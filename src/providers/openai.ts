// OpenAI Provider Implementation

import OpenAI from 'openai';
import type { EnrichmentMode, EnrichmentOptions, Language } from '../types';
import type {
  LLMProviderInterface,
  LLMCompletionRequest,
  LLMCompletionResponse,
} from '../types/llm';
import { LLMProviderError } from '../types/llm';
import { buildEnrichmentMessages } from '../services/enrichment';

export class OpenAIProvider implements LLMProviderInterface {
  name = 'openai';
  private client: OpenAI | null = null;
  private model: string;
  private language: Language;

  constructor(apiKey?: string, model: string = 'gpt-4o-mini', language: Language = 'en') {
    this.model = model;
    this.language = language;
    if (apiKey) {
      this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    }
  }

  setApiKey(apiKey: string): void {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  setModel(model: string): void {
    this.model = model;
  }

  setLanguage(language: Language): void {
    this.language = language;
  }

  async isConfigured(): Promise<boolean> {
    return this.client !== null;
  }

  async enrich(
    transcript: string,
    mode: EnrichmentMode,
    options?: EnrichmentOptions
  ): Promise<string> {
    if (!this.client) {
      throw new LLMProviderError({
        code: 'NOT_CONFIGURED',
        message: 'OpenAI API key is not configured',
        provider: this.name,
        retryable: false,
      });
    }

    const messages = buildEnrichmentMessages(transcript, mode, this.language, options);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: messages.system },
          { role: 'user', content: messages.user },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new LLMProviderError({
          code: 'EMPTY_RESPONSE',
          message: 'OpenAI returned an empty response',
          provider: this.name,
          retryable: true,
        });
      }

      return content;
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      const openaiError = error as { status?: number; message?: string };

      if (openaiError.status === 401) {
        throw new LLMProviderError({
          code: 'INVALID_API_KEY',
          message: 'Invalid OpenAI API key',
          provider: this.name,
          retryable: false,
        });
      }

      if (openaiError.status === 429) {
        throw new LLMProviderError({
          code: 'RATE_LIMITED',
          message: 'OpenAI rate limit exceeded. Please try again later.',
          provider: this.name,
          retryable: true,
        });
      }

      throw new LLMProviderError({
        code: 'API_ERROR',
        message: openaiError.message || 'Unknown OpenAI API error',
        provider: this.name,
        retryable: true,
      });
    }
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.client) {
      throw new LLMProviderError({
        code: 'NOT_CONFIGURED',
        message: 'OpenAI API key is not configured',
        provider: this.name,
        retryable: false,
      });
    }

    try {
      const response = await this.client.chat.completions.create({
        model: request.model || this.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      });

      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage;

      return {
        content,
        model: response.model,
        tokensUsed: {
          prompt: usage?.prompt_tokens || 0,
          completion: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0,
        },
        finishReason: response.choices[0]?.finish_reason || 'unknown',
      };
    } catch (error) {
      const openaiError = error as { status?: number; message?: string };
      throw new LLMProviderError({
        code: 'API_ERROR',
        message: openaiError.message || 'OpenAI API error',
        provider: this.name,
        retryable: openaiError.status !== 401,
      });
    }
  }
}

// Available OpenAI models
export const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy model' },
];
