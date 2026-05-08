"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { useTweaks, type Accent, type Density, type ThemeMode } from "./theme-provider";

const ACCENT_OPTIONS: { id: Accent; color: string }[] = [
  { id: "indigo", color: "#5B6FE0" },
  { id: "teal", color: "#1FA8B0" },
  { id: "emerald", color: "#2C9D6E" },
  { id: "amber", color: "#C28A2E" },
  { id: "violet", color: "#7E5BD0" }
];

export function TweaksPanelTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="sx-btn sx-btn-ghost sx-btn-sm"
        onClick={() => setOpen((v) => !v)}
        style={{ padding: 5, position: "relative" }}
        type="button"
        aria-label="Tweaks"
      >
        <Icon name="settings" />
      </button>
      {open && <TweaksPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function TweaksPanel({ onClose }: { onClose: () => void }) {
  const { tweaks, set } = useTweaks();
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "transparent",
          zIndex: 60
        }}
      />
      <div
        style={{
          position: "fixed",
          right: 16,
          top: 56,
          width: 280,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          boxShadow: "var(--sx-shadow-lg)",
          padding: 14,
          zIndex: 61,
          fontSize: 12.5
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8
          }}
        >
          <div style={{ fontWeight: 600 }}>Tweaks</div>
          <button
            className="sx-btn sx-btn-ghost sx-btn-sm"
            onClick={onClose}
            style={{ padding: 4 }}
            type="button"
          >
            <Icon name="x" size={12} />
          </button>
        </div>

        <SectionLabel>Theme</SectionLabel>
        <RadioRow<ThemeMode>
          label="Mode"
          value={tweaks.theme}
          options={["light", "dark"]}
          onChange={(v) => set("theme", v)}
        />

        <Row label="Accent">
          <div style={{ display: "flex", gap: 6 }}>
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => set("accent", opt.id)}
                title={opt.id}
                type="button"
                aria-label={`Accent ${opt.id}`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: opt.color,
                  border:
                    tweaks.accent === opt.id
                      ? "2px solid var(--ink)"
                      : "1px solid var(--line)",
                  cursor: "pointer"
                }}
              />
            ))}
          </div>
        </Row>

        <SectionLabel pad>Layout</SectionLabel>
        <RadioRow<Density>
          label="Density"
          value={tweaks.density}
          options={["compact", "balanced", "comfortable"]}
          onChange={(v) => set("density", v)}
        />
        <ToggleRow
          label="Collapse sidebar"
          value={tweaks.sidebarCollapsed}
          onChange={(v) => set("sidebarCollapsed", v)}
        />
        <ToggleRow
          label="Show trace column"
          value={tweaks.showTraceColumns}
          onChange={(v) => set("showTraceColumns", v)}
        />
      </div>
    </>
  );
}

function SectionLabel({ children, pad }: { children: React.ReactNode; pad?: boolean }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--ink-4)",
        textTransform: "uppercase",
        margin: pad ? "12px 0 6px" : "0 0 6px"
      }}
    >
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0"
      }}
    >
      <div style={{ color: "var(--ink-2)" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function RadioRow<V extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: V;
  options: V[];
  onChange: (v: V) => void;
}) {
  return (
    <Row label={label}>
      <div
        style={{
          display: "inline-flex",
          background: "var(--bg-2)",
          padding: 2,
          borderRadius: 6,
          border: "1px solid var(--line)"
        }}
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              border: 0,
              borderRadius: 4,
              cursor: "pointer",
              background: value === o ? "var(--panel)" : "transparent",
              color: value === o ? "var(--ink)" : "var(--ink-3)",
              fontWeight: value === o ? 500 : 400,
              fontFamily: "inherit"
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </Row>
  );
}

function ToggleRow({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label}>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{
          width: 30,
          height: 16,
          background: value ? "var(--sx-accent)" : "var(--line-strong)",
          borderRadius: 999,
          border: 0,
          position: "relative",
          cursor: "pointer",
          padding: 0
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 16 : 2,
            width: 12,
            height: 12,
            background: "white",
            borderRadius: "50%",
            transition: "left .15s"
          }}
        />
      </button>
    </Row>
  );
}
