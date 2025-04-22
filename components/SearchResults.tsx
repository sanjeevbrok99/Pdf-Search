import type { SearchResult as SearchResultType } from '@/types';

// PagesPill component
const PagesPill = ({ totalPages }: { totalPages?: number }) => {
  if (!totalPages) return null;
  return (
    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
      {totalPages} pages
    </div>
  );
};

// RelevancyInfo component
const RelevancyInfo = ({ totalPages, relevantPages }: { totalPages?: number; relevantPages?: { startPage: number; endPage: number } }) => {
  if (!totalPages || !relevantPages) return null;

  const range = relevantPages.endPage - relevantPages.startPage + 1;
  if (range === totalPages) {
    return (
      <div className="text-sm text-gray-500 mt-2">
        All pages are relevant
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-500 mt-2">
      Pages {relevantPages.startPage}-{relevantPages.endPage} are most relevant
    </div>
  );
};

// Individual search result component
const SearchResultItem = ({ 
  title, 
  content, 
  preview_image_url,
  total_pages,
  relevantPages,
  grade_level 
}: SearchResultType) => {
  return (
    <div className="flex flex-col sm:flex-row border rounded-lg overflow-hidden mb-4 bg-white">
      <div className="w-full sm:w-1/4 relative">
        <img
          src={preview_image_url || '/placeholder.png'}
          alt={`Preview of ${title}`}
          className="w-full h-48 sm:h-full object-cover"
        />
        <PagesPill totalPages={total_pages || undefined} />
      </div>
      <div className="w-full sm:w-3/4 p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          {grade_level && (
            <span className="text-sm text-gray-500">Grade {grade_level}</span>
          )}
        </div>
        <p className="text-gray-600 mb-4 line-clamp-3">{content}</p>
        <RelevancyInfo 
          totalPages={total_pages || undefined} 
          relevantPages={relevantPages ? {
            startPage: relevantPages.start_page,
            endPage: relevantPages.end_page
          } : undefined}
        />
      </div>
    </div>
  );
};

// Search results container component
export function SearchResults({ results }: { results: SearchResultType[] }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No results found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result) => (
        <SearchResultItem key={result.id} {...result} />
      ))}
    </div>
  );
}
