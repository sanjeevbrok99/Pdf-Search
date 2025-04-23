import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Check if bucket exists
async function checkBucketExists() {
  const { data: buckets } = await supabase
    .storage
    .listBuckets()

  const pdfsBucketExists = buckets?.some(bucket => bucket.name === 'pdfs')

  if (!pdfsBucketExists) {
    throw new Error('PDF storage bucket not found. Please create a bucket named "pdfs" in your Supabase dashboard.')
  }
}

export async function POST(request: Request) {
  try {

    // Check if bucket exists
    await checkBucketExists()
    console.log('Bucket check completed')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const gradeLevel = formData.get('gradeLevel') as string

    console.log('Received file:', {
      name: file?.name,
      type: file?.type,
      size: file?.size,
      gradeLevel
    })

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    // Upload file to Supabase Storage
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('pdfs')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      })

    if (storageError) {
      throw new Error(`Failed to upload file: ${storageError.message}`)
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('pdfs')
      .getPublicUrl(fileName)

    // Create document record with the storage URL
    const { data, error } = await supabase
      .from('documents')
      .insert({
        title: file.name,
        url: publicUrlData.publicUrl,
        grade_level: gradeLevel,
        content: null,
        status: 'pending',
        total_pages: null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ document: data })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
