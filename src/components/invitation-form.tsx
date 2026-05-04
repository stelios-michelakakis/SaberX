"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword })
    });
    if (!response.ok) {
      setError((await response.json()).error ?? "Activation failed");
      return;
    }
    router.push("/");
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <h1 className="login-title">Activate Account</h1>
        <p className="login-subtitle">Set your password to complete invitation-based onboarding.</p>
        <div className="form-stack">
          <label className="field-label">
            Password
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="field-label">
            Confirm password
            <input className="input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="button primary">Activate</button>
        </div>
      </form>
    </main>
  );
}
