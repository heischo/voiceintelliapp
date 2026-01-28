'use client';

import { useEffect, useMemo } from 'react';
import type { RecordingState } from '../types';
import { MAX_RECORDING_DURATION } from '../lib/config';

interface RecordingOverlayProps {
  state: RecordingState;
  duration: number;
  audioLevel: number;
  onStop: () => void;
  onCancel: () => void;
  hotkey?: string;
  startedViaHotkey?: boolean;
}

export function RecordingOverlay({
  state,
  duration,
  audioLevel,
  onStop,
  onCancel,
  hotkey,
  startedViaHotkey,
}: RecordingOverlayProps) {
  // Format hotkey for display
  const formattedHotkey = hotkey?.replace('CommandOrControl', 'Ctrl').replace('+', ' + ') || 'Ctrl + Shift + Space';
  // Format duration as mm:ss
  const formattedDuration = useMemo(() => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [duration]);

  // Calculate remaining time
  const remainingTime = MAX_RECORDING_DURATION - duration;
  const showWarning = remainingTime <= 30 && remainingTime > 0;

  // No keyboard shortcuts needed - push-to-talk mode uses hotkey hold/release

  if (state === 'idle' || state === 'completed') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        {/* Recording indicator */}
        <div className="relative">
          <div
            className={`w-32 h-32 rounded-full flex items-center justify-center
              ${state === 'recording' ? 'bg-error/20' : 'bg-primary/20'}
              transition-colors duration-300`}
          >
            {/* Animated rings based on audio level */}
            {state === 'recording' && (
              <>
                <div
                  className="absolute inset-0 rounded-full border-2 border-error/50 animate-ping"
                  style={{ animationDuration: '1.5s' }}
                />
                <div
                  className="absolute rounded-full border-2 border-error/30 transition-all duration-100"
                  style={{
                    width: `${100 + audioLevel * 0.5}%`,
                    height: `${100 + audioLevel * 0.5}%`,
                    top: `${-audioLevel * 0.25}%`,
                    left: `${-audioLevel * 0.25}%`,
                  }}
                />
              </>
            )}

            {/* Center circle */}
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center
                ${state === 'recording' ? 'bg-error recording-pulse' : 'bg-primary'}
                transition-colors duration-300`}
            >
              {state === 'recording' ? (
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8 text-secondary animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Duration display */}
        <div className="text-center">
          <div className="text-5xl font-mono font-bold text-text">
            {formattedDuration}
          </div>
          {showWarning && (
            <div className="text-error text-sm mt-2 animate-pulse">
              {remainingTime} seconds remaining
            </div>
          )}
          <div className="text-text-muted text-sm mt-2">
            {state === 'recording' ? 'Recording...' : 'Processing...'}
          </div>
        </div>

        {/* Audio level visualization */}
        {state === 'recording' && (
          <div className="flex items-center gap-1 h-12">
            {Array.from({ length: 20 }).map((_, i) => {
              const threshold = (i / 20) * 100;
              const isActive = audioLevel > threshold;
              const isHigh = i >= 15;
              return (
                <div
                  key={i}
                  className={`w-2 rounded-full transition-all duration-75
                    ${isActive
                      ? isHigh
                        ? 'bg-error'
                        : 'bg-primary'
                      : 'bg-secondary'
                    }`}
                  style={{
                    height: `${20 + i * 2}px`,
                    opacity: isActive ? 1 : 0.3,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4">
          {state === 'recording' && (
            <>
              <button
                onClick={onCancel}
                className="btn-secondary px-6 py-3 text-lg"
              >
                Cancel
              </button>
              <button
                onClick={onStop}
                className="btn-primary px-8 py-3 text-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Stop Recording
              </button>
            </>
          )}
        </div>

        {/* Keyboard hints - only show if started via hotkey */}
        {state === 'recording' && startedViaHotkey && (
          <div className="text-text-muted text-xs">
            Release <kbd className="px-2 py-1 bg-secondary rounded text-text">{formattedHotkey}</kbd> to stop
          </div>
        )}
      </div>
    </div>
  );
}
