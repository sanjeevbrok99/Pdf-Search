create extension if not exists "vector" with schema "public";

-- Create enum for processing status
create type processing_status as enum ('pending', 'processing', 'completed', 'error');

-- Create the documents table
create table if not exists public.documents (
    id uuid default gen_random_uuid() primary key,
    url text not null,
    title text not null,
    content text,
    preview_image_url text,
    total_pages integer,
    grade_level text,
    status processing_status default 'pending',
    error_message text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the relevant_pages table
create table if not exists public.relevant_pages (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade,
    query text not null,
    start_page integer not null,
    end_page integer not null,
    relevance_score float not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the search_history table
create table if not exists public.search_history (
    id uuid default gen_random_uuid() primary key,
    query text not null,
    grade_level text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the search_results_cache table
create table if not exists public.search_results_cache (
    id uuid default gen_random_uuid() primary key,
    query text not null,
    grade_level text,
    document_ids uuid[] not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    expires_at timestamp with time zone not null
);

-- Enable full text search for documents
alter table public.documents add column if not exists content_search tsvector
    generated always as (to_tsvector('english', coalesce(content, ''))) stored;

-- Create indexes
create index if not exists documents_content_search_idx on public.documents using gin(content_search);
create index if not exists documents_grade_level_idx on public.documents(grade_level);
create index if not exists documents_status_idx on public.documents(status);
create index if not exists relevant_pages_document_query_idx on public.relevant_pages(document_id, query);
create index if not exists search_history_query_idx on public.search_history(query);
create index if not exists search_history_created_at_idx on public.search_history(created_at desc);
create index if not exists search_results_cache_query_idx on public.search_results_cache(query, grade_level);
create index if not exists search_results_cache_expires_idx on public.search_results_cache(expires_at);

-- Enable row level security
alter table public.documents enable row level security;
alter table public.relevant_pages enable row level security;
alter table public.search_history enable row level security;
alter table public.search_results_cache enable row level security;

-- Create policies that allow all operations for now
create policy "Enable all operations for documents" on public.documents for all using (true);
create policy "Enable all operations for relevant_pages" on public.relevant_pages for all using (true);
create policy "Enable all operations for search_history" on public.search_history for all using (true);
create policy "Enable all operations for search_results_cache" on public.search_results_cache for all using (true);

-- Create a function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Create a trigger to automatically update updated_at
create trigger update_documents_updated_at
    before update on public.documents
    for each row
    execute function update_updated_at_column();

-- Add unique constraint on url
ALTER TABLE documents
ADD CONSTRAINT unique_url UNIQUE (url);

ALTER TABLE documents
ADD COLUMN start_page INTEGER,
ADD COLUMN end_page INTEGER,
