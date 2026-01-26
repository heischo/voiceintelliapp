'use client';

import Link from 'next/link';
import { HistoryView } from '../../components/HistoryView';
import type { EnrichmentMode } from '../../types';
import type { HistoryItem } from '../../lib/api';

export default function HistoryPage() {
  const handleReprocess = async (item: HistoryItem, mode: EnrichmentMode) => {
    // TODO: Implement re-processing
    console.log('Re-processing item:', item.id, 'with mode:', mode);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-secondary">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-text-muted hover:text-text transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-text">History</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <HistoryView onReprocess={handleReprocess} />
      </main>
    </div>
  );
}
