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
  onPress?: () => void,
  onRelease?: () => void
): UseHotkeyReturn {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start as loading
  const [error, setError] = useState<string | null>(null);
  const onPressRef = useRef(onPress);
  const onReleaseRef = useRef(onRelease);
  const currentShortcutRef = useRef<string | null>(null);
  const isRegisteredRef = useRef(false);
  const setupAttemptedRef = useRef(false);

  // Keep callback refs updated
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  useEffect(() => {
    onReleaseRef.current = onRelease;
  }, [onRelease]);

  // Register hotkey on mount if initial shortcut provided
  useEffect(() => {
    let isMounted = true;

    const setupHotkey = async () => {
      if (!initialShortcut) {
        setIsLoading(false);
        return;
      }

      // Wait a short moment for the app to fully initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!isMounted) return;

      try {
        // Try to unregister first (in case it's still registered from a previous session)
        try {
          await unregisterHotkey(initialShortcut);
        } catch {
          // Ignore - might not be registered
        }

        // Create wrapper callbacks that use the refs
        const wrappedOnPress = () => {
          if (onPressRef.current) {
            onPressRef.current();
          }
        };
        const wrappedOnRelease = () => {
          if (onReleaseRef.current) {
            onReleaseRef.current();
          }
        };

        await registerHotkey(initialShortcut, wrappedOnPress, wrappedOnRelease);

        if (isMounted) {
          currentShortcutRef.current = initialShortcut;
          isRegisteredRef.current = true;
          setIsRegistered(true);
          setError(null);
          setupAttemptedRef.current = true;
        }
      } catch (err) {
        if (isMounted) {
          console.error('Hotkey registration failed:', err);
          const message = err instanceof Error ? err.message : 'Failed to register hotkey';
          setError(message);
          setIsRegistered(false);
          isRegisteredRef.current = false;
          setupAttemptedRef.current = true;
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    setupHotkey();

    return () => {
      isMounted = false;
      // Cleanup on unmount
      const shortcut = currentShortcutRef.current;
      if (shortcut && isRegisteredRef.current) {
        unregisterHotkey(shortcut).catch(() => {
          // Ignore errors on cleanup
        });
        isRegisteredRef.current = false;
        currentShortcutRef.current = null;
      }
    };
  }, [initialShortcut]);

  const registerShortcut = useCallback(
    async (shortcut: string, callback: () => void) => {
      try {
        setIsLoading(true);
        setError(null);

        // Unregister previous shortcut if exists
        const currentShortcut = currentShortcutRef.current;
        if (currentShortcut && currentShortcut !== shortcut && isRegisteredRef.current) {
          try {
            await unregisterHotkey(currentShortcut);
          } catch {
            // Ignore
          }
        }

        // Check and unregister if already registered
        const alreadyRegistered = await isHotkeyRegistered(shortcut);
        if (alreadyRegistered) {
          try {
            await unregisterHotkey(shortcut);
          } catch {
            // Ignore
          }
        }

        // Register new shortcut
        await registerHotkey(shortcut, callback);
        currentShortcutRef.current = shortcut;
        isRegisteredRef.current = true;
        setIsRegistered(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to register hotkey';
        setError(message);
        setIsRegistered(false);
        isRegisteredRef.current = false;

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
    []
  );

  const unregisterShortcut = useCallback(async () => {
    const currentShortcut = currentShortcutRef.current;
    if (!currentShortcut) return;

    try {
      setIsLoading(true);
      setError(null);
      await unregisterHotkey(currentShortcut);
      currentShortcutRef.current = null;
      isRegisteredRef.current = false;
      setIsRegistered(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unregister hotkey';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
