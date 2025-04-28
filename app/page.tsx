'use client';

import { useState, useCallback, useEffect } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { SearchResults } from '@/components/SearchResults';
import { GradeDropdown } from '@/components/GradeDropdown';
import { SearchResult } from '@/types';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const statuses = [
    "🔍 Searching through a world of knowledge for you...",
    "📚 Scanning PDFs to uncover valuable insights...",
    "🛠 Analyzing your study materials and cross-referencing results...",
    "⚙️ Fine-tuning the search to match your needs perfectly...",
    "⚡ Powering up your search with the best results...",
    "💬 Crafting a response tailored to your learning journey...",
    "🔄 Organizing everything for a clear and concise answer...",
    "📦 Wrapping up your search results, ready for study...",
    "🚀 Ready to launch your final insights and make studying easier...",
    "✅ Your study guide is ready—packed with knowledge!",
    "🎯 Identifying the most relevant results and perfecting your response..."
  ];

  // Fetch search history from the database
  const fetchSearchHistory = async () => {
    try {
      const response = await fetch('/api/search-history');
      if (response.ok) {
        const data = await response.json();
        setSearchHistory(data.history.map((item: { query: string }) => item.query));
      }
    } catch (error) {
      console.error('Failed to fetch search history:', error);
    }
  };

  useEffect(() => {
    fetchSearchHistory();
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setCurrentStatusIndex(0);
    try {
      const params = new URLSearchParams({
        q: query,
        ...(selectedGrade && { grade: selectedGrade }),
      });

      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();

      if (response.ok) {
        setResults(data.documents);
        // Fetch updated history after search
        fetchSearchHistory();
      } else {
        console.error('Search failed:', data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedGrade]);

  const handleGradeChange = (grade: string | null) => {
    setSelectedGrade(grade);
    if (searchQuery) {
      handleSearch(searchQuery);
    }
  };

  const handleHistoryUpdate = async (newHistory: string[]) => {
    try {
      const response = await fetch('/api/search-history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: newHistory[0] })
      });

      if (response.ok) {
        fetchSearchHistory();
      }
    } catch (error) {
      console.error('Failed to update search history:', error);
    }
  };

    useEffect(() => {
      if (isLoading) {
        const interval = setInterval(() => {
          setCurrentStatusIndex((prevIndex) => {
            if (prevIndex < statuses.length - 1) {
              return prevIndex + 1;
            } else {
              return prevIndex;
            }
          });
        }, 6000); // interval of 7.5 seconds

        return () => clearInterval(interval);
      }
    }, [isLoading]);
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
            <>
              <p className="text-center text-lg font-semibold mb-4">{statuses[currentStatusIndex]}</p>
              <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
            </>
          ) : (
            <SearchResults results={results} />
          )}
        </div>
      </div>
    </main>
  );
}