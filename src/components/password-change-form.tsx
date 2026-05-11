"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError, AuthPrimaryButton, AuthShell } from "./saberx/auth-shell";
import { PasswordField, passwordIsValid } from "./saberx/password-field";

export function PasswordChangeForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!passwordIsValid(newPassword)) {
      setError("Password does not meet the requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: forced ? undefined : currentPassword,
        newPassword,
        confirmPassword
      })
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json();
      const fieldErrors = payload.detail?.fieldErrors
        ? Object.values(payload.detail.fieldErrors).flat().filter(Boolean).join(" ")
        : "";
      setError(fieldErrors || payload.error || "Password change failed");
      return;
    }
    router.push("/dashboard");
  }

  const canSubmit =
    (forced || currentPassword.length > 0) &&
    passwordIsValid(newPassword) &&
    newPassword === confirmPassword;

  return (
    <AuthShell
      title={forced ? "Set a new password" : "Change password"}
      subtitle={
        forced
          ? "Bootstrap access is blocked until you change this password."
          : "Choose a new password for your account."
      }
    >
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        {!forced && (
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
        )}
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          showRequirements
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          matchAgainst={newPassword}
        />
        {error && <AuthError message={error} />}
        <AuthPrimaryButton
          type="submit"
          pending={pending}
          pendingLabel="Saving…"
          disabled={!canSubmit}
        >
          {forced ? "Set password and continue" : "Save password"}
        </AuthPrimaryButton>
      </form>
    </AuthShell>
  );
}
