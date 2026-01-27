'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Settings, EnrichmentMode } from '../types';
import {
  COMMON_HOTKEYS,
  ENRICHMENT_MODES,
  LANGUAGES,
  LLM_PROVIDERS,
  OUTPUT_TARGETS,
  RETENTION_OPTIONS,
} from '../lib/config';
import { MicrophoneSelector } from './MicrophoneSelector';
import { OPENROUTER_MODELS } from '../providers/openrouter';
import { getAppVersion } from '../lib/api';

// OpenAI models
const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous flagship' },
];

interface WhisperCheckResult {
  available: boolean;
  path: string | null;
}

interface SettingsPanelProps {
  settings: Settings;
  onSave: (settings: Partial<Settings>) => Promise<void>;
  isLoading?: boolean;
  onClose?: () => void;
}

export function SettingsPanel({ settings, onSave, isLoading, onClose }: SettingsPanelProps) {
  const router = useRouter();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: settings.openaiApiKey || '',
    openrouter: settings.openrouterApiKey || '',
  });
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({
    openai: false,
    openrouter: false,
  });
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);
  const [whisperPath, setWhisperPath] = useState<string>(settings.whisperPath || '');
  const [isInstallingWhisper, setIsInstallingWhisper] = useState(false);
  const [whisperInstallStatus, setWhisperInstallStatus] = useState<string | null>(null);
  const [isVerifyingPath, setIsVerifyingPath] = useState(false);
  const [pathVerifyResult, setPathVerifyResult] = useState<'success' | 'error' | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  // Fetch app version
  useEffect(() => {
    getAppVersion().then(setAppVersion);
  }, []);

  // Check whisper availability
  const checkWhisperAvailable = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<WhisperCheckResult>('check_whisper_available', {
        savedPath: settings.whisperPath || null,
      });
      setWhisperAvailable(result.available);
      if (result.path && !whisperPath) {
        setWhisperPath(result.path);
      }
    } catch {
      setWhisperAvailable(false);
    }
  }, [settings.whisperPath, whisperPath]);

  useEffect(() => {
    checkWhisperAvailable();
  }, [checkWhisperAvailable]);

  const installWhisper = async () => {
    setIsInstallingWhisper(true);
    setWhisperInstallStatus('Downloading whisper.cpp...');

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ success: boolean; message: string; path: string | null }>('install_whisper');

      if (result.success) {
        setWhisperInstallStatus('Installation complete!');
        setWhisperAvailable(true);
        if (result.path) {
          setWhisperPath(result.path);
          // Save the path immediately
          handleChange('whisperPath', result.path);
        }
      } else {
        setWhisperInstallStatus(result.message);
      }
    } catch (error) {
      setWhisperInstallStatus(`Error: ${error instanceof Error ? error.message : 'Installation failed'}`);
    } finally {
      setIsInstallingWhisper(false);
    }
  };

  const selectWhisperPath = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Executable',
          extensions: process.platform === 'win32' ? ['exe'] : ['*'],
        }],
      });

      if (selected && typeof selected === 'string') {
        setWhisperPath(selected);
        verifyWhisperPath(selected);
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
    }
  };

  const verifyWhisperPath = async (path: string) => {
    setIsVerifyingPath(true);
    setPathVerifyResult(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<WhisperCheckResult>('verify_whisper_path', { path });

      if (result.available) {
        setPathVerifyResult('success');
        setWhisperAvailable(true);
        handleChange('whisperPath', path);
      } else {
        setPathVerifyResult('error');
      }
    } catch {
      setPathVerifyResult('error');
    } finally {
      setIsVerifyingPath(false);
    }
  };

  const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Include API keys in the settings if provided
      const settingsToSave: Partial<Settings> = { ...localSettings };
      if (apiKeys.openai) {
        settingsToSave.openaiApiKey = apiKeys.openai;
      }
      if (apiKeys.openrouter) {
        settingsToSave.openrouterApiKey = apiKeys.openrouter;
      }
      await onSave(settingsToSave);
      setSaveSuccess(true);
      // Close modal or navigate back after short delay
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          router.push('/');
        }
      }, 500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="space-y-8">
      {/* Microphone Settings */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Microphone</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Select Microphone
            </label>
            <MicrophoneSelector
              value={localSettings.selectedMicrophone}
              onChange={(deviceId) => handleChange('selectedMicrophone', deviceId)}
              disabled={isLoading}
            />
            <p className="text-xs text-text-muted mt-2">
              Choose which microphone to use for recording
            </p>
          </div>
        </div>
      </section>

      {/* Transcription Settings */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Transcription</h3>
        <div className="space-y-4">
          {/* Whisper.cpp Status */}
          <div className={`p-4 rounded-lg border ${
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
                ? 'whisper.cpp is installed. Audio is transcribed locally for maximum privacy.'
                : 'Install whisper.cpp for local, private transcription. No data leaves your computer.'}
            </p>

            {/* Show current path if available */}
            {whisperAvailable && whisperPath && (
              <div className="text-xs text-text-muted bg-secondary/50 rounded p-2 mb-3 font-mono break-all">
                {whisperPath}
              </div>
            )}

            {!whisperAvailable && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={installWhisper}
                  disabled={isInstallingWhisper}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  {isInstallingWhisper ? (
                    <span className="flex items-center gap-2">
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
                <button
                  onClick={selectWhisperPath}
                  disabled={isInstallingWhisper || isVerifyingPath}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  Select Path Manually
                </button>
              </div>
            )}

            {/* Manual path input */}
            {!whisperAvailable && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Or enter path manually:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={whisperPath}
                    onChange={(e) => setWhisperPath(e.target.value)}
                    placeholder="Path to whisper executable..."
                    className="input flex-1 text-sm"
                  />
                  <button
                    onClick={() => verifyWhisperPath(whisperPath)}
                    disabled={!whisperPath || isVerifyingPath}
                    className="btn-secondary text-sm px-3"
                  >
                    {isVerifyingPath ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {pathVerifyResult === 'success' && (
                  <p className="text-success text-xs mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Valid whisper executable found!
                  </p>
                )}
                {pathVerifyResult === 'error' && (
                  <p className="text-error text-xs mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Invalid path or not a whisper executable
                  </p>
                )}
              </div>
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

          {/* Cloud Fallback Info */}
          <div className="p-4 rounded-lg border border-secondary">
            <div className="font-medium text-text mb-2">Cloud Transcription (OpenAI Whisper)</div>
            <p className="text-sm text-text-muted">
              Fallback option using OpenAI&apos;s Whisper API. Requires an API key configured below.
            </p>
          </div>
        </div>
      </section>

      {/* Hotkey Settings */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Global Hotkey</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Activation Shortcut
            </label>
            <select
              value={localSettings.hotkey}
              onChange={(e) => handleChange('hotkey', e.target.value)}
              className="input w-full"
            >
              {COMMON_HOTKEYS.map((hk) => (
                <option key={hk.value} value={hk.value}>
                  {hk.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">
              This shortcut will activate voice recording from any application
            </p>
          </div>
        </div>
      </section>

      {/* LLM Provider Settings */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">LLM Provider</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LLM_PROVIDERS.map((provider) => (
                <button
                  key={provider.value}
                  onClick={() => {
                    handleChange('llmProvider', provider.value);
                    // Set default model for the provider
                    const defaultModel = provider.value === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini';
                    handleChange('llmModel', defaultModel);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all
                    ${localSettings.llmProvider === provider.value
                      ? 'border-primary bg-primary/10'
                      : 'border-secondary hover:border-primary/50'
                    }`}
                >
                  <div className="font-medium text-text">{provider.label}</div>
                  <div className="text-xs text-text-muted">{provider.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              {localSettings.llmProvider === 'openai' ? 'OpenAI' : 'OpenRouter'} API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey[localSettings.llmProvider] ? 'text' : 'password'}
                value={apiKeys[localSettings.llmProvider]}
                onChange={(e) =>
                  setApiKeys((prev) => ({
                    ...prev,
                    [localSettings.llmProvider]: e.target.value,
                  }))
                }
                placeholder={`Enter your ${localSettings.llmProvider === 'openai' ? 'OpenAI' : 'OpenRouter'} API key`}
                className="input w-full pr-20"
              />
              <button
                type="button"
                onClick={() =>
                  setShowApiKey((prev) => ({
                    ...prev,
                    [localSettings.llmProvider]: !prev[localSettings.llmProvider],
                  }))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-sm text-text-muted hover:text-text"
              >
                {showApiKey[localSettings.llmProvider] ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Your API key is stored securely in your system keychain
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Model
            </label>
            <select
              value={localSettings.llmModel || (localSettings.llmProvider === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini')}
              onChange={(e) => handleChange('llmModel', e.target.value)}
              className="input w-full"
            >
              {localSettings.llmProvider === 'openai' ? (
                OPENAI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))
              ) : (
                OPENROUTER_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-text-muted mt-1">
              {localSettings.llmProvider === 'openrouter'
                ? 'OpenRouter provides access to many AI models'
                : 'Choose the OpenAI model for text enrichment'}
            </p>
          </div>
        </div>
      </section>

      {/* Enrichment Settings */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Enrichment</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Default Mode
            </label>
            <select
              value={localSettings.enrichmentMode}
              onChange={(e) => handleChange('enrichmentMode', e.target.value as EnrichmentMode)}
              className="input w-full"
            >
              {ENRICHMENT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label} - {mode.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-text">Auto-enrich</div>
              <div className="text-sm text-text-muted">
                Automatically process transcript after recording
              </div>
            </div>
            <button
              onClick={() => handleChange('autoEnrich', !localSettings.autoEnrich)}
              className={`relative w-12 h-6 rounded-full transition-colors
                ${localSettings.autoEnrich ? 'bg-primary' : 'bg-secondary'}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform
                  ${localSettings.autoEnrich ? 'translate-x-6' : ''}`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Output Settings */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Output</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Default Destination
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OUTPUT_TARGETS.map((target) => (
                <button
                  key={target.value}
                  onClick={() => handleChange('outputTarget', target.value)}
                  className={`p-3 rounded-lg border text-left transition-all
                    ${localSettings.outputTarget === target.value
                      ? 'border-primary bg-primary/10'
                      : 'border-secondary hover:border-primary/50'
                    }`}
                >
                  <div className="font-medium text-text">{target.label}</div>
                  <div className="text-xs text-text-muted">{target.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Language Settings */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Language</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Transcription Language
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => handleChange('language', lang.value)}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${localSettings.language === lang.value
                      ? 'border-primary bg-primary/10'
                      : 'border-secondary hover:border-primary/50'
                    }`}
                >
                  <div className="text-2xl mb-1">{lang.flag}</div>
                  <div className="font-medium text-text text-sm">{lang.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* History Settings */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">History</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Retention Period
            </label>
            <select
              value={localSettings.retentionDays}
              onChange={(e) => handleChange('retentionDays', parseInt(e.target.value))}
              className="input w-full"
            >
              {RETENTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">
              Older transcriptions will be automatically deleted
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-text">Show Notifications</div>
              <div className="text-sm text-text-muted">
                Display system notifications for actions
              </div>
            </div>
            <button
              onClick={() => handleChange('showNotifications', !localSettings.showNotifications)}
              className={`relative w-12 h-6 rounded-full transition-colors
                ${localSettings.showNotifications ? 'bg-primary' : 'bg-secondary'}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform
                  ${localSettings.showNotifications ? 'translate-x-6' : ''}`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">About</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-text">VoiceIntelli</span>
            <span className="text-text-muted font-mono">
              {appVersion ? `v${appVersion}` : 'Loading...'}
            </span>
          </div>
          <p className="text-xs text-text-muted">
            Voice-to-text transcription with AI enrichment
          </p>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={handleCancel}
          className="btn-secondary px-8 py-3"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="btn-primary px-8 py-3"
        >
          {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
