import React from 'react';
import {
  PageSkeletonLoader,
  LotCardSkeleton,
  LotDetailsSkeleton,
  TableSkeleton,
  DocumentCardSkeleton,
} from '../common/Skeletons';

export {
  PageSkeletonLoader,
  LotCardSkeleton,
  LotDetailsSkeleton,
  TableSkeleton,
  DocumentCardSkeleton,
};

/**
 * Multi-row Skeleton Table with configurable rows and columns for Admin tables
 */
export const TableRowsSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 6,
  cols = 5,
}) => {
  return (
    <div
      className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"
      aria-busy="true"
      aria-label="Загрузка таблицы..."
    >
      <div className="h-12 bg-slate-100 border-b border-slate-200 px-6 flex items-center gap-4">
        {Array.from({ length: cols }).map((_, idx) => (
          <div
            key={idx}
            className={`h-4 bg-slate-300 rounded ${idx === 0 ? 'w-24' : 'flex-1 max-w-[160px]'}`}
          />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="h-14 px-6 flex items-center gap-4">
            {Array.from({ length: cols }).map((__, colIdx) => (
              <div
                key={colIdx}
                className={`h-3.5 bg-slate-200 rounded ${
                  colIdx === 0 ? 'w-20' : colIdx === cols - 1 ? 'w-24 ml-auto' : 'flex-1 max-w-[180px]'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Smooth layout-preserving Skeleton for Client Portal tabs (/portal)
 */
export const PortalTabSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Загрузка данных кабинета...">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="h-28 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between"
          >
            <div className="w-28 h-3.5 bg-slate-200 rounded" />
            <div className="w-20 h-7 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-40 h-5 bg-slate-200 rounded" />
              <div className="w-20 h-5 bg-slate-200 rounded-full" />
            </div>
            <div className="w-full h-24 bg-slate-100 rounded-xl" />
            <div className="flex justify-between items-center pt-2">
              <div className="w-32 h-4 bg-slate-200 rounded" />
              <div className="w-28 h-9 bg-slate-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
