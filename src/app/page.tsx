'use client';

import { useState, useEffect, useCallback } from 'react';
import { RecordingOverlay } from '../components/RecordingOverlay';
import { EnrichmentModeSelector } from '../components/EnrichmentModeSelector';
import { OutputRouter } from '../components/OutputRouter';
import { SettingsPanel } from '../components/SettingsPanel';
import { useSettings } from '../hooks/useSettings';
import { useRecording } from '../hooks/useRecording';
import { useHotkey } from '../hooks/useHotkey';
import { useLLM } from '../hooks/useLLM';
import type { EnrichmentMode, OutputTarget } from '../types';
import { addToHistory, getHistory, getAppVersion, type HistoryItem } from '../lib/api';
import { getSTTService } from '../services/stt';
import { SetupWizard } from '../components/SetupWizard';

export default function Home() {
  const { settings, isLoading: settingsLoading, updateSettings } = useSettings();
  const recording = useRecording({ selectedMicrophone: settings.selectedMicrophone });
  const llm = useLLM(settings.llmProvider);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryItem[]>([]);

  const [enrichmentMode, setEnrichmentMode] = useState<EnrichmentMode>(settings.enrichmentMode);
  const [outputTarget, setOutputTarget] = useState<OutputTarget>(settings.outputTarget);
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt || '');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [enrichedContent, setEnrichedContent] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [sttConfigured, setSTTConfigured] = useState<boolean | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  // Update local state when settings load
  useEffect(() => {
    if (!settingsLoading) {
      setEnrichmentMode(settings.enrichmentMode);
      setOutputTarget(settings.outputTarget);
      setCustomPrompt(settings.customPrompt || '');
      llm.setLanguage(settings.language);

      // Configure LLM provider with API key
      if (settings.llmProvider === 'openai' && settings.openaiApiKey) {
        llm.configureProvider('openai', settings.openaiApiKey, settings.llmModel);
      } else if (settings.llmProvider === 'openrouter' && settings.openrouterApiKey) {
        llm.configureProvider('openrouter', settings.openrouterApiKey, settings.llmModel);
      }

      // Check if STT is configured
      const checkSTT = async () => {
        const sttService = getSTTService();
        if (settings.openaiApiKey) {
          sttService.configureOpenAI(settings.openaiApiKey);
        }
        if (settings.whisperPath) {
          sttService.configureWhisperPath(settings.whisperPath);
        }
        const provider = await sttService.getAvailableProvider();
        setSTTConfigured(provider !== null);
      };
      checkSTT();

      // Show setup wizard if not completed
      if (!settings.setupComplete) {
        setShowSetupWizard(true);
      }
    }
  }, [settings, settingsLoading, llm]);

  // Fetch app version on mount
  useEffect(() => {
    getAppVersion().then(setAppVersion);
  }, []);

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

  // Re-enrich when enrichment mode changes (if content already exists)
  useEffect(() => {
    if (transcript && enrichedContent && !isEnriching) {
      handleEnrich();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichmentMode]);

  // Auto-show transcript modal when transcript is set
  useEffect(() => {
    if (transcript) {
      setShowTranscriptModal(true);
    }
  }, [transcript]);

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
    setShowTranscriptModal(false);
    setTranscript(null);
    setEnrichedContent(null);
    recording.startRecording();
  };

  const handleSetupComplete = async (updates: Partial<typeof settings>) => {
    await updateSettings(updates);
    setShowSetupWizard(false);
  };

  const handleSetupSkip = () => {
    setShowSetupWizard(false);
  };

  // Load history when showing history modal
  const handleShowHistory = async () => {
    try {
      const entries = await getHistory();
      setHistoryEntries(entries);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
    setShowHistory(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Setup Wizard */}
      {showSetupWizard && (
        <SetupWizard
          settings={settings}
          onComplete={handleSetupComplete}
          onSkip={handleSetupSkip}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto">
          <div className="min-h-screen py-8 px-4 w-full max-w-2xl">
            <div className="bg-background rounded-lg shadow-xl">
              <div className="border-b border-secondary px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-text">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-text-muted hover:text-text transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <SettingsPanel
                  settings={settings}
                  onSave={updateSettings}
                  isLoading={settingsLoading}
                  onClose={() => setShowSettings(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto">
          <div className="min-h-screen py-8 px-4 w-full max-w-4xl">
            <div className="bg-background rounded-lg shadow-xl">
              <div className="border-b border-secondary px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-text">History</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-text-muted hover:text-text transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                {historyEntries.length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <p>No recordings yet</p>
                    <p className="text-sm mt-2">Your transcription history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historyEntries.map((entry) => (
                      <div key={entry.id} className="card">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm text-text-muted">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                          <span className="text-xs bg-secondary px-2 py-1 rounded text-text-muted">
                            {entry.enrichmentMode}
                          </span>
                        </div>
                        <p className="text-text mb-2">{entry.rawTranscript}</p>
                        {entry.enrichedContent && (
                          <div className="mt-3 pt-3 border-t border-secondary">
                            <p className="text-sm text-text-muted mb-1">Enriched:</p>
                            <p className="text-text text-sm">{entry.enrichedContent}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Modal */}
      {showTranscriptModal && transcript && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto">
          <div className="min-h-screen py-8 px-4 w-full max-w-2xl">
            <div className="bg-background rounded-lg shadow-xl">
              {/* Modal Header with X button */}
              <div className="border-b border-secondary px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-text">Transcript</h2>
                <button
                  onClick={() => setShowTranscriptModal(false)}
                  className="text-text-muted hover:text-text transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Transcript Content */}
                <div className="card">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-text">Recording</h3>
                    <button
                      onClick={handleNewRecording}
                      className="btn-secondary text-sm px-3 py-1.5"
                    >
                      New Recording
                    </button>
                  </div>
                  <div className="p-4 bg-background rounded-lg text-text whitespace-pre-wrap max-h-[10.5rem] overflow-y-auto">
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
                    <h3 className="text-lg font-semibold text-text mb-3">
                      Enriched Content
                    </h3>
                    <div className="p-4 bg-background rounded-lg text-text whitespace-pre-wrap max-h-[10.5rem] overflow-y-auto">
                      {enrichedContent}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer with Cancel button */}
              <div className="border-t border-secondary px-6 py-4 flex justify-end">
                <button
                  onClick={() => setShowTranscriptModal(false)}
                  className="btn-secondary px-6 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <button
              onClick={handleShowHistory}
              className="text-text-muted hover:text-text transition-colors"
            >
              History
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-text-muted hover:text-text transition-colors"
            >
              Settings
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {/* Status Bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full ${
                hotkey.isLoading ? 'bg-warning animate-pulse' :
                hotkey.isRegistered ? 'bg-success' : 'bg-error'
              }`}
            />
            <span className="text-sm text-text-muted">
              {hotkey.isLoading
                ? 'Registering hotkey...'
                : hotkey.isRegistered
                  ? `Press ${settings.hotkey.replace('CommandOrControl', 'Ctrl')} to record`
                  : 'Hotkey not registered'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {sttConfigured === false && (
              <button
                onClick={() => setShowSettings(true)}
                className="text-sm text-warning hover:text-warning/80 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Configure transcription
              </button>
            )}
            {hotkey.error && !hotkey.isLoading && (
              <span className="text-sm text-error">{hotkey.error}</span>
            )}
          </div>
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
            <div className="p-6 bg-error/10 border border-error rounded-lg max-w-2xl w-full">
              <h3 className="font-semibold mb-2 text-error">Transcription Failed</h3>

              {/* Short error summary */}
              <p className="text-sm mb-4 text-text-muted">
                {transcriptionError.split('\n')[0]}
              </p>

              {/* Detailed error (expandable) */}
              {transcriptionError.includes('\n') && (
                <details className="mb-4">
                  <summary className="text-sm text-primary cursor-pointer hover:underline">
                    Show details
                  </summary>
                  <pre className="mt-2 p-3 bg-secondary/50 rounded text-xs text-text-muted overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {transcriptionError}
                  </pre>
                </details>
              )}

              {transcriptionError.includes('No speech-to-text provider') ||
               transcriptionError.includes('live audio input') ? (
                <div className="text-sm text-text mb-4 space-y-2">
                  <p className="font-medium">To enable transcription, you need one of:</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li><strong>OpenAI API Key</strong> - Add in Settings for cloud transcription</li>
                    <li><strong>whisper.cpp</strong> - Install locally for private transcription</li>
                  </ul>
                </div>
              ) : null}

              {transcriptionError.includes('Whisper binary not found') ||
               transcriptionError.includes('transcribe_audio') ? (
                <div className="text-sm text-text mb-4 space-y-2">
                  <p className="font-medium">Whisper.cpp is not properly configured:</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>Go to Settings and install whisper.cpp</li>
                    <li>Or manually select the whisper executable path</li>
                    <li>Make sure a whisper model is downloaded</li>
                  </ul>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={() => setTranscriptionError(null)}
                  className="btn-secondary text-sm"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="btn-primary text-sm"
                >
                  Open Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Section - Placeholder when transcript exists but modal is closed */}
        {transcript && !showTranscriptModal && (
          <div className="flex flex-col items-center py-16">
            <button
              onClick={() => setShowTranscriptModal(true)}
              className="btn-primary px-6 py-3"
            >
              View Transcript
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-secondary mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between text-text-muted text-sm">
          <span>Voice Intelligence - Privacy-first voice processing</span>
          {appVersion && <span>v{appVersion}</span>}
        </div>
      </footer>
    </div>
  );
}
