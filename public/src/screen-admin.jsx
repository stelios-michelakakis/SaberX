function ScreenAdmin() {
  const [tab, setTab] = useState("users");
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <PageHeader eyebrow="Administration" title="Users & invitations"
        subtitle="No public registration. Onboarding via single-use invitations bound to email; tokens stored as hashes; valid 48 h."
        actions={<button className="btn btn-primary btn-sm"><Icon name="plus" className="ic-sm" />Invite user</button>}
      />
      <div style={{ padding: "16px 28px 0", display: "flex", borderBottom: "1px solid var(--line)" }}>
        {[["users", `Users · ${USERS.length}`], ["invites", `Invitations · ${INVITATIONS.length}`], ["roles", "Roles & scopes"]].map(([k,lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "8px 14px", background: "transparent", border: "none",
            borderBottom: "2px solid " + (k === tab ? "var(--ink)" : "transparent"),
            marginBottom: -1, color: k === tab ? "var(--ink)" : "var(--ink-3)",
            fontSize: 12.5, fontWeight: k === tab ? 600 : 500,
            cursor: "default", fontFamily: "inherit",
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ padding: "20px 28px" }}>
        {tab === "users" && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 160px 110px 110px 30px", gap: 14, padding: "8px 16px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)" }}>
              <div>User</div><div>Username</div><div>Role</div><div>Status</div><div>Last seen</div><div></div>
            </div>
            {USERS.map((u, i) => (
              <div key={u.username} style={{ display: "grid", gridTemplateColumns: "1fr 130px 160px 110px 110px 30px", gap: 14, padding: "12px 16px", alignItems: "center", borderBottom: i < USERS.length - 1 ? "1px solid var(--line)" : "none", fontSize: 12.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={u.name} size={26} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{u.username}@saberx.gov</div>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{u.username}</span>
                <span className="pill" style={{ fontSize: 11 }}>{u.role}</span>
                <span className={"pill " + (u.status === "Active" ? "pill-green" : "")} style={{ fontSize: 11, opacity: u.status === "Active" ? 1 : 0.7 }}>
                  <span className="dot" />{u.status}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{u.last}</span>
                <Icon name="more" className="ic-sm" style={{ color: "var(--ink-4)" }} />
              </div>
            ))}
          </div>
        )}

        {tab === "invites" && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 160px 130px 100px", gap: 14, padding: "8px 16px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)" }}>
              <div>Email</div><div>Role</div><div>Invited by</div><div>Expires</div><div>Status</div>
            </div>
            {INVITATIONS.map((iv, i) => (
              <div key={iv.email} style={{ display: "grid", gridTemplateColumns: "1fr 110px 160px 130px 100px", gap: 14, padding: "12px 16px", alignItems: "center", borderBottom: i < INVITATIONS.length - 1 ? "1px solid var(--line)" : "none", fontSize: 12.5 }}>
                <span className="mono" style={{ fontSize: 12 }}>{iv.email}</span>
                <span className="pill" style={{ fontSize: 11 }}>{iv.role}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Avatar name={iv.invitedBy} size={18} />{iv.invitedBy}</span>
                <span style={{ fontSize: 11.5, color: iv.expires === "expired" ? "var(--red)" : "var(--ink-3)" }}>{iv.expires}</span>
                <span className={"pill " + (iv.status === "Pending" ? "pill-amber" : "")} style={{ fontSize: 10.5 }}>{iv.status}</span>
              </div>
            ))}
            <div style={{ padding: "16px 18px", background: "var(--bg-2)", borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 10, alignItems: "center" }}>
              <Icon name="lock" className="ic-sm" />
              Invitation tokens are stored as hashes. Each invite is single-use and revocable. Passwords are hashed with Argon2id.
            </div>
          </div>
        )}

        {tab === "roles" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {[
              { name: "Administrator", scope: "Application", who: 1, perms: ["Manage users & invitations","Manage roles & scopes","All document & schema operations","Audit & integrity admin"] },
              { name: "Document Manager", scope: "Document", who: 2, perms: ["Create / archive documents","Manage schema","Take baselines & snapshots","Approve open issues"] },
              { name: "Editor", scope: "Document / Sheet", who: 3, perms: ["Edit row values & references","Open issues & questions","Cannot change schema","Cannot baseline"] },
              { name: "Reviewer", scope: "Document", who: 2, perms: ["Read-only access","Comment on rows","Vote on open issues"] },
            ].map(r => (
              <div key={r.name} style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon name="shield" className="ic-sm" style={{ color: "var(--accent)" }} />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{r.name}</h3>
                  <span className="pill" style={{ fontSize: 10.5 }}>{r.scope} scope</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.who} {r.who === 1 ? "user" : "users"}</span>
                </div>
                <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                  {r.perms.map(p => (
                    <li key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
                      <Icon name="check" size={11} style={{ color: "var(--green)" }} />{p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
Object.assign(window, { ScreenAdmin });
