"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { AuthInput } from "./auth-shell";

const TRIVIAL = ["admin", "password", "password123", "admin123", "adminadmin"];

export type PasswordRule = {
  id: string;
  label: string;
  test: (v: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 12 characters", test: (v) => v.length >= 12 },
  { id: "max", label: "No more than 128 characters", test: (v) => v.length <= 128 },
  {
    id: "trivial",
    label: "Not a common or trivial password",
    test: (v) => v.length > 0 && !TRIVIAL.includes(v.toLowerCase())
  }
];

export function passwordIsValid(v: string) {
  return PASSWORD_RULES.every((r) => r.test(v));
}

export function PasswordField({
  label,
  value,
  onChange,
  showRequirements,
  autoComplete = "new-password",
  matchAgainst
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showRequirements?: boolean;
  autoComplete?: string;
  /** Pass the "new password" value to display a "passwords match" rule on the confirm field */
  matchAgainst?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  const showChecklist = !!showRequirements && (focused || value.length > 0);

  return (
    <div style={{ display: "grid", gap: 6 }}>
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
      <div style={{ position: "relative" }}>
        <AuthInput
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ width: "100%", paddingRight: 38 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
          style={{
            position: "absolute",
            right: 4,
            top: 4,
            bottom: 4,
            width: 30,
            border: 0,
            background: "transparent",
            color: "var(--ink-3)",
            cursor: "pointer",
            borderRadius: 4,
            display: "grid",
            placeItems: "center"
          }}
        >
          <Icon name={visible ? "eye" : "lock"} size={14} />
        </button>
      </div>

      {showChecklist && (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 4,
            paddingTop: 4
          }}
        >
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(value);
            return <Rule key={rule.id} label={rule.label} ok={ok} />;
          })}
          {matchAgainst !== undefined && (
            <Rule
              label="Matches new password"
              ok={value.length > 0 && value === matchAgainst}
            />
          )}
        </ul>
      )}
    </div>
  );
}

function Rule({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11.5,
        color: ok ? "var(--green)" : "var(--ink-3)"
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: ok ? "var(--green-soft)" : "var(--bg-2)",
          color: ok ? "var(--green)" : "var(--ink-4)",
          flex: "none"
        }}
      >
        <Icon name={ok ? "check" : "minus"} size={10} />
      </span>
      {label}
    </li>
  );
}
