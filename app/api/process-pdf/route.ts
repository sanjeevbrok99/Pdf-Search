import { NextResponse } from 'next/server'
import { supabase, updateDocumentStatus } from '@/lib/supabase'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { fromBuffer } from 'pdf2pic'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
// Download PDF from URL and return as ArrayBuffer
async function downloadPDF(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download PDF: ${response.statusText}`)
  return response.arrayBuffer()
}

// Extract text content and total pages from a PDF Buffer
async function extractPageContent(buffer: Buffer): Promise<{
  content: string
  totalPages: number
}> {
  try {
    const data = await pdfParse(buffer)
    const content = data.text
    const totalPages = data.numpages

    return {
      content,
      totalPages
    }
  } catch (error) {
    console.error('Error extracting PDF content:', error)
    throw new Error('Failed to extract PDF content')
  }
}

// Placeholder preview image URL generator

async function generatePreviewImage(buffer: Buffer): Promise<string> {
  const filename = `preview-${uuidv4()}.png`
  const tmpDir = '/tmp'
  const outputPath = path.join(tmpDir, filename)

  // Ensure /tmp directory exists
  try {
    await fs.access(tmpDir)
  } catch {
    await fs.mkdir(tmpDir, { recursive: true })
  }

  const converter = fromBuffer(buffer, {
    density: 100,
    saveFilename: filename,
    savePath: tmpDir,
    format: 'png',
    width: 600,
    height: 800,
  })

  // Convert first page to image
  await converter(1)

  // Verify the file exists before trying to read it
  await fs.access(outputPath)

  // Upload the image to Supabase Storage
  const fileData = await fs.readFile(outputPath)

  const { data, error } = await supabase.storage
    .from('image-previews')
    .upload(filename, fileData, {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) throw error

  const publicURL = supabase.storage.from('image-previews').getPublicUrl(filename).data.publicUrl

  return publicURL
}

// Simple relevance calculation based on query terms frequency
async function findRelevantPages(
  content: string,
  query: string,
  totalPages: number
): Promise<{
  startPage: number
  endPage: number
  relevanceScore: number
}> {
  const queryTerms = query.toLowerCase().split(' ')
  const contentLower = content.toLowerCase()

  const termFrequency = queryTerms.reduce((count, term) => {
    const regex = new RegExp(term, 'g')
    const matches = contentLower.match(regex)
    return count + (matches ? matches.length : 0)
  }, 0)

  const relevanceScore = Math.min(termFrequency / 10, 1)

  return {
    startPage: 1,
    endPage: Math.min(5, totalPages),
    relevanceScore
  }
}

// POST handler for processing the PDF
export async function POST(request: Request) {
  try {
    const { documentId, url, query } = await request.json()

    // Set document status to 'processing'
    await updateDocumentStatus(documentId, 'processing')

    try {
      // Download and parse the PDF
      const pdfBuffer = Buffer.from(await downloadPDF(url))

      const { content, totalPages } = await extractPageContent(pdfBuffer)

      const previewImageUrl = await generatePreviewImage(pdfBuffer)

      const relevantPages = await findRelevantPages(content, query, totalPages)

      // Update the document with extracted details
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

      // Insert relevant page info
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

  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}
