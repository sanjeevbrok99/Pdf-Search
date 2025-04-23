import { NextResponse } from 'next/server'
import { supabase, updateDocumentStatus } from '@/lib/supabase'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import puppeteer from 'puppeteer';

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

export const generatePreviewImage = async (pdfBuffer: Buffer): Promise<string> => {
  const id = uuidv4();
  const tmpPdfPath = path.join('/tmp', `preview-${id}.pdf`);
  const tmpImagePath = tmpPdfPath.replace('.pdf', '.jpg');

  // Save PDF buffer to temp file
  await fs.writeFile(tmpPdfPath, pdfBuffer);

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Load PDF as file
  await page.goto(`file://${tmpPdfPath}`, {
    waitUntil: 'networkidle0',
  });

  // Take a screenshot
  const imageBuffer = await page.screenshot({
    fullPage: true,
    type: 'jpeg',
    quality: 80,
  });

  await browser.close();

  // Upload to Supabase
  const { error } = await supabase.storage
    .from('image-previews')
    .upload(`preview-${id}.jpg`, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('image-previews')
    .getPublicUrl(`preview-${id}.jpg`);

  return data.publicUrl;
};

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
