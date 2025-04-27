import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
  sdk_code: "nodejs",
  sdk_semver: "1.37.0",
});
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
    console.log(data)
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
    const response = await fetch(pdfUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload the PDF with resource_type: 'image'
    const uploadResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: `previews/${Date.now()}`,
          use_filename: true,
          unique_filename: false,
          overwrite: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // Generate the preview image URL
    const previewImageUrl = cloudinary.url(uploadResult.public_id, {
      transformation: [
        { width: 800, crop: 'scale' },
      ],
      page: 1,
      format: 'jpg',
      resource_type: 'image',
    });

    return previewImageUrl;
  }

  static async indexDocumentStatus(indexName: string): Promise<any> {
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
  static async waitForStatusDone(indexName: any, totalRetries = 60) {
    const errMsg = "Sorry! Doc reader failed to process the request.";
    let i = 0;
    let resolved = false;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        if (resolved) return;
        try {
          i++;
          console.log("checking status:", indexName);

          if (i > totalRetries) {
            clearInterval(interval);
            resolved = true;
            reject(new Error(errMsg));
            return;
          }

          const response = await this.indexDocumentStatus(indexName);

          if (!response || typeof response.status === 'undefined') {
            console.warn('Index status response invalid, retrying...', response);
            return;
          }

          console.log("status:", indexName, response.status);

          if (response.status === "done") {
            clearInterval(interval);
            resolved = true; // ✅ Set flag
            resolve("done");
            return;
          }

          if (response.status === "loading") {
            console.log(`Still loading: ${indexName}`);
            // continue waiting
          } else {
            clearInterval(interval);
            resolved = true;
            reject(new Error(errMsg));
            return;
          }

        } catch (err) {
          console.error("Error while checking index status:", err);
          clearInterval(interval);
          resolved = true;
          reject(new Error(errMsg));
        }
      }, 3000);
    });
  }

}

export default DocReaderService;
