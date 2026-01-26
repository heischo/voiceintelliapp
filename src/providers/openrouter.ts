// OpenRouter Provider Implementation

import type { EnrichmentMode, EnrichmentOptions, Language } from '../types';
import type {
  LLMProviderInterface,
  LLMCompletionRequest,
  LLMCompletionResponse,
} from '../types/llm';
import { LLMProviderError } from '../types/llm';
import { buildEnrichmentMessages } from '../services/enrichment';

// OpenRouter uses OpenAI-compatible API
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterProvider implements LLMProviderInterface {
  name = 'openrouter';
  private apiKey: string | null = null;
  private model: string;
  private language: Language;

  constructor(apiKey?: string, model: string = 'openai/gpt-4o-mini', language: Language = 'en') {
    this.model = model;
    this.language = language;
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setModel(model: string): void {
    this.model = model;
  }

  setLanguage(language: Language): void {
    this.language = language;
  }

  async isConfigured(): Promise<boolean> {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  async enrich(
    transcript: string,
    mode: EnrichmentMode,
    options?: EnrichmentOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new LLMProviderError({
        code: 'NOT_CONFIGURED',
        message: 'OpenRouter API key is not configured',
        provider: this.name,
        retryable: false,
      });
    }

    const messages = buildEnrichmentMessages(transcript, mode, this.language, options);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://voiceintelligence.app',
          'X-Title': 'Voice Intelligence',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: messages.system },
            { role: 'user', content: messages.user },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new LLMProviderError({
            code: 'INVALID_API_KEY',
            message: 'Invalid OpenRouter API key',
            provider: this.name,
            retryable: false,
          });
        }

        if (response.status === 429) {
          throw new LLMProviderError({
            code: 'RATE_LIMITED',
            message: 'OpenRouter rate limit exceeded. Please try again later.',
            provider: this.name,
            retryable: true,
          });
        }

        throw new LLMProviderError({
          code: 'API_ERROR',
          message: errorData.error?.message || `OpenRouter API error: ${response.status}`,
          provider: this.name,
          retryable: response.status >= 500,
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new LLMProviderError({
          code: 'EMPTY_RESPONSE',
          message: 'OpenRouter returned an empty response',
          provider: this.name,
          retryable: true,
        });
      }

      return content;
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
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
    if (!this.apiKey) {
      throw new LLMProviderError({
        code: 'NOT_CONFIGURED',
        message: 'OpenRouter API key is not configured',
        provider: this.name,
        retryable: false,
      });
    }

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://voiceintelligence.app',
          'X-Title': 'Voice Intelligence',
        },
        body: JSON.stringify({
          model: request.model || this.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new LLMProviderError({
          code: 'API_ERROR',
          message: errorData.error?.message || 'OpenRouter API error',
          provider: this.name,
          retryable: response.status >= 500,
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage;

      return {
        content,
        model: data.model || this.model,
        tokensUsed: {
          prompt: usage?.prompt_tokens || 0,
          completion: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0,
        },
        finishReason: data.choices?.[0]?.finish_reason || 'unknown',
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      throw new LLMProviderError({
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        provider: this.name,
        retryable: true,
      });
    }
  }
}

// Popular models available on OpenRouter
export const OPENROUTER_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'OpenAI GPT-4o Mini' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic Claude' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and affordable' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', description: 'Google Gemini' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Meta Llama' },
  { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', description: 'Mistral AI' },
];
