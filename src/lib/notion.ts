// Notion Integration Module - Handles exporting content to Notion

import type { NotionSettings, NotionPage } from '../types';

/**
 * Custom error class for Notion-related errors
 */
export class NotionError extends Error {
  public code: string;
  public status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'NotionError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Options for creating a Notion page
 */
export interface CreatePageOptions {
  title: string;
  content: string;
  parentPageId?: string;
  databaseId?: string;
}

/**
 * Result of creating a Notion page
 */
export interface CreatePageResult {
  success: boolean;
  pageId?: string;
  url?: string;
  error?: string;
}

/**
 * Validates the format of a Notion API key
 * @param apiKey - The API key to validate
 * @returns true if the format is valid
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  // Notion API keys start with 'secret_' or 'ntn_' (internal integration tokens)
  return apiKey.startsWith('secret_') || apiKey.startsWith('ntn_');
}

/**
 * Validates that a Notion API key is valid by making a test request
 * @param apiKey - The API key to validate
 * @returns Promise resolving to true if valid, throws NotionError if invalid
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!validateApiKeyFormat(apiKey)) {
    throw new NotionError(
      'Invalid API key format. Notion API keys should start with "secret_" or "ntn_".',
      'INVALID_FORMAT'
    );
  }

  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new NotionError('Invalid API key', 'UNAUTHORIZED', 401);
      }
      throw new NotionError(`Notion API error: ${response.statusText}`, 'API_ERROR', response.status);
    }

    return true;
  } catch (error) {
    if (error instanceof NotionError) {
      throw error;
    }
    throw new NotionError(
      `Failed to validate API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Converts plain text content to Notion block format
 */
function textToNotionBlocks(content: string): object[] {
  const paragraphs = content.split('\n\n').filter(p => p.trim());

  return paragraphs.map(paragraph => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: {
          content: paragraph.trim(),
        },
      }],
    },
  }));
}

/**
 * NotionClient class for interacting with the Notion API
 */
export class NotionClient {
  private apiKey: string;
  private baseUrl = 'https://api.notion.com/v1';
  private notionVersion = '2022-06-28';

  constructor(settings: NotionSettings) {
    if (!settings.apiKey) {
      throw new NotionError('API key is required', 'MISSING_API_KEY');
    }
    this.apiKey = settings.apiKey;
  }

  /**
   * Creates a new page in Notion
   * @param options - Options for creating the page
   * @returns Promise resolving to CreatePageResult
   */
  async createPage(options: CreatePageOptions): Promise<CreatePageResult> {
    const { title, content, parentPageId, databaseId } = options;

    if (!parentPageId && !databaseId) {
      throw new NotionError(
        'Either parentPageId or databaseId must be provided',
        'MISSING_PARENT'
      );
    }

    try {
      const blocks = textToNotionBlocks(content);

      // Build the request body based on parent type
      let requestBody: Record<string, unknown>;

      if (databaseId) {
        requestBody = {
          parent: { database_id: databaseId },
          properties: {
            title: {
              title: [{ text: { content: title } }],
            },
          },
          children: blocks,
        };
      } else {
        requestBody = {
          parent: { page_id: parentPageId },
          properties: {
            title: {
              title: [{ text: { content: title } }],
            },
          },
          children: blocks,
        };
      }

      const response = await fetch(`${this.baseUrl}/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': this.notionVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData as { message?: string }).message || response.statusText;

        if (response.status === 401) {
          throw new NotionError('Invalid or expired API key', 'UNAUTHORIZED', 401);
        }
        if (response.status === 403) {
          throw new NotionError(
            'Access denied. Make sure the integration has access to the parent page or database.',
            'FORBIDDEN',
            403
          );
        }
        if (response.status === 404) {
          throw new NotionError(
            'Parent page or database not found. Check the ID and ensure the integration has access.',
            'NOT_FOUND',
            404
          );
        }

        throw new NotionError(`Notion API error: ${errorMessage}`, 'API_ERROR', response.status);
      }

      const data = await response.json();
      const typedData = data as { id?: string; url?: string };

      return {
        success: true,
        pageId: typedData.id,
        url: typedData.url,
      };
    } catch (error) {
      if (error instanceof NotionError) {
        throw error;
      }
      throw new NotionError(
        `Failed to create page: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Searches for accessible pages and databases
   * @returns Promise resolving to array of NotionPage
   */
  async searchPages(): Promise<NotionPage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': this.notionVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            value: 'page',
            property: 'object',
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time',
          },
          page_size: 50,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new NotionError('Invalid or expired API key', 'UNAUTHORIZED', 401);
        }
        throw new NotionError(`Notion API error: ${response.statusText}`, 'API_ERROR', response.status);
      }

      const data = await response.json();
      const results = (data as { results?: Array<Record<string, unknown>> }).results || [];

      const pages: NotionPage[] = results.map((item) => {
        const properties = item.properties as Record<string, unknown> | undefined;
        const titleProp = properties?.title || properties?.Name;
        let name = 'Untitled';

        if (titleProp && typeof titleProp === 'object') {
          const titleArray = (titleProp as { title?: Array<{ plain_text?: string }> }).title;
          if (titleArray && titleArray.length > 0 && titleArray[0].plain_text) {
            name = titleArray[0].plain_text;
          }
        }

        return {
          id: item.id as string,
          name,
          type: 'page' as const,
        };
      });

      // Also fetch databases
      const dbResponse = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': this.notionVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            value: 'database',
            property: 'object',
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time',
          },
          page_size: 50,
        }),
      });

      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        const dbResults = (dbData as { results?: Array<Record<string, unknown>> }).results || [];

        dbResults.forEach((item) => {
          const titleArray = (item.title as Array<{ plain_text?: string }>) || [];
          const name = titleArray.length > 0 && titleArray[0].plain_text
            ? titleArray[0].plain_text
            : 'Untitled Database';

          pages.push({
            id: item.id as string,
            name: `📊 ${name}`,
            type: 'database' as const,
          });
        });
      }

      return pages;
    } catch (error) {
      if (error instanceof NotionError) {
        throw error;
      }
      throw new NotionError(
        `Failed to search pages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Tests the API key validity
   * @returns Promise resolving to true if valid
   */
  async testConnection(): Promise<boolean> {
    return validateApiKey(this.apiKey);
  }
}

/**
 * Convenience function to create a page in Notion
 * @param settings - Notion settings including API key
 * @param options - Options for creating the page
 * @returns Promise resolving to CreatePageResult
 */
export async function createPage(
  settings: NotionSettings,
  options: CreatePageOptions
): Promise<CreatePageResult> {
  const client = new NotionClient(settings);
  return client.createPage(options);
}

/**
 * Convenience function to search for accessible pages in Notion
 * @param apiKey - The Notion API key
 * @returns Promise resolving to array of NotionPage
 */
export async function searchNotionPages(apiKey: string): Promise<NotionPage[]> {
  const client = new NotionClient({ apiKey });
  return client.searchPages();
}

/**
 * Convenience function to test Notion API connection
 * @param apiKey - The Notion API key
 * @returns Promise resolving to true if valid
 */
export async function testNotionConnection(apiKey: string): Promise<boolean> {
  const client = new NotionClient({ apiKey });
  return client.testConnection();
}
