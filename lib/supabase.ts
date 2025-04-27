import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
