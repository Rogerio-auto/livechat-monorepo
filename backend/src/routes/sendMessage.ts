import type { Application, Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import db from "../pg.ts";
import { publish, publishApp, EX_APP } from "../queue/rabbit.ts";
import { requireAuth } from "../middlewares/requireAuth.ts";

const MEDIA_DIR = process.env.MEDIA_DIR || path.resolve(process.cwd(), "media");
const MEDIA_PUBLIC_BASE = (process.env.MEDIA_PUBLIC_BASE || "").replace(/\/+$/, "");
const FILES_PUBLIC_BASE = (process.env.FILES_PUBLIC_BASE || "http://localhost:5000").replace(/\/+$/, "");

function sanitizeFilename(name: string): string {
  return name.replace(/[\/\\?%*:|"<>]/g, "_").slice(0, 180);
}
function extFromMime(mime?: string): string | null {
  if (!mime) return null;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/opus": "opus",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "video/quicktime": "mov",
  };
  return map[mime] || null;
}
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MEDIA_MAX_BYTES || 104_857_600),
  },
});

export async function sendChannelMessage(req: any, res: Response) {
  const { inboxId } = req.params;
  const { chat_id, text } = req.body || {};
  if (!inboxId || !chat_id || !text) {
    return res.status(400).json({ error: "inboxId, chat_id e text sao obrigatorios" });
  }

  await publish(EX_APP, "outbound.request", {
    jobType: "message.send",
    kind: "send-text",
    provider: "META",
    inboxId,
    chatId: chat_id,
    content: String(text),
    attempt: 0,
    createdAt: new Date().toISOString(),
  });

  return res.status(202).json({ queued: true });
}

export function registerSendMessageRoutes(app: Application) {
  app.post("/inboxes/:inboxId/messages", sendChannelMessage);

  app.post(
    "/livechat/chats/:chatId/messages/media",
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const chatId = String(req.params?.chatId || "").trim();
        if (!chatId) {
          return res.status(400).json({ error: "invalid_chat_id" });
        }

        const caption = typeof req.body?.caption === "string" ? req.body.caption : "";
        const file = (req as any).file as {
          buffer: Buffer;
          originalname?: string;
          mimetype: string;
          size: number;
        } | undefined;
        if (!file) {
          return res.status(400).json({ error: "file_required" });
        }

        const allowed = (process.env.MEDIA_ALLOWED_MIME || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (allowed.length > 0 && !allowed.includes(file.mimetype)) {
          return res.status(415).json({ error: "mime_not_allowed", mimetype: file.mimetype });
        }

        const ymd = new Date().toISOString().slice(0, 10);
        const safeName = sanitizeFilename(
          file.originalname || `upload.${extFromMime(file.mimetype) || "bin"}`,
        );
        const relativeKey = `outbound/${chatId}/${ymd}/${Date.now()}-${safeName}`;
        const absPath = path.join(MEDIA_DIR, relativeKey);
        await ensureDir(path.dirname(absPath));
        await fs.writeFile(absPath, file.buffer);

        const mime = file.mimetype;
        const type = mime.startsWith("image/")
          ? "IMAGE"
          : mime.startsWith("video/")
          ? "VIDEO"
          : mime.startsWith("audio/")
          ? "AUDIO"
          : "DOCUMENT";

        const draftUrl = MEDIA_PUBLIC_BASE
          ? `${MEDIA_PUBLIC_BASE}/${relativeKey}`
          : null;

        const chatRow = await db.oneOrNone<{ inbox_id: string; company_id: string }>(
          `select c.inbox_id, i.company_id
             from public.chats c
             join public.inboxes i on i.id = c.inbox_id
            where c.id = $1`,
          [chatId],
        );
        if (!chatRow) {
          return res.status(404).json({ error: "chat_not_found" });
        }

        // Resolve local user (sender) from Supabase Auth user id
        let localSenderId: string | null = null;
        let localSenderName: string | null = null;
        let localSenderAvatarUrl: string | null = null;
        
        console.log("[POST /messages/media] 🔍 Starting sender resolution:", {
          authUserId: (req as any)?.user?.id,
          hasUser: !!(req as any)?.user,
        });
        
        try {
          const authUserId = (req as any)?.user?.id as string | undefined;
          if (authUserId && typeof authUserId === "string") {
            const userRow = await db.oneOrNone<{
              id: string;
              name: string | null;
              email: string | null;
              avatar: string | null;
            }>(
              `select id, name, email, avatar from public.users where user_id = $1`,
              [authUserId],
            );
            
            console.log("[POST /messages/media] 📊 User lookup result:", {
              found: !!userRow,
              data: userRow,
            });
            
            if (userRow) {
              localSenderId = userRow.id;
              localSenderName = userRow.name || userRow.email || null;
              localSenderAvatarUrl = userRow.avatar || null;
            }
          }
        } catch (e) {
          console.warn("[messages.media] sender resolution failed", e instanceof Error ? e.message : e);
        }

        console.log("[POST /messages/media] 📝 Resolved sender:", {
          localSenderId,
          localSenderName,
          localSenderAvatarUrl,
        });

        const inserted = await db.one<{
          id: string;
          chat_id: string;
          content: string | null;
          type: string | null;
          created_at: string;
          view_status: string | null;
          media_url: string | null;
          sender_id: string | null;
          sender_name: string | null;
          sender_avatar_url: string | null;
        }>(
          `insert into public.chat_messages
             (chat_id, content, type, is_from_customer, sender_id, sender_name, sender_avatar_url, media_url, view_status)
           values ($1, $2, $3, false, $4, $5, $6, $7, 'Pending')
           returning id, chat_id, content, type, created_at, view_status, media_url, sender_id, sender_name, sender_avatar_url`,
          [
            chatId,
            caption || safeName,
            type,
            localSenderId,
            localSenderName,
            localSenderAvatarUrl,
            draftUrl,
          ],
        );

        console.log("[POST /messages/media] 💾 Inserted message:", {
          id: inserted.id,
          sender_id: inserted.sender_id,
          sender_name: inserted.sender_name,
          sender_avatar_url: inserted.sender_avatar_url,
        });

        const viewStatus = inserted.view_status ?? "Pending";
        let effectiveMediaUrl = draftUrl ?? inserted.media_url ?? null;
        if (!draftUrl) {
          const fallbackUrl = `${FILES_PUBLIC_BASE}/files/${inserted.id}`;
          await db.none(
            `update public.chat_messages set media_url = $2 where id = $1`,
            [inserted.id, fallbackUrl],
          );
          effectiveMediaUrl = fallbackUrl;
        }

        await publishApp("outbound.request", {
          jobType: "meta.sendMedia",
          kind: "meta.sendMedia",
          chatId,
          inboxId: chatRow.inbox_id,
          companyId: chatRow.company_id,
          messageId: inserted.id,
          storage_key: relativeKey,
          filename: safeName,
          mime_type: mime,
          caption: caption || null,
          senderId: localSenderId ?? null,
          senderUserSupabaseId: (req as any)?.user?.id ?? null,
          attempt: 0,
          createdAt: new Date().toISOString(),
        });

        const responsePayload = {
          ...inserted,
          media_url: effectiveMediaUrl,
          view_status: viewStatus,
        };

        const mappedMessage = {
          id: responsePayload.id,
          chat_id: responsePayload.chat_id,
          body: responsePayload.content,
          sender_type: "AGENT" as const,
          sender_id: responsePayload.sender_id,
          sender_name: responsePayload.sender_name ?? localSenderName ?? null,
          sender_avatar_url: responsePayload.sender_avatar_url ?? localSenderAvatarUrl ?? null,
          created_at: responsePayload.created_at,
          view_status: responsePayload.view_status ?? "Pending",
          type,
          is_private: false,
          media_url: responsePayload.media_url ?? null,
        };

        console.log("[POST /messages/media] 📡 Socket emit (via rabbit):", {
          messageId: mappedMessage.id,
          sender_id: mappedMessage.sender_id,
          sender_name: mappedMessage.sender_name,
          sender_avatar_url: mappedMessage.sender_avatar_url,
        });

        try {
          await publishApp("socket.livechat.outbound", {
            kind: "livechat.outbound.message",
            chatId,
            inboxId: chatRow.inbox_id,
            message: mappedMessage,
            chatUpdate: {
              chatId,
              inboxId: chatRow.inbox_id,
              last_message: mappedMessage.body,
              last_message_at: mappedMessage.created_at,
              last_message_from: mappedMessage.sender_type,
              last_message_type: mappedMessage.type,
              last_message_media_url: mappedMessage.media_url,
            },
          });
        } catch (err) {
          console.warn(
            "[messages.media] failed to publish socket event:",
            (err as any)?.message || err,
          );
        }

        return res.json({
          ok: true,
          inserted: responsePayload,
        });
      } catch (e: any) {
        console.error("[messages.media] error:", e?.message || e);
        return res.status(500).json({ error: "send_media_failed" });
      }
    },
  );
}
