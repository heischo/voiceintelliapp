'use client';

import { useState } from 'react';
import type { Settings, EnrichmentMode } from '../types';
import {
  COMMON_HOTKEYS,
  ENRICHMENT_MODES,
  LANGUAGES,
  LLM_PROVIDERS,
  OUTPUT_TARGETS,
  RETENTION_OPTIONS,
} from '../lib/config';

interface SettingsPanelProps {
  settings: Settings;
  onSave: (settings: Partial<Settings>) => Promise<void>;
  isLoading?: boolean;
}

export function SettingsPanel({ settings, onSave, isLoading }: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: settings.openaiApiKey || '',
    openrouter: settings.openrouterApiKey || '',
  });
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({
    openai: false,
    openrouter: false,
  });

  const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
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
                  onClick={() => handleChange('llmProvider', provider.value)}
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

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="btn-primary px-8 py-3"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
