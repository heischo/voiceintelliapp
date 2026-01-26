// Speech-to-Text Service - whisper.cpp integration with Whisper API fallback

import type { Language, TranscriptionResult } from '../types';

export interface STTProvider {
  name: string;
  transcribe(audioBlob: Blob, language: Language): Promise<TranscriptionResult>;
  isAvailable(): Promise<boolean>;
}

export class STTError extends Error {
  code: string;
  retryable: boolean;

  constructor(code: string, message: string, retryable: boolean = false) {
    super(message);
    this.name = 'STTError';
    this.code = code;
    this.retryable = retryable;
  }
}

// Convert audio blob to base64 (for future use with base64 API endpoints)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert WebM to WAV format (whisper.cpp prefers WAV)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function convertToWav(audioBlob: Blob): Promise<Blob> {
  // For now, return the original blob
  // In production, we'd use Web Audio API to convert to WAV
  // whisper-node can handle WebM/Opus format
  return audioBlob;
}

interface WhisperCheckResult {
  available: boolean;
  path: string | null;
}

/**
 * Local Whisper Provider using whisper-node
 * This runs whisper.cpp locally for privacy
 */
export class LocalWhisperProvider implements STTProvider {
  name = 'local-whisper';
  private modelPath: string;
  private whisperPath: string | null = null;

  constructor(modelPath: string = 'base.en') {
    this.modelPath = modelPath;
  }

  setWhisperPath(path: string | null): void {
    this.whisperPath = path;
  }

  async isAvailable(): Promise<boolean> {
    // Check if we're in Tauri environment
    if (typeof window === 'undefined') return false;

    try {
      // Check if whisper command is available via Tauri
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<WhisperCheckResult>('check_whisper_available', {
        savedPath: this.whisperPath,
      });
      if (result.path) {
        this.whisperPath = result.path;
      }
      return result.available;
    } catch {
      return false;
    }
  }

  async transcribe(audioBlob: Blob, language: Language): Promise<TranscriptionResult> {
    const steps: string[] = [];

    try {
      steps.push('Loading Tauri APIs...');
      const { invoke } = await import('@tauri-apps/api/core');
      const { writeFile, remove } = await import('@tauri-apps/plugin-fs');
      const { tempDir } = await import('@tauri-apps/api/path');

      steps.push('Getting temp directory...');
      const tempPath = await tempDir();
      const audioPath = `${tempPath}recording-${Date.now()}.wav`;
      steps.push(`Temp path: ${audioPath}`);

      steps.push('Converting audio blob...');
      const arrayBuffer = await audioBlob.arrayBuffer();
      steps.push(`Audio size: ${arrayBuffer.byteLength} bytes`);

      steps.push('Writing temp file...');
      await writeFile(audioPath, new Uint8Array(arrayBuffer));

      steps.push(`Calling whisper transcribe_audio (whisperPath: ${this.whisperPath || 'auto-detect'})...`);
      // Call whisper via Tauri command
      const result = await invoke<{
        text: string;
        language: string;
        duration: number;
      }>('transcribe_audio', {
        audioPath,
        language,
        model: this.modelPath,
        whisperPath: this.whisperPath,
      });

      steps.push('Cleaning up temp file...');
      // Clean up temp file
      try {
        await remove(audioPath);
      } catch {
        // Ignore cleanup errors
      }

      return {
        text: result.text.trim(),
        language: result.language as Language,
        duration: result.duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const detailedMessage = `Local transcription failed at step: ${steps[steps.length - 1] || 'initialization'}\n\nError: ${errorMessage}\n\nSteps completed:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

      console.error('Transcription error details:', {
        steps,
        error,
        whisperPath: this.whisperPath,
      });

      throw new STTError(
        'LOCAL_TRANSCRIPTION_FAILED',
        detailedMessage,
        true
      );
    }
  }
}

/**
 * OpenAI Whisper API Provider
 * Cloud-based fallback when local whisper is not available
 */
export class OpenAIWhisperProvider implements STTProvider {
  name = 'openai-whisper';
  private apiKey: string | null = null;

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  async transcribe(audioBlob: Blob, language: Language): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new STTError('NOT_CONFIGURED', 'OpenAI API key is not configured', false);
    }

    try {
      // Convert to format Whisper API accepts
      const audioFile = new File([audioBlob], 'recording.webm', {
        type: audioBlob.type || 'audio/webm',
      });

      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', language);
      formData.append('response_format', 'verbose_json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new STTError('INVALID_API_KEY', 'Invalid OpenAI API key', false);
        }

        throw new STTError(
          'API_ERROR',
          errorData.error?.message || `Whisper API error: ${response.status}`,
          response.status >= 500
        );
      }

      const data = await response.json();

      return {
        text: data.text?.trim() || '',
        language: (data.language as Language) || language,
        duration: data.duration || 0,
        confidence: data.segments?.[0]?.avg_logprob
          ? Math.exp(data.segments[0].avg_logprob)
          : undefined,
      };
    } catch (error) {
      if (error instanceof STTError) {
        throw error;
      }

      throw new STTError(
        'TRANSCRIPTION_FAILED',
        error instanceof Error ? error.message : 'Transcription failed',
        true
      );
    }
  }
}

/**
 * Browser-based Speech Recognition (Web Speech API)
 * Fallback when no other provider is available
 */
export class BrowserSpeechProvider implements STTProvider {
  name = 'browser-speech';

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(_audioBlob: Blob, _language: Language): Promise<TranscriptionResult> {
    // Web Speech API doesn't work with pre-recorded audio
    // This is a placeholder - in practice, we'd need to use it during recording
    throw new STTError(
      'NOT_SUPPORTED',
      'Browser speech recognition requires live audio input',
      false
    );
  }
}

/**
 * STT Service - Manages transcription providers
 */
export class STTService {
  private providers: Map<string, STTProvider> = new Map();
  private preferredProvider: string | null = null;

  constructor() {
    // Register providers in order of preference
    this.registerProvider(new LocalWhisperProvider());
    this.registerProvider(new OpenAIWhisperProvider());
    this.registerProvider(new BrowserSpeechProvider());
  }

  registerProvider(provider: STTProvider): void {
    this.providers.set(provider.name, provider);
  }

  setPreferredProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`STT Provider ${name} is not registered`);
    }
    this.preferredProvider = name;
  }

  configureOpenAI(apiKey: string): void {
    const provider = this.providers.get('openai-whisper');
    if (provider && provider instanceof OpenAIWhisperProvider) {
      provider.setApiKey(apiKey);
    }
  }

  configureWhisperPath(path: string | undefined): void {
    const provider = this.providers.get('local-whisper');
    if (provider && provider instanceof LocalWhisperProvider) {
      provider.setWhisperPath(path || null);
    }
  }

  async getAvailableProvider(): Promise<STTProvider | null> {
    // Try preferred provider first
    if (this.preferredProvider) {
      const preferred = this.providers.get(this.preferredProvider);
      if (preferred && await preferred.isAvailable()) {
        return preferred;
      }
    }

    // Fall back to first available provider
    const providers = Array.from(this.providers.values());
    for (const provider of providers) {
      if (await provider.isAvailable()) {
        return provider;
      }
    }

    return null;
  }

  async transcribe(audioBlob: Blob, language: Language): Promise<TranscriptionResult> {
    const provider = await this.getAvailableProvider();

    if (!provider) {
      throw new STTError(
        'NO_PROVIDER',
        'No speech-to-text provider is available. Please configure an API key or enable local transcription.',
        false
      );
    }

    console.log(`Using STT provider: ${provider.name}`);
    return provider.transcribe(audioBlob, language);
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
let sttInstance: STTService | null = null;

export function getSTTService(): STTService {
  if (!sttInstance) {
    sttInstance = new STTService();
  }
  return sttInstance;
}

export function resetSTTService(): void {
  sttInstance = null;
}
