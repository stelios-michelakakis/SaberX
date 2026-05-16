"use client";

import { useRouter } from "next/navigation";
import type { ChatMention } from "./store";

type Props = {
  body: string;
  mentions: ChatMention[];
  highlightUserId?: string | null;
  currentDocumentId: string;
};

function buildSegments(body: string, mentions: ChatMention[]) {
  const sorted = [...mentions].sort((a, b) => a.offset - b.offset);
  const segments: Array<{ text: string; mention?: ChatMention }> = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.offset > cursor) segments.push({ text: body.slice(cursor, m.offset) });
    segments.push({ text: body.slice(m.offset, m.offset + m.length), mention: m });
    cursor = m.offset + m.length;
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor) });
  return segments;
}

export function MentionBody({ body, mentions, highlightUserId, currentDocumentId }: Props) {
  const router = useRouter();

  const navigate = (m: ChatMention) => {
    const t = m.target;
    if (m.kind === "user") return;
    if (m.kind === "document" && t.documentId) {
      router.push(`/dashboard/documents/${t.documentId}`);
    } else if ((m.kind === "sheet" || m.kind === "row" || m.kind === "cell") && t.documentId) {
      const params = new URLSearchParams();
      if (t.sheetId) params.set("sheet", t.sheetId);
      if (t.rowId) params.set("focusRow", t.rowId);
      if (t.fieldId) params.set("focusField", t.fieldId);
      params.set("flash", "1");
      router.push(`/dashboard/documents/${t.documentId}?${params.toString()}`);
    } else if (m.kind === "sheet" && t.sheetId) {
      const params = new URLSearchParams({ sheet: t.sheetId, flash: "1" });
      router.push(`/dashboard/documents/${currentDocumentId}?${params.toString()}`);
    }
  };

  const segments = buildSegments(body, mentions);

  return (
    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {segments.map((seg, i) => {
        if (!seg.mention) return <span key={i}>{seg.text}</span>;
        const m = seg.mention;
        const isUser = m.kind === "user";
        const isHighlightedUser = isUser && highlightUserId && m.target.userId === highlightUserId;
        return (
          <span
            key={i}
            onClick={() => navigate(m)}
            style={{
              display: "inline-block",
              padding: "0 5px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              cursor: isUser ? "default" : "pointer",
              background: isHighlightedUser ? "var(--accent-soft)" : "var(--accent-soft)",
              color: "var(--accent-ink)",
              border: isHighlightedUser ? "1px solid var(--sx-accent)" : "1px solid transparent"
            }}
            title={m.target.label}
          >
            {m.target.label}
          </span>
        );
      })}
    </span>
  );
}
