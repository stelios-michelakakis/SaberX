import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { identifyFromCookie, type RealtimeIdentity } from "./auth";
import { joinRoom, leave, setSelection } from "./hub";

type ClientMessage =
  | { type: "join"; documentId: string }
  | { type: "select"; sheetId: string; rowId: string | null; fieldId: string | null }
  | { type: "ping" };

function safeParse(raw: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.type === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function attachRealtime(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/realtime") {
        socket.destroy();
        return;
      }
      const identity = await identifyFromCookie(req.headers.cookie);
      if (!identity) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, identity);
      });
    } catch (err) {
      console.error("[realtime] upgrade failed", err);
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket, identity: RealtimeIdentity) => {
    let isAlive = true;
    ws.on("pong", () => {
      isAlive = true;
    });

    ws.on("message", (raw) => {
      const msg = safeParse(raw.toString());
      if (!msg) return;
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (msg.type === "join") {
        joinRoom(ws, identity, msg.documentId);
        return;
      }
      if (msg.type === "select") {
        setSelection(ws, {
          sheetId: msg.sheetId,
          rowId: msg.rowId,
          fieldId: msg.fieldId
        });
        return;
      }
    });

    ws.on("close", () => leave(ws));
    ws.on("error", () => leave(ws));

    const ping = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        clearInterval(ping);
        return;
      }
      isAlive = false;
      try {
        ws.ping();
      } catch {
        // ignore
      }
    }, 30_000);

    ws.on("close", () => clearInterval(ping));
  });

  console.log("[realtime] /realtime WS endpoint attached");
}
