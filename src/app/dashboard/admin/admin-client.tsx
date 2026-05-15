"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { PageHeader } from "@/components/saberx/page-header";
import { useToast } from "@/components/saberx/toast";

type AdminUser = {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  accountStatus: string;
  lastLoginAt: string | null;
  roles: string[];
};

type Invitation = {
  id: string;
  invitedEmail: string;
  preassignedUsername: string;
  status: string;
  expiresAt: string;
  invitedBy: string;
};

const STATUS_PILL: Record<string, string> = {
  active: "pill pill-green",
  pending_activation: "pill pill-amber",
  disabled: "pill",
  archived: "pill"
};

const INVITE_PILL: Record<string, string> = {
  pending: "pill pill-amber",
  accepted: "pill pill-green",
  revoked: "pill",
  expired: "pill pill-red"
};

export function AdminClient({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("Editor");
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [pendingRemoveUserId, setPendingRemoveUserId] = useState<string | null>(null);

  const removeUser = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const detail = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? "Remove failed");
      }
      return r.json() as Promise<{ removed: boolean; username: string }>;
    },
    onSuccess: (data) => {
      toast.success("User removed", { detail: `${data.username} has been permanently removed` });
      setPendingRemoveUserId(null);
      queryClient.invalidateQueries({ queryKey: ["sx-admin-users"] });
    },
    onError: (err) => {
      toast.error("Remove failed", { detail: (err as Error).message });
      setPendingRemoveUserId(null);
    }
  });

  const usersQuery = useQuery({
    queryKey: ["sx-admin-users"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users");
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to load users");
      return r.json() as Promise<{ users: AdminUser[] }>;
    }
  });

  const invitationsQuery = useQuery({
    queryKey: ["sx-admin-invitations"],
    queryFn: async () => {
      const r = await fetch("/api/admin/invitations");
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to load invitations");
      return r.json() as Promise<{ invitations: Invitation[] }>;
    }
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, roles: [role] })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to create invitation");
      return r.json() as Promise<{ activationUrl: string }>;
    },
    onSuccess: (data) => {
      setActivationUrl(data.activationUrl);
      setEmail("");
      setUsername("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["sx-admin-invitations"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not create invitation")
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/invitations/${id}/revoke`, { method: "POST" });
      if (!r.ok) throw new Error("Revoke failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Invitation revoked");
      queryClient.invalidateQueries({ queryKey: ["sx-admin-invitations"] });
    },
    onError: (err) => toast.error("Revoke failed", { detail: (err as Error).message })
  });

  const userCount = usersQuery.data?.users.length ?? 0;
  const activeCount = usersQuery.data?.users.filter((u) => u.accountStatus === "active").length ?? 0;
  const pendingCount =
    invitationsQuery.data?.invitations.filter((i) => i.status === "pending").length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Workspace administration"
        subtitle="Provision users, manage roles, and audit access for the workspace."
        meta={
          <>
            <span><strong style={{ color: "var(--ink)" }}>{userCount}</strong> users</span>
            <span><strong style={{ color: "var(--ink)" }}>{activeCount}</strong> active</span>
            <span><strong style={{ color: "var(--ink)" }}>{pendingCount}</strong> pending invitations</span>
          </>
        }
      />

      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Card title="Invite a new user" icon="plus">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 200px auto",
              gap: 12,
              alignItems: "end"
            }}
          >
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@edfsaber.gov"
              />
            </Field>
            <Field label="Username">
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="j.doe"
              />
            </Field>
            <Field label="Role">
              <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option>Editor</option>
                <option>Reviewer</option>
                <option>Admin</option>
              </select>
            </Field>
            <button
              className="sx-btn sx-btn-primary"
              type="button"
              onClick={() => createInvite.mutate()}
              disabled={createInvite.isPending || !email || !username}
              style={{ height: 36 }}
            >
              <Icon name="bolt" size={12} />
              {createInvite.isPending ? "Creating…" : "Send invitation"}
            </button>
          </div>
          {error && (
            <div className="error" style={{ marginTop: 10, fontSize: 12 }}>
              {error}
            </div>
          )}
          {activationUrl && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 6,
                background: "var(--accent-soft)",
                color: "var(--accent-ink)",
                fontSize: 12.5
              }}
            >
              Activation link (share securely):{" "}
              <code style={{ background: "transparent", border: 0 }}>{activationUrl}</code>
            </div>
          )}
        </Card>

        <Card title="Users" icon="users">
          {usersQuery.isLoading && <Loading />}
          {usersQuery.error && <ErrorRow message={(usersQuery.error as Error).message} />}
          {usersQuery.data && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--panel-2)" }}>
                  <Th>Name</Th>
                  <Th>Username</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Roles</Th>
                  <Th>Last seen</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isPending = pendingRemoveUserId === u.id;
                  const isRemoving = removeUser.isPending && removeUser.variables === u.id;
                  return (
                    <tr key={u.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <Td>
                        <strong style={{ color: "var(--ink)" }}>
                          {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                        </strong>
                      </Td>
                      <Td>
                        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                          {u.username}
                        </span>
                      </Td>
                      <Td muted>{u.email}</Td>
                      <Td>
                        <span className={STATUS_PILL[u.accountStatus] ?? "pill"}>
                          {u.accountStatus.replace(/_/g, " ")}
                        </span>
                      </Td>
                      <Td>
                        {u.roles.map((r) => (
                          <span key={r} className="pill pill-accent" style={{ marginRight: 4 }}>
                            {r}
                          </span>
                        ))}
                      </Td>
                      <Td muted>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}
                      </Td>
                      <Td>
                        {isSelf ? (
                          <span style={{ color: "var(--ink-4)", fontSize: 11.5 }}>You</span>
                        ) : isPending ? (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              className="sx-btn sx-btn-sm"
                              type="button"
                              disabled={isRemoving}
                              onClick={() => removeUser.mutate(u.id)}
                              style={{ color: "var(--red)", borderColor: "var(--red)" }}
                              title="Permanently remove this user from the database"
                            >
                              <Icon name="trash" size={12} />
                              {isRemoving ? "Removing…" : "Confirm remove"}
                            </button>
                            <button
                              className="sx-btn sx-btn-sm"
                              type="button"
                              disabled={isRemoving}
                              onClick={() => setPendingRemoveUserId(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="sx-btn sx-btn-sm"
                            type="button"
                            onClick={() => setPendingRemoveUserId(u.id)}
                            title="Permanently remove this user"
                          >
                            <Icon name="trash" size={12} />
                            Remove
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Pending invitations" icon="bell">
          {invitationsQuery.isLoading && <Loading />}
          {invitationsQuery.data && invitationsQuery.data.invitations.length === 0 && (
            <div style={{ padding: 16, color: "var(--ink-3)", fontSize: 12.5 }}>
              No invitations.
            </div>
          )}
          {invitationsQuery.data && invitationsQuery.data.invitations.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--panel-2)" }}>
                  <Th>Email</Th>
                  <Th>Username</Th>
                  <Th>Status</Th>
                  <Th>Expires</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {invitationsQuery.data.invitations.map((inv) => (
                  <tr key={inv.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <Td>{inv.invitedEmail}</Td>
                    <Td>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                        {inv.preassignedUsername}
                      </span>
                    </Td>
                    <Td>
                      <span className={INVITE_PILL[inv.status] ?? "pill"}>{inv.status}</span>
                    </Td>
                    <Td muted>{new Date(inv.expiresAt).toLocaleString()}</Td>
                    <Td>
                      {inv.status === "pending" &&
                        (pendingRevokeId === inv.id ? (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              className="sx-btn sx-btn-sm"
                              type="button"
                              onClick={() => {
                                revokeInvite.mutate(inv.id);
                                setPendingRevokeId(null);
                              }}
                              style={{ color: "var(--red)", borderColor: "var(--red)" }}
                            >
                              <Icon name="check" size={12} /> Confirm
                            </button>
                            <button
                              className="sx-btn sx-btn-sm"
                              type="button"
                              onClick={() => setPendingRevokeId(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="sx-btn sx-btn-sm"
                            type="button"
                            onClick={() => setPendingRevokeId(inv.id)}
                          >
                            <Icon name="x" size={12} /> Revoke
                          </button>
                        ))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function Card({
  title,
  icon,
  children
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--sx-radius-lg)",
        background: "var(--panel)",
        boxShadow: "var(--sx-shadow-sm)",
        overflow: "hidden"
      }}
    >
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel-2)",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}
      >
        <Icon name={icon} size={12} style={{ color: "var(--ink-3)" }} />
        <strong style={{ fontSize: 13 }}>{title}</strong>
      </header>
      <div style={{ padding: 16 }}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
      <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      {children}
    </label>
  );
}

function Loading() {
  return <div style={{ padding: 16, color: "var(--ink-3)", fontSize: 12.5 }}>Loading…</div>;
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="error" style={{ fontSize: 12 }}>
      {message}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
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
        padding: "10px 14px",
        fontSize: 12.5,
        color: muted ? "var(--ink-3)" : "var(--ink-2)",
        verticalAlign: "middle"
      }}
    >
      {children}
    </td>
  );
}
