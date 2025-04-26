import { createClient } from '@supabase/supabase-js'
import { Document, SearchResult, SearchHistory, RelevantPages, SearchResultsCache } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const googleSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY
const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

if (!googleSearchApiKey || !googleSearchEngineId) {
  throw new Error('Missing Google Search API environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Google Search API function
export async function searchGoogleForPDFs(query: string, grade?: string): Promise<any[]> {
  const gradeQuery = grade ? ` "Grade ${grade}"` : ''
  const fullQuery = `${query}${gradeQuery} filetype:pdf`

  const url = `https://www.googleapis.com/customsearch/v1?key=${googleSearchApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(fullQuery)}`

  const response = await fetch(url)
  const data = await response.json()

  return data.items || []
}

// Function to check cache and return results if available
export async function getSearchResultsFromCache(query: string, grade?: string): Promise<SearchResult[] | null> {
  const { data: cache } = await supabase
    .from('search_results_cache')
    .select('*')
    .eq('query', query)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!cache) return null

  const { data: documents } = await supabase
    .from('documents')
    .select('*, relevant_pages!inner(*)')
    .in('id', cache.document_ids)
    .eq('relevant_pages.query', query)

  return documents?.map(doc => ({
    ...doc,
    relevantPages: doc.relevant_pages[0]
  })) || null
}

// Function to save search history
export async function saveSearchHistory(query: string, grade?: string): Promise<void> {
  await supabase
    .from('search_history')
    .insert({
      query,
      grade_level: grade || null
    })
}

// Function to get search history
export async function getSearchHistory(): Promise<SearchHistory[]> {
  const { data } = await supabase
    .from('search_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  return data || []
}

// Function to update document processing status
export async function updateDocumentStatus(
  id: string,
  status: 'processing' | 'completed' | 'error',
  errorMessage?: string
): Promise<void> {
  await supabase
    .from('documents')
    .update({
      status,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
}
