create extension if not exists "vector" with schema "public";

-- Create the documents table
create table if not exists public.documents (
    id uuid default gen_random_uuid() primary key,
    url text not null,
    title text not null,
    content text,
    preview_image_url text,
    total_pages integer,
    grade_level text,
    status text null default 'pending'::text,
    error_message text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- Enable full text search for documents
alter table public.documents add column if not exists content_search tsvector
    generated always as (to_tsvector('english', coalesce(content, ''))) stored;

-- Create indexes
create index if not exists documents_content_search_idx on public.documents using gin(content_search);
create index if not exists documents_grade_level_idx on public.documents(grade_level);
create index if not exists documents_status_idx on public.documents(status);

-- Enable row level security
alter table public.documents enable row level security;

-- Create policies that allow all operations for now
create policy "Enable all operations for documents" on public.documents for all using (true);

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
ADD COLUMN end_page INTEGER
