import type { SearchResult as SearchResultType } from '@/types';
import { Printer, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  if (!totalPages ) return null;
  if (!relevantPages) {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-500 mt-2">
        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        <span>Checking relevancy...</span>
      </div>
    );
  }
  // const range = relevantPages.endPage - relevantPages.startPage + 1;
  // if (range === totalPages) {
  //   return (
  //     <div className="text-sm text-gray-500 mt-2">
  //       All pages are relevant
  //     </div>
  //   );
  // }
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
     {range} relevant pages from page {relevantPages.startPage}-{relevantPages.endPage}
    </div>
  );
};

// Individual search result component
const SearchResultItem = ({
  title,
  content,
  preview_image_url,
  total_pages,
  end_page,
  start_page,
  grade_level,
  pdf_url,
  url
}: SearchResultType) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPrinting, setPrinting] = useState(false);
  const [relevantPages, setRelevantPages] = useState<{
    startPage: number;
    endPage: number;
  } | undefined>(undefined);
  const handlePrint = async () => {
    if (!pdf_url && !url) return;

    setPrinting(true);
    try {
      const pdfUrl = pdf_url || url;
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('Failed to fetch PDF');

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const printWindow = window.open(objectUrl);

      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          setTimeout(() => {
            window.URL.revokeObjectURL(objectUrl);
          }, 100);
        };
      }
    } catch (error) {
      console.error('Error printing PDF:', error);
      alert('Failed to print PDF. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  const handleClick = () => {
    if (!pdf_url && !url) return;
    window.open(pdf_url || url, '_blank');
  };
  useEffect(() => {
    if (start_page !== undefined && end_page !== undefined) {
      // First, show "Checking relevancy..."
      setRelevantPages(undefined);

      const timer = setTimeout(() => {
        // After 2 seconds, show the relevant pages
        setRelevantPages({
          startPage: start_page,
          endPage: end_page,
        });
      }, 2000);

      return () => clearTimeout(timer); // Clean up timer if component unmounts
    }
  }, [start_page, end_page]);
  return (
    <div className="flex flex-col sm:flex-row border rounded-lg overflow-hidden mb-4 bg-white hover:shadow-lg transition-shadow duration-200">
      <div
        onClick={handleClick}
        className="w-full sm:w-1/4 relative bg-gray-100 cursor-pointer"
      >
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <img
          src={preview_image_url || '/placeholder.png'}
          alt={`Preview of ${title}`}
          className={`w-full h-48 sm:h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
        />
        <PagesPill totalPages={total_pages || undefined} />
      </div>
      <div className="w-full sm:w-3/4 p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <button
              onClick={handleClick}
              className="text-lg font-semibold text-left hover:text-blue-600 transition-colors duration-200 flex items-center gap-2"
            >
              {title}
              <ExternalLink className="w-4 h-4" />
            </button>
            {grade_level && (
              <span className="text-sm text-gray-500 block mt-1">Grade {grade_level}</span>
            )}
          </div>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className={`p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors duration-200 ${
              isPrinting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Print PDF"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>
        <p className="text-gray-600 mb-4 line-clamp-3">{content}</p>
        <p className="text-gray-600 mb-4 text-xs line-clamp-3">

        </p>

        <RelevancyInfo
          totalPages={total_pages || undefined}
          relevantPages={relevantPages}
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
        <SearchResultItem key={result.id}  {...result}   />
      ))}
    </div>
  );
}
