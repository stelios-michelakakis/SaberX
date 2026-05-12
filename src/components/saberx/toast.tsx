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
    <div
      style={{
        position: "fixed",
        bottom: 18,
        right: 18,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
        maxWidth: "calc(100vw - 36px)"
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone = toast.tone;
  const accentMap: Record<ToastTone, { color: string; icon: string }> = {
    success: { color: "var(--green)", icon: "check" },
    error: { color: "var(--red)", icon: "alert" },
    info: { color: "var(--sx-accent)", icon: "info" }
  };
  const a = accentMap[tone];

  const onAction = async () => {
    if (!toast.action) return;
    try {
      await toast.action.onClick();
    } finally {
      onDismiss();
    }
  };

  return (
    <div
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        minWidth: 280,
        maxWidth: 420,
        padding: "10px 12px",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderLeft: `3px solid ${a.color}`,
        borderRadius: "var(--sx-radius)",
        boxShadow: "var(--sx-shadow-lg)",
        fontSize: 12.5,
        color: "var(--ink)"
      }}
    >
      <Icon
        name={toast.loading ? "spinner" : a.icon}
        size={14}
        className={toast.loading ? "spin" : undefined}
        style={{ color: a.color, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: "var(--ink)" }}>{toast.message}</div>
        {toast.detail && (
          <div style={{ marginTop: 2, color: "var(--ink-3)", fontSize: 12 }}>{toast.detail}</div>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          className="sx-btn sx-btn-sm"
          onClick={onAction}
          style={{ alignSelf: "center" }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: 0,
          color: "var(--ink-4)",
          cursor: "pointer",
          padding: 4,
          marginLeft: 2,
          alignSelf: "flex-start"
        }}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
