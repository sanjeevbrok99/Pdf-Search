import { NextResponse } from 'next/server'
import { supabase, updateDocumentStatus } from '@/lib/supabase'
import { PDFExtract, PDFPage } from 'pdf.js-extract'

const pdfExtract = new PDFExtract()

async function downloadPDF(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download PDF: ${response.statusText}`)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function extractPageContent(buffer: Buffer): Promise<{
  content: string;
  totalPages: number;
}> {
  const data = await pdfExtract.extractBuffer(buffer)
  return {
    content: data.pages.map((page: PDFPage) => page.content.join(' ')).join(' '),
    totalPages: data.meta.numPages
  }
}

async function generatePreviewImage(buffer: Buffer): Promise<string> {
  // TODO: Implement PDF to image conversion
  // For now, return a placeholder
  return '/placeholder.png'
}

async function findRelevantPages(content: string, query: string, totalPages: number): Promise<{
  startPage: number;
  endPage: number;
  relevanceScore: number;
}> {
  // TODO: Implement more sophisticated page relevance detection
  // For now, return the first few pages
  return {
    startPage: 1,
    endPage: Math.min(5, totalPages),
    relevanceScore: 0.8
  }
}

export async function POST(request: Request) {
  try {
    const { documentId, url, query } = await request.json()

    // Update status to processing
    await updateDocumentStatus(documentId, 'processing')

    try {
      // Download and process PDF
      const pdfBuffer = await downloadPDF(url)
      
      // Extract content and metadata
      const { content, totalPages } = await extractPageContent(pdfBuffer)
      
      // Generate preview image
      const previewImageUrl = await generatePreviewImage(pdfBuffer)
      
      // Find relevant pages
      const relevantPages = await findRelevantPages(content, query, totalPages)

      // Update document with content and metadata
      await supabase
        .from('documents')
        .update({
          content,
          total_pages: totalPages,
          preview_image_url: previewImageUrl,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)

      // Store relevant pages information
      await supabase
        .from('relevant_pages')
        .insert({
          document_id: documentId,
          query,
          start_page: relevantPages.startPage,
          end_page: relevantPages.endPage,
          relevance_score: relevantPages.relevanceScore
        })

      return NextResponse.json({ success: true })
    } catch (processingError) {
      console.error('PDF processing error:', processingError)
      await updateDocumentStatus(
        documentId,
        'error',
        processingError instanceof Error ? processingError.message : 'Unknown error occurred'
      )
      return NextResponse.json(
        { error: 'Failed to process PDF' },
        { status: 500 }
      )
    }
  } catch (requestError) {
    console.error('Request error:', requestError)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
