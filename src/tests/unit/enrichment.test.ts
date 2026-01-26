import { describe, it, expect } from 'vitest';
import {
  ENRICHMENT_PROMPTS,
  buildEnrichmentMessages,
  validateTranscript,
} from '../../services/enrichment';

describe('Enrichment Engine', () => {
  describe('ENRICHMENT_PROMPTS', () => {
    it('should have all 5 enrichment modes defined', () => {
      expect(ENRICHMENT_PROMPTS['meeting-notes']).toBeDefined();
      expect(ENRICHMENT_PROMPTS['clean-transcript']).toBeDefined();
      expect(ENRICHMENT_PROMPTS['action-items']).toBeDefined();
      expect(ENRICHMENT_PROMPTS['summary']).toBeDefined();
      expect(ENRICHMENT_PROMPTS['custom']).toBeDefined();
    });

    it('should have system and user prompts for each mode', () => {
      const modes = Object.keys(ENRICHMENT_PROMPTS) as Array<keyof typeof ENRICHMENT_PROMPTS>;
      modes.forEach((mode) => {
        expect(ENRICHMENT_PROMPTS[mode].system).toBeDefined();
        expect(typeof ENRICHMENT_PROMPTS[mode].system).toBe('string');
        expect(ENRICHMENT_PROMPTS[mode].user).toBeDefined();
        expect(typeof ENRICHMENT_PROMPTS[mode].user).toBe('function');
      });
    });
  });

  describe('buildEnrichmentMessages', () => {
    it('should build messages for clean-transcript mode', () => {
      const messages = buildEnrichmentMessages('Test transcript', 'clean-transcript');
      expect(messages.system).toContain('transcript editor');
      expect(messages.user).toContain('Test transcript');
    });

    it('should build messages for meeting-notes mode', () => {
      const messages = buildEnrichmentMessages('Meeting discussion', 'meeting-notes');
      expect(messages.system).toContain('meeting notes');
      expect(messages.user).toContain('Meeting discussion');
    });

    it('should build messages for action-items mode', () => {
      const messages = buildEnrichmentMessages('Tasks to do', 'action-items');
      expect(messages.system).toContain('task extraction');
      expect(messages.user).toContain('Tasks to do');
    });

    it('should build messages for summary mode with sentence count', () => {
      const messages = buildEnrichmentMessages(
        'Long content',
        'summary',
        'en',
        { sentences: 5 }
      );
      expect(messages.user).toContain('5 sentences');
    });

    it('should build messages for custom mode with custom prompt', () => {
      const messages = buildEnrichmentMessages(
        'Custom content',
        'custom',
        'en',
        { customPrompt: 'Translate to French' }
      );
      expect(messages.user).toContain('Translate to French');
    });

    it('should include language instruction in system prompt', () => {
      const messagesEn = buildEnrichmentMessages('Test', 'clean-transcript', 'en');
      expect(messagesEn.system).toContain('English');

      const messagesDe = buildEnrichmentMessages('Test', 'clean-transcript', 'de');
      expect(messagesDe.system).toContain('Deutsch');

      const messagesNo = buildEnrichmentMessages('Test', 'clean-transcript', 'no');
      expect(messagesNo.system).toContain('norsk');
    });
  });

  describe('validateTranscript', () => {
    it('should reject empty transcript', () => {
      const result = validateTranscript('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only transcript', () => {
      const result = validateTranscript('   \n\t  ');
      expect(result.valid).toBe(false);
    });

    it('should reject too short transcript', () => {
      const result = validateTranscript('Hello');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should accept valid transcript', () => {
      const result = validateTranscript('This is a valid transcript with enough content');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
