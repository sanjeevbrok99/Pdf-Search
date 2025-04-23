'use client';

import { useState, useCallback } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { SearchResults } from '@/components/SearchResults';
import { GradeDropdown } from '@/components/GradeDropdown';
import { SearchResult } from '@/types';

const LOCAL_STORAGE_KEY = 'pdf-search-history';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const handleSearch = useCallback(async (query: string) => {
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
          const newHistory = [query, ...searchHistory].slice(0, 5);
          setSearchHistory(newHistory);
          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
          }
        }
      } else {
        console.error('Search failed:', data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchHistory, selectedGrade]);

  const handleGradeChange = (grade: string | null) => {
    setSelectedGrade(grade);
    if (searchQuery) {
      handleSearch(searchQuery);
    }
  };

  const handleHistoryUpdate = (newHistory: string[]) => {
    setSearchHistory(newHistory);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
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
                onSearch={handleSearch}
                placeholder="Search PDFs..."
                history={searchHistory}
                onHistoryUpdate={handleHistoryUpdate}
              />
            </div>
            <GradeDropdown value={selectedGrade} onChange={handleGradeChange} />
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