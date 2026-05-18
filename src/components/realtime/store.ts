"use client";

import { create } from "zustand";

export type Selection = {
  sheetId: string;
  rowId: string | null;
  fieldId: string | null;
} | null;

export type PresenceUser = {
  userId: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  color: string;
  selection: Selection;
};

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; username: string; firstName: string | null; lastName: string | null };
  mentions: ChatMention[];
};

export type ChatMention = {
  kind: "user" | "document" | "sheet" | "row" | "cell";
  offset: number;
  length: number;
  target: {
    userId?: string;
    documentId?: string;
    sheetId?: string;
    rowId?: string;
    fieldId?: string;
    label: string;
  };
};

type RealtimeState = {
  connected: boolean;
  documentId: string | null;
  selfUserId: string | null;
  selfColor: string | null;
  presence: PresenceUser[];
  messages: ChatMessage[];
  unread: number;
  setConnected(v: boolean): void;
  setSelf(userId: string, color: string): void;
  setDocument(id: string | null): void;
  setPresence(users: PresenceUser[]): void;
  setMessages(msgs: ChatMessage[]): void;
  appendMessage(msg: ChatMessage): void;
  incrementUnread(): void;
  resetUnread(): void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  documentId: null,
  selfUserId: null,
  selfColor: null,
  presence: [],
  messages: [],
  unread: 0,
  setConnected: (v) => set({ connected: v }),
  setSelf: (userId, color) => set({ selfUserId: userId, selfColor: color }),
  setDocument: (id) => set({ documentId: id, presence: [], messages: [], unread: 0 }),
  setPresence: (users) => set({ presence: users }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (msg) =>
    set((s) => ({
      messages: s.messages.some((m) => m.id === msg.id) ? s.messages : [...s.messages, msg]
    })),
  incrementUnread: () => set((s) => ({ unread: s.unread + 1 })),
  resetUnread: () => set({ unread: 0 })
}));
