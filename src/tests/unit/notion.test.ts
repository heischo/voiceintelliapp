import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateApiKeyFormat,
  NotionClient,
  NotionError
} from '../../lib/notion';

// Mock the @notionhq/client module with a proper class constructor
vi.mock('@notionhq/client', () => {
  return {
    Client: class MockNotionClient {
      users = {
        me: vi.fn().mockResolvedValue({ id: 'bot-123', type: 'bot' }),
      };
      pages = {
        create: vi.fn().mockResolvedValue({
          id: 'page-123',
          url: 'https://notion.so/page-123',
          created_time: '2026-01-27T00:00:00.000Z',
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_options: { auth: string }) {
        // Mock constructor
      }
    },
  };
});

describe('Notion Integration Module', () => {
  describe('validateApiKeyFormat', () => {
    it('should return true for valid secret_ prefix', () => {
      expect(validateApiKeyFormat('secret_' + 'x'.repeat(40))).toBe(true);
    });

    it('should return true for valid ntn_ prefix', () => {
      expect(validateApiKeyFormat('ntn_' + 'x'.repeat(40))).toBe(true);
    });

    it('should return false for invalid prefix', () => {
      expect(validateApiKeyFormat('invalid_' + 'x'.repeat(40))).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(validateApiKeyFormat('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(validateApiKeyFormat(null as any)).toBe(false);
      expect(validateApiKeyFormat(undefined as any)).toBe(false);
    });

    it('should return false for too short key', () => {
      expect(validateApiKeyFormat('secret_short')).toBe(false);
    });
  });

  describe('NotionClient', () => {
    it('should initialize without settings', () => {
      const client = new NotionClient();
      expect(client.isConfigured()).toBe(false);
    });

    it('should configure with valid settings', () => {
      const client = new NotionClient();
      client.configure({ apiKey: 'secret_' + 'x'.repeat(40) });
      expect(client.isConfigured()).toBe(true);
    });

    it('should throw NOT_CONFIGURED without API key', () => {
      const client = new NotionClient();
      expect(() => client.configure({ apiKey: '' })).toThrow(NotionError);
    });

    it('should initialize with settings in constructor', () => {
      const client = new NotionClient({
        apiKey: 'secret_' + 'x'.repeat(40),
      });
      expect(client.isConfigured()).toBe(true);
    });

    it('should return null settings when not configured', () => {
      const client = new NotionClient();
      expect(client.getSettings()).toBeNull();
    });

    it('should set API key with setApiKey', () => {
      const client = new NotionClient();
      client.setApiKey('secret_' + 'x'.repeat(40));
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe('NotionClient.createPage', () => {
    let client: NotionClient;

    beforeEach(() => {
      client = new NotionClient({
        apiKey: 'secret_' + 'x'.repeat(40),
        parentPageId: 'parent-123',
      });
    });

    it('should throw NOT_CONFIGURED when client not configured', async () => {
      const unconfiguredClient = new NotionClient();
      await expect(
        unconfiguredClient.createPage({ title: 'Test', content: 'Content' })
      ).rejects.toThrow(NotionError);
    });

    it('should throw VALIDATION_ERROR without parent or database', async () => {
      const clientNoParent = new NotionClient({ apiKey: 'secret_' + 'x'.repeat(40) });
      await expect(
        clientNoParent.createPage({ title: 'Test', content: 'Content' })
      ).rejects.toThrow(NotionError);
    });

    it('should create page with valid settings', async () => {
      const result = await client.createPage({
        title: 'Test Title',
        content: 'Test content',
      });
      expect(result.id).toBe('page-123');
      expect(result.title).toBe('Test Title');
    });

    it('should create page with database ID', async () => {
      const dbClient = new NotionClient({
        apiKey: 'secret_' + 'x'.repeat(40),
        databaseId: 'db-123',
      });
      const result = await dbClient.createPage({
        title: 'DB Title',
        content: 'DB content',
      });
      expect(result.id).toBe('page-123');
    });

    it('should create page with tags', async () => {
      const dbClient = new NotionClient({
        apiKey: 'secret_' + 'x'.repeat(40),
        databaseId: 'db-123',
      });
      const result = await dbClient.createPage({
        title: 'Tagged Title',
        content: 'Tagged content',
        tags: ['tag1', 'tag2'],
      });
      expect(result.id).toBe('page-123');
    });
  });

  describe('NotionError', () => {
    it('should have correct properties', () => {
      const error = new NotionError({
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        retryable: true,
      });
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('NotionError');
    });

    it('should store cause', () => {
      const cause = new Error('Original error');
      const error = new NotionError({
        code: 'API_ERROR',
        message: 'API failed',
        retryable: true,
        cause,
      });
      expect(error.cause).toBe(cause);
    });

    it('should have all error codes typed', () => {
      const codes: string[] = [
        'NOT_CONFIGURED',
        'INVALID_API_KEY',
        'RATE_LIMITED',
        'PAGE_NOT_FOUND',
        'PERMISSION_DENIED',
        'VALIDATION_ERROR',
        'NETWORK_ERROR',
        'API_ERROR',
      ];
      codes.forEach((code) => {
        const error = new NotionError({
          code: code as any,
          message: 'Test',
          retryable: false,
        });
        expect(error.code).toBe(code);
      });
    });
  });
});
