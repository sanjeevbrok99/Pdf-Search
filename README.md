# PDF Search and Analysis Application

A modern web application that enables users to upload, parse, and search through PDF documents efficiently. Built with Next.js 13+, TypeScript, and advanced PDF processing capabilities.

## Features

- PDF document upload and processing
- Advanced text extraction using pdf-parse
- Server-side PDF processing with robust error handling
- Modern UI built with Next.js and Tailwind CSS
- Real-time search functionality
- Supabase integration for data persistence

## Technical Stack

- **Frontend**: Next.js 13+ (App Router), TypeScript, Tailwind CSS
- **PDF Processing**: pdf-parse, pdfjs-dist (v5.1.91)
- **Backend**: Next.js API Routes
- **Database**: Supabase
- **Styling**: shadcn/ui components

## Setup and Installation

1. `bun i` to install deps
2. Ensure to add .example.env environment variables for supabase and google search to work
3. `bun dev` to start local dev environment
4. Visit `/` route on localhost to see the mock UI

## Implementation Details

### PDF Processing
- Utilizes `pdf-parse` with optimized Buffer handling
- Implements unlimited page processing with `max: 0` option
- Proper error handling for PDF downloads and processing

### PDF.js Integration
- Uses `pdfjs-dist` v5.1.91
- Worker configuration via CDN URL
- Modern import system using `require('pdfjs-dist')`
