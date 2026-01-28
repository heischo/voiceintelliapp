// Voice Intelligence App - Type Definitions

export type RecordingState = 'idle' | 'recording' | 'processing' | 'completed' | 'error';

export type EnrichmentMode =
  | 'meeting-notes'
  | 'clean-transcript'
  | 'action-items'
  | 'summary'
  | 'custom';

export type OutputTarget = 'clipboard' | 'file' | 'notion' | 'google_drive';

export type LLMProvider = 'openai' | 'openrouter' | 'ollama';

export type Language = 'en' | 'de' | 'no';

export interface EnrichmentOptions {
  sentences?: number;      // For summary mode
  customPrompt?: string;   // For custom mode
}

export interface NotionSettings {
  apiKey: string;
  parentPageId?: string;
  databaseId?: string;
}

export interface Settings {
  hotkey: string;
  language: Language;
  enrichmentMode: EnrichmentMode;
  outputTarget: OutputTarget;
  retentionDays: number;
  llmProvider: LLMProvider;
  llmModel?: string;
  customPrompt?: string;
  autoEnrich: boolean;
  showNotifications: boolean;
  // API Keys (stored securely)
  openaiApiKey?: string;
  openrouterApiKey?: string;
  notionApiKey?: string;
  // Ollama settings
  ollamaModel?: string;
  // Microphone
  selectedMicrophone?: string;
  // Whisper
  whisperPath?: string;
  // Setup
  setupComplete?: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  rawTranscript: string;
  enrichedContent: string;
  enrichmentMode: EnrichmentMode;
  language: Language;
  duration: number;  // seconds
}

export interface TranscriptionResult {
  text: string;
  language: Language;
  duration: number;
  confidence?: number;
}

export interface EnrichmentResult {
  content: string;
  mode: EnrichmentMode;
  provider: LLMProvider;
  model?: string;
  tokensUsed?: number;
}

export interface LLMProviderConfig {
  name: LLMProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AppState {
  recordingState: RecordingState;
  currentTranscript: string | null;
  enrichedContent: string | null;
  error: string | null;
  isProcessing: boolean;
}

// Default settings
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
};

// Enrichment mode labels
export const ENRICHMENT_MODE_LABELS: Record<EnrichmentMode, string> = {
  'meeting-notes': 'Meeting Notes',
  'clean-transcript': 'Clean Transcript',
  'action-items': 'Action Items',
  'summary': 'Summary',
  'custom': 'Custom Prompt',
};

// Language labels
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
  no: 'Norsk',
};
