'use client';

import { useState } from 'react';
import type { OutputTarget } from '../types';
import { OUTPUT_TARGETS } from '../lib/config';
import { copyToClipboard, saveToFile, saveAsPdf } from '../lib/api';

// File format options for "Save to File" output target
type FileFormat = 'markdown' | 'pdf';

const FILE_FORMATS: { value: FileFormat; label: string; extension: string }[] = [
  { value: 'markdown', label: 'Markdown', extension: '.md' },
  { value: 'pdf', label: 'PDF', extension: '.pdf' },
];

interface OutputRouterProps {
  value: OutputTarget;
  onChange: (target: OutputTarget) => void;
  content?: string;
  disabled?: boolean;
}

export function OutputRouter({
  value,
  onChange,
  content,
  disabled = false,
}: OutputRouterProps) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileFormat, setFileFormat] = useState<FileFormat>('markdown');

  const handleOutput = async () => {
    if (!content || isLoading) return;

    setIsLoading(true);
    try {
      setStatus('idle');

      if (value === 'clipboard') {
        await copyToClipboard(content);
        setStatus('success');
        setStatusMessage('Copied to clipboard!');
      } else if (value === 'file') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let path: string | null = null;

        if (fileFormat === 'pdf') {
          // Save as PDF with Unicode support
          path = await saveAsPdf(content, {
            title: `Transcript - ${new Date().toLocaleString()}`,
          });
        } else {
          // Save as Markdown
          const filename = `transcript-${timestamp}.md`;
          path = await saveToFile(content, filename);
        }

        if (path) {
          setStatus('success');
          setStatusMessage(`Saved to ${path}`);
        }
      }

      // Clear status after 3 seconds
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 3000);
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to output');

      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-text">
        Output Destination
      </label>

      {/* Output target selection */}
      <div className="flex gap-2">
        {OUTPUT_TARGETS.map((target) => (
          <button
            key={target.value}
            onClick={() => onChange(target.value)}
            disabled={disabled}
            className={`flex-1 px-4 py-3 rounded-lg border transition-all
              ${value === target.value
                ? 'border-primary bg-primary/10 text-text'
                : 'border-secondary bg-background text-text-muted hover:border-primary/50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center justify-center gap-2">
              {target.value === 'clipboard' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              <span className="font-medium">{target.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* File format selection - shown when 'file' is selected */}
      {value === 'file' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-muted">
            File Format
          </label>
          <div className="flex gap-2">
            {FILE_FORMATS.map((format) => (
              <button
                key={format.value}
                onClick={() => setFileFormat(format.value)}
                disabled={disabled}
                className={`flex-1 px-3 py-2 rounded-lg border transition-all text-sm
                  ${fileFormat === format.value
                    ? 'border-primary bg-primary/10 text-text'
                    : 'border-secondary bg-background text-text-muted hover:border-primary/50'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-center gap-2">
                  {format.value === 'markdown' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span className="font-medium">{format.label}</span>
                  <span className="text-xs text-text-muted">{format.extension}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Output button */}
      {content && (
        <button
          onClick={handleOutput}
          disabled={disabled || isLoading}
          className={`w-full py-3 rounded-lg font-medium transition-all
            ${status === 'success'
              ? 'bg-success/20 text-success border border-success'
              : status === 'error'
                ? 'bg-error/20 text-error border border-error'
                : 'btn-accent'
            }
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {value === 'clipboard' ? 'Copying...' : 'Saving...'}
            </span>
          ) : status === 'success' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {statusMessage}
            </span>
          ) : status === 'error' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {statusMessage}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              {value === 'clipboard'
                ? 'Copy to Clipboard'
                : value === 'file'
                  ? `Save as ${fileFormat === 'pdf' ? 'PDF' : 'Markdown'}`
                  : 'Save to File'}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
