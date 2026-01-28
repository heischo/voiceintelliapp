// Default Configuration

import type { Settings, EnrichmentMode, Language, LLMProvider, OutputTarget } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  hotkey: 'CommandOrControl+Shift+Space',
  language: 'en',
  enrichmentMode: 'clean-transcript',
  outputTarget: 'clipboard',
  retentionDays: 7,
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  autoEnrich: true,
  showNotifications: true,
  whisperModel: 'base',
};

export const HOTKEY_MODIFIERS = [
  'CommandOrControl',
  'Control',
  'Alt',
  'Shift',
  'Super',
] as const;

export const HOTKEY_KEYS = [
  'Space',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
] as const;

export const COMMON_HOTKEYS = [
  { label: 'Ctrl+Shift+Space', value: 'CommandOrControl+Shift+Space' },
  { label: 'Ctrl+Shift+R', value: 'CommandOrControl+Shift+R' },
  { label: 'Ctrl+Shift+V', value: 'CommandOrControl+Shift+V' },
  { label: 'Alt+Space', value: 'Alt+Space' },
  { label: 'Ctrl+Space', value: 'CommandOrControl+Space' },
] as const;

export const ENRICHMENT_MODES: { value: EnrichmentMode; label: string; description: string }[] = [
  {
    value: 'clean-transcript',
    label: 'Clean Transcript',
    description: 'Remove filler words and fix grammar',
  },
  {
    value: 'meeting-notes',
    label: 'Meeting Notes',
    description: 'Structured notes with key points and actions',
  },
  {
    value: 'action-items',
    label: 'Action Items',
    description: 'Extract tasks and to-dos as a checklist',
  },
  {
    value: 'summary',
    label: 'Summary',
    description: 'Concise summary of the content',
  },
  {
    value: 'custom',
    label: 'Custom Prompt',
    description: 'Use your own prompt for processing',
  },
];

export const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'no', label: 'Norsk', flag: '🇳🇴' },
  { value: 'auto', label: 'Other', flag: '🌍' },
];

export const LLM_PROVIDERS: { value: LLMProvider; label: string; description: string }[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o and GPT-4o Mini models',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    description: 'Access multiple models via OpenRouter',
  },
  {
    value: 'ollama',
    label: 'Ollama',
    description: 'Local LLM models for privacy-first processing',
  },
];

export const OUTPUT_TARGETS: { value: OutputTarget; label: string; description: string; comingSoon?: boolean }[] = [
  {
    value: 'clipboard',
    label: 'Clipboard',
    description: 'Copy result to clipboard instantly',
  },
  {
    value: 'file',
    label: 'Save to File',
    description: 'Save as Markdown file',
  },
  {
    value: 'notion',
    label: 'Notion',
    description: 'Send directly to a Notion page',
  },
  {
    value: 'google_drive',
    label: 'Google Drive',
    description: 'Save as document in Google Drive',
    comingSoon: true,
  },
];

export const RETENTION_OPTIONS = [
  { value: 0, label: 'Never save history' },
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

export type FileFormat = 'markdown' | 'pdf' | 'txt';

export const FILE_FORMATS: { value: FileFormat; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'pdf', label: 'PDF' },
  { value: 'txt', label: 'Plain Text' },
];

// Recording constraints
export const MIN_RECORDING_DURATION = 5; // seconds
export const MAX_RECORDING_DURATION = 180; // seconds
export const DEFAULT_RECORDING_TIMEOUT = 180000; // milliseconds

// App info
export const APP_NAME = 'Voice Intelligence';
export const APP_DESCRIPTION = 'Privacy-first desktop voice application for knowledge workers';
