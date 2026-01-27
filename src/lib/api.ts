// Tauri IPC Wrapper - Centralizes all communication with Rust backend

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { Store } from '@tauri-apps/plugin-store';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile, readTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import type { Settings, NotionSettings } from '../types';
import { generatePdfAsBytes, type PdfOptions } from './pdf';
import {
  NotionClient,
  NotionError,
  createPage,
  validateApiKey,
  validateApiKeyFormat,
  type CreatePageOptions,
  type CreatePageResult,
} from './notion';

// Re-export Notion types and classes for external use
export { NotionError };
export type { CreatePageOptions, CreatePageResult };

// Store instance for non-sensitive settings
let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('settings.json');
  }
  return store;
}

// ============================================
// Settings Management
// ============================================

export async function getSettings(): Promise<Settings | null> {
  try {
    const s = await getStore();
    const settings = await s.get<Settings>('settings');
    return settings || null;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return null;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    const s = await getStore();
    await s.set('settings', settings);
    await s.save();
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

// ============================================
// Hotkey Management
// ============================================

export async function registerHotkey(
  shortcut: string,
  callback: () => void
): Promise<void> {
  try {
    await register(shortcut, callback);
  } catch (error) {
    console.error('Failed to register hotkey:', error);
    throw error;
  }
}

export async function unregisterHotkey(shortcut: string): Promise<void> {
  try {
    await unregister(shortcut);
  } catch (error) {
    console.error('Failed to unregister hotkey:', error);
    throw error;
  }
}

export async function isHotkeyRegistered(shortcut: string): Promise<boolean> {
  try {
    return await isRegistered(shortcut);
  } catch (error) {
    console.error('Failed to check hotkey registration:', error);
    return false;
  }
}

// ============================================
// Clipboard Operations
// ============================================

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await writeText(text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw error;
  }
}

export async function readFromClipboard(): Promise<string> {
  try {
    const text = await readText();
    return text || '';
  } catch (error) {
    console.error('Failed to read from clipboard:', error);
    throw error;
  }
}

// ============================================
// File Operations
// ============================================

export async function saveToFile(
  content: string,
  suggestedName?: string
): Promise<string | null> {
  try {
    const filePath = await save({
      defaultPath: suggestedName || `transcript-${Date.now()}.md`,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (filePath) {
      await writeTextFile(filePath, content);
      return filePath;
    }
    return null;
  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
}

export async function saveAsPdf(
  content: string,
  suggestedName?: string,
  options?: PdfOptions
): Promise<string | null> {
  try {
    if (!content || content.trim().length === 0) {
      throw new Error('Cannot save empty content as PDF');
    }

    const filePath = await save({
      defaultPath: suggestedName || `transcript-${Date.now()}.pdf`,
      filters: [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (filePath) {
      const pdfBytes = generatePdfAsBytes(content, options);
      await writeFile(filePath, pdfBytes);
      return filePath;
    }
    return null;
  } catch (error) {
    console.error('Failed to save PDF:', error);
    throw error;
  }
}

export async function saveToAppData(
  filename: string,
  content: string
): Promise<void> {
  try {
    // Ensure directory exists
    const dirExists = await exists('transcripts', { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir('transcripts', { baseDir: BaseDirectory.AppData, recursive: true });
    }

    await writeTextFile(`transcripts/${filename}`, content, {
      baseDir: BaseDirectory.AppData,
    });
  } catch (error) {
    console.error('Failed to save to app data:', error);
    throw error;
  }
}

export async function readFromAppData(filename: string): Promise<string | null> {
  try {
    const content = await readTextFile(`transcripts/${filename}`, {
      baseDir: BaseDirectory.AppData,
    });
    return content;
  } catch (error) {
    console.error('Failed to read from app data:', error);
    return null;
  }
}

// ============================================
// Notion Integration
// ============================================

export interface ExportToNotionOptions {
  title?: string;
  parentPageId?: string;
  databaseId?: string;
}

export async function exportToNotion(
  content: string,
  apiKey: string,
  options?: ExportToNotionOptions
): Promise<CreatePageResult> {
  try {
    if (!content || content.trim().length === 0) {
      throw new NotionError('Cannot export empty content to Notion', 'EMPTY_CONTENT');
    }

    if (!apiKey) {
      throw new NotionError('Notion API key is required', 'MISSING_API_KEY');
    }

    const settings: NotionSettings = {
      apiKey,
      parentPageId: options?.parentPageId,
      databaseId: options?.databaseId,
    };

    const createOptions: CreatePageOptions = {
      title: options?.title || `Transcript - ${new Date().toLocaleString()}`,
      content,
      parentPageId: options?.parentPageId,
      databaseId: options?.databaseId,
    };

    const result = await createPage(settings, createOptions);
    return result;
  } catch (error) {
    if (error instanceof NotionError) {
      console.error('Notion export error:', error.message);
      throw error;
    }
    console.error('Failed to export to Notion:', error);
    throw new NotionError(
      `Failed to export to Notion: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'EXPORT_FAILED'
    );
  }
}

export async function validateNotionApiKey(apiKey: string): Promise<boolean> {
  try {
    return await validateApiKey(apiKey);
  } catch (error) {
    console.error('Failed to validate Notion API key:', error);
    throw error;
  }
}

export function isNotionApiKeyFormatValid(apiKey: string): boolean {
  return validateApiKeyFormat(apiKey);
}

// ============================================
// Tauri Commands (IPC to Rust)
// ============================================

export async function getAppVersion(): Promise<string> {
  try {
    return await invoke<string>('get_app_version');
  } catch (error) {
    console.error('Failed to get app version:', error);
    return '0.0.0';
  }
}

export async function invokeGetSettings(): Promise<Settings | null> {
  try {
    return await invoke<Settings>('get_settings');
  } catch (error) {
    console.error('Failed to invoke get_settings:', error);
    return null;
  }
}

export async function invokeSaveSettings(settings: Settings): Promise<void> {
  try {
    await invoke('save_settings', { settings });
  } catch (error) {
    console.error('Failed to invoke save_settings:', error);
    throw error;
  }
}

// ============================================
// Event Listeners
// ============================================

export async function onRecordingStarted(
  callback: () => void
): Promise<UnlistenFn> {
  return listen('recording_started', callback);
}

export async function onRecordingStopped(
  callback: (audioPath: string) => void
): Promise<UnlistenFn> {
  return listen<string>('recording_stopped', (event) => {
    callback(event.payload);
  });
}

export async function onTranscriptReady(
  callback: (transcript: string) => void
): Promise<UnlistenFn> {
  return listen<string>('transcript_ready', (event) => {
    callback(event.payload);
  });
}

export async function onEnrichmentComplete(
  callback: (content: string) => void
): Promise<UnlistenFn> {
  return listen<string>('enrichment_complete', (event) => {
    callback(event.payload);
  });
}

export async function onError(
  callback: (error: string) => void
): Promise<UnlistenFn> {
  return listen<string>('error', (event) => {
    callback(event.payload);
  });
}

// ============================================
// History Management
// ============================================

export interface HistoryItem {
  id: string;
  timestamp: number;
  rawTranscript: string;
  enrichedContent: string;
  enrichmentMode: string;
  duration: number;
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const s = await getStore();
    const history = await s.get<HistoryItem[]>('history');
    return history || [];
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
}

export async function addToHistory(item: HistoryItem): Promise<void> {
  try {
    const s = await getStore();
    const history = (await s.get<HistoryItem[]>('history')) || [];
    history.unshift(item);
    await s.set('history', history);
    await s.save();
  } catch (error) {
    console.error('Failed to add to history:', error);
    throw error;
  }
}

export async function clearHistory(): Promise<void> {
  try {
    const s = await getStore();
    await s.set('history', []);
    await s.save();
  } catch (error) {
    console.error('Failed to clear history:', error);
    throw error;
  }
}

export async function deleteHistoryItem(id: string): Promise<void> {
  try {
    const s = await getStore();
    const history = (await s.get<HistoryItem[]>('history')) || [];
    const filtered = history.filter((item) => item.id !== id);
    await s.set('history', filtered);
    await s.save();
  } catch (error) {
    console.error('Failed to delete history item:', error);
    throw error;
  }
}

export async function cleanupOldHistory(retentionDays: number): Promise<void> {
  if (retentionDays <= 0) return;

  try {
    const s = await getStore();
    const history = (await s.get<HistoryItem[]>('history')) || [];
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const filtered = history.filter((item) => item.timestamp > cutoff);

    if (filtered.length !== history.length) {
      await s.set('history', filtered);
      await s.save();
    }
  } catch (error) {
    console.error('Failed to cleanup old history:', error);
  }
}
