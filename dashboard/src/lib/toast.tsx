import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Tone = "ok" | "error";

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  ok: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const VISIBLE_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Tone) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), VISIBLE_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      ok: (message) => push(message, "ok"),
      error: (message) => push(message, "error"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur ${
              toast.tone === "ok"
                ? "border-up/40 bg-surface text-ink"
                : "border-down/50 bg-surface text-ink"
            }`}
          >
            <span className={toast.tone === "ok" ? "text-up" : "text-down"}>
              {toast.tone === "ok" ? "✓" : "✕"}
            </span>{" "}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) {
    throw new Error("useToast necesita estar dentro de ToastProvider");
  }
  return api;
}
