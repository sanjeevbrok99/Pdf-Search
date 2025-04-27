import { NextResponse } from 'next/server'
import { supabase, updateDocumentStatus } from '@/lib/supabase'
import DocReaderService from './DocReader'

// POST handler for processing the PDF
export async function POST(request: Request) {
  try {
    const { documentId, url, query, indexName } = await request.json()

    // Set document status to 'processing'
    await updateDocumentStatus(documentId, 'processing')

    try {

      // Step 1: Send PDF URL to Doc Reader Service
      await DocReaderService.sendDocForProcessing(url, documentId)

      const previewPromise = DocReaderService.generatePreviewImage(url)

      const previewImageUrl = await previewPromise;

      // Step 2: Ask question using Doc Reader Service
      const answer = await DocReaderService.askQuestionFromDocReader(documentId, query)

      await supabase
      .from('documents')
      .update({
        preview_image_url: previewImageUrl,
        status: 'completed',
        updated_at: new Date().toISOString(),
        start_page: answer.startPage,
        end_page: answer.endPage
      })
      .eq('id', documentId)

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

  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}
