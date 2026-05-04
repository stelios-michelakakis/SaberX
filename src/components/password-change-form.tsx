"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PasswordChangeForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: forced ? undefined : currentPassword, newPassword, confirmPassword })
    });
    if (!response.ok) {
      const payload = await response.json();
      const fieldErrors = payload.detail?.fieldErrors
        ? Object.values(payload.detail.fieldErrors).flat().filter(Boolean).join(" ")
        : "";
      setError(fieldErrors || payload.error || "Password change failed");
      return;
    }
    router.push("/workspace");
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <h1 className="login-title">Set Password</h1>
        <p className="login-subtitle">
          {forced ? "Bootstrap access is blocked until this password is changed." : "Change your account password."} Use at least 12 characters.
        </p>
        <div className="form-stack">
          {!forced ? (
            <label className="field-label">
              Current password
              <input className="input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
          ) : null}
          <label className="field-label">
            New password
            <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <label className="field-label">
            Confirm password
            <input className="input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="button primary">Save Password</button>
        </div>
      </form>
    </main>
  );
}
