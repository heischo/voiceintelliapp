'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RecordingOverlay } from '../components/RecordingOverlay';
import { EnrichmentModeSelector } from '../components/EnrichmentModeSelector';
import { OutputRouter } from '../components/OutputRouter';
import { useSettings } from '../hooks/useSettings';
import { useRecording } from '../hooks/useRecording';
import { useHotkey } from '../hooks/useHotkey';
import { useLLM } from '../hooks/useLLM';
import type { EnrichmentMode, OutputTarget } from '../types';
import { addToHistory } from '../lib/api';
import { getSTTService } from '../services/stt';

export default function Home() {
  const { settings, isLoading: settingsLoading } = useSettings();
  const recording = useRecording();
  const llm = useLLM(settings.llmProvider);

  const [enrichmentMode, setEnrichmentMode] = useState<EnrichmentMode>(settings.enrichmentMode);
  const [outputTarget, setOutputTarget] = useState<OutputTarget>(settings.outputTarget);
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt || '');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [enrichedContent, setEnrichedContent] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  // Update local state when settings load
  useEffect(() => {
    if (!settingsLoading) {
      setEnrichmentMode(settings.enrichmentMode);
      setOutputTarget(settings.outputTarget);
      setCustomPrompt(settings.customPrompt || '');
      llm.setLanguage(settings.language);
    }
  }, [settings, settingsLoading, llm]);

  // Handle enrichment (defined early for use in handleStopRecording)
  const handleEnrich = useCallback(async (text?: string) => {
    const textToEnrich = text || transcript;
    if (!textToEnrich) return;

    setIsEnriching(true);
    try {
      const options = enrichmentMode === 'custom' ? { customPrompt } : undefined;
      const result = await llm.enrich(textToEnrich, enrichmentMode, options);
      setEnrichedContent(result);

      // Save to history
      await addToHistory({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        rawTranscript: textToEnrich,
        enrichedContent: result,
        enrichmentMode,
        duration: recording.duration,
      });
    } catch (error) {
      console.error('Enrichment failed:', error);
    } finally {
      setIsEnriching(false);
    }
  }, [transcript, enrichmentMode, customPrompt, llm, recording.duration]);

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    const audioBlob = await recording.stopRecording();
    if (!audioBlob) return;

    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      // Use the STT service for actual transcription
      const sttService = getSTTService();

      // Configure OpenAI API key if available
      const openaiKey = settings.openaiApiKey;
      if (openaiKey) {
        sttService.configureOpenAI(openaiKey);
      }

      const result = await sttService.transcribe(audioBlob, settings.language);
      setTranscript(result.text);

      // Auto-enrich if enabled
      if (settings.autoEnrich) {
        await handleEnrich(result.text);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      setTranscriptionError(
        error instanceof Error ? error.message : 'Transcription failed'
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [recording, settings.autoEnrich, settings.language, settings.openaiApiKey, handleEnrich]);

  // Hotkey handler
  const handleHotkey = useCallback(() => {
    if (recording.state === 'idle') {
      recording.startRecording();
    } else if (recording.state === 'recording') {
      handleStopRecording();
    }
  }, [recording, handleStopRecording]);

  // Register hotkey
  const hotkey = useHotkey(settings.hotkey, handleHotkey);

  // Handle new recording
  const handleNewRecording = () => {
    setTranscript(null);
    setEnrichedContent(null);
    recording.startRecording();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Recording Overlay */}
      <RecordingOverlay
        state={recording.state}
        duration={recording.duration}
        audioLevel={recording.audioLevel}
        onStop={handleStopRecording}
        onCancel={recording.cancelRecording}
      />

      {/* Header */}
      <header className="border-b border-secondary">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <svg className="w-6 h-6 text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-text">Voice Intelligence</h1>
              <p className="text-xs text-text-muted">Privacy-first voice assistant</p>
            </div>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              href="/history"
              className="text-text-muted hover:text-text transition-colors"
            >
              History
            </Link>
            <Link
              href="/settings"
              className="text-text-muted hover:text-text transition-colors"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full ${
                hotkey.isRegistered ? 'bg-success' : 'bg-error'
              }`}
            />
            <span className="text-sm text-text-muted">
              {hotkey.isRegistered
                ? `Press ${settings.hotkey.replace('CommandOrControl', 'Ctrl')} to record`
                : 'Hotkey not registered'}
            </span>
          </div>
          {hotkey.error && (
            <span className="text-sm text-error">{hotkey.error}</span>
          )}
        </div>

        {/* Recording Button */}
        {recording.state === 'idle' && !transcript && !isTranscribing && (
          <div className="flex flex-col items-center py-16">
            <button
              onClick={recording.startRecording}
              className="w-32 h-32 rounded-full bg-primary hover:bg-primary/90
                transition-all duration-300 flex items-center justify-center
                shadow-lg hover:shadow-primary/30 hover:scale-105 active:scale-95"
            >
              <svg className="w-16 h-16 text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <p className="mt-6 text-text-muted">Click to start recording</p>
            <p className="text-sm text-text-muted mt-2">
              or press{' '}
              <kbd className="px-2 py-1 bg-secondary rounded text-text text-xs">
                {settings.hotkey.replace('CommandOrControl', 'Ctrl')}
              </kbd>
            </p>
          </div>
        )}

        {/* Transcribing State */}
        {isTranscribing && (
          <div className="flex flex-col items-center py-16">
            <div className="w-32 h-32 rounded-full bg-secondary flex items-center justify-center">
              <svg className="animate-spin h-16 w-16 text-primary" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="mt-6 text-text">Transcribing audio...</p>
            <p className="text-sm text-text-muted mt-2">Using whisper for speech-to-text</p>
          </div>
        )}

        {/* Transcription Error */}
        {transcriptionError && !transcript && (
          <div className="flex flex-col items-center py-16">
            <div className="p-6 bg-error/10 border border-error rounded-lg text-error max-w-md text-center">
              <h3 className="font-semibold mb-2">Transcription Failed</h3>
              <p className="text-sm mb-4">{transcriptionError}</p>
              <button
                onClick={() => {
                  setTranscriptionError(null);
                }}
                className="btn-secondary text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {transcript && (
          <div className="space-y-6">
            {/* Transcript */}
            <div className="card">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-text">Transcript</h2>
                <button
                  onClick={handleNewRecording}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  New Recording
                </button>
              </div>
              <div className="p-4 bg-background rounded-lg text-text whitespace-pre-wrap">
                {transcript}
              </div>
            </div>

            {/* Enrichment Controls */}
            <div className="grid grid-cols-2 gap-6">
              <EnrichmentModeSelector
                value={enrichmentMode}
                onChange={setEnrichmentMode}
                customPrompt={customPrompt}
                onCustomPromptChange={setCustomPrompt}
                disabled={isEnriching}
              />
              <OutputRouter
                value={outputTarget}
                onChange={setOutputTarget}
                content={enrichedContent || undefined}
                disabled={isEnriching}
              />
            </div>

            {/* Enrich Button */}
            {!enrichedContent && (
              <button
                onClick={() => handleEnrich()}
                disabled={isEnriching || llm.isProcessing}
                className="w-full btn-accent py-4 text-lg"
              >
                {isEnriching || llm.isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Enrich Transcript'
                )}
              </button>
            )}

            {/* LLM Error */}
            {llm.error && (
              <div className="p-4 bg-error/10 border border-error rounded-lg text-error">
                {llm.error}
              </div>
            )}

            {/* Enriched Content */}
            {enrichedContent && (
              <div className="card">
                <h2 className="text-lg font-semibold text-text mb-3">
                  Enriched Content
                </h2>
                <div className="p-4 bg-background rounded-lg text-text whitespace-pre-wrap">
                  {enrichedContent}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-secondary mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-text-muted text-sm">
          Voice Intelligence - Privacy-first voice processing
        </div>
      </footer>
    </div>
  );
}
