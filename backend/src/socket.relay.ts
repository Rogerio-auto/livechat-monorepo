import type { Server } from "socket.io";
import { consume } from "./queue/rabbit.js";

const Q_SOCKET = "q.socket.livechat";

type SocketEvent =
  | {
      kind: "livechat.inbound.message" | "livechat.outbound.message";
      chatId: string;
      message: any;
      chatUpdate?: any;
      companyId?: string | null;
    }
  | {
      kind: "livechat.message.status";
      chatId: string;
      messageId?: string | null;
      externalId?: string | null;
      view_status?: string | null;
      raw_status?: string | null;
    }
  | {
      kind: "notification";
      userId: string;
      notification: any;
    };

function emitNotification(
  io: Server,
  ev: Extract<SocketEvent, { kind: "notification" }>,
) {
  if (!ev?.userId || !ev?.notification) return;
  const room = `user:${ev.userId}`;
  console.log(`[socket.relay] 🔔 Emitting notification to room: ${room}`);
  io.to(room).emit("notification", ev.notification);
}

function emitMessage(
  io: Server,
  ev: Extract<SocketEvent, { kind: "livechat.inbound.message" | "livechat.outbound.message" }>,
) {
  console.log("[socket.relay] 🔄 emitMessage called:", {
    kind: ev?.kind,
    chatId: ev?.chatId,
    hasMessage: !!ev?.message,
    hasChatUpdate: !!ev?.chatUpdate,
    companyId: ev?.companyId,
  });
  
  if (!ev?.chatId || !ev?.message) {
    console.log("[socket.relay] ⚠️ Skipping emit - missing chatId or message");
    return;
  }
  
  const room = `chat:${ev.chatId}`;

  console.log("[socket.relay] 📤 Emitting to chat room:", {
    room,
    messageId: ev.message?.id,
    events: ["message:new", ev.kind === "livechat.inbound.message" ? "message:inbound" : "message:outbound"],
  });

  // Emite eventos legados e novos para compatibilidade.
  io.to(room).emit("message:new", ev.message);
  io.to(room).emit(
    ev.kind === "livechat.inbound.message" ? "message:inbound" : "message:outbound",
    ev.message,
  );

  if (ev.chatUpdate) {
    console.log("[socket.relay] 💬 Processing chatUpdate:", {
      chatId: ev.chatUpdate.id,
      companyId: ev.companyId,
      last_message_from: ev.chatUpdate.last_message_from,
      last_message_body: ev.chatUpdate.last_message_body?.substring(0, 50),
    });
    
    // Emit to company room if companyId provided, otherwise fallback to global (legacy)
    if (ev.companyId) {
      const companyRoom = `company:${ev.companyId}`;
      console.log("[socket.relay] 📡 Emitting chat:updated to company room:", {
        room: companyRoom,
        companyId: ev.companyId,
        chatId: ev.chatId,
        last_message_from: ev.chatUpdate.last_message_from,
        chatUpdate_companyId: ev.chatUpdate.company_id,
      });
      io.to(companyRoom).emit("chat:updated", ev.chatUpdate);
    } else {
      // Legacy fallback - unsafe but maintains compatibility
      console.warn("[socket.relay] ⚠️  chat:updated without companyId - using global broadcast (unsafe)", { chatId: ev.chatId });
      io.emit("chat:updated", ev.chatUpdate);
    }
  } else {
    console.log("[socket.relay] ⏭️  No chatUpdate in payload, skipping chat:updated emission");
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
      
      console.log("[socket.relay] 📨 Received message from queue:", {
        kind: payload?.kind,
        chatId: (payload as any)?.chatId,
        companyId: (payload as any)?.companyId,
        hasMessage: !!(payload as any)?.message,
        hasChatUpdate: !!(payload as any)?.chatUpdate,
      });
      
      switch (payload?.kind) {
        case "livechat.inbound.message":
        case "livechat.outbound.message":
          emitMessage(io, payload as any);
          break;
        case "livechat.message.status":
          emitStatus(io, payload as any);
          break;
        case "notification":
          emitNotification(io, payload as any);
          break;
        default:
          console.log("[socket.relay] ⚠️ Unknown message kind:", (payload as any)?.kind);
          break;
      }
      ch.ack(msg);
    } catch (e) {
      console.error("[socket.relay] ❌ ERROR parsing message:", (e as any)?.message || e);
      ch.nack(msg, false, false);
    }
  });
}
