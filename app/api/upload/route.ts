import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Check if bucket exists
async function checkBucketExists() {
  const { data: buckets } = await supabase
    .storage
    .listBuckets()

  console.log('Buckets:', buckets)

  const pdfsBucketExists = buckets?.some(bucket => bucket.name === 'pdfs')

  if (!pdfsBucketExists) {
    throw new Error('PDF storage bucket not found. Please create a bucket named "pdfs" in your Supabase dashboard.')
  }
}

export async function POST(request: Request) {
  try {
    console.log('Starting file upload process...')
    debugger; // Debugger point 1: Start of upload

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

    // Convert File to Buffer for Supabase storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    console.log('Prepared file for upload:', { fileName })
    debugger; // Debugger point 2: Before storage upload

    // Upload file to Supabase Storage
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('pdfs')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      })

    console.log('Storage upload result:', { storageData, storageError })
    debugger; // Debugger point 3: After storage upload

    if (storageError) {
      throw new Error(`Failed to upload file: ${storageError.message}`)
    }

    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase
      .storage
      .from('pdfs')
      .getPublicUrl(fileName)

    console.log('Got public URL:', publicUrlData)
    debugger; // Debugger point 4: Before database insert

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

    console.log('Database insert result:', { data, error })
    debugger; // Debugger point 5: After database insert

    if (error) throw error

    return NextResponse.json({ document: data })
  } catch (error) {
    console.error('Upload error:', error)
    debugger; // Debugger point 6: Error handling
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
