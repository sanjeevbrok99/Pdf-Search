import { NextResponse } from 'next/server'
import { supabase, updateDocumentStatus } from '@/lib/supabase'
import DocReaderService from './DocReader'

// POST handler for processing the PDF
export async function POST(request: Request) {
  try {
    const { documentId, url, query } = await request.json()

    // Set document status to 'processing'
    await updateDocumentStatus(documentId, 'processing')

    try {

      const sendDocPromise = DocReaderService.sendDocForProcessing(url, documentId);

      // Start preview generation in parallel
      const previewPromise = DocReaderService.generatePreviewImage(url);

      await sendDocPromise;

      await DocReaderService.waitForStatusDone(`doc_${documentId}`);

      const answer = await DocReaderService.askQuestionFromDocReader(documentId, query);

      // Wait for preview image to finish
      const previewImageUrl = await previewPromise;

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

      return NextResponse.json({ success: true, status: 'completed', previewImageUrl, answer });

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
