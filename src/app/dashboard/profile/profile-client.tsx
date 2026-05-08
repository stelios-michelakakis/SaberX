"use client";

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
    </div>
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
