"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError, AuthPrimaryButton, AuthShell } from "./saberx/auth-shell";
import { PasswordField, passwordIsValid } from "./saberx/password-field";

export function InvitationForm({
  token,
  username,
  email,
  invalid
}: {
  token: string;
  username?: string;
  email?: string;
  invalid?: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!passwordIsValid(password)) {
      setError("Password does not meet the requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword })
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const fieldErrors = payload.detail?.fieldErrors
        ? Object.values(payload.detail.fieldErrors).flat().filter(Boolean).join(" ")
        : "";
      setError(fieldErrors || payload.error || "Activation failed");
      return;
    }
    router.push("/");
  }

  const canSubmit = passwordIsValid(password) && password === confirmPassword;

  if (invalid) {
    return (
      <AuthShell
        title="Invitation unavailable"
        subtitle="This activation link has expired, been revoked, or already been used."
      >
        <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55 }}>
          Ask your administrator to send a new invitation.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Activate your account"
      subtitle="Choose a password to complete your invitation."
    >
      {(username || email) && (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "10px 12px",
            marginBottom: 16,
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            fontSize: 12
          }}
        >
          {username && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--ink-4)",
                  textTransform: "uppercase"
                }}
              >
                Username
              </span>
              <span
                className="mono"
                style={{ color: "var(--ink)", fontWeight: 600, userSelect: "all" }}
              >
                {username}
              </span>
            </div>
          )}
          {email && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--ink-4)",
                  textTransform: "uppercase"
                }}
              >
                Email
              </span>
              <span style={{ color: "var(--ink-2)" }}>{email}</span>
            </div>
          )}
          {username && (
            <div style={{ color: "var(--ink-3)", fontSize: 11.5, marginTop: 2 }}>
              You'll sign in with this username — your administrator chose it for you.
            </div>
          )}
        </div>
      )}
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          showRequirements
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          matchAgainst={password}
        />
        {error && <AuthError message={error} />}
        <AuthPrimaryButton
          type="submit"
          pending={pending}
          pendingLabel="Activating…"
          disabled={!canSubmit}
        >
          Activate account
        </AuthPrimaryButton>
      </form>
    </AuthShell>
  );
}
