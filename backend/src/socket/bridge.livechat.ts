// src/socket/bridge.livechat.ts
import { getIO } from "../lib/io.js";
import { consume } from "../queue/rabbit.js";

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

function emitMessage(ev: Extract<SocketEvent, { kind: "livechat.inbound.message" | "livechat.outbound.message" }>) {
  const io = getIO(); // não-null, se não inicializado lança erro claro
  if (!ev?.chatId || !ev?.message) return;

  const room = `chat:${ev.chatId}`;
  io.to(room).emit("message:new", ev.message);
  io.to(room).emit(
    ev.kind === "livechat.inbound.message" ? "message:inbound" : "message:outbound",
    ev.message
  );

  if (ev.chatUpdate) {
    // 🔒 CORREÇÃO CRÍTICA: Emitir apenas para a sala da empresa, não para todos
    const companyId = (ev.chatUpdate as any)?.companyId;
    if (companyId) {
      io.to(`company:${companyId}`).emit("chat:updated", ev.chatUpdate);
    } else {
      console.warn("[socket.bridge] chat:updated sem companyId - não emitido", { chatId: ev.chatId });
    }
  }
}

function emitStatus(ev: Extract<SocketEvent, { kind: "livechat.message.status" }>) {
  const io = getIO();
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

export function startLivechatSocketBridge() {
  console.log("[socket.bridge] listening on:", Q_SOCKET);

  consume(Q_SOCKET, async (msg, ch) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as SocketEvent;

      switch (payload?.kind) {
        case "livechat.inbound.message":
        case "livechat.outbound.message":
          emitMessage(payload);
          break;
        case "livechat.message.status":
          emitStatus(payload);
          break;
        default:
          // desconhecido -> ack pra não travar fila
          break;
      }

      ch.ack(msg);
    } catch (e) {
      console.error("[socket.bridge] error:", (e as any)?.message || e);
      ch.nack(msg, false, false);
    }
  });
}
