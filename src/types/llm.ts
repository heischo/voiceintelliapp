// LLM Provider Types

import type { EnrichmentMode, EnrichmentOptions } from './index';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: string;
}

export interface LLMProviderInterface {
  name: string;
  isConfigured(): Promise<boolean>;
  enrich(
    transcript: string,
    mode: EnrichmentMode,
    options?: EnrichmentOptions
  ): Promise<string>;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}

export interface LLMError {
  code: string;
  message: string;
  provider: string;
  retryable: boolean;
}

export class LLMProviderError extends Error {
  code: string;
  provider: string;
  retryable: boolean;

  constructor(error: LLMError) {
    super(error.message);
    this.name = 'LLMProviderError';
    this.code = error.code;
    this.provider = error.provider;
    this.retryable = error.retryable;
  }
}
