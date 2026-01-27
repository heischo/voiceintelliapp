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

// OLLAMA-specific types

/**
 * Represents an OLLAMA model from the /api/tags endpoint
 */
export interface OllamaModel {
  name: string;
  model: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details: {
    parentModel: string;
    format: string;
    family: string;
    families: string[] | null;
    parameterSize: string;
    quantizationLevel: string;
  };
}

/**
 * Service status returned from check_ollama_available command
 * Mirrors Rust OllamaCheckResult struct
 */
export interface OllamaServiceStatus {
  available: boolean;
  version: string | null;
  baseUrl: string;
}

/**
 * Configuration settings for OLLAMA provider
 */
export interface OllamaSettings {
  baseUrl: string;
  model: string;
  temperature?: number;
  contextLength?: number;
}

/**
 * Progress information for OLLAMA model pull operations
 */
export interface OllamaPullProgress {
  modelId: string;
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percentage: number;
}
