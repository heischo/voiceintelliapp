// LLM Router - Provider-Agnostic Abstraction

import type { EnrichmentMode, EnrichmentOptions, LLMProvider, Language } from '../types';
import type { LLMProviderInterface, LLMCompletionRequest, LLMCompletionResponse } from '../types/llm';
import { LLMProviderError } from '../types/llm';
import { OpenAIProvider } from '../providers/openai';
import { OpenRouterProvider } from '../providers/openrouter';
import { OllamaProvider } from '../providers/ollama';

export class LLMRouter {
  private providers: Map<string, LLMProviderInterface> = new Map();
  private defaultProvider: string | null = null;
  private language: Language = 'en';

  constructor() {
    // Register default providers
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new OpenRouterProvider());
    this.registerProvider(new OllamaProvider());
  }

  registerProvider(provider: LLMProviderInterface): void {
    this.providers.set(provider.name, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = provider.name;
    }
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} is not registered`);
    }
    this.defaultProvider = name;
  }

  setLanguage(language: Language): void {
    this.language = language;
  }

  getProvider(name?: string): LLMProviderInterface {
    const providerName = name || this.defaultProvider;
    if (!providerName) {
      throw new LLMProviderError({
        code: 'NO_PROVIDER',
        message: 'No LLM provider is configured',
        provider: 'router',
        retryable: false,
      });
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new LLMProviderError({
        code: 'PROVIDER_NOT_FOUND',
        message: `Provider ${providerName} is not registered`,
        provider: providerName,
        retryable: false,
      });
    }

    return provider;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async isProviderConfigured(name?: string): Promise<boolean> {
    try {
      const provider = this.getProvider(name);
      return await provider.isConfigured();
    } catch {
      return false;
    }
  }

  async enrich(
    transcript: string,
    mode: EnrichmentMode,
    providerName?: string,
    options?: EnrichmentOptions
  ): Promise<string> {
    const provider = this.getProvider(providerName);

    const isConfigured = await provider.isConfigured();
    if (!isConfigured) {
      throw new LLMProviderError({
        code: 'NOT_CONFIGURED',
        message: `Provider ${provider.name} is not configured. Please add your API key in Settings.`,
        provider: provider.name,
        retryable: false,
      });
    }

    return provider.enrich(transcript, mode, options);
  }

  async complete(
    request: LLMCompletionRequest,
    providerName?: string
  ): Promise<LLMCompletionResponse> {
    const provider = this.getProvider(providerName);

    const isConfigured = await provider.isConfigured();
    if (!isConfigured) {
      throw new LLMProviderError({
        code: 'NOT_CONFIGURED',
        message: `Provider ${provider.name} is not configured`,
        provider: provider.name,
        retryable: false,
      });
    }

    return provider.complete(request);
  }

  // Configure a provider with API key
  configureProvider(
    name: LLMProvider,
    apiKey: string,
    model?: string
  ): void {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} is not registered`);
    }

    // Type-safe configuration based on provider
    if (name === 'openai' && provider instanceof OpenAIProvider) {
      provider.setApiKey(apiKey);
      if (model) provider.setModel(model);
      provider.setLanguage(this.language);
    } else if (name === 'openrouter' && provider instanceof OpenRouterProvider) {
      provider.setApiKey(apiKey);
      if (model) provider.setModel(model);
      provider.setLanguage(this.language);
    } else if (name === 'ollama' && provider instanceof OllamaProvider) {
      // OLLAMA doesn't require an API key (local service)
      // The apiKey parameter is ignored for OLLAMA
      if (model) provider.setModel(model);
      provider.setLanguage(this.language);
    }
  }

  // Configure OLLAMA provider with optional base URL
  configureOllamaProvider(model?: string, baseUrl?: string): void {
    const provider = this.providers.get('ollama');
    if (!provider || !(provider instanceof OllamaProvider)) {
      throw new Error('OLLAMA provider is not registered');
    }

    if (baseUrl) provider.setBaseUrl(baseUrl);
    if (model) provider.setModel(model);
    provider.setLanguage(this.language);
  }
}

// Singleton instance
let routerInstance: LLMRouter | null = null;

export function getLLMRouter(): LLMRouter {
  if (!routerInstance) {
    routerInstance = new LLMRouter();
  }
  return routerInstance;
}

export function resetLLMRouter(): void {
  routerInstance = null;
}
