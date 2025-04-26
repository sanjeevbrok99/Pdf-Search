import { NextResponse } from 'next/server'
import { supabase, searchGoogleForPDFs, getSearchResultsFromCache, saveSearchHistory } from '@/lib/supabase'
import { ProcessingStatus, SearchResult } from '@/types'
import { downloadPDF, extractPageContent } from '../process-pdf/route'

// Helper function to filter valid documents
function filterValidDocuments(docs: any[]) {
  return docs.filter(doc =>
    doc.preview_image_url !== null &&
    doc.status === 'completed'
  )
}

async function waitForDocumentCompletion(documentId: string, timeoutMs = 130000, intervalMs = 1000): Promise<any> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (doc && doc.status === 'completed' && doc.preview_image_url ) {
      return doc
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error('Timeout waiting for document processing')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const gradeLevel = searchParams.get('grade')
    const timestamp = searchParams.get('timestamp')
    const skipCache = searchParams.get('skipCache') === 'true'

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    // Save search to history
    await saveSearchHistory(query, gradeLevel || undefined)

    // Only check cache if no timestamp is provided
    if (!timestamp && !skipCache) {
      // Check cache first
      const cachedResults = await getSearchResultsFromCache(query, gradeLevel || undefined)
      if (cachedResults) {
        // For cached results, only show completed documents
        const validCachedDocs = filterValidDocuments(cachedResults)
        if (validCachedDocs.length > 0) {
          return NextResponse.json({
            documents: validCachedDocs,
            fromCache: true
          })
        }
      }
    }

    // Start Google Search
    const googleResults = await searchGoogleForPDFs(query, gradeLevel || undefined)

    // Process each result
    const processPromises = googleResults.map(async (result: any) => {
      try {
        // Step 1: Try to download PDF first
        const pdfBuffer = Buffer.from(await downloadPDF(result.link))

        // Step 2: Try to extract page content
        const { content, totalPages } = await extractPageContent(pdfBuffer)

        if (!content || content.length === 0) {
          console.warn('Empty content from PDF:', result.link)
          return null // skip this document
        }

        // Step 3: Now safe to save to DB
        const { data: doc, error } = await supabase
          .from('documents')
          .upsert({
            url: result.link,
            title: result.title,
            status: 'pending' as ProcessingStatus,
            grade_level: gradeLevel || null,
            content:content ,
            total_pages: totalPages,
            preview_image_url: null,
            error_message: null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'url'
          })
          .select()
          .single()

        if (error) throw error

        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3001'

        // Step 4: Call process-pdf API
        await fetch(`${baseUrl}/api/process-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: doc.id,
            url: result.link,
            query
          })
        })

        // Step 5: Wait for document completion
        const completedDoc = await waitForDocumentCompletion(doc.id)
        return completedDoc
      } catch (error) {
        console.error('Skipping invalid PDF link:', result.link, error)
        return null // Skip invalid/broken pdfs
      }
    })

    // Finally, after Promise.all
    const allDocuments = (await Promise.all(processPromises)).filter(Boolean)

    // Cache all documents (including invalid ones, they might be processed later)
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + Number(process.env.SEARCH_CACHE_DURATION || 3600))

    await supabase
      .from('search_results_cache')
      .insert({
        query,
        grade_level: gradeLevel || null,
        document_ids: allDocuments.map(doc => doc.id),
        expires_at: expiresAt.toISOString()
      })

    // Return documents, including pending ones for first search
    return NextResponse.json({
      documents: allDocuments,
      fromCache: false
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
}

// Streaming endpoint for getting updates on processing documents
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const documentIds = searchParams.get('documentIds')?.split(',')

  if (!documentIds?.length) {
    return NextResponse.json({ error: 'Document IDs are required' }, { status: 400 })
  }

  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('*, relevant_pages(*)')
      .in('id', documentIds)
      .order('created_at', { ascending: false })

    if (error) throw error

    const results: SearchResult[] = documents.map(doc => ({
      ...doc,
      relevantPages: doc.relevant_pages?.[0] || undefined
    }))

    return NextResponse.json({ documents: results })
  } catch (error) {
    console.error('Update check error:', error)
    return NextResponse.json(
      { error: 'Failed to check for updates' },
      { status: 500 }
    )
  }
}
