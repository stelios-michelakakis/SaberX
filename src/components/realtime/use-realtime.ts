"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage, Selection } from "./store";
import { useRealtimeStore } from "./store";

function wsUrl(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/realtime`;
}

type Inbound =
  | { type: "joined"; documentId: string; you: { userId: string; color: string } }
  | { type: "presence"; documentId: string; users: any[] }
  | { type: "chat:new"; documentId: string; message: ChatMessage }
  | { type: "pong" };

export function useRealtime(documentId: string) {
  const setConnected = useRealtimeStore((s) => s.setConnected);
  const setDocument = useRealtimeStore((s) => s.setDocument);
  const setPresence = useRealtimeStore((s) => s.setPresence);
  const setMessages = useRealtimeStore((s) => s.setMessages);
  const appendMessage = useRealtimeStore((s) => s.appendMessage);
  const incrementUnread = useRealtimeStore((s) => s.incrementUnread);
  const setSelf = useRealtimeStore((s) => s.setSelf);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);
  const lastSelectionRef = useRef<Selection>(null);
  const pendingSelectionRef = useRef<Selection | null>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDocument(documentId);
    let cancelled = false;
    let backoff = 500;

    const loadHistory = async () => {
      try {
        const r = await fetch(`/api/documents/${documentId}/chat?limit=50`);
        if (!r.ok) return;
        const data = (await r.json()) as { messages: ChatMessage[] };
        if (!cancelled) setMessages(data.messages);
      } catch {
        // ignore
      }
    };
    void loadHistory();

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        setConnected(true);
        backoff = 500;
        ws.send(JSON.stringify({ type: "join", documentId }));
        if (lastSelectionRef.current) {
          ws.send(JSON.stringify({ type: "select", ...lastSelectionRef.current }));
        }
      });

      ws.addEventListener("message", (ev) => {
        let msg: Inbound | null = null;
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch {
          return;
        }
        if (!msg) return;
        if (msg.type === "joined") {
          setSelf(msg.you.userId, msg.you.color);
        } else if (msg.type === "presence") {
          setPresence(msg.users);
        } else if (msg.type === "chat:new") {
          appendMessage(msg.message);
          if (document.visibilityState !== "visible") incrementUnread();
        }
      });

      ws.addEventListener("close", () => {
        setConnected(false);
        wsRef.current = null;
        if (cancelled) return;
        reconnectRef.current = window.setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 10_000);
      });

      ws.addEventListener("error", () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, [documentId, setConnected, setDocument, setMessages, setPresence, appendMessage, incrementUnread, setSelf]);

  const setSelection = useCallback((selection: Selection) => {
    lastSelectionRef.current = selection;
    pendingSelectionRef.current = selection;
    if (selectionTimerRef.current) return;
    selectionTimerRef.current = setTimeout(() => {
      selectionTimerRef.current = null;
      const ws = wsRef.current;
      const payload = pendingSelectionRef.current;
      pendingSelectionRef.current = null;
      if (!ws || ws.readyState !== WebSocket.OPEN || !payload) return;
      ws.send(JSON.stringify({ type: "select", ...payload }));
    }, 80);
  }, []);

  return { setSelection };
}
