"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

export function AdminUsersClient() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users");
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not load users");
      return response.json() as Promise<{ users: { id: string; username: string; email: string; accountStatus: string; roles: string[] }[] }>;
    }
  });

  const invitations = useQuery({
    queryKey: ["admin-invitations"],
    queryFn: async () => {
      const response = await fetch("/api/admin/invitations");
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not load invitations");
      return response.json() as Promise<{ invitations: { id: string; invitedEmail: string; preassignedUsername: string; status: string; expiresAt: string }[] }>;
    }
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, username, roles: ["Editor"] })
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not create invitation");
      return response.json() as Promise<{ activationUrl: string }>;
    },
    onSuccess: (data) => {
      setActivationUrl(data.activationUrl);
      setEmail("");
      setUsername("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not create invitation")
  });

  return (
    <main className="admin-page">
      <div className="toolbar-group" style={{ marginBottom: 16 }}>
        <Link className="button" href="/workspace">
          Workspace
        </Link>
      </div>
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>User Management</h1>
        {error ? <p className="error">{error}</p> : null}
        <div className="form-stack" style={{ gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
          <label className="field-label">
            Email
            <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field-label">
            Admin-assigned username
            <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <button className="button primary" onClick={() => createInvite.mutate()}>
            Create Invitation
          </button>
        </div>
        {activationUrl ? (
          <p>
            Activation link: <code>{activationUrl}</code>
          </p>
        ) : null}
      </section>
      <section className="panel">
        <h2>Users</h2>
        <table className="simple-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Status</th>
              <th>Roles</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.accountStatus}</td>
                <td>{user.roles.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Invitations</h2>
        <table className="simple-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Username</th>
              <th>Status</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {invitations.data?.invitations.map((invitation) => (
              <tr key={invitation.id}>
                <td>{invitation.invitedEmail}</td>
                <td>{invitation.preassignedUsername}</td>
                <td>{invitation.status}</td>
                <td>{new Date(invitation.expiresAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
