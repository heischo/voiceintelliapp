'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { registerHotkey, unregisterHotkey, isHotkeyRegistered } from '../lib/api';

interface UseHotkeyReturn {
  isRegistered: boolean;
  isLoading: boolean;
  error: string | null;
  register: (shortcut: string, callback: () => void) => Promise<void>;
  unregister: () => Promise<void>;
  checkConflict: (shortcut: string) => Promise<boolean>;
}

export function useHotkey(
  initialShortcut?: string,
  onTrigger?: () => void
): UseHotkeyReturn {
  const [currentShortcut, setCurrentShortcut] = useState<string | null>(
    initialShortcut || null
  );
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef(onTrigger);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onTrigger;
  }, [onTrigger]);

  // Register hotkey on mount if initial shortcut provided
  useEffect(() => {
    if (initialShortcut && callbackRef.current) {
      registerShortcut(initialShortcut, callbackRef.current);
    }

    return () => {
      if (currentShortcut) {
        unregisterHotkey(currentShortcut).catch(console.error);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const registerShortcut = useCallback(
    async (shortcut: string, callback: () => void) => {
      try {
        setIsLoading(true);
        setError(null);

        // Unregister previous shortcut if exists
        if (currentShortcut && currentShortcut !== shortcut) {
          await unregisterHotkey(currentShortcut);
        }

        // Register new shortcut
        await registerHotkey(shortcut, callback);
        setCurrentShortcut(shortcut);
        setIsRegistered(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to register hotkey';
        setError(message);
        setIsRegistered(false);

        // Check if it's a conflict
        if (message.toLowerCase().includes('already registered') ||
            message.toLowerCase().includes('conflict')) {
          setError(`Hotkey ${shortcut} is already in use by another application`);
        }

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentShortcut]
  );

  const unregisterShortcut = useCallback(async () => {
    if (!currentShortcut) return;

    try {
      setIsLoading(true);
      setError(null);
      await unregisterHotkey(currentShortcut);
      setCurrentShortcut(null);
      setIsRegistered(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unregister hotkey';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentShortcut]);

  const checkConflict = useCallback(async (shortcut: string): Promise<boolean> => {
    try {
      return await isHotkeyRegistered(shortcut);
    } catch {
      return false;
    }
  }, []);

  return {
    isRegistered,
    isLoading,
    error,
    register: registerShortcut,
    unregister: unregisterShortcut,
    checkConflict,
  };
}
