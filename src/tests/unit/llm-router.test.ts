import { describe, it, expect, beforeEach } from 'vitest';
import { LLMRouter, getLLMRouter, resetLLMRouter } from '../../services/llm-router';
import { LLMProviderError } from '../../types/llm';

describe('LLM Router', () => {
  beforeEach(() => {
    resetLLMRouter();
  });

  describe('initialization', () => {
    it('should create a singleton instance', () => {
      const router1 = getLLMRouter();
      const router2 = getLLMRouter();
      expect(router1).toBe(router2);
    });

    it('should have OpenAI provider registered by default', () => {
      const router = getLLMRouter();
      const providers = router.getAvailableProviders();
      expect(providers).toContain('openai');
    });
  });

  describe('provider management', () => {
    it('should return available providers', () => {
      const router = new LLMRouter();
      const providers = router.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should set default provider', () => {
      const router = new LLMRouter();
      expect(() => router.setDefaultProvider('openai')).not.toThrow();
    });

    it('should throw when setting non-existent default provider', () => {
      const router = new LLMRouter();
      expect(() => router.setDefaultProvider('nonexistent')).toThrow();
    });

    it('should get provider by name', () => {
      const router = new LLMRouter();
      const provider = router.getProvider('openai');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
    });

    it('should throw when getting non-existent provider', () => {
      const router = new LLMRouter();
      expect(() => router.getProvider('nonexistent')).toThrow(LLMProviderError);
    });
  });

  describe('provider configuration', () => {
    it('should check if provider is configured', async () => {
      const router = new LLMRouter();
      const isConfigured = await router.isProviderConfigured('openai');
      expect(typeof isConfigured).toBe('boolean');
    });

    it('should return false for unconfigured provider', async () => {
      const router = new LLMRouter();
      const isConfigured = await router.isProviderConfigured('openai');
      expect(isConfigured).toBe(false);
    });

    it('should configure provider with API key', () => {
      const router = new LLMRouter();
      expect(() => {
        router.configureProvider('openai', 'test-api-key', 'gpt-4o-mini');
      }).not.toThrow();
    });
  });

  describe('enrichment', () => {
    it('should throw when provider is not configured', async () => {
      const router = new LLMRouter();
      await expect(
        router.enrich('test transcript', 'clean-transcript')
      ).rejects.toThrow(LLMProviderError);
    });

    it('should throw with helpful message when API key missing', async () => {
      const router = new LLMRouter();
      try {
        await router.enrich('test transcript', 'clean-transcript');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMProviderError);
        expect((error as LLMProviderError).code).toBe('NOT_CONFIGURED');
      }
    });
  });

  describe('language setting', () => {
    it('should set language without error', () => {
      const router = new LLMRouter();
      expect(() => router.setLanguage('de')).not.toThrow();
      expect(() => router.setLanguage('en')).not.toThrow();
      expect(() => router.setLanguage('no')).not.toThrow();
    });
  });
});
