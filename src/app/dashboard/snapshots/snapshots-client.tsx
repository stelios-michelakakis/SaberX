"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/saberx/icon";
import { PageHeader } from "@/components/saberx/page-header";
import { useToast } from "@/components/saberx/toast";

type DocOption = { id: string; title: string; baselineState: string };

type Snapshot = {
  id: string;
  name: string;
  baselineState: string;
  reason: string | null;
  createdAt: string;
  author: string;
};

type DiffChange = {
  type: "added" | "changed" | "deleted";
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export function SnapshotsClient({
  documents,
  activeDocId,
  activeDoc,
  snapshots
}: {
  documents: DocOption[];
  activeDocId: string;
  activeDoc: DocOption;
  snapshots: Snapshot[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [left, setLeft] = useState<string | null>(snapshots[1]?.id ?? null);
  const [right, setRight] = useState<string | null>(snapshots[0]?.id ?? null);
  const [diff, setDiff] = useState<DiffChange[] | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [creating, setCreating] = useState(false);

  const onCreateSnapshot = async () => {
    const name = window.prompt(
      "Snapshot name",
      `Baseline ${new Date().toISOString().slice(0, 10)}`
    );
    if (!name) return;
    const reason = window.prompt("Reason (optional)") ?? undefined;
    setCreating(true);
    try {
      const res = await fetch(`/api/documents/${activeDocId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, reason })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        toast.error("Failed to create snapshot", { detail: detail.error });
        return;
      }
      toast.success("Snapshot created", { detail: name });
      startTransition(() => router.refresh());
    } finally {
      setCreating(false);
    }
  };

  const onCompare = async () => {
    if (!left || !right) {
      toast.info("Pick two snapshots to compare");
      return;
    }
    setLoadingDiff(true);
    setDiff(null);
    try {
      const res = await fetch(
        `/api/documents/${activeDocId}/diff?left=${left}&right=${right}`
      );
      if (!res.ok) {
        toast.error("Diff failed");
        return;
      }
      const data: { changes: DiffChange[] } = await res.json();
      setDiff(data.changes);
    } finally {
      setLoadingDiff(false);
    }
  };

  const counts = diff
    ? {
        added: diff.filter((c) => c.type === "added").length,
        changed: diff.filter((c) => c.type === "changed").length,
        deleted: diff.filter((c) => c.type === "deleted").length
      }
    : null;

  const onPickDoc = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("doc", id);
    router.push(`/dashboard/snapshots?${params.toString()}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Snapshots"
        title={`${activeDoc.title} — baselines`}
        subtitle="Immutable point-in-time captures. Compare any two to see what changed."
        actions={
          <>
            <select
              className="select"
              value={activeDocId}
              onChange={(e) => onPickDoc(e.target.value)}
              style={{
                height: 28,
                minHeight: 0,
                width: "auto",
                minWidth: 220,
                fontSize: 12.5,
                padding: "4px 28px 4px 10px"
              }}
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <button
              className="sx-btn sx-btn-primary sx-btn-sm"
              onClick={onCreateSnapshot}
              disabled={creating}
              type="button"
            >
              <Icon name="plus" size={12} />
              {creating ? "Creating…" : "New snapshot"}
            </button>
          </>
        }
      />

      <div
        style={{
          padding: "20px 28px",
          display: "grid",
          gridTemplateColumns: "minmax(320px, 380px) minmax(0, 1fr)",
          gap: 18
        }}
      >
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--sx-radius-lg)",
            background: "var(--panel)",
            boxShadow: "var(--sx-shadow-sm)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              fontSize: 11,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: "1px solid var(--line)",
              background: "var(--panel-2)"
            }}
          >
            History
          </div>
          {snapshots.length === 0 && (
            <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 12.5 }}>
              No snapshots yet for this document.
            </div>
          )}
          {snapshots.map((snap, i) => (
            <div
              key={snap.id}
              style={{
                padding: "12px 14px",
                borderTop: i === 0 ? undefined : "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                gap: 6
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{snap.name}</strong>
                <span className="pill mono" style={{ marginLeft: "auto" }}>
                  {snap.baselineState}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                {snap.author} · {new Date(snap.createdAt).toLocaleString()}
              </div>
              {snap.reason && (
                <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{snap.reason}</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <RadioPill
                  label="A"
                  active={left === snap.id}
                  onClick={() => setLeft(snap.id)}
                />
                <RadioPill
                  label="B"
                  active={right === snap.id}
                  onClick={() => setRight(snap.id)}
                />
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--sx-radius-lg)",
            background: "var(--panel)",
            boxShadow: "var(--sx-shadow-sm)",
            display: "flex",
            flexDirection: "column",
            minHeight: 360
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              background: "var(--panel-2)",
              display: "flex",
              alignItems: "center",
              gap: 12
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.04em"
              }}
            >
              Diff
            </div>
            {counts && (
              <div style={{ display: "flex", gap: 6 }}>
                <span className="pill pill-green">+{counts.added}</span>
                <span className="pill pill-amber">Δ{counts.changed}</span>
                <span className="pill pill-red">−{counts.deleted}</span>
              </div>
            )}
            <button
              className="sx-btn sx-btn-sm"
              type="button"
              onClick={onCompare}
              disabled={!left || !right || loadingDiff || left === right}
              style={{ marginLeft: "auto" }}
            >
              <Icon name="diff" size={12} />
              {loadingDiff ? "Diffing…" : "Compare A↔B"}
            </button>
          </div>
          <div style={{ padding: 14, overflow: "auto" }}>
            {!diff && (
              <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>
                Pick two snapshots and click <strong>Compare</strong>.
              </div>
            )}
            {diff && diff.length === 0 && (
              <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>No differences.</div>
            )}
            {diff && diff.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <Th>Change</Th>
                    <Th>Entity</Th>
                    <Th>ID</Th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((c, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                      <Td>
                        <span
                          className={
                            c.type === "added"
                              ? "pill pill-green"
                              : c.type === "deleted"
                              ? "pill pill-red"
                              : "pill pill-amber"
                          }
                        >
                          {c.type}
                        </span>
                      </Td>
                      <Td muted>{c.entityType}</Td>
                      <Td>
                        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                          {c.entityId.slice(0, 12)}…
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function RadioPill({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "pill pill-accent" : "pill"}
      style={{ cursor: "pointer", border: "1px solid var(--line)" }}
    >
      {label}
    </button>
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
        color: "var(--ink-3)"
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
        color: muted ? "var(--ink-3)" : "var(--ink-2)"
      }}
    >
      {children}
    </td>
  );
}
