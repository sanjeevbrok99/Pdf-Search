'use client';

import { useState } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { SearchResults } from '@/components/SearchResults';
import { GradeDropdown } from '@/components/GradeDropdown';
import { SearchResult } from '@/types';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        ...(selectedGrade && { grade: selectedGrade }),
      });

      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();

      if (response.ok) {
        setResults(data.documents);
        if (!searchHistory.includes(query)) {
          setSearchHistory((prev) => [query, ...prev].slice(0, 5));
        }
      } else {
        console.error('Search failed:', data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeChange = (grade: string | null) => {
    setSelectedGrade(grade);
    if (searchQuery) {
      handleSearch(searchQuery);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">PDF Search</h1>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search PDFs..."
                history={searchHistory}
              />
            </div>
            <GradeDropdown value={selectedGrade} onChange={handleGradeChange} />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSearch(searchQuery)}
              disabled={!searchQuery.trim() || isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <SearchResults results={results} />
          )}
        </div>
      </div>
    </main>
  );
}