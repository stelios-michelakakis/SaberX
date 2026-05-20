"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { Icon } from "./icon";

type ToastTone = "info" | "success" | "error";

type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

export type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
  detail?: string;
  action?: ToastAction;
  durationMs?: number;
  /** When true, render a spinning icon (useful for in-progress operations). */
  loading?: boolean;
};

type Ctx = {
  show: (input: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  success: (message: string, opts?: Partial<Omit<Toast, "id" | "tone" | "message">>) => string;
  error: (message: string, opts?: Partial<Omit<Toast, "id" | "tone" | "message">>) => string;
  info: (message: string, opts?: Partial<Omit<Toast, "id" | "tone" | "message">>) => string;
};

const ToastContext = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: Omit<Toast, "id">) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const toast: Toast = { id, durationMs: 5000, ...input };
      setToasts((list) => [...list, toast]);
      if (toast.durationMs && toast.durationMs > 0) {
        const handle = setTimeout(() => dismiss(id), toast.durationMs);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss]
  );

  const success = useCallback<Ctx["success"]>(
    (message, opts) => show({ tone: "success", message, ...opts }),
    [show]
  );
  const error = useCallback<Ctx["error"]>(
    (message, opts) => show({ tone: "error", message, durationMs: 7000, ...opts }),
    [show]
  );
  const info = useCallback<Ctx["info"]>(
    (message, opts) => show({ tone: "info", message, ...opts }),
    [show]
  );

  useEffect(
    () => () => {
      timers.current.forEach((h) => clearTimeout(h));
      timers.current.clear();
    },
    []
  );

  const value = useMemo<Ctx>(
    () => ({ show, dismiss, success, error, info }),
    [show, dismiss, success, error, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  dismiss
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="sx-toast-stack" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

const ICON_BY_TONE: Record<ToastTone, string> = {
  success: "check",
  error: "alert",
  info: "info"
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const onAction = async () => {
    if (!toast.action) return;
    try {
      await toast.action.onClick();
    } finally {
      onDismiss();
    }
  };

  const showProgress =
    !toast.loading && typeof toast.durationMs === "number" && toast.durationMs > 0;

  return (
    <div className="sx-toast" data-tone={toast.tone} role="status">
      <span className="sx-toast-icon" aria-hidden>
        <Icon
          name={toast.loading ? "spinner" : ICON_BY_TONE[toast.tone]}
          size={14}
          className={toast.loading ? "spin" : undefined}
        />
      </span>
      <div className="sx-toast-body">
        <div className="sx-toast-title">{toast.message}</div>
        {toast.detail && <div className="sx-toast-detail">{toast.detail}</div>}
      </div>
      {toast.action && (
        <button
          type="button"
          className="sx-btn sx-btn-sm sx-toast-action"
          onClick={onAction}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="sx-toast-close"
      >
        <Icon name="x" size={12} />
      </button>
      {showProgress && (
        <span
          className="sx-toast-progress"
          style={{
            width: "100%",
            animationDuration: `${toast.durationMs}ms`
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
