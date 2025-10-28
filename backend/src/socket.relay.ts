import type { Server } from "socket.io";
import { consume } from "./queue/rabbit.ts";

const Q_SOCKET = "q.socket.livechat";

type SocketEvent =
  | {
      kind: "livechat.inbound.message" | "livechat.outbound.message";
      chatId: string;
      message: any;
      chatUpdate?: any;
    }
  | {
      kind: "livechat.message.status";
      chatId: string;
      messageId?: string | null;
      externalId?: string | null;
      view_status?: string | null;
      raw_status?: string | null;
    };

function emitMessage(
  io: Server,
  ev: Extract<SocketEvent, { kind: "livechat.inbound.message" | "livechat.outbound.message" }>,
) {
  if (!ev?.chatId || !ev?.message) return;
  const room = `chat:${ev.chatId}`;

  // Emite eventos legados e novos para compatibilidade.
  io.to(room).emit("message:new", ev.message);
  io.to(room).emit(
    ev.kind === "livechat.inbound.message" ? "message:inbound" : "message:outbound",
    ev.message,
  );

  if (ev.chatUpdate) {
    io.emit("chat:updated", ev.chatUpdate);
  }
}

function emitStatus(
  io: Server,
  ev: Extract<SocketEvent, { kind: "livechat.message.status" }>,
) {
  if (!ev?.chatId) return;
  const room = `chat:${ev.chatId}`;
  io.to(room).emit("message:status", {
    chatId: ev.chatId,
    messageId: ev.messageId ?? null,
    externalId: ev.externalId ?? null,
    view_status: ev.view_status ?? null,
    raw_status: ev.raw_status ?? null,
  });
}

export function startSocketRelay(io: Server) {
  console.log("[socket.relay] listening on:", Q_SOCKET);
  consume(Q_SOCKET, async (msg, ch) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as SocketEvent;
      switch (payload?.kind) {
        case "livechat.inbound.message":
        case "livechat.outbound.message":
          emitMessage(io, payload);
          break;
        case "livechat.message.status":
          emitStatus(io, payload);
          break;
        default:
          break;
      }
      ch.ack(msg);
    } catch (e) {
      console.error("[socket.relay] error:", (e as any)?.message || e);
      ch.nack(msg, false, false);
    }
  });
}
