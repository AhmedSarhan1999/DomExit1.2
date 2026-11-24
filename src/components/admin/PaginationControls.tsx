import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  isLoading?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  isLoading = false,
}) => {
  if (totalItems <= 0) return null;

  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const from = (safeCurrentPage - 1) * pageSize + 1;
  const to = Math.min(totalItems, safeCurrentPage * pageSize);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safeCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 select-none">
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
        <span>
          Показано <strong className="font-semibold text-slate-700">{from}–{to}</strong> из{' '}
          <strong className="font-semibold text-slate-700">{totalItems}</strong> записей
        </span>
      </div>

      <div className="flex items-center space-x-1 sm:space-x-2">
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1 || isLoading}
          className="p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Предыдущая страница"
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((p, idx) =>
          typeof p === 'string' ? (
            <span key={`dots-${idx}`} className="px-2 text-slate-400 text-xs">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={isLoading}
              className={`min-w-[32px] sm:min-w-[36px] h-8 sm:h-9 px-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                safeCurrentPage === p
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages || isLoading}
          className="p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Следующая страница"
          aria-label="Следующая страница"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {onPageSizeChange && (
          <div className="ml-2 sm:ml-4 flex items-center space-x-1.5 text-xs text-slate-500">
            <span className="hidden md:inline">По:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={isLoading}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
