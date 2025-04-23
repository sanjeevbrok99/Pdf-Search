import { Search, History, X } from 'lucide-react';
import { useState, useEffect, useRef, KeyboardEvent } from 'react';

interface SearchHistoryProps {
  history: string[];
  onSelect: (query: string) => void;
  onClear: (index: number) => void;
  highlightedIndex: number;
}

function SearchHistory({ history, onSelect, onClear, highlightedIndex }: SearchHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
        <div className="flex items-center gap-2 text-gray-500">
          <History className="w-4 h-4" />
          <span>No search history</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      {history.map((query, index) => (
        <div
          key={index}
          className={`group flex items-center justify-between px-4 py-2 hover:bg-gray-50 ${
            index === highlightedIndex ? 'bg-gray-50' : ''
          }`}
        >
          <button
            onClick={() => onSelect(query)}
            className="flex-1 flex items-center gap-2 text-sm text-gray-700 text-left"
          >
            <History className="w-4 h-4 text-gray-400" />
            <span>{query}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear(index);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-full transition-all duration-200"
            title="Remove from history"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  history?: string[];
  onHistoryUpdate?: (history: string[]) => void;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = "Search...",
  history = [],
  onHistoryUpdate
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSearch(value);
      setIsFocused(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, history.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && highlightedIndex < history.length) {
      onChange(history[highlightedIndex]);
    }
  }, [highlightedIndex]);

  const handleHistoryClear = (index: number) => {
    const newHistory = [...history];
    newHistory.splice(index, 1);
    onHistoryUpdate?.(newHistory);
  };

  return (
    <div className="relative z-50">
      <div className="flex bg-gray-100 rounded-lg shadow-sm border border-gray-200 transition-all duration-200 focus-within:ring-1 focus-within:ring-gray-400 overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay to allow button clicks to register
            setTimeout(() => setIsFocused(false), 200);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 h-12 pl-4 bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <button
          onClick={() => {
            if (value.trim()) {
              onSearch(value);
              setIsFocused(false);
            }
          }}
          className="h-12 w-12 flex items-center justify-center bg-gray-900 text-white hover:bg-gray-800 transition duration-200"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>
      {isFocused && (
        <SearchHistory
          history={history}
          onSelect={(query) => {
            onChange(query);
            onSearch(query);
            setIsFocused(false);
          }}
          onClear={handleHistoryClear}
          highlightedIndex={highlightedIndex}
        />
      )}
    </div>
  );
}
