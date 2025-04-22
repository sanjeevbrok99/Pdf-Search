import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const gradeLevel = formData.get('gradeLevel') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // For now, we'll just store the file name and grade level
    // In a real implementation, you'd want to:
    // 1. Upload the file to Supabase storage
    // 2. Extract text from the PDF
    // 3. Store the extracted text in the documents table
    const { data, error } = await supabase
      .from('documents')
      .insert({
        title: file.name,
        file_path: file.name, // In production, this would be the storage URL
        grade_level: gradeLevel,
        content: 'PDF content would go here', // This would be the extracted text
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ document: data })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
