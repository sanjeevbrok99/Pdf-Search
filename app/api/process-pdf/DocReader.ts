import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import axios from 'axios';

const server = process.env.DOC_READER_SERVER;
const accessToken = process.env.DOC_READER_TOKEN;

class DocReaderService {
  // Download PDF from URL and send for processing
  static async sendDocForProcessing(url: string, documentId: string) {
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
    });
  }

  // Extract text and total pages from PDF buffer
  static async extractPageContent(buffer: Buffer): Promise<{
    content: string;
    totalPages: number;
  }> {
    try {
      const data = await pdfParse(buffer);
      return {
        content: data.text,
        totalPages: data.numpages
      };
    } catch (error) {
      console.error('Error extracting PDF content:', error);
      throw new Error('Failed to extract PDF content');
    }
  }

  // Ask question from Doc Reader AI
  static async askQuestionFromDocReader(documentId: string, query: string) {
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
          - No explanations, comments, or extra text.
          - If answer found on single page, Start = End page.
          - If no answer found, return Start page: 1 and End page: 1.
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

    const startPageMatch = responseText.match(/Start page:\s*(\d+)/i);
    const endPageMatch = responseText.match(/End page:\s*(\d+)/i);

    let startPage = startPageMatch ? parseInt(startPageMatch[1], 10) : 1;
    let endPage = endPageMatch ? parseInt(endPageMatch[1], 10) : startPage;

    if (startPage > endPage) [startPage, endPage] = [endPage, startPage];

    return { startPage, endPage };
  }

  // Generate Preview Image from first page of PDF
  static async generatePreviewImage(pdfUrl: string) {
    const id = uuidv4();
    const tmpPdfPath = path.join('/tmp', `preview-${id}.pdf`);
    const tmpImagePath = tmpPdfPath.replace('.pdf', '.jpg');

    const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(tmpPdfPath, response.data);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(`file://${tmpPdfPath}`, { waitUntil: 'networkidle0' });

    const imageBuffer = await page.screenshot({
      fullPage: true,
      type: 'jpeg',
      quality: 80,
    });

    await browser.close();

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
  }

  static async  indexDocument(indexName: string): Promise<any> {
    const url = `${server}/doc/index-status`; // Your server URL here
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}` // Assuming you have an access token
    };

    const body = JSON.stringify({
      index_name: indexName
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Indexing failed: ${data.error || 'Unknown error'}`);
      }

      return data; // This should contain the status of the indexing process
    } catch (error:any) {
      console.error('Indexing error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default DocReaderService;
