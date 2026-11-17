import React from 'react';

/**
 * Universal Page Skeleton Loader for React.lazy() Suspense boundaries
 */
export const PageSkeletonLoader: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-pulse" aria-busy="true" aria-label="Загрузка страницы...">
      {/* Top Bar Skeleton */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200" />
          <div className="w-32 h-5 rounded bg-slate-200" />
        </div>
        <div className="hidden md:flex space-x-6">
          <div className="w-20 h-4 rounded bg-slate-200" />
          <div className="w-24 h-4 rounded bg-slate-200" />
          <div className="w-20 h-4 rounded bg-slate-200" />
        </div>
        <div className="w-28 h-9 rounded-lg bg-slate-200" />
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8 flex-1">
        <div className="space-y-3">
          <div className="w-48 h-8 rounded bg-slate-200" />
          <div className="w-96 h-4 rounded bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <div className="w-full h-36 rounded-xl bg-slate-200" />
            <div className="w-3/4 h-5 rounded bg-slate-200" />
            <div className="w-1/2 h-4 rounded bg-slate-200" />
          </div>
          <div className="h-64 rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <div className="w-full h-36 rounded-xl bg-slate-200" />
            <div className="w-3/4 h-5 rounded bg-slate-200" />
            <div className="w-1/2 h-4 rounded bg-slate-200" />
          </div>
          <div className="h-64 rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <div className="w-full h-36 rounded-xl bg-slate-200" />
            <div className="w-3/4 h-5 rounded bg-slate-200" />
            <div className="w-1/2 h-4 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton Loader matching LotCard component for catalog views
 */
export const LotCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-pulse flex flex-col">
      <div className="w-full h-52 bg-slate-200" />
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="w-24 h-4 bg-slate-200 rounded" />
            <div className="w-16 h-4 bg-slate-200 rounded" />
          </div>
          <div className="w-3/4 h-6 bg-slate-200 rounded" />
          <div className="w-1/2 h-4 bg-slate-200 rounded" />
        </div>
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="w-28 h-6 bg-slate-200 rounded" />
          <div className="w-24 h-9 bg-slate-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton Loader for LotDetailsPage hero & specs
 */
export const LotDetailsSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <div className="h-6 w-48 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="w-full h-96 bg-slate-200 rounded-3xl" />
          <div className="h-10 w-3/4 bg-slate-200 rounded" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-4 w-5/6 bg-slate-200 rounded" />
            <div className="h-4 w-4/6 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-80 bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
            <div className="h-8 w-1/2 bg-slate-200 rounded" />
            <div className="h-12 w-full bg-slate-200 rounded-xl" />
            <div className="h-12 w-full bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton Loader for Admin Tables (Pipeline, Legal Audit, Matchmaker, Logs)
 */
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="h-12 bg-slate-100 border-b border-slate-200 px-6 flex items-center space-x-6">
        <div className="w-24 h-4 bg-slate-300 rounded" />
        <div className="w-32 h-4 bg-slate-300 rounded" />
        <div className="w-40 h-4 bg-slate-300 rounded" />
        <div className="w-24 h-4 bg-slate-300 rounded ml-auto" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-16 px-6 flex items-center space-x-6">
            <div className="w-20 h-4 bg-slate-200 rounded" />
            <div className="w-48 h-4 bg-slate-200 rounded" />
            <div className="w-32 h-4 bg-slate-200 rounded" />
            <div className="w-24 h-4 bg-slate-200 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton Loader for Legal Document Cards
 */
export const DocumentCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-20 h-4 bg-slate-200 rounded" />
        <div className="w-16 h-4 bg-slate-200 rounded" />
      </div>
      <div className="w-full h-5 bg-slate-200 rounded" />
      <div className="w-3/4 h-4 bg-slate-200 rounded" />
      <div className="pt-2 flex justify-between items-center">
        <div className="w-24 h-4 bg-slate-200 rounded" />
        <div className="w-20 h-6 bg-slate-200 rounded" />
      </div>
    </div>
  );
};
