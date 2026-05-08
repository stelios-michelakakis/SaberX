"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

export type ThemeMode = "light" | "dark";
export type Density = "compact" | "balanced" | "comfortable";
export type Accent = "indigo" | "teal" | "emerald" | "amber" | "violet";

export type Tweaks = {
  theme: ThemeMode;
  density: Density;
  accent: Accent;
  sidebarCollapsed: boolean;
  showTraceColumns: boolean;
};

const DEFAULTS: Tweaks = {
  theme: "dark",
  density: "balanced",
  accent: "indigo",
  sidebarCollapsed: false,
  showTraceColumns: true
};

const STORAGE_KEY = "sx-tweaks-v1";

const ACCENT_HUE: Record<Accent, number> = {
  indigo: 255,
  teal: 195,
  emerald: 155,
  amber: 75,
  violet: 295
};

type Ctx = {
  tweaks: Tweaks;
  set: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  toggle: (key: "theme" | "sidebarCollapsed" | "showTraceColumns") => void;
};

const TweaksContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTweaks({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      /* ignore */
    }
  }, [tweaks, hydrated]);

  const set = useCallback(<K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
    setTweaks((t) => ({ ...t, [key]: value }));
  }, []);

  const toggle = useCallback(
    (key: "theme" | "sidebarCollapsed" | "showTraceColumns") => {
      setTweaks((t) => {
        if (key === "theme") return { ...t, theme: t.theme === "dark" ? "light" : "dark" };
        return { ...t, [key]: !t[key] } as Tweaks;
      });
    },
    []
  );

  const value = useMemo(() => ({ tweaks, set, toggle }), [tweaks, set, toggle]);

  return <TweaksContext.Provider value={value}>{children}</TweaksContext.Provider>;
}

export function useTweaks() {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error("useTweaks must be used within ThemeProvider");
  return ctx;
}

export function accentVars(accent: Accent, dark: boolean) {
  const hue = ACCENT_HUE[accent];
  return {
    "--sx-accent": `oklch(${dark ? 0.7 : 0.55} 0.16 ${hue})`,
    "--accent-soft": `oklch(${dark ? 0.28 : 0.96} ${dark ? 0.07 : 0.02} ${hue})`,
    "--accent-ink": `oklch(${dark ? 0.78 : 0.42} ${dark ? 0.13 : 0.18} ${hue})`
  } as React.CSSProperties;
}
