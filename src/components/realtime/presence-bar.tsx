"use client";

import { useRealtimeStore } from "./store";

function initials(user: { username: string; firstName: string | null; lastName: string | null }) {
  const fn = user.firstName?.trim();
  const ln = user.lastName?.trim();
  if (fn || ln) {
    return `${(fn?.[0] ?? "").toUpperCase()}${(ln?.[0] ?? "").toUpperCase()}` || user.username.slice(0, 2).toUpperCase();
  }
  return user.username.slice(0, 2).toUpperCase();
}

export function PresenceBar() {
  const users = useRealtimeStore((s) => s.presence);
  const selfId = useRealtimeStore((s) => s.selfUserId);
  const connected = useRealtimeStore((s) => s.connected);

  const visible = users.slice(0, 8);
  const overflow = Math.max(0, users.length - visible.length);

  return (
    <div
      data-tour="presence-bar"
      style={{ display: "inline-flex", alignItems: "center", gap: 0 }}
      title={connected ? `${users.length} online` : "Reconnecting…"}
    >
      {visible.map((u, i) => {
        const isSelf = u.userId === selfId;
        return (
          <div
            key={u.userId}
            title={`${u.username}${isSelf ? " (you)" : ""}`}
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: u.color,
              color: "white",
              fontSize: 10.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--panel)",
              marginLeft: i === 0 ? 0 : -8,
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              position: "relative",
              zIndex: visible.length - i
            }}
          >
            {initials(u)}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--panel-2)",
            color: "var(--ink-2)",
            fontSize: 10.5,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--panel)",
            marginLeft: -8
          }}
        >
          +{overflow}
        </div>
      )}
      <span
        title={connected ? "Live" : "Offline"}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: connected ? "var(--sx-accent)" : "var(--ink-4)",
          marginLeft: 10
        }}
      />
    </div>
  );
}
