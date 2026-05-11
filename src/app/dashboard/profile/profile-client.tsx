"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
      <SectionTitle icon="key" title="API tokens for agents (MCP)" />
      <p style={{ margin: "0 0 14px", color: "var(--ink-3)", fontSize: 12.5, lineHeight: 1.55 }}>
        Tokens authenticate agents calling the MCP endpoint at <span className="mono">/api/mcp</span>
        . They inherit your role and account permissions, and every action is recorded in the audit
        log. Treat each token like a password.
      </p>

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
