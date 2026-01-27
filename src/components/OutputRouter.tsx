'use client';

import { useState } from 'react';
import type { OutputTarget } from '../types';
import { OUTPUT_TARGETS } from '../lib/config';
import { copyToClipboard, saveToFile, saveAsPdf, exportToNotion, getSettings, NotionError } from '../lib/api';

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
      } else if (value === 'notion') {
        // Get settings to check for Notion API key
        const settings = await getSettings();

        if (!settings?.notionApiKey) {
          throw new NotionError({
            code: 'NOT_CONFIGURED',
            message: 'Notion API key not configured. Please add your API key in Settings.',
            retryable: false,
          });
        }

        // Export to Notion
        const result = await exportToNotion(
          { apiKey: settings.notionApiKey },
          {
            title: `Transcript - ${new Date().toLocaleString()}`,
            content,
          }
        );

        setStatus('success');
        setStatusMessage(`Exported to Notion!`);

        // Open the Notion page in browser if URL is available
        if (result.url) {
          window.open(result.url, '_blank');
        }
      } else if (value === 'google_drive') {
        // Google Drive is coming soon - show informational message
        setStatus('error');
        setStatusMessage('Google Drive support coming in a later version');
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
              ) : target.value === 'file' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              ) : target.value === 'notion' ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                </svg>
              ) : target.value === 'google_drive' ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.71 3.5L1.15 15l2.86 5 6.56-11.5L7.71 3.5zm8.56 0L3.65 20h5.7l12.61-16.5H16.27zM16.27 20l2.86-5L12.61 3.5h5.7L24.85 15l-2.86 5h-5.72z"/>
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
              {value === 'clipboard' ? 'Copying...' : value === 'notion' ? 'Exporting to Notion...' : 'Saving...'}
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
                  : value === 'notion'
                    ? 'Export to Notion'
                    : value === 'google_drive'
                      ? 'Save to Google Drive'
                      : 'Save to File'}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
