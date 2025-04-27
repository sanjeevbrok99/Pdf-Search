import { NextResponse } from 'next/server'
import { supabase, searchGoogleForPDFs, getSearchResultsFromCache, saveSearchHistory } from '@/lib/supabase'
import { ProcessingStatus, SearchResult } from '@/types'
import { extractPageContent } from '../process-pdf/route'
import axios from 'axios'
import redis from '@/lib/redis';
const casheDuration:any = process.env.SEARCH_CACHE_DURATION

// Helper function to filter valid documents
function filterValidDocuments(docs: any[]) {
  return docs.filter(doc =>
    doc.preview_image_url !== null &&
    doc.status === 'completed'
  )
}
async function validatePDFUrl(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url, {
      timeout: 3000,
      headers: {
        'Accept': 'application/pdf'
      },
      maxRedirects: 3
    })

    const contentType = response.headers['content-type']
    return contentType && contentType.includes('application/pdf')
  } catch (error) {
    console.error('Validation failed for URL:', url, error)
    return false
  }
}
export const  downloadPDF =  async(url: string): Promise<Buffer> =>{
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'Accept': 'application/pdf'
      }
    })

    if (response.status !== 200) {
      throw new Error(`Failed to download PDF. Status: ${response.status}`)
    }

    return Buffer.from(response.data)
  } catch (error: any) {
    console.error('Error downloading PDF:', url, error.message)
    throw new Error('Failed to download PDF')
  }
}
async function waitForDocumentCompletion(documentId: string, timeoutMs = 130000, intervalMs = 3000): Promise<any> {
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

    const searchHistory = JSON.stringify({
      query: query,
      created_at: new Date().toISOString()
    });

    // Push the search history object to the Redis list
    await redis.lpush('search-history', searchHistory);

    const cacheKey = `search:${query}:${gradeLevel || 'all'}`;

     if (!skipCache) {
      const cachedResults = await redis.get(cacheKey);
      if (cachedResults) {
        // Return cached results if found
        return NextResponse.json({
          documents: JSON.parse(cachedResults),
          fromCache: true
        });
      }
    }

    // Step 1: Google Search
    const googleResults = await searchGoogleForPDFs(query, gradeLevel || undefined)

    // Step 2: Validate all PDFs in parallel
    const validatedResults = await Promise.all(
      googleResults.map(async (result: any) => {
        const isValidPDF = await validatePDFUrl(result.link)
        if (isValidPDF) return result
        console.warn(`Skipping invalid PDF URL: ${result.link}`)
        return null
      })
    )

    const validPDFs = validatedResults.filter(Boolean)

    // Step 3: Download all PDFs and extract content in parallel
    const processedPDFs = await Promise.all(
      validPDFs.map(async (result: any) => {
        try {
          const pdfBuffer = await downloadPDF(result.link)
          const { content, totalPages } = await extractPageContent(pdfBuffer)

          if (!content || content.length === 0) {
            console.warn('Empty content from PDF:', result.link)
            return null
          }

          return {
            link: result.link,
            title: result.title,
            content,
            totalPages
          }
        } catch (error) {
          console.error('Error processing PDF:', result.link, error)
          return null
        }
      })
    )

    const readyPDFs = processedPDFs.filter(Boolean)

    if (readyPDFs.length === 0) {
      return NextResponse.json({ documents: [], fromCache: false })
    }

    ; // Cache for 1 hour by default
    await redis.rpush(cacheKey, JSON.stringify(readyPDFs));
    await redis.expire(cacheKey, casheDuration);

    // Step 4: Save all PDFs into DB in parallel
    const savedDocuments = await Promise.all(
      readyPDFs.map(async (pdf: any) => {
        const { data: doc, error } = await supabase
          .from('documents')
          .upsert({
            url: pdf.link,
            title: pdf.title,
            status: 'pending' as ProcessingStatus,
            grade_level: gradeLevel || null,
            content: pdf.content,
            total_pages: pdf.totalPages,
            preview_image_url: null,
            error_message: null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'url'
          })
          .select()
          .single()

        if (error) {
          console.error('Failed to save document:', pdf.link, error)
          return null
        }

        return doc
      })
    )

    const docsToProcess = savedDocuments.filter(Boolean)

    // Step 5: Fire all /api/process-pdf calls in parallel
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3001'

    await Promise.all(
      docsToProcess.map(doc => {
        return fetch(`${baseUrl}/api/process-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: doc.id,
            url: doc.url,
            query
          })
        }).catch(error => {
          console.error('Failed to process PDF:', doc.url, error)
        })
      })
    )

    // Step 6: Wait for document processing completion in parallel
    const completedDocs = await Promise.all(
      docsToProcess.map(doc => waitForDocumentCompletion(doc.id).catch(err => {
        console.error('Timeout processing doc:', doc.url)
        return null
      }))
    )

    const finalDocuments = completedDocs.filter(Boolean)

    return NextResponse.json({
      documents: finalDocuments,
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

// // Streaming endpoint for getting updates on processing documents
// export async function POST(request: Request) {
//   const { searchParams } = new URL(request.url)
//   const documentIds = searchParams.get('documentIds')?.split(',')

//   if (!documentIds?.length) {
//     return NextResponse.json({ error: 'Document IDs are required' }, { status: 400 })
//   }

//   try {
//     const { data: documents, error } = await supabase
//       .from('documents')
//       .select('*, relevant_pages(*)')
//       .in('id', documentIds)
//       .order('created_at', { ascending: false })

//     if (error) throw error

//     const results: SearchResult[] = documents.map(doc => ({
//       ...doc,
//       relevantPages: doc.relevant_pages?.[0] || undefined
//     }))

//     return NextResponse.json({ documents: results })
//   } catch (error) {
//     console.error('Update check error:', error)
//     return NextResponse.json(
//       { error: 'Failed to check for updates' },
//       { status: 500 }
//     )
//   }
// }
