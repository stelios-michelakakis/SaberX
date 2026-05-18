import type { WebSocket } from "ws";
import type { RealtimeIdentity } from "./auth";

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

type Conn = {
  socket: WebSocket;
  identity: RealtimeIdentity;
  documentId: string;
  color: string;
  selection: Selection;
};

type Room = {
  documentId: string;
  conns: Set<Conn>;
};

declare global {
  // eslint-disable-next-line no-var
  var saberxRealtime: { rooms: Map<string, Room>; socketIndex: WeakMap<WebSocket, Conn> } | undefined;
}

const state =
  globalThis.saberxRealtime ??
  (globalThis.saberxRealtime = {
    rooms: new Map<string, Room>(),
    socketIndex: new WeakMap<WebSocket, Conn>()
  });

const rooms = state.rooms;
const socketIndex = state.socketIndex;

function colorFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 70% 50%)`;
}

function getRoom(documentId: string): Room {
  let r = rooms.get(documentId);
  if (!r) {
    r = { documentId, conns: new Set() };
    rooms.set(documentId, r);
  }
  return r;
}

function presenceSnapshot(room: Room): PresenceUser[] {
  const byUser = new Map<string, PresenceUser>();
  for (const c of room.conns) {
    const existing = byUser.get(c.identity.userId);
    if (existing && existing.selection) continue;
    byUser.set(c.identity.userId, {
      userId: c.identity.userId,
      username: c.identity.username,
      firstName: c.identity.firstName,
      lastName: c.identity.lastName,
      color: c.color,
      selection: c.selection
    });
  }
  return Array.from(byUser.values());
}

function broadcast(room: Room, payload: unknown) {
  const text = JSON.stringify(payload);
  for (const c of room.conns) {
    if (c.socket.readyState === c.socket.OPEN) c.socket.send(text);
  }
}

function broadcastPresence(room: Room) {
  broadcast(room, { type: "presence", documentId: room.documentId, users: presenceSnapshot(room) });
}

export function joinRoom(socket: WebSocket, identity: RealtimeIdentity, documentId: string) {
  leave(socket);
  const room = getRoom(documentId);
  const conn: Conn = {
    socket,
    identity,
    documentId,
    color: colorFor(identity.userId),
    selection: null
  };
  room.conns.add(conn);
  socketIndex.set(socket, conn);
  socket.send(
    JSON.stringify({
      type: "joined",
      documentId,
      you: { userId: identity.userId, color: conn.color }
    })
  );
  broadcastPresence(room);
}

export function setSelection(socket: WebSocket, selection: Selection) {
  const conn = socketIndex.get(socket);
  if (!conn) return;
  conn.selection = selection;
  const room = rooms.get(conn.documentId);
  if (room) broadcastPresence(room);
}

export function leave(socket: WebSocket) {
  const conn = socketIndex.get(socket);
  if (!conn) return;
  const room = rooms.get(conn.documentId);
  socketIndex.delete(socket);
  if (!room) return;
  room.conns.delete(conn);
  if (room.conns.size === 0) rooms.delete(conn.documentId);
  else broadcastPresence(room);
}

export function emitChatToDocument(documentId: string, message: unknown) {
  const room = rooms.get(documentId);
  if (!room) return;
  broadcast(room, { type: "chat:new", documentId, message });
}
