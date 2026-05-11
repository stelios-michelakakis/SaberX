"use client";

import { useEffect, type ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.background;
    document.body.style.background = "#0e0e0d";
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  return (
    <div
      className="sx-shell"
      data-theme="dark"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(1200px 600px at 50% -10%, oklch(0.22 0.06 255 / 0.45), transparent 70%), var(--bg)"
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          boxShadow: "var(--sx-shadow-lg)",
          padding: 28,
          color: "var(--ink)"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 22 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.16em",
              color: "var(--ink-3)",
              textTransform: "uppercase"
            }}
          >
            EDF SABER
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)"
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: "4px 0 0",
                color: "var(--ink-3)",
                fontSize: 13,
                lineHeight: 1.5
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthField({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        height: 38,
        padding: "0 12px",
        background: "var(--bg-2)",
        border: "1px solid var(--line-2)",
        borderRadius: 6,
        color: "var(--ink)",
        fontFamily: "inherit",
        fontSize: 13.5,
        outline: "none",
        transition: "border-color 0.12s, background 0.12s",
        ...(style ?? {})
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--sx-accent)";
        e.currentTarget.style.background = "var(--panel-2)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--line-2)";
        e.currentTarget.style.background = "var(--bg-2)";
        props.onBlur?.(e);
      }}
    />
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "9px 12px",
        background: "var(--red-soft)",
        color: "var(--red)",
        border: "1px solid color-mix(in oklch, var(--red), transparent 60%)",
        borderRadius: 6,
        fontSize: 12.5,
        lineHeight: 1.5
      }}
    >
      {message}
    </div>
  );
}

export function AuthPrimaryButton({
  pending,
  pendingLabel,
  children,
  ...rest
}: {
  pending?: boolean;
  pendingLabel?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={pending || rest.disabled}
      style={{
        height: 40,
        border: 0,
        borderRadius: 7,
        background: "var(--ink)",
        color: "var(--bg)",
        fontWeight: 600,
        fontSize: 13.5,
        cursor: pending || rest.disabled ? "not-allowed" : "pointer",
        opacity: pending || rest.disabled ? 0.6 : 1,
        fontFamily: "inherit",
        transition: "background 0.12s, opacity 0.12s",
        ...(rest.style ?? {})
      }}
    >
      {pending ? pendingLabel ?? "Working…" : children}
    </button>
  );
}
