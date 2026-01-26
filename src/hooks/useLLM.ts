'use client';

import { useState, useCallback, useRef } from 'react';
import type { EnrichmentMode, EnrichmentOptions, LLMProvider, Language } from '../types';
import { getLLMRouter } from '../services/llm-router';
import { LLMProviderError } from '../types/llm';

interface UseLLMReturn {
  isProcessing: boolean;
  error: string | null;
  lastResult: string | null;
  enrich: (
    transcript: string,
    mode: EnrichmentMode,
    options?: EnrichmentOptions
  ) => Promise<string>;
  configureProvider: (provider: LLMProvider, apiKey: string, model?: string) => void;
  setLanguage: (language: Language) => void;
  clearError: () => void;
}

export function useLLM(defaultProvider?: LLMProvider): UseLLMReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const routerRef = useRef(getLLMRouter());

  const enrich = useCallback(
    async (
      transcript: string,
      mode: EnrichmentMode,
      options?: EnrichmentOptions
    ): Promise<string> => {
      setIsProcessing(true);
      setError(null);

      try {
        const result = await routerRef.current.enrich(
          transcript,
          mode,
          defaultProvider,
          options
        );
        setLastResult(result);
        return result;
      } catch (err) {
        let errorMessage = 'An unexpected error occurred';

        if (err instanceof LLMProviderError) {
          errorMessage = err.message;

          // Provide more helpful error messages
          switch (err.code) {
            case 'NOT_CONFIGURED':
              errorMessage = `Please configure your ${err.provider} API key in Settings`;
              break;
            case 'INVALID_API_KEY':
              errorMessage = `Invalid API key for ${err.provider}. Please check your key in Settings`;
              break;
            case 'RATE_LIMITED':
              errorMessage = 'Rate limit exceeded. Please wait a moment and try again';
              break;
            case 'EMPTY_RESPONSE':
              errorMessage = 'The AI returned an empty response. Please try again';
              break;
          }
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    },
    [defaultProvider]
  );

  const configureProvider = useCallback(
    (provider: LLMProvider, apiKey: string, model?: string) => {
      try {
        routerRef.current.configureProvider(provider, apiKey, model);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to configure provider';
        setError(message);
      }
    },
    []
  );

  const setLanguage = useCallback((language: Language) => {
    routerRef.current.setLanguage(language);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isProcessing,
    error,
    lastResult,
    enrich,
    configureProvider,
    setLanguage,
    clearError,
  };
}
