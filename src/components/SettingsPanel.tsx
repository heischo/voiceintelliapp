'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Settings, EnrichmentMode, WhisperModel, DownloadProgress, NotionPage } from '../types';
import { searchNotionPages, testNotionConnection } from '../lib/notion';
import {
  COMMON_HOTKEYS,
  ENRICHMENT_MODES,
  LANGUAGES,
  LLM_PROVIDERS,
  RETENTION_OPTIONS,
} from '../lib/config';
import { MicrophoneSelector } from './MicrophoneSelector';
import { OPENROUTER_MODELS } from '../providers/openrouter';
import { getAppVersion, getAvailableModels, downloadWhisperModel, deleteWhisperModel, onDownloadProgress, checkOllamaAvailable, getOllamaModels, pullOllamaModel, onOllamaPullProgress } from '../lib/api';
import type { OllamaServiceStatus, OllamaModel, OllamaPullProgress } from '../types/llm';

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
    openaiWhisper: settings.openaiWhisperApiKey || '',
    notion: settings.notionApiKey || '',
  });
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({
    openai: false,
    openrouter: false,
    openaiWhisper: false,
    notion: false,
  });
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);
  const [whisperPath, setWhisperPath] = useState<string>(settings.whisperPath || '');
  const [isInstallingWhisper, setIsInstallingWhisper] = useState(false);
  const [whisperInstallStatus, setWhisperInstallStatus] = useState<string | null>(null);
  const [isVerifyingPath, setIsVerifyingPath] = useState(false);
  const [pathVerifyResult, setPathVerifyResult] = useState<'success' | 'error' | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  // Offline components state
  const [availableModels, setAvailableModels] = useState<WhisperModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [downloadingModels, setDownloadingModels] = useState<Record<string, number>>({});
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
  const [deletingModels, setDeletingModels] = useState<Record<string, boolean>>({});

  // OLLAMA state
  const [ollamaStatus, setOllamaStatus] = useState<OllamaServiceStatus | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingOllama, setIsLoadingOllama] = useState(false);

  // OLLAMA model pull state
  const [ollamaPullModelName, setOllamaPullModelName] = useState<string>('');
  const [ollamaPullingModels, setOllamaPullingModels] = useState<Record<string, number>>({});
  const [ollamaPullErrors, setOllamaPullErrors] = useState<Record<string, string>>({});

  // Notion state
  const [notionPages, setNotionPages] = useState<NotionPage[]>([]);
  const [isTestingNotion, setIsTestingNotion] = useState(false);
  const [notionTestResult, setNotionTestResult] = useState<'success' | 'error' | null>(null);
  const [notionTestError, setNotionTestError] = useState<string | null>(null);
  const [notionDefaultPageId, setNotionDefaultPageId] = useState<string>(settings.notionDefaultPageId || '');
  const [notionDefaultPageName, setNotionDefaultPageName] = useState<string>(settings.notionDefaultPageName || '');

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

  // Load available models
  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const models = await getAvailableModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Check OLLAMA availability and load models
  const checkOllamaStatus = useCallback(async () => {
    setIsLoadingOllama(true);
    try {
      const status = await checkOllamaAvailable();
      setOllamaStatus(status);
      if (status.available) {
        const models = await getOllamaModels();
        setOllamaModels(models);
      } else {
        setOllamaModels([]);
      }
    } catch (error) {
      console.error('Failed to check OLLAMA status:', error);
      setOllamaStatus({ available: false, version: null, baseUrl: 'http://localhost:11434' });
      setOllamaModels([]);
    } finally {
      setIsLoadingOllama(false);
    }
  }, []);

  useEffect(() => {
    checkOllamaStatus();
  }, [checkOllamaStatus]);

  // Listen for download progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onDownloadProgress((progress: DownloadProgress) => {
      if (progress.status === 'downloading') {
        setDownloadingModels((prev) => ({
          ...prev,
          [progress.modelId]: progress.percentage,
        }));
        // Clear any previous error for this model
        setDownloadErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[progress.modelId];
          return newErrors;
        });
      } else if (progress.status === 'completed') {
        setDownloadingModels((prev) => {
          const newState = { ...prev };
          delete newState[progress.modelId];
          return newState;
        });
        // Reload models to get updated installed status
        loadModels();
      } else if (progress.status === 'error') {
        setDownloadingModels((prev) => {
          const newState = { ...prev };
          delete newState[progress.modelId];
          return newState;
        });
        setDownloadErrors((prev) => ({
          ...prev,
          [progress.modelId]: 'Download failed. Please try again.',
        }));
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [loadModels]);

  // Listen for OLLAMA pull progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onOllamaPullProgress((progress: OllamaPullProgress) => {
      if (progress.status === 'downloading' || progress.status === 'pulling') {
        setOllamaPullingModels((prev) => ({
          ...prev,
          [progress.modelId]: progress.percentage,
        }));
        // Clear any previous error for this model
        setOllamaPullErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[progress.modelId];
          return newErrors;
        });
      } else if (progress.status === 'success' || progress.status === 'completed') {
        setOllamaPullingModels((prev) => {
          const newState = { ...prev };
          delete newState[progress.modelId];
          return newState;
        });
        // Clear model name input on success
        setOllamaPullModelName('');
        // Reload OLLAMA models to get updated list
        checkOllamaStatus();
      } else if (progress.status === 'error') {
        setOllamaPullingModels((prev) => {
          const newState = { ...prev };
          delete newState[progress.modelId];
          return newState;
        });
        setOllamaPullErrors((prev) => ({
          ...prev,
          [progress.modelId]: 'Pull failed. Please try again.',
        }));
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [checkOllamaStatus]);

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

  const handleDownloadModel = async (modelId: string) => {
    // Clear any previous error
    setDownloadErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[modelId];
      return newErrors;
    });

    // Set initial progress
    setDownloadingModels((prev) => ({
      ...prev,
      [modelId]: 0,
    }));

    try {
      const result = await downloadWhisperModel(modelId);
      if (!result.success) {
        setDownloadErrors((prev) => ({
          ...prev,
          [modelId]: result.message || 'Download failed. Please try again.',
        }));
        setDownloadingModels((prev) => {
          const newState = { ...prev };
          delete newState[modelId];
          return newState;
        });
      }
      // If successful, the download progress listener will handle the rest
    } catch (error) {
      setDownloadErrors((prev) => ({
        ...prev,
        [modelId]: error instanceof Error ? error.message : 'Download failed. Please try again.',
      }));
      setDownloadingModels((prev) => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    setDeletingModels((prev) => ({
      ...prev,
      [modelId]: true,
    }));

    try {
      const success = await deleteWhisperModel(modelId);
      if (success) {
        // Update the model list to reflect deletion
        setAvailableModels((prev) =>
          prev.map((m) =>
            m.id === modelId
              ? { ...m, installed: false, installedPath: undefined }
              : m
          )
        );
      } else {
        // Show error (could add error state similar to download)
        console.error('Failed to delete model:', modelId);
      }
    } catch (error) {
      console.error('Error deleting model:', error);
    } finally {
      setDeletingModels((prev) => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
    }
  };

  const handlePullOllamaModel = async (modelName: string) => {
    if (!modelName.trim()) return;

    const normalizedName = modelName.trim().toLowerCase();

    // Clear any previous error
    setOllamaPullErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[normalizedName];
      return newErrors;
    });

    // Set initial progress
    setOllamaPullingModels((prev) => ({
      ...prev,
      [normalizedName]: 0,
    }));

    try {
      const result = await pullOllamaModel(normalizedName);
      if (!result.success) {
        setOllamaPullErrors((prev) => ({
          ...prev,
          [normalizedName]: result.message || 'Pull failed. Please try again.',
        }));
        setOllamaPullingModels((prev) => {
          const newState = { ...prev };
          delete newState[normalizedName];
          return newState;
        });
      }
      // If successful, the pull progress listener will handle the rest
    } catch (error) {
      setOllamaPullErrors((prev) => ({
        ...prev,
        [normalizedName]: error instanceof Error ? error.message : 'Pull failed. Please try again.',
      }));
      setOllamaPullingModels((prev) => {
        const newState = { ...prev };
        delete newState[normalizedName];
        return newState;
      });
    }
  };

  // Test Notion connection and load pages
  const testNotionAndLoadPages = async () => {
    if (!apiKeys.notion) {
      setNotionTestResult('error');
      setNotionTestError('Please enter an API key first');
      return;
    }

    setIsTestingNotion(true);
    setNotionTestResult(null);
    setNotionTestError(null);
    setNotionPages([]);

    try {
      await testNotionConnection(apiKeys.notion);
      const pages = await searchNotionPages(apiKeys.notion);
      setNotionPages(pages);
      setNotionTestResult('success');

      // If there are pages and no default is set, don't auto-select
      // User should explicitly choose
    } catch (error) {
      setNotionTestResult('error');
      setNotionTestError(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsTestingNotion(false);
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
      if (apiKeys.openaiWhisper) {
        settingsToSave.openaiWhisperApiKey = apiKeys.openaiWhisper;
      }
      if (apiKeys.notion) {
        settingsToSave.notionApiKey = apiKeys.notion;
      }
      // Save Notion default page settings
      if (notionDefaultPageId) {
        settingsToSave.notionDefaultPageId = notionDefaultPageId;
        settingsToSave.notionDefaultPageName = notionDefaultPageName;
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
                ? 'Audio is transcribed locally for maximum privacy. Manage models below.'
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

          {/* Whisper Model Selection - shown when whisper is available and models are installed */}
          {whisperAvailable && availableModels.some(m => m.installed) && (
            <div className="p-4 rounded-lg border border-secondary">
              <label className="block text-sm font-medium text-text mb-2">
                Transcription Model
              </label>
              <select
                value={localSettings.whisperModel || 'base'}
                onChange={(e) => handleChange('whisperModel', e.target.value)}
                className="input w-full"
              >
                {availableModels.filter(m => m.installed).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.size})
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-2">
                Larger models are more accurate but slower. Use multilingual models for non-English languages.
              </p>
            </div>
          )}

          {/* Cloud Fallback */}
          <div className="p-4 rounded-lg border border-secondary">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text">Cloud Transcription (OpenAI Whisper)</span>
                {apiKeys.openaiWhisper && (
                  <span className="text-xs bg-success text-black px-2 py-0.5 rounded">Configured</span>
                )}
              </div>
            </div>
            <p className="text-sm text-text-muted mb-3">
              Fallback option using OpenAI&apos;s Whisper API when local transcription is not available.
            </p>
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                OpenAI Whisper API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey.openaiWhisper ? 'text' : 'password'}
                  value={apiKeys.openaiWhisper}
                  onChange={(e) =>
                    setApiKeys((prev) => ({
                      ...prev,
                      openaiWhisper: e.target.value,
                    }))
                  }
                  placeholder="Enter your OpenAI API key for transcription"
                  className="input w-full pr-20"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowApiKey((prev) => ({
                      ...prev,
                      openaiWhisper: !prev.openaiWhisper,
                    }))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-sm text-text-muted hover:text-text"
                >
                  {showApiKey.openaiWhisper ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Your API key is stored securely in your system keychain
              </p>
            </div>
          </div>

          {/* Whisper Models - integrated from Offline Components */}
          <div className="border-t border-secondary pt-4 mt-4">
            <h4 className="text-md font-semibold text-text mb-3">Available Models</h4>
            <p className="text-sm text-text-muted mb-4">
              Download whisper models for local transcription. Larger models are more accurate but slower.
            </p>

            {isLoadingModels ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-2 text-text-muted">Loading models...</span>
              </div>
            ) : availableModels.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <p>No models available. Please ensure whisper.cpp is installed.</p>
                <button
                  onClick={loadModels}
                  className="btn-secondary mt-4 text-sm py-2 px-4"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {availableModels.map((model) => {
                  const isDownloading = model.id in downloadingModels;
                  const hasError = model.id in downloadErrors;
                  const isDeleting = model.id in deletingModels;

                  return (
                    <div
                      key={model.id}
                      className={`p-3 rounded-lg border ${
                        model.installed ? 'border-success bg-success/10' : 'border-secondary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-text text-sm">{model.name}</span>
                            {model.installed && (
                              <span className="text-xs bg-success text-black px-2 py-0.5 rounded">
                                Installed
                              </span>
                            )}
                            {model.isMultilingual && (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                Multilingual
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-text-muted mt-1">
                            Size: {model.size}
                          </div>
                        </div>

                        <div className="ml-4">
                          {model.installed ? (
                            <div className="flex items-center gap-2">
                              <span className="text-success text-xs flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Ready
                              </span>
                              <button
                                onClick={() => handleDeleteModel(model.id)}
                                disabled={isDeleting}
                                className="text-text-muted hover:text-error text-xs flex items-center gap-1 transition-colors"
                                title="Remove model"
                              >
                                {isDeleting ? (
                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          ) : isDownloading ? (
                            <span className="text-primary text-xs flex items-center gap-2">
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Downloading...
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDownloadModel(model.id)}
                              className="btn-secondary text-xs py-1.5 px-3"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      </div>

                      {hasError && (
                        <div className="mt-2 text-error text-xs flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          {downloadErrors[model.id]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-text-muted hover:text-text flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Model recommendations
              </summary>
              <div className="mt-2 p-3 rounded-lg bg-secondary/30 text-xs text-text-muted">
                <ul className="space-y-1">
                  <li><strong>Tiny/Base:</strong> Fast, good for quick notes</li>
                  <li><strong>Small:</strong> Balanced speed and accuracy</li>
                  <li><strong>Medium:</strong> Higher accuracy for important recordings</li>
                  <li><strong>Large:</strong> Best accuracy, more memory needed</li>
                </ul>
              </div>
            </details>
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
            <div className="grid grid-cols-3 gap-2">
              {LLM_PROVIDERS.map((provider) => (
                <button
                  key={provider.value}
                  onClick={() => {
                    handleChange('llmProvider', provider.value);
                    // Set default model for the provider
                    if (provider.value === 'openai') {
                      handleChange('llmModel', 'gpt-4o-mini');
                    } else if (provider.value === 'openrouter') {
                      handleChange('llmModel', 'openai/gpt-4o-mini');
                    } else if (provider.value === 'ollama') {
                      // Set first available OLLAMA model, or empty if none
                      const defaultOllamaModel = ollamaModels.length > 0 ? ollamaModels[0].name : '';
                      handleChange('ollamaModel', defaultOllamaModel);
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-all
                    ${localSettings.llmProvider === provider.value
                      ? 'border-primary bg-primary/10'
                      : 'border-secondary hover:border-primary/50'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{provider.label}</span>
                    {provider.value === 'ollama' && ollamaStatus && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        ollamaStatus.available
                          ? 'bg-success text-black'
                          : 'bg-error/20 text-error'
                      }`}>
                        {ollamaStatus.available ? 'Running' : 'Not Running'}
                      </span>
                    )}
                    {provider.value === 'ollama' && isLoadingOllama && (
                      <svg className="animate-spin h-3 w-3 text-text-muted" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">{provider.description}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary text-text-muted">
                More coming soon
              </span>
              <span>Additional LLM providers will be added in future updates</span>
            </p>
          </div>

          {/* OLLAMA Status Section - shown when OLLAMA is selected */}
          {localSettings.llmProvider === 'ollama' && (
            <div className={`p-4 rounded-lg border ${
              ollamaStatus?.available ? 'border-success bg-success/10' : 'border-secondary'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text">Ollama Service</span>
                  {isLoadingOllama ? (
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Checking...
                    </span>
                  ) : ollamaStatus?.available ? (
                    <span className="text-xs bg-success text-black px-2 py-0.5 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Running {ollamaStatus.version ? `v${ollamaStatus.version}` : ''}
                    </span>
                  ) : (
                    <span className="text-xs bg-error/20 text-error px-2 py-0.5 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Not Running
                    </span>
                  )}
                </div>
                <button
                  onClick={checkOllamaStatus}
                  disabled={isLoadingOllama}
                  className="btn-secondary text-xs py-1 px-3"
                >
                  Refresh
                </button>
              </div>

              {ollamaStatus?.available ? (
                <>
                  <p className="text-sm text-text-muted mb-4">
                    Ollama is running at {ollamaStatus.baseUrl}. Select a model below for local, private text enrichment.
                  </p>

                  {/* Pull Model Section */}
                  <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-secondary">
                    <label className="block text-sm font-medium text-text mb-2">
                      Pull New Model
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ollamaPullModelName}
                        onChange={(e) => setOllamaPullModelName(e.target.value)}
                        placeholder="e.g., llama3.2, mistral, gemma2..."
                        className="input flex-1 text-sm"
                        disabled={Object.keys(ollamaPullingModels).length > 0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && ollamaPullModelName.trim()) {
                            handlePullOllamaModel(ollamaPullModelName);
                          }
                        }}
                      />
                      <button
                        onClick={() => handlePullOllamaModel(ollamaPullModelName)}
                        disabled={!ollamaPullModelName.trim() || Object.keys(ollamaPullingModels).length > 0}
                        className="btn-secondary text-sm py-2 px-4"
                      >
                        Pull Model
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      Browse available models at <a href="https://ollama.ai/library" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ollama.ai/library</a>
                    </p>

                    {/* Pull Progress */}
                    {Object.entries(ollamaPullingModels).map(([modelId, progress]) => (
                      <div key={modelId} className="mt-3 p-2 rounded bg-secondary/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-text font-medium">Pulling {modelId}...</span>
                          <span className="text-xs text-text-muted">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Pull Errors */}
                    {Object.entries(ollamaPullErrors).map(([modelId, error]) => (
                      <div key={modelId} className="mt-2 text-error text-sm flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Failed to pull {modelId}: {error}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-text-muted">
                    Ollama is not running. Start the Ollama service to use local LLM models for privacy-first enrichment.
                  </p>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm font-medium text-text mb-2">To get started:</p>
                    <ol className="text-sm text-text-muted space-y-1 list-decimal list-inside">
                      <li>Download and install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ollama.ai</a></li>
                      <li>Run <code className="bg-secondary px-1 rounded">ollama serve</code> in your terminal</li>
                      <li>Pull a model: <code className="bg-secondary px-1 rounded">ollama pull llama3.2</code></li>
                      <li>Click Refresh above to detect the running service</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* API Key Input - hidden for OLLAMA */}
          {localSettings.llmProvider !== 'ollama' && (
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
          )}

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Model
            </label>
            {localSettings.llmProvider === 'ollama' ? (
              ollamaStatus?.available ? (
                ollamaModels.length > 0 ? (
                  <>
                    <select
                      value={localSettings.ollamaModel || (ollamaModels.length > 0 ? ollamaModels[0].name : '')}
                      onChange={(e) => handleChange('ollamaModel', e.target.value)}
                      className="input w-full"
                    >
                      {ollamaModels.map((model) => (
                        <option key={model.name} value={model.name}>
                          {model.name} ({(model.size / (1024 * 1024 * 1024)).toFixed(1)} GB)
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-text-muted mt-1">
                      {ollamaModels.length} model{ollamaModels.length !== 1 ? 's' : ''} installed locally
                    </p>
                  </>
                ) : (
                  <div className="p-3 rounded-lg border border-secondary bg-secondary/30">
                    <p className="text-sm text-text-muted mb-2">
                      No models installed. Pull a model using the form above or run: <code className="bg-secondary px-1 rounded">ollama pull llama3.2</code>
                    </p>
                    <p className="text-xs text-text-muted">
                      Recommended models: <span className="font-medium">llama3.2</span>, <span className="font-medium">mistral</span>, <span className="font-medium">gemma2</span>
                    </p>
                  </div>
                )
              ) : (
                <div className="p-3 rounded-lg border border-secondary bg-secondary/30">
                  <p className="text-sm text-text-muted">
                    Start Ollama to see available models
                  </p>
                </div>
              )
            ) : (
              <>
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
              </>
            )}
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

      {/* Output Integrations */}
      <section className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Output Integrations</h3>
        <div className="space-y-4">
          {/* Notion Integration */}
          <div className="p-4 rounded-lg border border-secondary">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text">Notion</span>
                {notionTestResult === 'success' && (
                  <span className="text-xs bg-success text-black px-2 py-0.5 rounded">Connected</span>
                )}
              </div>
            </div>
            <p className="text-sm text-text-muted mb-3">
              Send transcripts and enriched content directly to Notion pages.
            </p>

            {/* API Key Input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-text mb-2">
                Notion API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey.notion ? 'text' : 'password'}
                  value={apiKeys.notion}
                  onChange={(e) => {
                    setApiKeys((prev) => ({
                      ...prev,
                      notion: e.target.value,
                    }));
                    // Reset test result when key changes
                    setNotionTestResult(null);
                    setNotionPages([]);
                  }}
                  placeholder="Enter your Notion integration token"
                  className="input w-full pr-16"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowApiKey((prev) => ({
                      ...prev,
                      notion: !prev.notion,
                    }))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-sm text-text-muted hover:text-text"
                >
                  {showApiKey.notion ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Create an integration at{' '}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  notion.so/my-integrations
                </a>
                {' '}and share pages with it.
              </p>
            </div>

            {/* Test Connection Button */}
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={testNotionAndLoadPages}
                disabled={isTestingNotion || !apiKeys.notion}
                className="btn-secondary text-sm py-2 px-4"
              >
                {isTestingNotion ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Testing...
                  </span>
                ) : (
                  'Test Connection'
                )}
              </button>
              {notionTestResult !== 'success' && (
                <span className="text-xs text-text-muted">
                  Select a destination page after successful connection
                </span>
              )}
            </div>

            {/* Test Result - Error */}
            {notionTestResult === 'error' && (
              <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20">
                <p className="text-sm text-error flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {notionTestError || 'Connection failed'}
                </p>
              </div>
            )}

            {/* Test Result - Success + Page Selector */}
            {notionTestResult === 'success' && (
              <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-sm text-success flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Connection successful!
                </p>

                {notionPages.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">
                      Default Destination
                    </label>
                    <select
                      value={notionDefaultPageId}
                      onChange={(e) => {
                        const selectedPage = notionPages.find(p => p.id === e.target.value);
                        setNotionDefaultPageId(e.target.value);
                        setNotionDefaultPageName(selectedPage?.name || '');
                      }}
                      className="input w-full"
                    >
                      <option value="">Select a page or database...</option>
                      {notionPages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-text-muted mt-1">
                      New transcripts will be saved to this location.
                    </p>
                  </div>
                )}

                {notionPages.length === 0 && (
                  <p className="text-sm text-text-muted">
                    No pages found. Make sure you&apos;ve shared at least one page with your integration.
                  </p>
                )}
              </div>
            )}

            {/* Show currently configured page when not testing */}
            {!notionTestResult && notionDefaultPageName && (
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-sm text-text">
                  <span className="text-text-muted">Current destination:</span>{' '}
                  <span className="font-medium">{notionDefaultPageName}</span>
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Use &quot;Test Connection&quot; to change.
                </p>
              </div>
            )}
          </div>

          {/* Google Drive - Coming Soon */}
          <div className="p-4 rounded-lg border border-secondary opacity-60">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text">Google Drive</span>
                <span className="text-xs bg-secondary text-text-muted px-2 py-0.5 rounded">Coming Soon</span>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              Save transcripts as documents directly to Google Drive.
            </p>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-text font-medium">VoiceIntelli</span>
            <span className="text-text-muted font-mono">
              {appVersion ? `v${appVersion}` : 'Loading...'}
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Voice-to-text transcription with AI enrichment
          </p>
          <p className="text-sm text-text-muted">
            &copy; {new Date().getFullYear()} H.F. Scholze. All rights reserved.
          </p>

          {/* Components List */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-primary hover:text-primary/80 flex items-center gap-2">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Open Source Components
            </summary>
            <div className="mt-3 p-3 rounded-lg bg-secondary/30 text-xs text-text-muted space-y-2">
              <div className="font-medium text-text mb-2">This application uses the following open source components:</div>
              <ul className="space-y-1.5">
                <li><strong>Tauri</strong> - Desktop application framework (MIT)</li>
                <li><strong>Next.js</strong> - React framework (MIT)</li>
                <li><strong>React</strong> - UI library (MIT)</li>
                <li><strong>Tailwind CSS</strong> - Utility-first CSS framework (MIT)</li>
                <li><strong>whisper.cpp</strong> - Speech-to-text engine (MIT)</li>
                <li><strong>jsPDF</strong> - PDF generation library (MIT)</li>
                <li><strong>OpenAI SDK</strong> - API client (MIT)</li>
              </ul>
              <p className="mt-3 pt-2 border-t border-secondary">
                For LLM processing: OpenAI API, OpenRouter, or Ollama (local)
              </p>
            </div>
          </details>
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
