'use client';

import { useState } from 'react';
import type { OutputTarget } from '../types';
import { OUTPUT_TARGETS, FILE_FORMATS, type FileFormat } from '../lib/config';
import { copyToClipboard, saveToFile, saveAsPdf, exportToNotion, getSettings } from '../lib/api';

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
  const [fileFormat, setFileFormat] = useState<FileFormat>('markdown');

  const handleOutput = async () => {
    if (!content) return;

    try {
      setStatus('idle');

      if (value === 'clipboard') {
        await copyToClipboard(content);
        setStatus('success');
        setStatusMessage('Copied to clipboard!');
      } else if (value === 'file') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        if (fileFormat === 'pdf') {
          const filename = `transcript-${timestamp}.pdf`;
          const path = await saveAsPdf(content, filename);
          if (path) {
            setStatus('success');
            setStatusMessage(`Saved PDF to ${path}`);
          }
        } else {
          const filename = `transcript-${timestamp}.md`;
          const path = await saveToFile(content, filename);
          if (path) {
            setStatus('success');
            setStatusMessage(`Saved to ${path}`);
          }
        }
      } else if (value === 'notion') {
        // Get Notion API key from settings
        const settings = await getSettings();
        if (!settings?.notionApiKey) {
          setStatus('error');
          setStatusMessage('Please configure your Notion API key in Settings');
          setTimeout(() => {
            setStatus('idle');
            setStatusMessage('');
          }, 5000);
          return;
        }

        const result = await exportToNotion(content, settings.notionApiKey, {
          title: `Transcript - ${new Date().toLocaleString()}`,
        });

        if (result.success) {
          setStatus('success');
          setStatusMessage(result.url ? `Exported to Notion` : 'Exported to Notion!');
        } else {
          setStatus('error');
          setStatusMessage(result.error || 'Failed to export to Notion');
        }
      } else if (value === 'google_drive') {
        setStatus('error');
        setStatusMessage('Google Drive integration coming soon!');
      }

      // Clear status after 3 seconds (for success)
      if (status !== 'error') {
        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 3000);
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to output');

      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 5000);
    }
  };

  const handleTargetChange = (target: OutputTarget) => {
    // Show "coming soon" message for Google Drive
    if (target === 'google_drive') {
      setStatus('error');
      setStatusMessage('Google Drive integration coming soon!');
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 3000);
      return;
    }
    onChange(target);
  };

  // Get button label based on current selection
  const getOutputButtonLabel = () => {
    switch (value) {
      case 'clipboard':
        return 'Copy to Clipboard';
      case 'file':
        return fileFormat === 'pdf' ? 'Save as PDF' : 'Save as Markdown';
      case 'notion':
        return 'Export to Notion';
      case 'google_drive':
        return 'Save to Google Drive';
      default:
        return 'Output';
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-text">
        Output Destination
      </label>

      {/* Output target selection */}
      <div className="grid grid-cols-2 gap-2">
        {OUTPUT_TARGETS.map((target) => (
          <button
            key={target.value}
            onClick={() => handleTargetChange(target.value)}
            disabled={disabled}
            className={`relative min-w-0 px-3 py-2.5 rounded-lg border transition-all
              ${value === target.value && !target.comingSoon
                ? 'border-primary bg-primary/10 text-text'
                : 'border-secondary bg-background text-text-muted hover:border-primary/50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${target.comingSoon ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-center gap-2 min-w-0">
              {target.value === 'clipboard' && (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              )}
              {target.value === 'file' && (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              {target.value === 'notion' && (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.449.327s0 .84-1.168.84l-3.222.186c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.822 9.62c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.84.374-1.54 1.447-1.632z"/>
                </svg>
              )}
              {target.value === 'google_drive' && (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.71 3.5L1.15 15l4.58 7.5h13.35l4.77-7.5L17.29 3.5H7.71zm.79 1.5h7l5.5 9.5-2.3 3.75H5.3L3 14.5l5.5-9.5z"/>
                </svg>
              )}
              <span className="font-medium truncate text-sm">{target.label}</span>
            </div>
            {target.comingSoon && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-warning text-background rounded-full">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* File Format selector - shown only when 'file' is selected */}
      {value === 'file' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text">
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
                {format.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Output button */}
      {content && (
        <button
          onClick={handleOutput}
          disabled={disabled || value === 'google_drive'}
          className={`w-full py-3 rounded-lg font-medium transition-all
            ${status === 'success'
              ? 'bg-success/20 text-success border border-success'
              : status === 'error'
                ? 'bg-error/20 text-error border border-error'
                : 'btn-accent'
            }
            ${(disabled || value === 'google_drive') ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {status === 'success' ? (
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
              {getOutputButtonLabel()}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
