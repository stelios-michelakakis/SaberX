"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/saberx/icon";
import { MentionBody } from "./mention-render";
import { useRealtimeStore, type ChatMention } from "./store";

type Suggestion = {
  kind: "user" | "document" | "sheet" | "row";
  id: string;
  label: string;
  hint?: string;
  documentId?: string;
  sheetId?: string;
};

type DraftMention = {
  kind: ChatMention["kind"];
  offset: number;
  length: number;
  targetUserId?: string;
  targetDocumentId?: string;
  targetSheetId?: string;
  targetRowId?: string;
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function rebaseMentions(prev: DraftMention[], oldText: string, newText: string): DraftMention[] {
  if (oldText === newText) return prev;
  // Find common prefix and suffix to localize the edit
  let prefix = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefix < minLen && oldText[prefix] === newText[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix++;
  }
  const editStart = prefix;
  const editEnd = oldText.length - suffix; // end (exclusive) of replaced range in old text
  const delta = newText.length - oldText.length;
  return prev.flatMap((m) => {
    const mEnd = m.offset + m.length;
    if (mEnd <= editStart) return [m]; // before edit — unchanged
    if (m.offset >= editEnd) return [{ ...m, offset: m.offset + delta }]; // after edit — shift
    return []; // edit overlaps mention — drop
  });
}

function detectTrigger(text: string, caret: number): { start: number; query: string; prefix: "@" | "#" } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === " " || ch === "\n" || ch === "\t") return null;
    if (ch === "@" || ch === "#") {
      const before = i > 0 ? text[i - 1] : " ";
      if (before === " " || before === "\n" || before === "\t" || i === 0) {
        return { start: i, query: text.slice(i + 1, caret), prefix: ch as "@" | "#" };
      }
      return null;
    }
  }
  return null;
}

export function ChatDock({ documentId }: { documentId: string }) {
  const messages = useRealtimeStore((s) => s.messages);
  const connected = useRealtimeStore((s) => s.connected);
  const unread = useRealtimeStore((s) => s.unread);
  const resetUnread = useRealtimeStore((s) => s.resetUnread);
  const selfId = useRealtimeStore((s) => s.selfUserId);

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [draftMentions, setDraftMentions] = useState<DraftMention[]>([]);
  const [posting, setPosting] = useState(false);
  const [popover, setPopover] = useState<{
    start: number;
    query: string;
    prefix: "@" | "#";
    items: Suggestion[];
    selectedIdx: number;
  } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const popoverListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popover) return;
    const container = popoverListRef.current;
    if (!container) return;
    const child = container.children[popover.selectedIdx] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest" });
  }, [popover?.selectedIdx, popover?.items]);

  useEffect(() => {
    if (open) resetUnread();
  }, [open, resetUnread, messages.length]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  const onChange = async (next: string, caret: number) => {
    setDraftMentions((prev) => rebaseMentions(prev, body, next));
    setBody(next);

    const trig = detectTrigger(next, caret);
    if (!trig) {
      setPopover(null);
      return;
    }
    // For "@" → users; for "#" → document/sheet (decided by first colon, else combined search)
    const kind: Suggestion["kind"] = trig.prefix === "@" ? "user" : "document";
    try {
      const params = new URLSearchParams({ kind, q: trig.query });
      const r = await fetch(`/api/documents/${documentId}/chat/mention-search?${params}`);
      const data = (await r.json()) as { suggestions: Suggestion[] };
      let items = data.suggestions ?? [];
      if (trig.prefix === "#") {
        const [sheetRes, rowRes] = await Promise.all([
          fetch(`/api/documents/${documentId}/chat/mention-search?kind=sheet&q=${encodeURIComponent(trig.query)}`),
          fetch(`/api/documents/${documentId}/chat/mention-search?kind=row&q=${encodeURIComponent(trig.query)}`)
        ]);
        const sheets = (await sheetRes.json()) as { suggestions: Suggestion[] };
        const rows = (await rowRes.json()) as { suggestions: Suggestion[] };
        items = [...items, ...(sheets.suggestions ?? []), ...(rows.suggestions ?? [])];
      }
      setPopover({ ...trig, items, selectedIdx: 0 });
    } catch {
      setPopover(null);
    }
  };

  const insertSuggestion = (s: Suggestion) => {
    if (!popover) return;
    const prefixChar = s.kind === "user" ? "@" : "#";
    const label = `${prefixChar}${s.label}`;
    const before = body.slice(0, popover.start);
    const after = body.slice(popover.start + 1 + popover.query.length);
    const nextBody = `${before}${label} ${after}`;
    const mention: DraftMention = {
      kind: s.kind,
      offset: popover.start,
      length: label.length,
      targetUserId: s.kind === "user" ? s.id : undefined,
      targetDocumentId:
        s.kind === "document" ? s.id : s.kind === "sheet" || s.kind === "row" ? s.documentId : undefined,
      targetSheetId: s.kind === "sheet" ? s.id : s.kind === "row" ? s.sheetId : undefined,
      targetRowId: s.kind === "row" ? s.id : undefined
    };
    setBody(nextBody);
    setDraftMentions((prev) => [...prev, mention]);
    setPopover(null);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = popover.start + label.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/documents/${documentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed, mentions: draftMentions })
      });
      if (!r.ok) return;
      setBody("");
      setDraftMentions([]);
      setPopover(null);
    } finally {
      setPosting(false);
    }
  };

  const onKey: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (popover && popover.items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPopover({ ...popover, selectedIdx: (popover.selectedIdx + 1) % popover.items.length });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPopover({
          ...popover,
          selectedIdx: (popover.selectedIdx - 1 + popover.items.length) % popover.items.length
        });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertSuggestion(popover.items[popover.selectedIdx]);
        return;
      }
      if (e.key === "Escape") {
        setPopover(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const dockHeader = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          color: "var(--ink)",
          fontSize: 12.5,
          fontWeight: 500
        }}
        title={connected ? "Document chat" : "Reconnecting…"}
      >
        <Icon name="users" size={14} />
        <span>Chat</span>
        {unread > 0 && (
          <span
            style={{
              background: "var(--sx-accent)",
              color: "white",
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 10,
              fontWeight: 600
            }}
          >
            {unread}
          </span>
        )}
        <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 11 }}>
          {connected ? "● Live" : "○ Offline"}
        </span>
        <Icon name={open ? "chevronD" : "chevronU"} size={12} />
      </button>
    ),
    [open, connected, unread]
  );

  return (
    <div
      style={{
        flex: "none",
        borderTop: "1px solid var(--line)",
        background: "var(--panel)",
        color: "var(--ink)"
      }}
    >
      {dockHeader}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", height: 320, borderTop: "1px solid var(--line)" }}>
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
            {messages.length === 0 && (
              <div style={{ color: "var(--ink-3)", fontSize: 12.5, padding: 16, textAlign: "center" }}>
                No messages yet. Use @ to tag people, # to reference docs and sheets.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 10, display: "flex", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--panel-2)",
                    color: "var(--ink-2)",
                    fontSize: 11,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none"
                  }}
                >
                  {m.author.username.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{m.author.username}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{timeLabel(m.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
                    <MentionBody
                      body={m.body}
                      mentions={m.mentions}
                      highlightUserId={selfId}
                      currentDocumentId={documentId}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--line)", padding: 10, position: "relative" }}>
            {popover && popover.items.length > 0 && (
              <div
                ref={popoverListRef}
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 14,
                  marginBottom: 4,
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  minWidth: 240,
                  maxHeight: 220,
                  overflowY: "auto",
                  zIndex: 200
                }}
              >
                {popover.items.map((s, i) => (
                  <button
                    key={`${s.kind}-${s.id}`}
                    type="button"
                    onClick={() => insertSuggestion(s)}
                    style={{
                      all: "unset",
                      display: "flex",
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: 12.5,
                      gap: 6,
                      background: i === popover.selectedIdx ? "var(--accent-soft)" : "transparent"
                    }}
                  >
                    <span style={{ color: "var(--ink-3)", fontSize: 10.5, width: 50, textTransform: "uppercase" }}>
                      {s.kind}
                    </span>
                    <span style={{ color: "var(--ink)" }}>{s.label}</span>
                    {s.hint && <span style={{ color: "var(--ink-3)", marginLeft: "auto" }}>{s.hint}</span>}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={inputRef}
              value={body}
              onChange={(e) => onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
              onKeyDown={onKey}
              onClick={(e) => {
                const el = e.currentTarget;
                void onChange(el.value, el.selectionStart ?? el.value.length);
              }}
              placeholder="Message — @user, #doc, #sheet"
              rows={2}
              disabled={posting}
              style={{
                width: "100%",
                resize: "none",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 13,
                fontFamily: "inherit",
                background: "var(--panel-2)",
                color: "var(--ink)",
                outline: "none"
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Enter to send · Shift+Enter for newline</span>
              <button
                type="button"
                className="sx-btn sx-btn-primary sx-btn-sm"
                onClick={() => void submit()}
                disabled={posting || !body.trim()}
              >
                {posting ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
