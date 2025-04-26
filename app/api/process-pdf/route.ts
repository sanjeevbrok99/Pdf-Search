import { NextResponse } from 'next/server'
import { supabase, updateDocumentStatus } from '@/lib/supabase'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import puppeteer from 'puppeteer';
const server = process.env.DOC_READER_SERVER;
const accessToken = process.env.DOC_READER_TOKEN;
import axios from 'axios'

// Download PDF from URL and return as ArrayBuffer
async function sendDocForProcessing(url: string, documentId: string) {
  await fetch(`${server}/doc/process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      doc_urls: [url],
      index_name: `doc_${documentId}`
    })
  })
}
export const extractPageContent =  async(buffer: Buffer): Promise<{
  content: string
  totalPages: number
}> =>{
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
// async function waitForDocProcessing(documentId: string) {
//   const indexName = `doc_${documentId}`
//   let isReady = false
//   let retries = 0
//   while (!isReady && retries < 10) {
//     const res = await fetch(`${server}/doc/index-status`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({ index_name: indexName })
//     })
//     const data = await res.json()
//     if (data.status === 'ready') {
//       isReady = true
//     } else {
//       await new Promise(resolve => setTimeout(resolve, 3000)) // wait 3 seconds
//       retries++
//     }
//   }
//   if (!isReady) throw new Error('Doc processing timeout')
// }

export const askQuestionFromDocReader = async (documentId: string, query: string) => {
  const res = await fetch(`${server}/doc/qna`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      index_names: [`doc_${documentId}`],
      q: `
        You are an intelligent document search assistant.
        Given the user's query: "${query}" and the indexed document text across all pages,
        your task is to carefully search across all the pages and find the most relevant start page and end page.

        Instructions:
        - Respond ONLY in the following exact format:
          Start page: [number]
          End page: [number]
        - Do not include any explanation, comments, or extra text.
        - If the answer is found on a single page, Start page and End page must be the same.
        - Always ensure the start page number is less than or equal to the end page number.
        - If you cannot find the answer, return Start page: 1 and End page: 1.
      `,
      settings: {
        max_tokens: 500,
        temperature: 0.2,
        model_name: "gpt-3.5-turbo-16k",
        verbose: false
      }
    })
  });

  const data = await res.json();
  const responseText = data[0]?.result?.response ?? '';

  // Safely extract start and end page
  const startPageMatch = responseText.match(/Start page:\s*(\d+)/i);
  const endPageMatch = responseText.match(/End page:\s*(\d+)/i);

  let startPage = startPageMatch ? parseInt(startPageMatch[1], 10) : 1;
  let endPage = endPageMatch ? parseInt(endPageMatch[1], 10) : startPage; // fallback: endPage = startPage if missing

  // Ensure startPage <= endPage
  if (startPage > endPage) {
    [startPage, endPage] = [endPage, startPage]; // swap if needed
  }

  return {
    startPage,
    endPage
  };
};

// Placeholder preview image URL generator

export const generatePreviewImage = async (pdfUrl: string) => {
  const id = uuidv4();
  const tmpPdfPath = path.join('/tmp', `preview-${id}.pdf`);
  const tmpImagePath = tmpPdfPath.replace('.pdf', '.jpg');

  // Download PDF from URL directly into /tmp
  const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
  await fs.writeFile(tmpPdfPath, response.data);

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

// POST handler for processing the PDF
export async function POST(request: Request) {
  try {
    const { documentId, url, query } = await request.json()

    // Set document status to 'processing'
    await updateDocumentStatus(documentId, 'processing')

    try {

      // Step 1: Send PDF URL to Doc Reader Service
      await sendDocForProcessing(url, documentId) // function to call POST /doc/process
      const previewPromise = generatePreviewImage(url)

      // Step 2: Poll Doc Reader to check if processing is done
      // await waitForDocProcessing(documentId) // function to call POST /doc/index-status
      const previewImageUrl = await previewPromise;

      // Step 3: Ask question using Doc Reader Service
      const answer = await askQuestionFromDocReader(documentId, query)

      // Step 4: Update document details into your database
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
