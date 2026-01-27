'use client';

import { useState, useEffect, useRef } from 'react';
import type { EnrichmentMode } from '../types';
import { ENRICHMENT_MODE_LABELS } from '../types';
import { getHistory, deleteHistoryItem, clearHistory, copyToClipboard, saveAsPdf, exportToNotion, getSettings, NotionError, type HistoryItem } from '../lib/api';

interface HistoryViewProps {
  onReprocess?: (item: HistoryItem, mode: EnrichmentMode) => void;
}

export function HistoryView({ onReprocess }: HistoryViewProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    // Clear any previous error state
    setCopyError(null);

    try {
      await copyToClipboard(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      // Set error state with the item id to show error feedback
      setCopyError(id);
      setTimeout(() => setCopyError(null), 3000);
    }
  };

  const handleExportPdf = async (item: HistoryItem) => {
    setShowExportMenu(false);
    setExportStatus('loading');
    setExportMessage('Exporting to PDF...');

    try {
      const title = `Transcript - ${formatDate(item.timestamp)}`;
      const filePath = await saveAsPdf(item.enrichedContent, {
        title,
        filename: `transcript-${item.id.slice(0, 8)}.pdf`,
      });

      if (filePath) {
        setExportStatus('success');
        setExportMessage('PDF exported successfully!');
        // Clear status after delay
        setTimeout(() => {
          setExportStatus('idle');
          setExportMessage('');
        }, 3000);
      } else {
        // User cancelled the dialog
        setExportStatus('idle');
        setExportMessage('');
      }
    } catch (error) {
      setExportStatus('error');
      setExportMessage('Failed to export PDF');
      // Clear error status after longer delay
      setTimeout(() => {
        setExportStatus('idle');
        setExportMessage('');
      }, 5000);
    }
  };

  const handleExportNotion = async (item: HistoryItem) => {
    setShowExportMenu(false);
    setExportStatus('loading');
    setExportMessage('Exporting to Notion...');

    try {
      const settings = await getSettings();
      if (!settings?.notionApiKey) {
        setExportStatus('error');
        setExportMessage('Notion API key not configured. Please add it in Settings.');
        setTimeout(() => {
          setExportStatus('idle');
          setExportMessage('');
        }, 5000);
        return;
      }

      const title = `Transcript - ${formatDate(item.timestamp)}`;
      // Create NotionSettings from app settings
      const notionSettings = {
        apiKey: settings.notionApiKey,
      };
      await exportToNotion(notionSettings, {
        title,
        content: item.enrichedContent,
      });

      setExportStatus('success');
      setExportMessage('Exported to Notion!');
      // Clear success status after delay
      setTimeout(() => {
        setExportStatus('idle');
        setExportMessage('');
      }, 3000);
    } catch (error) {
      setExportStatus('error');
      if (error instanceof NotionError) {
        setExportMessage(error.message);
      } else {
        setExportMessage('Failed to export to Notion');
      }
      // Clear error status after longer delay
      setTimeout(() => {
        setExportStatus('idle');
        setExportMessage('');
      }, 5000);
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
                  className={`text-sm px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5
                    ${copiedId === selectedItem.id
                      ? 'bg-success/20 text-success border border-success'
                      : copyError === selectedItem.id
                        ? 'bg-error/20 text-error border border-error'
                        : 'btn-secondary'
                    }`}
                >
                  {copiedId === selectedItem.id ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : copyError === selectedItem.id ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Failed
                    </>
                  ) : (
                    'Copy'
                  )}
                </button>

                {/* Export dropdown */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={exportStatus === 'loading'}
                    className={`text-sm px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5
                      ${exportStatus === 'success'
                        ? 'bg-success/20 text-success border border-success'
                        : exportStatus === 'error'
                          ? 'bg-error/20 text-error border border-error'
                          : exportStatus === 'loading'
                            ? 'btn-secondary opacity-70'
                            : 'btn-secondary'
                      }`}
                  >
                    {exportStatus === 'loading' ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Exporting...
                      </>
                    ) : exportStatus === 'success' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Exported!
                      </>
                    ) : exportStatus === 'error' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Failed
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Export
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>

                  {/* Dropdown menu */}
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-surface border border-secondary rounded-lg shadow-lg z-10 min-w-[140px]">
                      <button
                        onClick={() => handleExportPdf(selectedItem)}
                        className="w-full px-3 py-2 text-sm text-left text-text hover:bg-primary/10 rounded-t-lg flex items-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        PDF
                      </button>
                      <button
                        onClick={() => handleExportNotion(selectedItem)}
                        className="w-full px-3 py-2 text-sm text-left text-text hover:bg-primary/10 rounded-b-lg flex items-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.453-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM2.64 1.502l13.589-.933c1.682-.14 2.102.093 2.81.607l3.874 2.707c.466.327.607.746.607 1.26v14.813c0 .84-.326 1.4-1.261 1.447l-15.456.887c-.7.047-1.027-.14-1.354-.56l-2.148-2.8c-.374-.467-.56-.887-.56-1.447V2.875c0-.56.28-1.12 1.26-1.213z" />
                        </svg>
                        Notion
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(selectedItem.id)}
                  className="text-sm px-3 py-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Export status message */}
            {exportMessage && (
              <div className={`text-sm px-3 py-2 rounded-lg mb-4 ${
                exportStatus === 'success'
                  ? 'bg-success/10 text-success'
                  : exportStatus === 'error'
                    ? 'bg-error/10 text-error'
                    : 'bg-primary/10 text-primary'
              }`}>
                {exportMessage}
              </div>
            )}

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
