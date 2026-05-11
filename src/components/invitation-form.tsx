"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError, AuthPrimaryButton, AuthShell } from "./saberx/auth-shell";
import { PasswordField, passwordIsValid } from "./saberx/password-field";

export function InvitationForm({ token }: { token: string }) {
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

  return (
    <AuthShell
      title="Activate your account"
      subtitle="Choose a password to complete your invitation."
    >
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
