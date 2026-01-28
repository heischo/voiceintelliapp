// Tauri IPC Wrapper - Centralizes all communication with Rust backend

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { Store } from '@tauri-apps/plugin-store';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile, readTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import type { Settings, WhisperModel, DownloadProgress, DownloadResult } from '../types';
import { generatePdfAsBytes, type PdfOptions } from './pdf';
import {
  NotionError,
  type CreatePageOptions,
  type CreatePageResult,
} from './notion';

// Re-export Notion types and classes for external use
export { NotionError };
export type { CreatePageOptions, CreatePageResult };
import type { OllamaServiceStatus, OllamaModel, OllamaPullProgress } from '../types/llm';

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
    // In Tauri v2, the callback receives an event with state ("Pressed" or "Released")
    // We only want to trigger on key press, not release
    await register(shortcut, (event) => {
      if (event.state === 'Pressed') {
        callback();
      }
    });
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

// ============================================
// Offline Components / Model Management
// ============================================

export async function getAvailableModels(): Promise<WhisperModel[]> {
  try {
    return await invoke<WhisperModel[]>('get_available_models');
  } catch (error) {
    console.error('Failed to get available models:', error);
    return [];
  }
}

export async function downloadWhisperModel(modelId: string): Promise<DownloadResult> {
  try {
    return await invoke<DownloadResult>('download_whisper_model', { modelId });
  } catch (error) {
    console.error('Failed to download whisper model:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function deleteWhisperModel(modelId: string): Promise<boolean> {
  try {
    return await invoke<boolean>('delete_whisper_model', { modelId });
  } catch (error) {
    console.error('Failed to delete whisper model:', error);
    return false;
  }
}

export async function onDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgress>('download-progress', (event) => {
    callback(event.payload);
  });
}

// ============================================
// OLLAMA Management
// ============================================

export async function checkOllamaAvailable(): Promise<OllamaServiceStatus> {
  try {
    return await invoke<OllamaServiceStatus>('check_ollama_available');
  } catch (error) {
    console.error('Failed to check OLLAMA availability:', error);
    return {
      available: false,
      version: null,
      baseUrl: 'http://localhost:11434',
    };
  }
}

export async function getOllamaModels(): Promise<OllamaModel[]> {
  try {
    const result = await invoke<{ models: OllamaModel[] }>('get_ollama_models');
    return result.models || [];
  } catch (error) {
    console.error('Failed to get OLLAMA models:', error);
    return [];
  }
}

export async function pullOllamaModel(modelName: string): Promise<{ success: boolean; message?: string }> {
  try {
    return await invoke<{ success: boolean; message?: string }>('pull_ollama_model', { modelName });
  } catch (error) {
    console.error('Failed to pull OLLAMA model:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function deleteOllamaModel(modelName: string): Promise<boolean> {
  try {
    const result = await invoke<{ success: boolean }>('delete_ollama_model', { modelName });
    return result.success;
  } catch (error) {
    console.error('Failed to delete OLLAMA model:', error);
    return false;
  }
}

export async function onOllamaPullProgress(
  callback: (progress: OllamaPullProgress) => void
): Promise<UnlistenFn> {
  return listen<OllamaPullProgress>('ollama-pull-progress', (event) => {
    callback(event.payload);
  });
}

// ============================================
// Notion API (via Tauri backend)
// ============================================

export interface NotionTestResult {
  success: boolean;
  message: string;
}

export interface NotionPage {
  id: string;
  name: string;
  pageType: string;
}

export interface NotionSearchResult {
  success: boolean;
  pages: NotionPage[];
  error?: string;
}

export interface NotionCreatePageResult {
  success: boolean;
  pageId?: string;
  url?: string;
  error?: string;
}

/**
 * Test Notion API connection
 */
export async function notionTestConnection(apiKey: string): Promise<NotionTestResult> {
  return invoke<NotionTestResult>('notion_test_connection', { apiKey });
}

/**
 * Search for accessible pages and databases in Notion
 */
export async function notionSearchPages(apiKey: string): Promise<NotionSearchResult> {
  return invoke<NotionSearchResult>('notion_search_pages', { apiKey });
}

/**
 * Create a new page in Notion
 */
export async function notionCreatePage(
  apiKey: string,
  parentId: string,
  parentType: string,
  title: string,
  content: string
): Promise<NotionCreatePageResult> {
  return invoke<NotionCreatePageResult>('notion_create_page', {
    apiKey,
    parentId,
    parentType,
    title,
    content,
  });
}

// ============================================
// Notion Export (High-level)
// ============================================

export interface ExportToNotionOptions {
  title?: string;
  parentPageId?: string;
  databaseId?: string;
}

/**
 * Export content to Notion
 * Uses the default page ID from settings if no specific parent is provided
 */
export async function exportToNotion(
  content: string,
  apiKey: string,
  options: ExportToNotionOptions = {}
): Promise<{ success: boolean; url?: string; error?: string }> {
  const { title = 'Transcript', parentPageId, databaseId } = options;

  // If no specific parent is provided, get the default from settings
  let targetId = parentPageId || databaseId;
  let targetType = databaseId ? 'database' : 'page';

  if (!targetId) {
    const settings = await getSettings();
    if (settings?.notionDefaultPageId) {
      targetId = settings.notionDefaultPageId;
      // Check if it's a database (stored page names starting with 📊)
      targetType = settings.notionDefaultPageName?.startsWith('📊') ? 'database' : 'page';
    }
  }

  if (!targetId) {
    return {
      success: false,
      error: 'No destination page configured. Please set a default Notion page in Settings.',
    };
  }

  const result = await notionCreatePage(apiKey, targetId, targetType, title, content);
  return result;
}

// ============================================
// PDF Export
// ============================================

export interface SaveAsPdfOptions {
  title?: string;
  fontSize?: number;
}

/**
 * Save content as a PDF file
 */
export async function saveAsPdf(content: string, filename: string, options: SaveAsPdfOptions = {}): Promise<string | null> {
  try {
    // Only include defined options to avoid overriding defaults with undefined
    const pdfOptions: PdfOptions = {};
    if (options.title !== undefined) pdfOptions.title = options.title;
    if (options.fontSize !== undefined) pdfOptions.fontSize = options.fontSize;

    const pdfBytes = generatePdfAsBytes(content, pdfOptions);

    const selectedPath = await save({
      defaultPath: filename,
      filters: [{
        name: 'PDF',
        extensions: ['pdf'],
      }],
    });

    if (selectedPath) {
      await writeFile(selectedPath, pdfBytes);
      return selectedPath;
    }
    return null;
  } catch (error) {
    console.error('Failed to save PDF:', error);
    throw error;
  }
}
