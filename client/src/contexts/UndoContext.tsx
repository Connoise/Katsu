import { createContext, useContext, useCallback, useState, useRef, useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface UndoEntry {
  id: number;
  message: string;
  undoFn: () => Promise<void>;
  visible: boolean;
}

interface UndoContextValue {
  addUndo: (message: string, undoFn: () => Promise<void>) => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

let nextId = 0;

export function UndoProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<UndoEntry[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    // Start exit animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
    // Remove after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
    // Clear the auto-dismiss timer if still running
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addUndo = useCallback(
    (message: string, undoFn: () => Promise<void>) => {
      const id = nextId++;
      const entry: UndoEntry = { id, message, undoFn, visible: false };

      setToasts((prev) => {
        // Keep max 3 visible; dismiss oldest if at limit
        const updated = [...prev, entry];
        if (updated.length > 3) {
          const oldest = updated[0];
          dismiss(oldest.id);
          return updated.slice(1);
        }
        return updated;
      });

      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: true } : t)));
      });

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        dismiss(id);
        timersRef.current.delete(id);
      }, 5000);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const handleUndo = useCallback(
    async (entry: UndoEntry) => {
      dismiss(entry.id);
      await entry.undoFn();
    },
    [dismiss]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <UndoContext.Provider value={{ addUndo }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse items-center gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-katsu-surface border border-katsu-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[400px]"
            style={{
              opacity: toast.visible ? 1 : 0,
              transform: toast.visible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 200ms ease, transform 200ms ease',
            }}
          >
            <span className="text-sm text-katsu-text flex-1">{toast.message}</span>
            <button
              onClick={() => handleUndo(toast)}
              className="text-sm font-medium text-katsu-accent hover:text-katsu-accent-hover transition-colors flex-shrink-0"
            >
              Undo
            </button>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-katsu-text-dim hover:text-katsu-text transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoContextValue {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
}
