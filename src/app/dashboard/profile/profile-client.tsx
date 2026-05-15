"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/saberx/avatar";
import { Icon } from "@/components/saberx/icon";
import { useToast } from "@/components/saberx/toast";

type ProfileUser = {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  accountStatus: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export function ProfileClient({
  user,
  roles
}: {
  user: ProfileUser;
  roles: string[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [organization, setOrganization] = useState(user.organization ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || user.username;

  const onSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, organization })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Could not save profile", { detail: detail.error });
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async () => {
    setPwError(null);
    if (newPw !== confirmPw) {
      setPwError("New passwords do not match.");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const fieldErrors = detail.detail?.fieldErrors
          ? Object.values(detail.detail.fieldErrors).flat().filter(Boolean).join(" ")
          : "";
        setPwError(fieldErrors || detail.error || "Password change failed");
        return;
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast.success("Password changed", { detail: "Other sessions were signed out." });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <Avatar name={fullName} size={48} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong style={{ fontSize: 15 }}>{fullName}</strong>
            <span style={{ color: "var(--ink-3)", fontSize: 12.5 }} className="mono">
              {user.username} · {user.email}
            </span>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <span
                className={
                  user.accountStatus === "active" ? "pill pill-green" : "pill"
                }
              >
                {user.accountStatus.replace(/_/g, " ")}
              </span>
              {roles.map((r) => (
                <span key={r} className="pill pill-accent">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </header>
        <div
          style={{
            display: "flex",
            gap: 18,
            color: "var(--ink-3)",
            fontSize: 12,
            flexWrap: "wrap"
          }}
        >
          <span>
            Member since <strong>{new Date(user.createdAt).toLocaleDateString()}</strong>
          </span>
          {user.lastLoginAt && (
            <span>
              Last login <strong>{new Date(user.lastLoginAt).toLocaleString()}</strong>
            </span>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle icon="user" title="Profile details" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="First name">
            <input
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Last name">
            <input
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
          <Field label="Organisation" full>
            <input
              className="input"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            type="button"
            className="sx-btn sx-btn-primary sx-btn-sm"
            onClick={onSaveProfile}
            disabled={savingProfile}
          >
            <Icon name="check" size={12} />{" "}
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="key" title="Change password" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Current password">
            <input
              className="input"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </Field>
          <Field label="New password">
            <input
              className="input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              className="input"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </Field>
        </div>
        <p style={{ margin: "10px 0 0", color: "var(--ink-3)", fontSize: 11.5 }}>
          Minimum 12 characters. Changing your password signs out other active sessions.
        </p>
        {pwError && (
          <div className="error" style={{ marginTop: 10, fontSize: 12 }}>
            {pwError}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            type="button"
            className="sx-btn sx-btn-primary sx-btn-sm"
            onClick={onChangePassword}
            disabled={savingPw || !newPw || !confirmPw}
          >
            <Icon name="key" size={12} /> {savingPw ? "Updating…" : "Change password"}
          </button>
        </div>
      </Card>

      <ApiTokensSection />
    </div>
  );
}

type ApiTokenRow = {
  id: string;
  name: string;
  readOnly: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

function ApiTokensSection() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [revealedToken, setRevealedToken] = useState<{ token: string; name: string } | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [setupHelpOpen, setSetupHelpOpen] = useState(false);

  const tokensQuery = useQuery({
    queryKey: ["api-tokens"],
    queryFn: async () => {
      const r = await fetch("/api/me/api-tokens");
      if (!r.ok) throw new Error("Failed to load tokens");
      return r.json() as Promise<{ tokens: ApiTokenRow[] }>;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/me/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, readOnly })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Could not create token");
      return r.json() as Promise<{ token: string; record: ApiTokenRow }>;
    },
    onSuccess: (data) => {
      setRevealedToken({ token: data.token, name: data.record.name });
      setName("");
      setReadOnly(false);
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError: (err) =>
      toast.error("Token creation failed", { detail: (err as Error).message })
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/me/api-tokens/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Revoke failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Token revoked");
      setPendingRevokeId(null);
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError: (err) => toast.error("Revoke failed", { detail: (err as Error).message })
  });

  const active = (tokensQuery.data?.tokens ?? []).filter((t) => !t.revokedAt);

  return (
    <section
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--sx-radius-lg)",
        background: "var(--panel)",
        boxShadow: "var(--sx-shadow-sm)",
        padding: 18
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12
        }}
      >
        <Icon name="key" size={12} style={{ color: "var(--ink-3)" }} />
        <strong style={{ fontSize: 13 }}>API tokens for agents (MCP)</strong>
        <button
          type="button"
          className="sx-btn sx-btn-ghost sx-btn-sm"
          onClick={() => setSetupHelpOpen(true)}
          style={{ padding: 4 }}
          aria-label="How to set up MCP"
          title="How to set up MCP"
        >
          <Icon name="question" size={12} />
        </button>
      </div>
      <p style={{ margin: "0 0 14px", color: "var(--ink-3)", fontSize: 12.5, lineHeight: 1.55 }}>
        Tokens authenticate agents calling the MCP endpoint at <span className="mono">/api/mcp</span>
        . They inherit your role and account permissions, and every action is recorded in the audit
        log. Treat each token like a password.
      </p>
      {setupHelpOpen && <McpSetupModal onClose={() => setSetupHelpOpen(false)} /> }

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 160px auto",
          gap: 10,
          alignItems: "end"
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.04em"
            }}
          >
            Name
          </span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Claude Desktop · laptop"
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            color: "var(--ink-2)",
            height: 36,
            padding: "0 6px"
          }}
        >
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
          Read-only
        </label>
        <button
          type="button"
          className="sx-btn sx-btn-primary"
          style={{ height: 36 }}
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <Icon name="plus" size={12} />{" "}
          {createMutation.isPending ? "Creating…" : "Generate token"}
        </button>
      </div>

      {revealedToken && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 6,
            background: "var(--accent-soft)",
            color: "var(--accent-ink)",
            fontSize: 12.5,
            display: "grid",
            gap: 8
          }}
        >
          <div style={{ fontWeight: 500 }}>
            Copy this token now — you won&apos;t see it again.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code
              style={{
                flex: 1,
                background: "var(--panel-2)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "8px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                wordBreak: "break-all"
              }}
            >
              {revealedToken.token}
            </code>
            <button
              type="button"
              className="sx-btn sx-btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(revealedToken.token);
                toast.success("Copied to clipboard");
              }}
            >
              <Icon name="copy" size={12} /> Copy
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-sm"
              onClick={() => setRevealedToken(null)}
            >
              <Icon name="x" size={12} /> Dismiss
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {tokensQuery.isLoading && (
          <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>Loading…</div>
        )}
        {active.length === 0 && !tokensQuery.isLoading && (
          <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>No active tokens.</div>
        )}
        {active.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--panel-2)" }}>
                <Th>Name</Th>
                <Th>Permissions</Th>
                <Th>Created</Th>
                <Th>Last used</Th>
                <Th>Expires</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {active.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <Td>
                    <strong style={{ color: "var(--ink)" }}>{t.name}</strong>
                  </Td>
                  <Td>
                    {t.readOnly ? (
                      <span className="pill">Read-only</span>
                    ) : (
                      <span className="pill pill-amber">Read + write</span>
                    )}
                  </Td>
                  <Td muted>{new Date(t.createdAt).toLocaleDateString()}</Td>
                  <Td muted>
                    {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "—"}
                  </Td>
                  <Td muted>
                    {t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "never"}
                  </Td>
                  <Td>
                    {pendingRevokeId === t.id ? (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          type="button"
                          className="sx-btn sx-btn-sm"
                          style={{
                            color: "var(--red)",
                            borderColor: "var(--red)",
                            background: "var(--red-soft)"
                          }}
                          onClick={() => revokeMutation.mutate(t.id)}
                        >
                          <Icon name="check" size={12} /> Confirm
                        </button>
                        <button
                          type="button"
                          className="sx-btn sx-btn-sm"
                          onClick={() => setPendingRevokeId(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="sx-btn sx-btn-ghost sx-btn-sm"
                        style={{ color: "var(--red)" }}
                        onClick={() => setPendingRevokeId(t.id)}
                      >
                        <Icon name="trash" size={12} /> Revoke
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 10px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        borderBottom: "1px solid var(--line)"
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      style={{
        padding: "8px 10px",
        fontSize: 12.5,
        color: muted ? "var(--ink-3)" : "var(--ink-2)",
        verticalAlign: "middle"
      }}
    >
      {children}
    </td>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--sx-radius-lg)",
        background: "var(--panel)",
        boxShadow: "var(--sx-shadow-sm)",
        padding: 18
      }}
    >
      {children}
    </section>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon name={icon} size={12} style={{ color: "var(--ink-3)" }} />
      <strong style={{ fontSize: 13 }}>{title}</strong>
    </div>
  );
}

function Field({
  label,
  children,
  full
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 4, gridColumn: full ? "1 / -1" : undefined }}>
      <span
        style={{
          fontSize: 11,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function McpSetupModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  // The modal only mounts after a user click, well past hydration — so
  // window is always defined here and the deployed origin is correct.
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const endpoint = `${origin}/api/mcp`;
  const claudeDesktopJson = `{
  "mcpServers": {
    "edf-saber": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${endpoint}",
        "--header",
        "Authorization: Bearer <YOUR_TOKEN>"
      ]
    }
  }
}`;
  const claudeCliCmd = `claude mcp add edf-saber --transport http ${endpoint} \\
  --header "Authorization: Bearer <YOUR_TOKEN>"`;

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed")
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MCP setup"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,10,14,0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "90dvh",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          boxShadow: "var(--sx-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center"
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "var(--ink-4)",
                textTransform: "uppercase"
              }}
            >
              Setup
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              Connect an agent via MCP
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sx-btn sx-btn-ghost sx-btn-sm"
            aria-label="Close"
            style={{ padding: 6 }}
          >
            <Icon name="x" size={12} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            fontSize: 12.5,
            color: "var(--ink-2)",
            lineHeight: 1.55
          }}
        >
          <Step n={1} title="Generate a token">
            Below this dialog: name your token (e.g. <em>"Claude Desktop · laptop"</em>), tick{" "}
            <strong>Read-only</strong> if the agent should never mutate, then click{" "}
            <strong>Generate token</strong>. The token is shown <strong>once</strong> — copy it
            immediately.
          </Step>

          <Step n={2} title="Endpoint">
            <CodeBlock
              text={endpoint}
              onCopy={() => copy(endpoint, "Endpoint")}
              label="Endpoint URL"
            />
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>
              Authentication is <code>Authorization: Bearer &lt;token&gt;</code>. Tokens inherit
              your role; every call is recorded in the audit log with source <code>mcp</code>.
            </div>
          </Step>

          <Step n={3} title="Claude Desktop">
            Add this to <code>claude_desktop_config.json</code> (macOS:{" "}
            <code>~/Library/Application Support/Claude/</code>, Windows:{" "}
            <code>%APPDATA%\Claude\</code>):
            <CodeBlock
              text={claudeDesktopJson}
              onCopy={() => copy(claudeDesktopJson, "Config")}
              label="claude_desktop_config.json"
              multiline
            />
            Replace <code>&lt;YOUR_TOKEN&gt;</code> with the token from step 1, then restart Claude
            Desktop.
          </Step>

          <Step n={4} title="Claude Code (CLI)">
            <CodeBlock
              text={claudeCliCmd}
              onCopy={() => copy(claudeCliCmd, "Command")}
              label="Terminal command"
              multiline
            />
          </Step>

          <Step n={5} title="Other MCP clients">
            Any client that speaks MCP over Streamable HTTP works — point it at the endpoint above
            and pass the <code>Authorization: Bearer …</code> header.
          </Step>

          <div
            style={{
              padding: 10,
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontSize: 11.5,
              color: "var(--ink-3)"
            }}
          >
            <strong style={{ color: "var(--ink-2)" }}>Permissions:</strong> Admin → full; Editor →
            full unless the token is read-only; Reviewer → read-only regardless. Only Admins can
            call <code>list_audit_events</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 12 }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "var(--bg-3)",
          color: "var(--ink-2)",
          fontSize: 11,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
          {title}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({
  text,
  onCopy,
  label,
  multiline
}: {
  text: string;
  onCopy: () => void;
  label: string;
  multiline?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        marginTop: 6,
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: multiline ? "10px 44px 10px 10px" : "8px 44px 8px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        color: "var(--ink)",
        whiteSpace: multiline ? "pre" : "nowrap",
        overflowX: "auto"
      }}
    >
      {text}
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        className="sx-btn sx-btn-ghost sx-btn-sm"
        style={{ position: "absolute", top: 4, right: 4, padding: 4 }}
      >
        <Icon name="copy" size={12} />
      </button>
    </div>
  );
}
