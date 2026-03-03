import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react';

interface Shortcut {
  key: string;
  handler: () => void;
  description: string;
}

interface KeyboardContextValue {
  registerShortcut: (key: string, handler: () => void, description: string) => () => void;
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

const IGNORED_ELEMENTS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const shortcutsRef = useRef<Map<string, Shortcut>>(new Map());

  const registerShortcut = useCallback(
    (key: string, handler: () => void, description: string): (() => void) => {
      const shortcut: Shortcut = { key, handler, description };
      shortcutsRef.current.set(key, shortcut);

      // Return unregister function
      return () => {
        shortcutsRef.current.delete(key);
      };
    },
    []
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if the active element is an input, textarea, or select
      const activeTag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (IGNORED_ELEMENTS.has(activeTag)) return;

      // Also skip if the element is contentEditable
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;

      const shortcut = shortcutsRef.current.get(e.key);
      if (shortcut) {
        e.preventDefault();
        shortcut.handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <KeyboardContext.Provider value={{ registerShortcut }}>
      {children}
    </KeyboardContext.Provider>
  );
}

export function useKeyboard(): KeyboardContextValue {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within a KeyboardProvider');
  }
  return context;
}
