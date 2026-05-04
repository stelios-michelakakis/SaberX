"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
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
    router.push(payload.user.mustChangePassword ? "/force-password" : "/workspace");
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <h1 className="login-title">SaberX</h1>
        <p className="login-subtitle">Closed engineering repository access</p>
        <div className="form-stack">
          <label className="field-label">
            Username
            <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label className="field-label">
            Password
            <input className="input" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="button primary" disabled={pending}>
            {pending ? "Signing in..." : "Login"}
          </button>
        </div>
      </form>
    </main>
  );
}
