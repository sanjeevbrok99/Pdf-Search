import { NextResponse } from 'next/server'
import { supabase, searchGoogleForPDFs, getSearchResultsFromCache, saveSearchHistory } from '@/lib/supabase'
import { ProcessingStatus, SearchResult } from '@/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const gradeLevel = searchParams.get('grade')
  const skipCache = searchParams.get('skipCache') === 'true'

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    // Save search to history
    await saveSearchHistory(query, gradeLevel || undefined)

    // Check cache first
    if (!skipCache) {
      const cachedResults = await getSearchResultsFromCache(query, gradeLevel || undefined)
      if (cachedResults) {
        return NextResponse.json({
          documents: cachedResults,
          fromCache: true
        })
      }
    }

    // Start Google Search
    const googleResults = await searchGoogleForPDFs(query, gradeLevel || undefined)

    // Process each result
    const processPromises = googleResults.map(async (result: any) => {
      // Check if document already exists
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('*')
        .eq('url', result.link)
        .single()

      if (existingDoc) {
        return existingDoc
      }

      // Create new document
      const { data: newDoc, error } = await supabase
        .from('documents')
        .insert({
          url: result.link,
          title: result.title,
          status: 'pending' as ProcessingStatus,
          grade_level: gradeLevel || null
        })
        .select()
        .single()

      if (error) throw error

      // Start background processing
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3001'  // Use the port that's currently active

      fetch(`${baseUrl}/api/process-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: newDoc.id,
          url: result.link,
          query
        })
      }).catch(console.error) // Non-blocking

      return newDoc
    })

    // Get initial results
    const initialDocuments = await Promise.all(processPromises)

    // Cache the results
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + Number(process.env.SEARCH_CACHE_DURATION || 3600))

    await supabase
      .from('search_results_cache')
      .insert({
        query,
        grade_level: gradeLevel || null,
        document_ids: initialDocuments.map(doc => doc.id),
        expires_at: expiresAt.toISOString()
      })

    return NextResponse.json({
      documents: initialDocuments,
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
