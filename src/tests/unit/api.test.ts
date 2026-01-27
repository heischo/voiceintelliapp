import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri plugins before importing api
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(),
  readText: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
      save: vi.fn(),
    }),
  },
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(),
  writeFile: vi.fn(),
  readTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  BaseDirectory: { AppData: 'appdata' },
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
  isRegistered: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { copyToClipboard, ClipboardError } from '../../lib/api';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

describe('Clipboard Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('copyToClipboard', () => {
    it('should copy text successfully', async () => {
      vi.mocked(writeText).mockResolvedValueOnce(undefined);
      await expect(copyToClipboard('test content')).resolves.toBeUndefined();
      expect(writeText).toHaveBeenCalledWith('test content');
    });

    it('should throw ClipboardError for null content', async () => {
      await expect(copyToClipboard(null as any)).rejects.toThrow(ClipboardError);
      await expect(copyToClipboard(null as any)).rejects.toThrow('Cannot copy null or undefined');
    });

    it('should throw ClipboardError for undefined content', async () => {
      await expect(copyToClipboard(undefined as any)).rejects.toThrow(ClipboardError);
    });

    it('should throw ClipboardError for non-string content', async () => {
      await expect(copyToClipboard(123 as any)).rejects.toThrow(ClipboardError);
      await expect(copyToClipboard(123 as any)).rejects.toThrow('must be a string');
    });

    it('should allow empty string but warn', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(writeText).mockResolvedValueOnce(undefined);

      await expect(copyToClipboard('')).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith('Copying empty string to clipboard');

      warnSpy.mockRestore();
    });

    it('should throw ClipboardError with cause on failure', async () => {
      const originalError = new Error('Permission denied');
      vi.mocked(writeText).mockRejectedValueOnce(originalError);

      try {
        await copyToClipboard('test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ClipboardError);
        expect((error as ClipboardError).cause).toBe(originalError);
      }
    });

    it('should provide user-friendly message for permission errors', async () => {
      vi.mocked(writeText).mockRejectedValueOnce(new Error('Permission denied'));

      await expect(copyToClipboard('test')).rejects.toThrow('Clipboard access denied');
    });

    it('should provide user-friendly message for focus errors', async () => {
      vi.mocked(writeText).mockRejectedValueOnce(new Error('Document is not focused'));

      await expect(copyToClipboard('test')).rejects.toThrow('application window is focused');
    });

    it('should provide user-friendly message for unavailable clipboard', async () => {
      vi.mocked(writeText).mockRejectedValueOnce(new Error('Clipboard is not supported'));

      await expect(copyToClipboard('test')).rejects.toThrow('not available');
    });

    it('should wrap unexpected errors', async () => {
      vi.mocked(writeText).mockRejectedValueOnce(new Error('Some random error'));

      await expect(copyToClipboard('test')).rejects.toThrow('Failed to copy to clipboard');
    });
  });

  describe('ClipboardError', () => {
    it('should have correct name and message', () => {
      const error = new ClipboardError('Test error');
      expect(error.name).toBe('ClipboardError');
      expect(error.message).toBe('Test error');
    });

    it('should store cause', () => {
      const cause = new Error('Original');
      const error = new ClipboardError('Wrapper', cause);
      expect(error.cause).toBe(cause);
    });

    it('should be instanceof Error', () => {
      const error = new ClipboardError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ClipboardError);
    });
  });
});
