import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function Header({
  title,
  subtitle,
  searchQuery = '',
  onSearchChange,
  onRefresh,
  refreshing = false,
}: HeaderProps) {
  return (
    <header className="flex justify-between items-center px-8 w-full h-16 border-b border-outline-variant bg-surface sticky top-0 z-30">
      <div className="flex items-center gap-6">
        <div>
          <h2 className="font-headline-lg text-lg font-bold text-primary tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">analytics</span>
            {title}
          </h2>
          {subtitle && (
            <p className="font-label-md text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
              {subtitle}
            </p>
          )}
        </div>

        {onSearchChange && (
          <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant ml-4">
            <span className="material-symbols-outlined text-primary text-sm">search</span>
            <input
              type="text"
              placeholder="Filter by Asset ID or Fleet..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-body-md text-xs w-64 p-0 text-on-surface placeholder:text-on-surface-variant"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant px-3 py-1 rounded text-xs font-semibold text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-[#2E7D32] animate-pulse" />
          Real-time Ingestion
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high transition-colors font-label-md text-xs font-bold uppercase text-on-surface-variant cursor-pointer"
          >
            <span className={`material-symbols-outlined text-sm ${refreshing ? 'animate-spin' : ''}`}>sync</span>
            Refresh
          </button>
        )}
      </div>
    </header>
  );
}
