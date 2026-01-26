'use client';

import { useState } from 'react';
import type { EnrichmentMode } from '../types';
import { ENRICHMENT_MODES } from '../lib/config';

interface EnrichmentModeSelectorProps {
  value: EnrichmentMode;
  onChange: (mode: EnrichmentMode) => void;
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
  disabled?: boolean;
}

export function EnrichmentModeSelector({
  value,
  onChange,
  customPrompt = '',
  onCustomPromptChange,
  disabled = false,
}: EnrichmentModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedMode = ENRICHMENT_MODES.find((m) => m.value === value);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-text">
        Enrichment Mode
      </label>

      {/* Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full flex items-center justify-between px-4 py-3 bg-background
            border border-secondary rounded-lg text-left
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50 cursor-pointer'}
            transition-colors`}
        >
          <div>
            <div className="font-medium text-text">{selectedMode?.label}</div>
            <div className="text-sm text-text-muted">{selectedMode?.description}</div>
          </div>
          <svg
            className={`w-5 h-5 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && !disabled && (
          <div className="absolute z-10 w-full mt-2 bg-surface border border-secondary rounded-lg shadow-lg overflow-hidden">
            {ENRICHMENT_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => {
                  onChange(mode.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-primary/10 transition-colors
                  ${value === mode.value ? 'bg-primary/20 border-l-2 border-primary' : ''}`}
              >
                <div className="font-medium text-text">{mode.label}</div>
                <div className="text-sm text-text-muted">{mode.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Custom prompt input */}
      {value === 'custom' && onCustomPromptChange && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-text mb-2">
            Custom Prompt
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter your custom instructions for processing the transcript..."
            rows={4}
            className="w-full px-4 py-3 bg-background border border-secondary rounded-lg
              text-text placeholder:text-text-muted resize-none
              focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-text-muted mt-1">
            Your prompt will be used to process the transcript. Be specific about the output format you want.
          </p>
        </div>
      )}
    </div>
  );
}
