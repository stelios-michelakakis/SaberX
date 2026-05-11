"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AuthError,
  AuthField,
  AuthInput,
  AuthPrimaryButton,
  AuthShell
} from "./saberx/auth-shell";
import { PasswordField } from "./saberx/password-field";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    setPending(false);
    if (!response.ok) {
      setError((await response.json()).error ?? "Login failed");
      return;
    }
    const payload = await response.json();
    router.push(payload.user.mustChangePassword ? "/force-password" : "/dashboard");
  }

  return (
    <AuthShell title="Sign in" subtitle="Closed engineering repository access.">
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <AuthField label="Username">
          <AuthInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </AuthField>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error && <AuthError message={error} />}
        <AuthPrimaryButton
          type="submit"
          pending={pending}
          pendingLabel="Signing in…"
        >
          Sign in
        </AuthPrimaryButton>
        <p
          style={{
            margin: 0,
            color: "var(--ink-4)",
            fontSize: 11.5,
            textAlign: "center"
          }}
        >
          Access by invitation only. Contact your administrator.
        </p>
      </form>
    </AuthShell>
  );
}
