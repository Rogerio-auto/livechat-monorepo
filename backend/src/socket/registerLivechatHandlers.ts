// src/socket/registerLivechatHandlers.ts
import type { Server, Socket } from "socket.io";

export function registerLivechatHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("join", (payload: { chatId?: string | null }) => {
      const chatId = payload?.chatId;
      if (!chatId) return;
      socket.join(`chat:${chatId}`);
    });

    socket.on("leave", (payload: { chatId?: string | null }) => {
      const chatId = payload?.chatId;
      if (!chatId) return;
      socket.leave(`chat:${chatId}`);
    });

    socket.on("livechat:chats:list", async (_params, ack) => {
      if (typeof ack === "function") {
        ack({ ok: false, error: "not_implemented" });
      }
    });
  });
}
