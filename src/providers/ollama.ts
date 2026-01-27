// OLLAMA Provider Implementation (Local LLM)

import type { EnrichmentMode, EnrichmentOptions, Language } from '../types';
import type {
  LLMProviderInterface,
  LLMCompletionRequest,
  LLMCompletionResponse,
  OllamaModel,
} from '../types/llm';
import { LLMProviderError } from '../types/llm';
import { buildEnrichmentMessages } from '../services/enrichment';

// OLLAMA runs locally on default port
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

export class OllamaProvider implements LLMProviderInterface {
  name = 'ollama';
  private baseUrl: string;
  private model: string;
  private language: Language;

  constructor(baseUrl: string = DEFAULT_OLLAMA_BASE_URL, model: string = 'llama3.2', language: Language = 'en') {
    this.baseUrl = baseUrl;
    this.model = model;
    this.language = language;
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  setModel(model: string): void {
    this.model = model;
  }

  setLanguage(language: Language): void {
    this.language = language;
  }

  async isConfigured(): Promise<boolean> {
    // OLLAMA is considered configured if a model is selected and service is reachable
    if (!this.model) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3 second timeout for quick check
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async enrich(
    transcript: string,
    mode: EnrichmentMode,
    options?: EnrichmentOptions
  ): Promise<string> {
    if (!this.model) {
      throw new LLMProviderError({
        code: 'NOT_CONFIGURED',
        message: 'OLLAMA model is not selected',
        provider: this.name,
        retryable: false,
      });
    }

    const messages = buildEnrichmentMessages(transcript, mode, this.language, options);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: messages.system },
            { role: 'user', content: messages.user },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 404) {
          throw new LLMProviderError({
            code: 'MODEL_NOT_FOUND',
            message: `Model '${this.model}' not found. Please pull it first.`,
            provider: this.name,
            retryable: false,
          });
        }

        throw new LLMProviderError({
          code: 'API_ERROR',
          message: errorData.error || `OLLAMA API error: ${response.status}`,
          provider: this.name,
          retryable: response.status >= 500,
        });
      }

      const data = await response.json();
      const content = data.message?.content;

      if (!content) {
        throw new LLMProviderError({
          code: 'EMPTY_RESPONSE',
          message: 'OLLAMA returned an empty response',
          provider: this.name,
          retryable: true,
        });
      }

      return content;
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      // Handle connection errors (OLLAMA not running)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new LLMProviderError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'OLLAMA service is not running. Please start OLLAMA and try again.',
          provider: this.name,
          retryable: true,
        });
      }

      throw new LLMProviderError({
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error occurred',
        provider: this.name,
        retryable: true,
      });
    }
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const modelToUse = request.model || this.model;

    if (!modelToUse) {
      throw new LLMProviderError({
        code: 'NOT_CONFIGURED',
        message: 'OLLAMA model is not selected',
        provider: this.name,
        retryable: false,
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: request.messages,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens ?? 2048,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 404) {
          throw new LLMProviderError({
            code: 'MODEL_NOT_FOUND',
            message: `Model '${modelToUse}' not found. Please pull it first.`,
            provider: this.name,
            retryable: false,
          });
        }

        throw new LLMProviderError({
          code: 'API_ERROR',
          message: errorData.error || 'OLLAMA API error',
          provider: this.name,
          retryable: response.status >= 500,
        });
      }

      const data = await response.json();
      const content = data.message?.content || '';

      // OLLAMA provides token counts in different format
      const promptEvalCount = data.prompt_eval_count || 0;
      const evalCount = data.eval_count || 0;

      return {
        content,
        model: data.model || modelToUse,
        tokensUsed: {
          prompt: promptEvalCount,
          completion: evalCount,
          total: promptEvalCount + evalCount,
        },
        finishReason: data.done ? 'stop' : 'unknown',
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      // Handle connection errors (OLLAMA not running)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new LLMProviderError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'OLLAMA service is not running. Please start OLLAMA and try again.',
          provider: this.name,
          retryable: true,
        });
      }

      throw new LLMProviderError({
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        provider: this.name,
        retryable: true,
      });
    }
  }

  /**
   * Check if OLLAMA service is running
   */
  async checkServiceStatus(): Promise<{ available: boolean; version: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { available: false, version: null };
      }

      const data = await response.json();
      return { available: true, version: data.version || null };
    } catch {
      return { available: false, version: null };
    }
  }

  /**
   * Get list of installed models from OLLAMA
   */
  async getInstalledModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new LLMProviderError({
          code: 'API_ERROR',
          message: `Failed to fetch models: ${response.status}`,
          provider: this.name,
          retryable: true,
        });
      }

      const data = await response.json();
      const models: OllamaModel[] = (data.models || []).map((m: Record<string, unknown>) => ({
        name: m.name as string,
        model: m.model as string || m.name as string,
        modifiedAt: m.modified_at as string || '',
        size: (m.size as number) || 0,
        digest: m.digest as string || '',
        details: {
          parentModel: (m.details as Record<string, unknown>)?.parent_model as string || '',
          format: (m.details as Record<string, unknown>)?.format as string || '',
          family: (m.details as Record<string, unknown>)?.family as string || '',
          families: (m.details as Record<string, unknown>)?.families as string[] || null,
          parameterSize: (m.details as Record<string, unknown>)?.parameter_size as string || '',
          quantizationLevel: (m.details as Record<string, unknown>)?.quantization_level as string || '',
        },
      }));

      return models;
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      throw new LLMProviderError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'OLLAMA service is not running',
        provider: this.name,
        retryable: true,
      });
    }
  }
}

// Recommended OLLAMA models for enrichment
export const OLLAMA_RECOMMENDED_MODELS = [
  { id: 'llama3.2', name: 'Llama 3.2', description: 'Meta\'s latest small model (~2GB)' },
  { id: 'llama3.2:1b', name: 'Llama 3.2 1B', description: 'Lightweight 1B parameter (~1.3GB)' },
  { id: 'mistral', name: 'Mistral 7B', description: 'Mistral AI 7B model (~4GB)' },
  { id: 'phi3', name: 'Phi-3', description: 'Microsoft Phi-3 (~2.2GB)' },
  { id: 'gemma2', name: 'Gemma 2', description: 'Google Gemma 2 (~5GB)' },
];

// Default OLLAMA base URL
export const DEFAULT_OLLAMA_URL = DEFAULT_OLLAMA_BASE_URL;
