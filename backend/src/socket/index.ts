import { Server as SocketIOServer, Socket } from "socket.io";
import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import db from "../pg.js";
import { rGet, rSet, k } from "../lib/redis.js";

const chatViewers = new Map<string, Set<string>>();

export async function socketAuthUserId(socket: any): Promise<string | null> {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(" ")[1] ||
    socket.handshake.headers?.cookie
      ?.split("; ")
      .find((c: string) => c.startsWith("sb_access_token="))
      ?.split("=")[1];

  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch (err) {
    return null;
  }
}

export function setupSocketHandlers(io: SocketIOServer) {
  (io as any)._chatViewers = chatViewers;

  io.on("connection", async (socket: Socket) => {
    const userId = await socketAuthUserId(socket);
    if (userId) {
      socket.join(`user:${userId}`);
      logger.info(`[Socket] 🔌 User connected. Auth ID: ${userId}`, { socketId: socket.id });
      
      try {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id, company_id")
          .eq("user_id", userId)
          .maybeSingle();
        
        if (user) {
          if (user.id) socket.join(`user:${user.id}`);
          if (user.company_id) socket.join(`company:${user.company_id}`);
        }
      } catch (error) {
        logger.error("[RT] ❌ failed to join company/user rooms", { socketId: socket.id, userId, error });
      }
    }

    socket.on("join", async (payload: { chatId?: string; companyId?: string }) => {
      const { chatId, companyId } = payload;
      const authId = await socketAuthUserId(socket);
      if (!authId) return;

      if (companyId) {
        const userCompany = await db.oneOrNone<{ company_id: string }>(
          `SELECT company_id FROM public.users WHERE id = $1`,
          [authId]
        );
        if (userCompany?.company_id === companyId) {
          socket.join(`company:${companyId}`);
        }
      }

      if (chatId) {
        const cleanChatId = String(chatId).trim().replace(/--+/g, '-');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanChatId)) return;

        const access = await db.oneOrNone<{ chat_id: string }>(
          `SELECT c.id as chat_id FROM public.chats c
           LEFT JOIN public.inboxes i ON i.id = c.inbox_id
           JOIN public.users u ON u.user_id = $2
           WHERE c.id = $1 AND (u.role IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER') OR u.company_id = c.company_id OR u.company_id = i.company_id)`,
          [cleanChatId, authId]
        );

        if (access) {
          socket.join(`chat:${cleanChatId}`);
          if (!chatViewers.has(cleanChatId)) chatViewers.set(cleanChatId, new Set());
          chatViewers.get(cleanChatId)!.add(authId);
        }
      }
    });

    socket.on("leave", async (payload: { chatId?: string; companyId?: string }) => {
      if (payload.companyId) socket.leave(`company:${payload.companyId}`);
      if (payload.chatId) {
        socket.leave(`chat:${payload.chatId}`);
        const authId = await socketAuthUserId(socket);
        if (authId && chatViewers.has(payload.chatId)) {
          chatViewers.get(payload.chatId)!.delete(authId);
        }
      }
    });

    socket.on("disconnect", async () => {
      const authId = await socketAuthUserId(socket);
      if (authId) {
        for (const [chatId, viewers] of chatViewers.entries()) {
          if (viewers.has(authId)) {
            viewers.delete(authId);
            if (viewers.size === 0) chatViewers.delete(chatId);
          }
        }
      }
    });

    socket.on("livechat:chats:tags:get", async (payload: { chatId?: string }, callback) => {
      if (!payload.chatId) return callback?.({ ok: false, error: 'chatId required' });
      const { data, error } = await supabaseAdmin.from('chat_tags').select('tag_id').eq('chat_id', payload.chatId);
      if (error) return callback?.({ ok: false, error: error.message });
      callback?.({ ok: true, data: (data || []).map(r => (r as any).tag_id) });
    });

    socket.on("livechat:inboxes:my", async (ack?: (resp: any) => void) => {
      const authId = await socketAuthUserId(socket);
      if (!authId) return ack?.({ ok: false, error: "Not authenticated" });
      const { data: links } = await supabaseAdmin.from("inbox_users").select("inbox_id").eq("user_id", authId);
      const ids = Array.from(new Set((links || []).map((r: any) => r.inbox_id))).filter(Boolean);
      if (ids.length === 0) return ack?.({ ok: true, data: [] });
      const { data, error } = await supabaseAdmin.from("inboxes").select("id, name, phone_number, is_active, provider, channel").in("id", ids).eq("is_active", true).order("name", { ascending: true });
      if (error) return ack?.({ ok: false, error: error.message });
      return ack?.({ ok: true, data: data });
    });
  });
}

