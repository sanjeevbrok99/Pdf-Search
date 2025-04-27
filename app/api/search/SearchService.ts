import { supabase } from '@/lib/supabase';
import redis from '@/lib/redis';
import axios, { AxiosError } from 'axios';
import { URL } from 'url';

const cacheDuration: any = process.env.SEARCH_CACHE_DURATION;
const googleSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY
const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

export default class SearchService {
  static async filterValidDocuments(docs: any[]) {
    return docs.filter(doc => doc.preview_image_url !== null && doc.status === 'completed');
  }

  static async validatePDFUrl(url: string): Promise<boolean> {
    try {
      // Resolve Google redirect URLs (e.g., https://www.google.com/url?q=...)
      let resolvedUrl = url;
      if (url.includes('google.com/url')) {
        const urlObj = new URL(url);
        resolvedUrl = urlObj.searchParams.get('q') || url;
      }

      const response = await axios.head(resolvedUrl, {
        timeout: 5000,
        headers: {
          'Accept': 'application/pdf',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://www.google.com/',
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const contentType = response.headers['content-type'];
      // Allow common PDF content types
      return !!contentType && (
        contentType.includes('application/pdf') ||
        contentType.includes('application/octet-stream')
      );
    } catch (error: AxiosError | any) {
      console.error('Validation failed for URL:', url, {
        message: error.message,
        status: error.response?.status,
        headers: error.response?.headers,
      });
      return false;
    }
  }

static async downloadPDF(url: string): Promise<Buffer> {
  try {
    let resolvedUrl = url;
    if (url.includes('google.com/url')) {
      const urlObj = new URL(url);
      resolvedUrl = urlObj.searchParams.get('q') || url;
    }

    const response = await axios.get(resolvedUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'Accept': 'application/pdf',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.google.com/',
      },
      validateStatus: (status) => status >= 200 && status < 300,
      maxRedirects: 5,
    });

    // Verify content type is PDF
    const contentType = response.headers['content-type'];
    if (!contentType?.includes('application/pdf')) {
      throw new Error(`Invalid content type: ${contentType}. Expected application/pdf`);
    }

    return Buffer.from(response.data);
  } catch (error: any) {
    console.error('Error downloading PDF:', url, {
      message: error.message,
      status: error.response?.status,
      headers: error.response?.headers,
      data: error.response?.data?.toString().slice(0, 200),
    });
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
}

  static async waitForDocumentCompletion(documentId: string, timeoutMs = 130000, intervalMs = 3000): Promise<any> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();
      if (doc && doc.status === 'completed' && doc.preview_image_url) {
        return doc;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error('Timeout waiting for document processing');
  }

  static async cacheDocuments(cacheKey: string, documents: any[], gradeLevel:any) {
    // Append new documents to the existing list in Redis
    const documentsWithGrade = documents.map(doc => ({
      ...doc,
      gradeLevel: gradeLevel || 'all'
    }));

    await redis.rpush(cacheKey, ...documentsWithGrade.map(doc => JSON.stringify(doc)));

    // Set the expiration time for the cache
    await redis.expire(cacheKey, cacheDuration);
  }

  static async searchGoogleForPDFs(query: string, grade?: string): Promise<any[]> {
    const gradeQuery = grade ? ` "Grade ${grade}"` : ''
    const exactQuery = `"${query}"`;
    const fullQuery = `${exactQuery}${gradeQuery} filetype:pdf`;

    const url = `https://www.googleapis.com/customsearch/v1?key=${googleSearchApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(fullQuery)}`

    const response = await fetch(url)
    const data = await response.json()

    return data.items || []
  }
}
