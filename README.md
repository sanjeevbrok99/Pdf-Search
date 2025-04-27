# 📚 PDF Search and Analysis Application

A modern web application that enables users to upload, parse, and search through PDF documents efficiently. Built with Next.js 13+, TypeScript, and advanced PDF processing capabilities. This application integrates various services like Google Custom Search, Redis caching, Puppeteer for image previews, and Supabase for data storage.

---

## ✨ Features

- 📄 **PDF Document Upload and Processing**: Seamlessly upload and parse PDF files on the server.
- 🧠 **Advanced Text Extraction**: Efficiently extract text and metadata using `pdf-parse`.
- 🛠️ **Server-Side PDF Processing**: Robust error handling ensures smooth and reliable PDF processing.
- 🎨 **Modern UI**: Built with Next.js and Tailwind CSS for a sleek and responsive user interface.
- 🔍 **Real-Time Search Functionality**: Search through indexed PDFs instantly based on user queries.
- 🧑‍💻 **Google Custom Search API**: Search the web for PDF links, ensuring relevant results for users.
- 🔄 **Redis Caching**: Cache search results and document metadata for faster future queries.
- 🎨 **Puppeteer for Image Previews**: Generate image previews of PDFs using Puppeteer for better UX.
- 🛢️ **Supabase Integration**: Store and manage documents and metadata persistently in Supabase.

---

## 🛠️ Technical Stack

- **Frontend**:
  Next.js 13+ (App Router), TypeScript, Tailwind CSS
- **PDF Processing**:
  pdf-parse, pdfjs-dist (v5.1.91)
- **Backend**:
  Next.js API Routes
- **Database**:
  Supabase
- **Search**:
  Google Custom Search API
- **Caching**:
  Redis
- **Image Preview**:
  Puppeteer
- **Styling**:
  shadcn/ui components

---

## 🚀 Setup and Installation

1. `bun i` to install deps
2. Ensure to add .example.env environment variables for supabase and google search to work
3. `bun dev` to start local dev environment
4. Visit `/` route on localhost to see the mock UI

## 🛠️ Implementation Details

### 📄 PDF Processing
- **Optimized Buffer Handling**: Utilizes `pdf-parse` for efficient, memory-safe PDF processing, allowing handling of large PDF files without overloading memory.
- **Unlimited Page Processing**: Supports processing PDFs with an unlimited number of pages by using the `max: 0` option, ensuring that all pages are processed without restriction.
- **Error Handling**: Implements robust error handling for PDF downloads and processing, ensuring smooth operation even when documents encounter issues (e.g., malformed PDFs).
- **Parallel Processing**: Downloads and parses multiple PDFs simultaneously for improved performance, leveraging asynchronous operations with `Promise.all`.
- **Timeout Configurations**: Configures timeouts for PDF downloads and processing to ensure that long-running tasks do not hang indefinitely.

### 🔍 Google Custom Search Integration
- **Search PDFs via Google**: Uses the Google Custom Search API to fetch PDF links based on user queries.
- **PDF Validation**: Filters search results to only include real PDFs (based on file extensions and Content-Type headers).
- **Caching Results**: Stores search results in Redis for faster future queries and reduced API calls.
- **Search Results Metadata**: Extracts metadata from search results and stores them in Supabase, ensuring quick retrieval of document details.

### 🧠 PDF.js Integration
- **PDF.js v5.1.91**: Uses `pdfjs-dist` v5.1.91 for parsing and rendering PDFs when more complex handling or rendering is needed.
- **Worker Configuration**: Configures PDF.js workers via a CDN URL, ensuring lightweight builds and offloading heavy computations to web workers.
- **Modern Import System**: Imports `pdfjs-dist` using `require('pdfjs-dist')`, allowing for easy integration with the backend and frontend, optimizing both functionality and performance.

### 🔄 Redis Caching
- **Search Caching**: Caches Google search results in Redis to reduce query times and speed up the search process for users.
- **Document Metadata Caching**: Caches metadata of processed PDFs in Redis, ensuring faster access and retrieval for subsequent searches or document accesses.
- **Cache Expiry**: Manages cache expiration and invalidation to ensure that cached search results and metadata remain up-to-date.

### 🎨 Puppeteer Image Preview
- **Image Generation**: Uses Puppeteer to generate preview images for uploaded PDFs, providing a visual representation of the document before full processing.
- **Image Preview in Search Results**: Previews (thumbnails) of PDFs are generated during the search process to give users a quick view of the document's contents.
- **Headless Browsing**: Operates Puppeteer in a headless mode, ensuring that PDF previews are generated efficiently without the need for a graphical interface.

### 🧑‍💻 Supabase Integration
- **Document and Metadata Storage**: Stores uploaded PDFs and their metadata in Supabase, allowing for long-term persistence and retrieval.
- **Real-Time Search**: Indexes document metadata (like title, author, keywords) in Supabase for fast querying, enabling real-time search results for users.
- **Data Integrity**: Ensures that all stored data is valid and properly indexed in Supabase to maintain data integrity and prevent errors in document retrieval.

### 🚀 Real-Time Search and Document Processing
- **Document Polling**: Users can poll the server to track the real-time processing status of uploaded documents, ensuring a smooth user experience as documents are processed in the background.
- **Real-Time Updates**: Search queries are pushed to Redis and can be used for future analytics or personalized recommendations.
- **Parallel Processing**: Multiple documents can be processed simultaneously, reducing waiting times and improving the efficiency of the system.


