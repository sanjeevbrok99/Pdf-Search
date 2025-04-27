import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ProcessingStatus } from '@/types'
import DocReaderService from '../process-pdf/DocReader'
import redis from '@/lib/redis';
import SearchService from './SearchService'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const gradeLevel = searchParams.get('grade');
    const skipCache = searchParams.get('skipCache') === 'true';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }
    await redis.lpush('search-history', JSON.stringify({ query, createdAt: Date.now() }));

    const cacheKey = `search:${query}:${gradeLevel || 'all'}`;

    if (!skipCache) {
      try {
        // Retrieve the list of documents from Redis
        const cachedResults = await redis.lrange(cacheKey, 0, -1);
        if (cachedResults && cachedResults.length > 0) {
          // Parse each item in the list
          const parsedResults = cachedResults.map((item) => JSON.parse(item));
          return NextResponse.json({
            documents: parsedResults,
            fromCache: true,
          });
        }
      } catch (error) {
        console.error(`Error retrieving cache for ${cacheKey}:`, error);
      }
    }

    const googleResults = await SearchService.searchGoogleForPDFs(query, gradeLevel || undefined);

    const validatedResults = await Promise.all(
      googleResults.map(async (result: any) => {
        const isValidPDF = await SearchService.validatePDFUrl(result.link);
        if (isValidPDF) return result;
        console.warn(`Skipping invalid PDF URL: ${result.link}`);
        return null;
      })
    );

    const validPDFs = validatedResults.filter(Boolean);

    const processedPDFs = await Promise.all(
      validPDFs.map(async (result: any) => {
        try {
          const pdfBuffer = await SearchService.downloadPDF(result.link);
          const { content, totalPages } = await DocReaderService.extractPageContent(pdfBuffer);

          if (!content || content.length === 0) {
            console.warn('Empty content from PDF:', result.link);
            return null;
          }

          return {
            link: result.link,
            title: result.title,
            content,
            totalPages
          };
        } catch (error) {
          console.error('Error processing PDF:', result.link, error);
          return null;
        }
      })
    );

    const readyPDFs = processedPDFs.filter(Boolean);

    if (readyPDFs.length === 0) {
      return NextResponse.json({ documents: [], fromCache: false });
    }

    const savedDocuments = await Promise.all(
      readyPDFs.map(async (pdf: any) => {
        const { data: doc, error } = await supabase
          .from('documents')
          .upsert({
            url: pdf.link,
            title: pdf.title,
            status: 'pending' as ProcessingStatus,
            grade_level: gradeLevel || null,
            content: pdf.content,
            total_pages: pdf.totalPages,
            preview_image_url: null,
            error_message: null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'url' })
          .select()
          .single();
        if (error) {
          console.error('Failed to save document:', pdf.link, error);
          return null;
        }
        return doc;
      })
    );

    const docsToProcess = savedDocuments.filter(Boolean);

    const baseUrl = process.env.VERCEL_URL
      ? `${process.env.VERCEL_URL}`
      : 'http://localhost:3001';

      const processDocsInBatch = async (docsToProcess: any[], batchSize: number = 5) => {
        // Function to process docs in smaller batches to avoid overwhelming the server
        for (let i = 0; i < docsToProcess.length; i += batchSize) {
          const batch = docsToProcess.slice(i, i + batchSize);

          await Promise.all(
            batch.map(async (doc) => {
              try {
                // Sending document for processing
                const response = await fetch(`${baseUrl}/api/process-pdf`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ documentId: doc.id, url: doc.url, query }),
                });

                if (!response.ok) {
                  throw new Error(`Failed to process PDF: ${doc.url} - ${response.statusText}`);
                }
              } catch (error) {
                console.error('Failed to process PDF:', doc.url, error);
              }
            })
          );
        }
      };

      const waitForDocumentsCompletion = async (docsToProcess: any[]) => {
        return Promise.all(
          docsToProcess.map(async (doc) => {
            try {
              const completedDoc = await SearchService.waitForDocumentCompletion(doc.id);
              return completedDoc;
            } catch (err) {
              console.error('Timeout processing doc:', doc.url, err);
              return null;
            }
          })
        );
      };

      // Process documents in smaller batches
      await processDocsInBatch(docsToProcess);

      // Wait for all documents to be processed
      const completedDocs = await waitForDocumentsCompletion(docsToProcess);

      const finalDocuments = completedDocs.filter(Boolean);

   if(finalDocuments.length>0){
    await SearchService.cacheDocuments(cacheKey, finalDocuments,gradeLevel);
   }
    return NextResponse.json({
      documents: finalDocuments,
      fromCache: false
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
