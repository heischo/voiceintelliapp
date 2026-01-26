'use client';

import { useState } from 'react';
import type { OutputTarget } from '../types';
import { OUTPUT_TARGETS } from '../lib/config';
import { copyToClipboard, saveToFile } from '../lib/api';

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

  const handleOutput = async () => {
    if (!content) return;

    try {
      setStatus('idle');

      if (value === 'clipboard') {
        await copyToClipboard(content);
        setStatus('success');
        setStatusMessage('Copied to clipboard!');
      } else {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `transcript-${timestamp}.md`;
        const path = await saveToFile(content, filename);
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

      {/* Output button */}
      {content && (
        <button
          onClick={handleOutput}
          disabled={disabled}
          className={`w-full py-3 rounded-lg font-medium transition-all
            ${status === 'success'
              ? 'bg-success/20 text-success border border-success'
              : status === 'error'
                ? 'bg-error/20 text-error border border-error'
                : 'btn-accent'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              {value === 'clipboard' ? 'Copy to Clipboard' : 'Save to File'}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
