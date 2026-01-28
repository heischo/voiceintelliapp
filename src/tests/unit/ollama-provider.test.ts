import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OllamaProvider, OLLAMA_RECOMMENDED_MODELS, DEFAULT_OLLAMA_URL } from '../../providers/ollama';
import { LLMProviderError } from '../../types/llm';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('ollama');
    });

    it('should use default base URL', () => {
      const defaultProvider = new OllamaProvider();
      expect(defaultProvider).toBeDefined();
    });

    it('should use custom base URL when provided', () => {
      const customProvider = new OllamaProvider('http://custom:11434');
      expect(customProvider).toBeDefined();
    });

    it('should use default model when not provided', () => {
      const defaultProvider = new OllamaProvider();
      expect(defaultProvider).toBeDefined();
    });

    it('should use custom model when provided', () => {
      const customProvider = new OllamaProvider(DEFAULT_OLLAMA_URL, 'mistral');
      expect(customProvider).toBeDefined();
    });

    it('should use default language when not provided', () => {
      const defaultProvider = new OllamaProvider();
      expect(defaultProvider).toBeDefined();
    });
  });

  describe('setters', () => {
    it('should set base URL without error', () => {
      expect(() => provider.setBaseUrl('http://localhost:8080')).not.toThrow();
    });

    it('should set model without error', () => {
      expect(() => provider.setModel('mistral')).not.toThrow();
    });

    it('should set language without error', () => {
      expect(() => provider.setLanguage('de')).not.toThrow();
      expect(() => provider.setLanguage('en')).not.toThrow();
      expect(() => provider.setLanguage('no')).not.toThrow();
    });
  });

  describe('isConfigured', () => {
    it('should return false when model is not set', async () => {
      const emptyProvider = new OllamaProvider(DEFAULT_OLLAMA_URL, '');
      const isConfigured = await emptyProvider.isConfigured();
      expect(isConfigured).toBe(false);
    });

    it('should return true when service is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: '0.1.0' }),
      });

      const isConfigured = await provider.isConfigured();
      expect(isConfigured).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return false when service is not reachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const isConfigured = await provider.isConfigured();
      expect(isConfigured).toBe(false);
    });

    it('should return false when service returns error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const isConfigured = await provider.isConfigured();
      expect(isConfigured).toBe(false);
    });
  });

  describe('checkServiceStatus', () => {
    it('should return available true when service is running', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: '0.1.24' }),
      });

      const status = await provider.checkServiceStatus();
      expect(status.available).toBe(true);
      expect(status.version).toBe('0.1.24');
    });

    it('should return available false when service is not running', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const status = await provider.checkServiceStatus();
      expect(status.available).toBe(false);
      expect(status.version).toBeNull();
    });

    it('should return available false on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const status = await provider.checkServiceStatus();
      expect(status.available).toBe(false);
      expect(status.version).toBeNull();
    });

    it('should handle missing version in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const status = await provider.checkServiceStatus();
      expect(status.available).toBe(true);
      expect(status.version).toBeNull();
    });
  });

  describe('getInstalledModels', () => {
    it('should return list of installed models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          models: [
            {
              name: 'llama3.2:latest',
              model: 'llama3.2:latest',
              modified_at: '2024-01-15T10:30:00Z',
              size: 2048000000,
              digest: 'abc123',
              details: {
                parent_model: '',
                format: 'gguf',
                family: 'llama',
                families: ['llama'],
                parameter_size: '3B',
                quantization_level: 'Q4_0',
              },
            },
          ],
        }),
      });

      const models = await provider.getInstalledModels();
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('llama3.2:latest');
      expect(models[0].details.family).toBe('llama');
    });

    it('should handle empty models list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      });

      const models = await provider.getInstalledModels();
      expect(models).toHaveLength(0);
    });

    it('should throw LLMProviderError on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(provider.getInstalledModels()).rejects.toThrow(LLMProviderError);
    });

    it('should throw SERVICE_UNAVAILABLE when service is not running', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      try {
        await provider.getInstalledModels();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('SERVICE_UNAVAILABLE');
      }
    });

    it('should handle missing model details gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          models: [
            {
              name: 'minimal-model',
            },
          ],
        }),
      });

      const models = await provider.getInstalledModels();
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('minimal-model');
      expect(models[0].details.family).toBe('');
    });
  });

  describe('enrich', () => {
    it('should throw NOT_CONFIGURED when model is not set', async () => {
      const emptyProvider = new OllamaProvider(DEFAULT_OLLAMA_URL, '');

      try {
        await emptyProvider.enrich('test transcript', 'clean-transcript');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('NOT_CONFIGURED');
        expect((error as LLMProviderError).provider).toBe('ollama');
      }
    });

    it('should successfully enrich transcript', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Cleaned transcript content' },
        }),
      });

      const result = await provider.enrich('test transcript', 'clean-transcript');
      expect(result).toBe('Cleaned transcript content');
    });

    it('should throw MODEL_NOT_FOUND on 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'model not found' }),
      });

      try {
        await provider.enrich('test transcript', 'clean-transcript');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('MODEL_NOT_FOUND');
        expect((error as LLMProviderError).retryable).toBe(false);
      }
    });

    it('should throw API_ERROR on server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      try {
        await provider.enrich('test transcript', 'clean-transcript');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('API_ERROR');
        expect((error as LLMProviderError).retryable).toBe(true);
      }
    });

    it('should throw EMPTY_RESPONSE when content is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: { content: '' },
        }),
      });

      try {
        await provider.enrich('test transcript', 'clean-transcript');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('EMPTY_RESPONSE');
        expect((error as LLMProviderError).retryable).toBe(true);
      }
    });

    it('should throw NETWORK_ERROR on connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await provider.enrich('test transcript', 'clean-transcript');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('NETWORK_ERROR');
        expect((error as LLMProviderError).retryable).toBe(true);
      }
    });

    it('should handle all enrichment modes', async () => {
      const modes: Array<'clean-transcript' | 'meeting-notes' | 'action-items' | 'summary' | 'custom'> = [
        'clean-transcript',
        'meeting-notes',
        'action-items',
        'summary',
        'custom',
      ];

      for (const mode of modes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            message: { content: `Result for ${mode}` },
          }),
        });

        const result = await provider.enrich('test transcript', mode);
        expect(result).toBe(`Result for ${mode}`);
      }
    });
  });

  describe('complete', () => {
    it('should throw NOT_CONFIGURED when model is not set', async () => {
      const emptyProvider = new OllamaProvider(DEFAULT_OLLAMA_URL, '');

      try {
        await emptyProvider.complete({
          messages: [{ role: 'user', content: 'Hello' }],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('NOT_CONFIGURED');
      }
    });

    it('should use request model over default model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Response' },
          model: 'custom-model',
          prompt_eval_count: 10,
          eval_count: 20,
          done: true,
        }),
      });

      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'custom-model',
      });

      expect(result.model).toBe('custom-model');
    });

    it('should return correct completion response structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Hello, world!' },
          model: 'llama3.2',
          prompt_eval_count: 15,
          eval_count: 25,
          done: true,
        }),
      });

      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Say hello' }],
      });

      expect(result.content).toBe('Hello, world!');
      expect(result.model).toBe('llama3.2');
      expect(result.tokensUsed.prompt).toBe(15);
      expect(result.tokensUsed.completion).toBe(25);
      expect(result.tokensUsed.total).toBe(40);
      expect(result.finishReason).toBe('stop');
    });

    it('should handle missing token counts gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Response' },
          model: 'llama3.2',
          done: true,
        }),
      });

      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.tokensUsed.prompt).toBe(0);
      expect(result.tokensUsed.completion).toBe(0);
      expect(result.tokensUsed.total).toBe(0);
    });

    it('should pass temperature and maxTokens options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Response' },
          model: 'llama3.2',
          done: true,
        }),
      });

      await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
        maxTokens: 1000,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"temperature":0.5'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"num_predict":1000'),
        })
      );
    });

    it('should throw MODEL_NOT_FOUND on 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'model not found' }),
      });

      try {
        await provider.complete({
          messages: [{ role: 'user', content: 'Hello' }],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('MODEL_NOT_FOUND');
      }
    });

    it('should throw API_ERROR on server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service unavailable' }),
      });

      try {
        await provider.complete({
          messages: [{ role: 'user', content: 'Hello' }],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('API_ERROR');
        expect((error as LLMProviderError).retryable).toBe(true);
      }
    });

    it('should handle incomplete response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Partial response' },
          model: 'llama3.2',
          done: false,
        }),
      });

      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.finishReason).toBe('unknown');
    });

    it('should throw NETWORK_ERROR on connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection reset'));

      try {
        await provider.complete({
          messages: [{ role: 'user', content: 'Hello' }],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('NETWORK_ERROR');
      }
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors in API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      try {
        await provider.enrich('test', 'clean-transcript');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('API_ERROR');
      }
    });

    it('should preserve LLMProviderError when re-thrown', async () => {
      const originalError = new LLMProviderError({
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        provider: 'ollama',
        retryable: false,
      });

      mockFetch.mockRejectedValueOnce(originalError);

      try {
        await provider.enrich('test', 'clean-transcript');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBe(originalError);
      }
    });
  });

  describe('constants', () => {
    it('should export recommended models', () => {
      expect(OLLAMA_RECOMMENDED_MODELS).toBeDefined();
      expect(Array.isArray(OLLAMA_RECOMMENDED_MODELS)).toBe(true);
      expect(OLLAMA_RECOMMENDED_MODELS.length).toBeGreaterThan(0);
    });

    it('should have id, name, and description for each recommended model', () => {
      for (const model of OLLAMA_RECOMMENDED_MODELS) {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.description).toBeDefined();
      }
    });

    it('should export default OLLAMA URL', () => {
      expect(DEFAULT_OLLAMA_URL).toBe('http://localhost:11434');
    });
  });
});
