'use client';

import { useState, useEffect } from 'react';
import type { EnrichmentMode } from '../types';
import { ENRICHMENT_MODE_LABELS } from '../types';
import { getHistory, deleteHistoryItem, clearHistory, copyToClipboard, type HistoryItem } from '../lib/api';

interface HistoryViewProps {
  onReprocess?: (item: HistoryItem, mode: EnrichmentMode) => void;
}

export function HistoryView({ onReprocess }: HistoryViewProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const items = await getHistory();
      setHistory(items);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteHistoryItem(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all history?')) return;

    try {
      await clearHistory();
      setHistory([]);
      setSelectedItem(null);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleCopy = async (content: string, id: string) => {
    try {
      await copyToClipboard(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-muted">
        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-lg">No transcriptions yet</p>
        <p className="text-sm">Your voice recordings will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* History list */}
      <div className="w-1/3 space-y-2 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-text">History</h3>
          <button
            onClick={handleClearAll}
            className="text-sm text-error hover:text-error/80 transition-colors"
          >
            Clear All
          </button>
        </div>

        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className={`w-full p-3 rounded-lg border text-left transition-all
              ${selectedItem?.id === item.id
                ? 'border-primary bg-primary/10'
                : 'border-secondary hover:border-primary/50 bg-surface'
              }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">
                  {item.rawTranscript.slice(0, 50)}...
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-text-muted">
                    {formatDate(item.timestamp)}
                  </span>
                  <span className="text-xs text-primary px-1.5 py-0.5 bg-primary/10 rounded">
                    {ENRICHMENT_MODE_LABELS[item.enrichmentMode as EnrichmentMode] || item.enrichmentMode}
                  </span>
                </div>
              </div>
              <span className="text-xs text-text-muted ml-2">
                {formatDuration(item.duration)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail view */}
      <div className="flex-1 card">
        {selectedItem ? (
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-text">
                  {formatDate(selectedItem.timestamp)}
                </h3>
                <p className="text-sm text-text-muted">
                  Duration: {formatDuration(selectedItem.duration)} |{' '}
                  Mode: {ENRICHMENT_MODE_LABELS[selectedItem.enrichmentMode as EnrichmentMode]}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(selectedItem.enrichedContent, selectedItem.id)}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  {copiedId === selectedItem.id ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => handleDelete(selectedItem.id)}
                  className="text-sm px-3 py-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              <div>
                <h4 className="text-sm font-medium text-text-muted mb-2">
                  Original Transcript
                </h4>
                <div className="p-3 bg-background rounded-lg text-sm text-text whitespace-pre-wrap">
                  {selectedItem.rawTranscript}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-text-muted mb-2">
                  Enriched Content
                </h4>
                <div className="p-3 bg-background rounded-lg text-sm text-text whitespace-pre-wrap">
                  {selectedItem.enrichedContent}
                </div>
              </div>
            </div>

            {/* Re-process buttons */}
            {onReprocess && (
              <div className="mt-4 pt-4 border-t border-secondary">
                <p className="text-sm text-text-muted mb-2">Re-process with different mode:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ENRICHMENT_MODE_LABELS).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => onReprocess(selectedItem, mode as EnrichmentMode)}
                      className="text-xs px-2 py-1 rounded border border-secondary hover:border-primary/50
                        text-text-muted hover:text-text transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted">
            Select an item to view details
          </div>
        )}
      </div>
    </div>
  );
}
