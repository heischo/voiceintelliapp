// Notion Integration Module
// Provides Notion SDK wrapper for exporting transcripts as pages

import { Client } from '@notionhq/client';
import type { NotionSettings } from '../types';

// ============================================
// Error Types
// ============================================

export interface NotionErrorDetails {
  code: NotionErrorCode;
  message: string;
  retryable: boolean;
  cause?: unknown;
}

export type NotionErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'PAGE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'API_ERROR';

export class NotionError extends Error {
  code: NotionErrorCode;
  retryable: boolean;
  cause?: unknown;

  constructor(details: NotionErrorDetails) {
    super(details.message);
    this.name = 'NotionError';
    this.code = details.code;
    this.retryable = details.retryable;
    this.cause = details.cause;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extracts a type-safe error message from an unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error occurred';
}

/**
 * Extracts status code from Notion API error
 */
function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status;
  }
  return undefined;
}

/**
 * Extracts error code from Notion API error
 */
function getNotionErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code;
  }
  return undefined;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validates Notion API key format
 * Notion API keys start with 'secret_' or 'ntn_'
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  const trimmed = apiKey.trim();

  // Notion integration tokens start with 'secret_' (internal) or 'ntn_' (newer format)
  // They are typically 50+ characters long
  if (trimmed.startsWith('secret_') || trimmed.startsWith('ntn_')) {
    return trimmed.length >= 40;
  }

  return false;
}

/**
 * Validates an API key by making a test request to Notion API
 * Returns user info on success, throws NotionError on failure
 */
export async function validateApiKey(apiKey: string): Promise<{ botId: string; workspaceName?: string }> {
  if (!validateApiKeyFormat(apiKey)) {
    throw new NotionError({
      code: 'VALIDATION_ERROR',
      message: 'Invalid API key format. Notion API keys start with "secret_" or "ntn_".',
      retryable: false,
    });
  }

  const client = new Client({ auth: apiKey });

  try {
    // Use the users.me endpoint to validate the token
    const response = await client.users.me({});

    return {
      botId: response.id,
      workspaceName: response.type === 'bot' ? response.bot?.owner?.type : undefined,
    };
  } catch (error) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error);

    if (status === 401) {
      throw new NotionError({
        code: 'INVALID_API_KEY',
        message: 'Invalid Notion API key. Please check your integration token.',
        retryable: false,
        cause: error,
      });
    }

    if (status === 403) {
      throw new NotionError({
        code: 'PERMISSION_DENIED',
        message: 'API key is valid but has insufficient permissions.',
        retryable: false,
        cause: error,
      });
    }

    if (status === 429) {
      throw new NotionError({
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please try again later.',
        retryable: true,
        cause: error,
      });
    }

    throw new NotionError({
      code: 'API_ERROR',
      message: `Failed to validate API key: ${message}`,
      retryable: true,
      cause: error,
    });
  }
}

// ============================================
// Page Creation Types
// ============================================

export interface CreatePageOptions {
  title: string;
  content: string;
  parentPageId?: string;
  databaseId?: string;
  tags?: string[];
}

export interface CreatePageResult {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

// ============================================
// NotionClient Class
// ============================================

export class NotionClient {
  private client: Client | null = null;
  private settings: NotionSettings | null = null;

  constructor(settings?: NotionSettings) {
    if (settings?.apiKey) {
      this.configure(settings);
    }
  }

  /**
   * Configure the client with Notion settings
   */
  configure(settings: NotionSettings): void {
    if (!settings.apiKey) {
      throw new NotionError({
        code: 'NOT_CONFIGURED',
        message: 'Notion API key is required',
        retryable: false,
      });
    }

    this.settings = settings;
    this.client = new Client({ auth: settings.apiKey });
  }

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return this.client !== null && this.settings !== null;
  }

  /**
   * Get current settings
   */
  getSettings(): NotionSettings | null {
    return this.settings;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.settings = {
      ...this.settings,
      apiKey,
    };
    this.client = new Client({ auth: apiKey });
  }

  /**
   * Set parent page ID
   */
  setParentPageId(parentPageId: string): void {
    if (this.settings) {
      this.settings.parentPageId = parentPageId;
    }
  }

  /**
   * Set database ID
   */
  setDatabaseId(databaseId: string): void {
    if (this.settings) {
      this.settings.databaseId = databaseId;
    }
  }

  /**
   * Validate the current configuration
   */
  async validateConfiguration(): Promise<{ botId: string; workspaceName?: string }> {
    if (!this.settings?.apiKey) {
      throw new NotionError({
        code: 'NOT_CONFIGURED',
        message: 'Notion API key is not configured',
        retryable: false,
      });
    }

    return validateApiKey(this.settings.apiKey);
  }

  /**
   * Create a new page in Notion with transcript content
   */
  async createPage(options: CreatePageOptions): Promise<CreatePageResult> {
    if (!this.client || !this.settings) {
      throw new NotionError({
        code: 'NOT_CONFIGURED',
        message: 'Notion client is not configured. Please add your API key in Settings.',
        retryable: false,
      });
    }

    // Determine parent - use provided or fall back to settings
    const parentPageId = options.parentPageId || this.settings.parentPageId;
    const databaseId = options.databaseId || this.settings.databaseId;

    if (!parentPageId && !databaseId) {
      throw new NotionError({
        code: 'VALIDATION_ERROR',
        message: 'Either a parent page ID or database ID is required to create a page.',
        retryable: false,
      });
    }

    try {
      // Build the page content blocks from the transcript
      const contentBlocks = this.buildContentBlocks(options.content);

      // Determine the parent and build the request
      // We use type assertion here because Notion SDK types are complex and
      // we're constructing valid API payloads dynamically
      let response;

      if (databaseId) {
        // Creating in a database - title property is typically "Name"
        const databaseProperties: Record<string, unknown> = {
          Name: {
            title: [{ type: 'text', text: { content: options.title } }],
          },
        };
        // Add tags if provided and database supports them
        if (options.tags && options.tags.length > 0) {
          databaseProperties['Tags'] = {
            multi_select: options.tags.map((tag) => ({ name: tag })),
          };
        }

        response = await this.client.pages.create({
          parent: { database_id: databaseId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          properties: databaseProperties as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          children: contentBlocks as any,
        });
      } else if (parentPageId) {
        // Creating as child page - title property uses 'title' key
        response = await this.client.pages.create({
          parent: { page_id: parentPageId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          properties: {
            title: {
              title: [{ type: 'text', text: { content: options.title } }],
            },
          } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          children: contentBlocks as any,
        });
      } else {
        // This shouldn't happen due to earlier validation, but TypeScript needs it
        throw new NotionError({
          code: 'VALIDATION_ERROR',
          message: 'No valid parent specified for page creation.',
          retryable: false,
        });
      }

      return {
        id: response.id,
        url: 'url' in response ? response.url : `https://notion.so/${response.id.replace(/-/g, '')}`,
        title: options.title,
        createdAt: 'created_time' in response ? response.created_time : new Date().toISOString(),
      };
    } catch (error) {
      // Re-throw NotionError as-is
      if (error instanceof NotionError) {
        throw error;
      }

      const status = getErrorStatus(error);
      const message = getErrorMessage(error);
      const notionCode = getNotionErrorCode(error);

      if (status === 401) {
        throw new NotionError({
          code: 'INVALID_API_KEY',
          message: 'Invalid Notion API key. Please update your API key in Settings.',
          retryable: false,
          cause: error,
        });
      }

      if (status === 403) {
        throw new NotionError({
          code: 'PERMISSION_DENIED',
          message: 'Permission denied. Please ensure the page/database is shared with your Notion integration.',
          retryable: false,
          cause: error,
        });
      }

      if (status === 404) {
        throw new NotionError({
          code: 'PAGE_NOT_FOUND',
          message: 'Parent page or database not found. Please check the ID and sharing permissions.',
          retryable: false,
          cause: error,
        });
      }

      if (status === 429) {
        throw new NotionError({
          code: 'RATE_LIMITED',
          message: 'Notion rate limit exceeded. Please wait a moment and try again.',
          retryable: true,
          cause: error,
        });
      }

      if (notionCode === 'validation_error') {
        throw new NotionError({
          code: 'VALIDATION_ERROR',
          message: `Validation error: ${message}`,
          retryable: false,
          cause: error,
        });
      }

      // Check for network errors
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
        throw new NotionError({
          code: 'NETWORK_ERROR',
          message: 'Network error. Please check your internet connection.',
          retryable: true,
          cause: error,
        });
      }

      throw new NotionError({
        code: 'API_ERROR',
        message: `Failed to create Notion page: ${message}`,
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Build Notion block content from text
   * Splits content into paragraphs and handles long text
   */
  private buildContentBlocks(content: string): Array<{
    object: 'block';
    type: 'paragraph';
    paragraph: {
      rich_text: Array<{
        type: 'text';
        text: { content: string };
      }>;
    };
  }> {
    // Notion has a limit of 2000 characters per text block
    const MAX_BLOCK_LENGTH = 2000;
    const blocks: Array<{
      object: 'block';
      type: 'paragraph';
      paragraph: {
        rich_text: Array<{
          type: 'text';
          text: { content: string };
        }>;
      };
    }> = [];

    // Split content by double newlines to create paragraphs
    const paragraphs = content.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      // If paragraph is longer than max, split it
      if (trimmed.length > MAX_BLOCK_LENGTH) {
        // Split by sentences or at max length
        const chunks = this.splitTextIntoChunks(trimmed, MAX_BLOCK_LENGTH);
        for (const chunk of chunks) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: chunk } }],
            },
          });
        }
      } else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: trimmed } }],
          },
        });
      }
    }

    // If no content, add an empty block
    if (blocks.length === 0) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: '(No content)' } }],
        },
      });
    }

    return blocks;
  }

  /**
   * Split text into chunks, preferring to break at sentence boundaries
   */
  private splitTextIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to find a sentence boundary within the limit
      let splitIndex = remaining.lastIndexOf('. ', maxLength);
      if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
        // No good sentence boundary, try word boundary
        splitIndex = remaining.lastIndexOf(' ', maxLength);
      }
      if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
        // No good boundary, force split at max length
        splitIndex = maxLength;
      } else {
        // Include the period/space in the current chunk
        splitIndex += 1;
      }

      chunks.push(remaining.slice(0, splitIndex).trim());
      remaining = remaining.slice(splitIndex).trim();
    }

    return chunks;
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Create a page in Notion using provided settings
 * This is a convenience function for one-off exports
 */
export async function createPage(
  settings: NotionSettings,
  options: CreatePageOptions
): Promise<CreatePageResult> {
  const client = new NotionClient(settings);
  return client.createPage(options);
}
