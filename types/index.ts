export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

export type Document = {
  id: string;
  url: string;
  title: string;
  content: string | null;
  preview_image_url: string | null;
  total_pages: number | null;
  grade_level: string | null;
  status: ProcessingStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  pdf_url?: string; // URL to download the PDF file
};

export type RelevantPages = {
  id: string;
  document_id: string;
  query: string;
  start_page: number;
  end_page: number;
  relevance_score: number;
  created_at: string;
};

export type SearchHistory = {
  id: string;
  query: string;
  grade_level: string | null;
  created_at: string;
};

export type SearchResultsCache = {
  id: string;
  query: string;
  grade_level: string | null;
  document_ids: string[];
  created_at: string;
  expires_at: string;
};

export type SearchResult = Document & {
  relevantPages: {
    start_page: number;
    end_page: number;
    relevance_score: number;
  };
};