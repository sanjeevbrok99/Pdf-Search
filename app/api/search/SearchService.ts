import axios from 'axios';
import { supabase } from '@/lib/supabase';
import redis from '@/lib/redis';

const cacheDuration: any = process.env.SEARCH_CACHE_DURATION;
const googleSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY
const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

export default class SearchService {
  static async filterValidDocuments(docs: any[]) {
    return docs.filter(doc => doc.preview_image_url !== null && doc.status === 'completed');
  }

  static async validatePDFUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 3000,
        headers: { 'Accept': 'application/pdf' },
        maxRedirects: 3,
      });
      const contentType = response.headers['content-type'];
      return contentType && contentType.includes('application/pdf');
    } catch (error) {
      console.error('Validation failed for URL:', url, error);
      return false;
    }
  }

  static async downloadPDF(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'Accept': 'application/pdf' }
      });
      if (response.status !== 200) {
        throw new Error(`Failed to download PDF. Status: ${response.status}`);
      }
      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('Error downloading PDF:', url, error.message);
      throw new Error('Failed to download PDF');
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

  static async cacheDocuments(cacheKey: string, documents: any[]) {
    await redis.rpush(cacheKey, JSON.stringify(documents));
    await redis.expire(cacheKey, cacheDuration);
  }

  static async searchGoogleForPDFs(query: string, grade?: string): Promise<any[]> {
    const gradeQuery = grade ? ` "Grade ${grade}"` : ''
    const fullQuery = `${query}${gradeQuery} filetype:pdf`

    const url = `https://www.googleapis.com/customsearch/v1?key=${googleSearchApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(fullQuery)}`

    const response = await fetch(url)
    const data = await response.json()

    return data.items || []
  }
}
