'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';

interface SetupWizardProps {
  settings: Settings;
  onComplete: (updates: Partial<Settings>) => Promise<void>;
  onSkip: () => void;
}

type Step = 'welcome' | 'microphone' | 'transcription' | 'llm' | 'complete';

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface WhisperCheckResult {
  available: boolean;
  path: string | null;
}

export function SetupWizard({ settings, onComplete, onSkip }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [microphones, setMicrophones] = useState<AudioDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>(settings.selectedMicrophone || '');
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey || '');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestResult, setMicTestResult] = useState<'success' | 'error' | null>(null);
  const [isInstallingWhisper, setIsInstallingWhisper] = useState(false);
  const [whisperInstallStatus, setWhisperInstallStatus] = useState<string | null>(null);
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);
  const [whisperPath, setWhisperPath] = useState<string>(settings.whisperPath || '');
  const [isSaving, setIsSaving] = useState(false);

  const loadMicrophones = useCallback(async () => {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        }));

      setMicrophones(audioInputs);
      if (audioInputs.length > 0 && !selectedMic) {
        setSelectedMic(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to load microphones:', error);
    }
  }, [selectedMic]);

  const checkWhisperAvailable = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<WhisperCheckResult>('check_whisper_available', {
        savedPath: settings.whisperPath || null,
      });
      setWhisperAvailable(result.available);
      if (result.path) {
        setWhisperPath(result.path);
      }
    } catch {
      setWhisperAvailable(false);
    }
  }, [settings.whisperPath]);

  // Load microphones
  useEffect(() => {
    loadMicrophones();
    checkWhisperAvailable();
  }, [loadMicrophones, checkWhisperAvailable]);

  const testMicrophone = async () => {
    setIsTestingMic(true);
    setMicTestResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined }
      });

      // Create audio context to analyze
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Check for audio input over 2 seconds
      let hasSound = false;
      const checkInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        if (average > 10) {
          hasSound = true;
        }
      }, 100);

      await new Promise(resolve => setTimeout(resolve, 2000));
      clearInterval(checkInterval);

      // Cleanup
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();

      setMicTestResult(hasSound ? 'success' : 'error');
    } catch (error) {
      console.error('Mic test failed:', error);
      setMicTestResult('error');
    } finally {
      setIsTestingMic(false);
    }
  };

  const installWhisper = async () => {
    setIsInstallingWhisper(true);
    setWhisperInstallStatus('Checking system requirements...');

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      setWhisperInstallStatus('Downloading whisper.cpp...');
      const result = await invoke<{ success: boolean; message: string; path: string | null }>('install_whisper');

      if (result.success) {
        setWhisperInstallStatus('Installation complete!');
        setWhisperAvailable(true);
        if (result.path) {
          setWhisperPath(result.path);
        }
      } else {
        setWhisperInstallStatus(`Installation failed: ${result.message}`);
      }
    } catch (error) {
      setWhisperInstallStatus(`Error: ${error instanceof Error ? error.message : 'Installation failed'}`);
    } finally {
      setIsInstallingWhisper(false);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      await onComplete({
        selectedMicrophone: selectedMic,
        openaiApiKey: openaiKey || undefined,
        whisperPath: whisperPath || undefined,
        setupComplete: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    const steps: Step[] = ['welcome', 'microphone', 'transcription', 'llm', 'complete'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: Step[] = ['welcome', 'microphone', 'transcription', 'llm', 'complete'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-secondary rounded-2xl max-w-lg w-full p-8 shadow-2xl">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {['welcome', 'microphone', 'transcription', 'llm', 'complete'].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                s === step ? 'bg-primary' : 'bg-secondary'
              }`}
            />
          ))}
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary flex items-center justify-center">
              <svg className="w-12 h-12 text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-text mb-3">Welcome to Voice Intelligence</h2>
            <p className="text-text-muted mb-8">
              Let&apos;s set up your microphone and transcription settings to get you started.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={onSkip} className="btn-secondary px-6 py-3">
                Skip Setup
              </button>
              <button onClick={nextStep} className="btn-primary px-6 py-3">
                Get Started
              </button>
            </div>
          </div>
        )}

        {/* Microphone Step */}
        {step === 'microphone' && (
          <div>
            <h2 className="text-xl font-bold text-text mb-2">Select Microphone</h2>
            <p className="text-text-muted mb-6">Choose which microphone to use for recording.</p>

            <div className="space-y-3 mb-6">
              {microphones.length === 0 ? (
                <div className="p-4 bg-error/10 border border-error rounded-lg text-error text-sm">
                  No microphones found. Please connect a microphone and refresh.
                </div>
              ) : (
                microphones.map((mic) => (
                  <label
                    key={mic.deviceId}
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedMic === mic.deviceId
                        ? 'border-primary bg-primary/10'
                        : 'border-secondary hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="microphone"
                      value={mic.deviceId}
                      checked={selectedMic === mic.deviceId}
                      onChange={(e) => setSelectedMic(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedMic === mic.deviceId ? 'border-primary' : 'border-text-muted'
                    }`}>
                      {selectedMic === mic.deviceId && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-text">{mic.label}</span>
                  </label>
                ))
              )}
            </div>

            {/* Test Microphone */}
            <div className="mb-6">
              <button
                onClick={testMicrophone}
                disabled={isTestingMic || !selectedMic}
                className="btn-secondary w-full py-3"
              >
                {isTestingMic ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Testing... Speak now!
                  </span>
                ) : (
                  'Test Microphone'
                )}
              </button>
              {micTestResult === 'success' && (
                <p className="text-success text-sm mt-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Microphone is working!
                </p>
              )}
              {micTestResult === 'error' && (
                <p className="text-error text-sm mt-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  No audio detected. Try speaking louder or select a different mic.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="btn-secondary flex-1 py-3">
                Back
              </button>
              <button onClick={nextStep} className="btn-primary flex-1 py-3">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Transcription Step */}
        {step === 'transcription' && (
          <div>
            <h2 className="text-xl font-bold text-text mb-2">Speech-to-Text Setup</h2>
            <p className="text-text-muted mb-6">Choose how to transcribe your voice recordings.</p>

            {/* Whisper.cpp Status */}
            <div className={`p-4 rounded-lg border mb-4 ${
              whisperAvailable ? 'border-success bg-success/10' : 'border-secondary'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text">Local Transcription (whisper.cpp)</span>
                  {whisperAvailable && (
                    <span className="text-xs bg-success text-black px-2 py-0.5 rounded">Installed</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-text-muted mb-3">
                {whisperAvailable
                  ? 'whisper.cpp is installed. Your audio will be transcribed locally for maximum privacy.'
                  : 'Transcribe audio locally on your device. No data leaves your computer.'}
              </p>

              {!whisperAvailable && (
                <button
                  onClick={installWhisper}
                  disabled={isInstallingWhisper}
                  className="btn-secondary text-sm w-full py-2"
                >
                  {isInstallingWhisper ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Installing...
                    </span>
                  ) : (
                    'Install whisper.cpp'
                  )}
                </button>
              )}

              {whisperInstallStatus && (
                <p className={`text-sm mt-2 ${
                  whisperInstallStatus.includes('complete') ? 'text-success' :
                  whisperInstallStatus.includes('failed') || whisperInstallStatus.includes('Error') ? 'text-error' :
                  'text-text-muted'
                }`}>
                  {whisperInstallStatus}
                </p>
              )}
            </div>

            {/* Cloud Option */}
            <div className="p-4 rounded-lg border border-secondary">
              <div className="font-medium text-text mb-2">Cloud Transcription (OpenAI Whisper)</div>
              <p className="text-sm text-text-muted mb-3">
                Use OpenAI&apos;s Whisper API. Requires an API key. Audio is sent to OpenAI servers.
              </p>
              <p className="text-xs text-text-muted">
                Configure in the next step with your OpenAI API key.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={prevStep} className="btn-secondary flex-1 py-3">
                Back
              </button>
              <button onClick={nextStep} className="btn-primary flex-1 py-3">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* LLM Step */}
        {step === 'llm' && (
          <div>
            <h2 className="text-xl font-bold text-text mb-2">API Key Setup</h2>
            <p className="text-text-muted mb-6">
              Add your OpenAI API key for transcription and AI enrichment.
              {whisperAvailable && ' (Optional if using local whisper.cpp)'}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="input w-full"
                />
                <p className="text-xs text-text-muted mt-1">
                  Get your API key at{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    platform.openai.com/api-keys
                  </a>
                </p>
              </div>
            </div>

            {!whisperAvailable && !openaiKey && (
              <div className="p-3 bg-warning/10 border border-warning rounded-lg text-warning text-sm mb-6">
                <strong>Note:</strong> Without whisper.cpp or an API key, transcription won&apos;t work.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={prevStep} className="btn-secondary flex-1 py-3">
                Back
              </button>
              <button onClick={nextStep} className="btn-primary flex-1 py-3">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-text mb-3">You&apos;re All Set!</h2>
            <p className="text-text-muted mb-6">
              Your settings have been configured. You can change them anytime in Settings.
            </p>

            <div className="bg-secondary/50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-text mb-2">Your Configuration:</h3>
              <ul className="text-sm text-text-muted space-y-1">
                <li>• Microphone: {microphones.find(m => m.deviceId === selectedMic)?.label || 'Default'}</li>
                <li>• Local transcription: {whisperAvailable ? 'Available' : 'Not installed'}</li>
                <li>• OpenAI API: {openaiKey ? 'Configured' : 'Not configured'}</li>
              </ul>
            </div>

            <button
              onClick={handleComplete}
              disabled={isSaving}
              className="btn-primary w-full py-3"
            >
              {isSaving ? 'Saving...' : 'Start Using Voice Intelligence'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
