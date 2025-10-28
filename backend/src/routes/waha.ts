import express, { Request, Response } from "express";
import type { Express } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/requireAuth";
import { publish, publishMeta, EX_APP } from "../queue/rabbit";
import { getIO } from "../lib/io";
import { rDelMatch, rGet, rSet, k } from "../lib/redis";
import { supabaseAdmin } from "../lib/supabase";
import { getDecryptedCredsForInbox } from "../services/meta/store";
import { WAHA_BASE_URL, WAHA_PROVIDER, wahaFetch, WahaHttpError } from "../services/waha/client";
import { normalizeMsisdn } from "../util";

// ====== CONFIG ======
const WAHA_WEBHOOK_SECRET = process.env.WAHA_WEBHOOK_SECRET || ""; // opcional
const WAHA_WEBHOOK_TOKEN = process.env.WAHA_WEBHOOK_TOKEN || "";   // Authorization: Bearer <token>

const TTL_LIST = Number(process.env.WAHA_CACHE_TTL_LIST || process.env.CACHE_TTL_LIST || 5);
const TTL_CHAT = Number(process.env.WAHA_CACHE_TTL_CHAT || process.env.CACHE_TTL_CHAT || 30);
const TTL_MSGS = Number(process.env.WAHA_CACHE_TTL_MSGS || process.env.CACHE_TTL_MSGS || 5);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CONNECTED_STATUSES = new Set(["WORKING", "CONNECTED", "READY", "OPEN", "RUNNING"]);
const DISCONNECTED_STATUSES = new Set(["FAILED", "STOPPED", "CLOSED", "LOGGED_OUT", "DISCONNECTED", "QR_TIMEOUT"]);

type InboxLookupRow = {
  id: string;
  company_id: string;
  provider: string | null;
  instance_id: string | null;
};

async function loadWahaInboxBySession(session: string): Promise<InboxLookupRow | null> {
  if (!session.trim()) return null;
  const { data, error } = await supabaseAdmin
    .from("inboxes")
    .select("id, company_id, provider, instance_id")
    .eq("provider", WAHA_PROVIDER)
    .eq("instance_id", session.trim())
    .maybeSingle();
  if (error) {
    console.error("[WAHA] failed to load inbox by session", { session, error: error.message });
    return null;
  }
  if (!data) {
    console.warn("[WAHA] inbox not found for session", { session });
    return null;
  }
  return data;
}

// ====== Zod Schemas ======
const SendTextSchema = z.object({
  session: z.string().default("default"),
  chatId: z.string().min(5),            // 5511999999999@c.us | ...@g.us
  text: z.string().min(1),
  mentions: z.array(z.string()).optional(), // 5511...@c.us (grupos)
});

const SendMediaBase = z.object({
  session: z.string().default("default"),
  chatId: z.string().min(5),
  caption: z.string().optional(),
  // escolha: url OU base64
  file: z.object({
    url: z.string().url().optional(),
    data: z.string().optional(),       // base64 sem prefixo data:
    mimetype: z.string().optional(),
    filename: z.string().optional(),
    convert: z.boolean().optional(),   // voice/video: conversão interna
  }).refine(v => !!v.url || !!v.data, { message: "Informe file.url ou file.data (base64)" }),
});

const SendImageSchema = SendMediaBase;
const SendVideoSchema = SendMediaBase;
const SendFileSchema  = SendMediaBase;
const SendVoiceSchema = SendMediaBase.extend({
  // voice aceita convert=true para MP3->OPUS
});

const ChatsOverviewQuery = z.object({
  session: z.string().default("default"),
  limit: z.coerce.number().min(1).max(200).default(20),
  offset: z.coerce.number().min(0).default(0),
  ids: z.preprocess(v => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.string())).optional(),
  q: z.string().optional(),
  status: z.string().optional(),
});

const ChatMessagesQuery = z.object({
  session: z.string().default("default"),
  chatId: z.string().min(5),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  downloadMedia: z.coerce.boolean().optional(),
});

const GetMessagesQuery = z.object({
  session: z.string().default("default"),
  chatId: z.string().min(3), // permite "all" nos engines suportados
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  downloadMedia: z.coerce.boolean().optional(),
});

// ====== Helpers ======
async function invalidateCompanyChatLists(companyId: string) {
  try {
    await rDelMatch(`livechat:chats:list:${companyId}:*`);
  } catch {}
  try {
    await rDelMatch(k.listPrefixCompany(companyId));
  } catch {}
}

async function persistDraftMessage(params: {
  companyId: string;
  chatId?: string | null;
  inboxId: string;
  to: string;
  fromUserId?: string;
  kind: "text" | "image" | "audio" | "video" | "document";
  content?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  quotedMessageId?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .insert([{
      company_id: params.companyId,
      chat_id: params.chatId ?? null,
      inbox_id: params.inboxId,
      to_remote: params.to,
      from_user_id: params.fromUserId ?? null,
      kind: params.kind,
      content: params.content ?? null,
      media_url: params.mediaUrl ?? null,
      caption: params.caption ?? null,
      quoted_message_id: params.quotedMessageId ?? null,
      status: "DRAFT",
    }])
    .select()
    .maybeSingle();

  if (error) console.warn("[WAHA] persistDraftMessage failed:", error.message);
  return data || null;
}

function authHeaderBearer(req: Request): string {
  const raw = (req.headers.authorization || (req.headers as any).Authorization) as string | undefined;
  if (!raw) return "";
  const m = /^Bearer\s+(.+)$/.exec(String(raw));
  return m?.[1] ?? "";
}

function isValidWebhookAuth(req: Request): boolean {
  const xSecret = String(req.headers["x-waha-secret"] || "");
  if (WAHA_WEBHOOK_SECRET && xSecret && xSecret === WAHA_WEBHOOK_SECRET) return true;
  const bearer = authHeaderBearer(req);
  if (WAHA_WEBHOOK_TOKEN && bearer && bearer === WAHA_WEBHOOK_TOKEN) return true;
  const qs = String(req.query.secret || "");
  if (WAHA_WEBHOOK_SECRET && qs && qs === WAHA_WEBHOOK_SECRET) return true;
  return false;
}

function unwrapSessionPayload(payload: any): any {
  if (!payload) return payload;
  if (payload.result && typeof payload.result === "object") {
    return unwrapSessionPayload(payload.result);
  }
  return payload;
}

function extractSessionStatus(payload: any): string {
  const base = unwrapSessionPayload(payload);
  const status = base?.status ?? base?.state ?? base?.sessionStatus ?? "";
  return typeof status === "string" ? status : "";
}

function extractConnectedNumber(payload: any): string | null {
  const base = unwrapSessionPayload(payload);
  const candidate =
    base?.phone ??
    base?.number ??
    base?.connectedPhone ??
    base?.info?.phone ??
    base?.info?.number ??
    base?.info?.connectedPhone ??
    null;
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function ensureLimit(value: unknown, fallback = DEFAULT_LIMIT): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, MAX_LIMIT);
  }
  return fallback;
}

function toWahaChatIdFromPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = normalizeMsisdn(String(phone));
  if (!digits) return null;
  return `${digits}@c.us`;
}

function parseRemoteChatId(raw: string): { digits: string; jid: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (UUID_RE.test(trimmed)) {
    return { digits: trimmed, jid: trimmed };
  }
  const jid = trimmed.includes("@") ? trimmed : `${trimmed}@c.us`;
  const digits = normalizeMsisdn(jid.replace(/@.*/, ""));
  if (!digits) return null;
  return { digits, jid };
}

function mapViewStatusToAck(status: string | null | undefined, isFromCustomer: boolean): number {
  if (isFromCustomer) return 0;
  const normalized = (status || "").toLowerCase();
  switch (normalized) {
    case "sent":
      return 1;
    case "received":
    case "delivered":
      return 2;
    case "read":
    case "seen":
    case "visualized":
      return 3;
    case "played":
      return 4;
    default:
      return 0;
  }
}

function mapMessageType(type: string | null | undefined): string {
  const normalized = (type || "").toString().toLowerCase();
  if (!normalized) return "chat";
  switch (normalized) {
    case "text":
      return "chat";
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker":
    case "ptt":
      return normalized;
    default:
      return "chat";
  }
}

type ResolvedChatContext = {
  inbox: InboxLookupRow;
  chat: {
    id: string;
    inbox_id: string | null;
    customer_id: string | null;
    status?: string | null;
  };
  customer: {
    id: string;
    name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  remoteChatId: string | null;
  customerPhoneDigits: string | null;
};

async function resolveChatContext(session: string, chatIdentifier: string): Promise<ResolvedChatContext | null> {
  const inbox = await loadWahaInboxBySession(session);
  if (!inbox) return null;

  const parsed = parseRemoteChatId(chatIdentifier);
  if (!parsed) return null;

  let chatRow: { id: string; inbox_id: string | null; customer_id: string | null; status?: string | null } | null = null;
  let customerRow: { id: string; name: string | null; phone: string | null; avatar_url: string | null } | null = null;

  if (UUID_RE.test(parsed.digits)) {
    const { data: chat, error } = await supabaseAdmin
      .from("chats")
      .select("id, inbox_id, customer_id, status")
      .eq("id", parsed.digits)
      .maybeSingle();
    if (error || !chat || chat.inbox_id !== inbox.id) return null;
    chatRow = chat as any;
    if (chat.customer_id) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, name, phone, avatar_url")
        .eq("id", chat.customer_id)
        .maybeSingle();
      customerRow = (customer as any) || null;
    }
  } else {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, avatar_url")
      .eq("company_id", inbox.company_id)
      .eq("phone", parsed.digits)
      .maybeSingle();
    if (!customer) return null;
    customerRow = customer as any;

    const { data: chat } = await supabaseAdmin
      .from("chats")
      .select("id, inbox_id, customer_id, status")
      .eq("inbox_id", inbox.id)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (!chat) return null;
    chatRow = chat as any;
  }

  const customerPhoneDigits = customerRow?.phone ? normalizeMsisdn(customerRow.phone) : null;
  const remoteChatId =
    toWahaChatIdFromPhone(customerRow?.phone) ??
    (customerPhoneDigits ? `${customerPhoneDigits}@c.us` : chatRow?.id ?? parsed.jid);

  return {
    inbox,
    chat: chatRow!,
    customer: customerRow,
    remoteChatId,
    customerPhoneDigits,
  };
}

type AttachmentInfo = {
  id: string;
  message_id: string;
  public_url: string | null;
  mime_type: string | null;
  filename: string | null;
  provider?: string | null;
};

type ChatCacheItem = {
  id: string;
  created_at: string;
  status: string;
  last_message: string | null;
  last_message_at: string | null;
  last_message_from: "CUSTOMER" | "AGENT" | null;
  last_message_type?: string | null;
  last_message_media_url?: string | null;
  last_message_id?: string | null;
  last_message_view_status?: string | null;
  inbox_id: string;
  customer_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_avatar_url?: string | null;
  unread_count?: number | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  assigned_agent_user_id?: string | null;
};

type MessageCacheItem = {
  id: string;
  external_id?: string | null;
  chat_id: string;
  body: string | null;
  content: string | null;
  sender_type: "CUSTOMER" | "AGENT";
  sender_id: string | null;
  created_at: string;
  view_status: string | null;
  type: string | null;
  media_url: string | null;
  attachments?: AttachmentInfo[];
  quoted_message_id?: string | null;
};

function mapChatCacheToWaha(chat: ChatCacheItem, opts: {
  session: string;
  remoteChatId?: string | null;
  lastMessage?: {
    id: string;
    external_id: string | null;
    content: string | null;
    created_at: string;
    type: string | null;
    view_status: string | null;
    media_url: string | null;
    is_from_customer: boolean;
  } | null;
}) {
  const remoteChatId =
    opts.remoteChatId ??
    toWahaChatIdFromPhone(chat.customer_phone) ??
    chat.customer_phone ??
    chat.id;
  const fallbackLastMessage =
    chat.last_message_id || chat.last_message
      ? {
          id: chat.last_message_id || chat.id,
          external_id: chat.last_message_id ?? null,
          content: chat.last_message ?? null,
          created_at: chat.last_message_at ?? chat.created_at,
          type: chat.last_message_type ?? null,
          view_status: chat.last_message_view_status ?? null,
          media_url: chat.last_message_media_url ?? null,
          is_from_customer: (chat.last_message_from ?? "CUSTOMER") === "CUSTOMER",
        }
      : null;
  const lastMessage = opts.lastMessage ?? fallbackLastMessage;
  const lastTimestampIso = lastMessage?.created_at ?? chat.last_message_at ?? null;
  const lastTimestampUnix = lastTimestampIso ? Math.floor(new Date(lastTimestampIso).getTime() / 1000) : null;

  const lastMessageSummary = lastMessage
    ? {
        id: lastMessage.external_id || lastMessage.id,
        internalId: lastMessage.id,
        body: lastMessage.content,
        type: mapMessageType(lastMessage.type),
        mediaUrl: lastMessage.media_url ?? null,
        fromMe: !lastMessage.is_from_customer,
        ack: mapViewStatusToAck(lastMessage.view_status, lastMessage.is_from_customer),
        timestamp: lastTimestampUnix,
      }
    : null;

  return {
    id: remoteChatId,
    chatId: remoteChatId,
    session: opts.session,
    name: chat.customer_name ?? remoteChatId,
    pushName: chat.customer_name ?? null,
    isGroup: false,
    unreadCount: chat.unread_count ?? 0,
    picture: chat.customer_avatar_url ?? null,
    lastMessage: lastMessageSummary,
    lastMessageTimestamp: lastTimestampUnix,
    status: chat.status,
    metadata: {
      chatUuid: chat.id,
      inboxId: chat.inbox_id,
      customerId: chat.customer_id,
      lastMessageId: lastMessageSummary?.id ?? null,
    },
  };
}

function mapMessageCacheToWaha(message: MessageCacheItem, remoteChatId: string | null) {
  const unixTimestamp = Math.floor(new Date(message.created_at).getTime() / 1000);
  const isFromCustomer = message.sender_type === "CUSTOMER";
  const attachments = (message.attachments || []).map((att) => ({
    id: att.id,
    url: att.public_url,
    mimeType: att.mime_type,
    filename: att.filename,
  }));

  return {
    id: message.external_id || message.id,
    internalId: message.id,
    chatId: remoteChatId ?? message.chat_id,
    fromMe: !isFromCustomer,
    body: message.body ?? message.content ?? null,
    type: mapMessageType(message.type),
    timestamp: unixTimestamp,
    ack: mapViewStatusToAck(message.view_status, isFromCustomer),
    from: isFromCustomer ? remoteChatId ?? message.chat_id : "me",
    to: isFromCustomer ? "me" : remoteChatId ?? message.chat_id,
    mediaUrl: message.media_url ?? null,
    attachments,
    quotedMessageId: message.quoted_message_id ?? null,
    createdAt: message.created_at,
    viewStatus: message.view_status ?? null,
  };
}

async function syncInboxSessionState(
  sessionName: string,
  payload: any,
  companyId: string | null | undefined,
) {
  if (!companyId) return;

  try {
    const { data: inbox, error: loadError } = await supabaseAdmin
      .from("inboxes")
      .select("id, phone_number, is_active, instance_id, phone_number_id")
      .eq("company_id", companyId)
      .eq("instance_id", sessionName)
      .maybeSingle();

    if (loadError || !inbox) return;

    const statusRaw = extractSessionStatus(payload);
    const status = statusRaw ? statusRaw.toUpperCase() : "";
    const rawConnected = extractConnectedNumber(payload);
    const connectedNumber =
      rawConnected && rawConnected !== sessionName && !rawConnected.startsWith("PENDING_")
        ? rawConnected
        : null;

    const updates: Record<string, any> = {};
    let shouldUpdate = false;

    if (connectedNumber && connectedNumber !== inbox.phone_number) {
      updates.phone_number = connectedNumber;
      shouldUpdate = true;
    }

    if (status) {
      if (CONNECTED_STATUSES.has(status) && inbox.is_active !== true) {
        updates.is_active = true;
        shouldUpdate = true;
      } else if (DISCONNECTED_STATUSES.has(status) && inbox.is_active !== false) {
        updates.is_active = false;
        shouldUpdate = true;
      }
    }

    if (inbox.instance_id !== sessionName) {
      updates.instance_id = sessionName;
      shouldUpdate = true;
    }
    if (inbox.phone_number_id !== sessionName) {
      updates.phone_number_id = sessionName;
      shouldUpdate = true;
    }

    if (!shouldUpdate) return;

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("inboxes")
      .update(updates)
      .eq("id", inbox.id);

    if (updateError) {
      console.warn("[WAHA] Failed to sync inbox state:", updateError.message);
    }
  } catch (error) {
    console.warn("[WAHA] syncInboxSessionState error:", (error as Error).message);
  }
}

// ====== Rotas ======
export function registerWAHARoutes(app: Express) {
  const router = express.Router();

  // -------- Health --------
  router.get("/health", async (_req, res) => {
    try {
      const wahaHealth = await wahaFetch<any>("/health").catch(() => null);
      res.json({ ok: true, provider: WAHA_PROVIDER, baseUrl: WAHA_BASE_URL, wahaHealth });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // -------- Sessão / QR --------
  router.get("/sessions", requireAuth, async (req: Request, res: Response) => {
    const all = req.query.all;
    const qs = new URLSearchParams();
    if (all !== undefined) qs.set("all", String(all));
    try {
      const result = await wahaFetch(`/api/sessions${qs.toString() ? `?${qs.toString()}` : ""}`);
      return res.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ ok: false, error: message });
    }
  });

  router.post("/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await wahaFetch(`/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body ?? {}),
      });
      return res.status(201).json({ ok: true, result });
    } catch (err) {
      if (err instanceof WahaHttpError && (err.status === 409 || err.status === 422 || err.status === 423)) {
        return res.json({ ok: true, conflict: true });
      }
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ ok: false, error: message });
    }
  });

  router.get("/sessions/:session", requireAuth, async (req: Request, res: Response) => {
    const session = req.params.session || "default";
    try {
      const result = await wahaFetch(`/api/sessions/${encodeURIComponent(session)}`);
      const companyId = String((req as any).user?.company_id || "");
      await syncInboxSessionState(session, result, companyId || null);
      return res.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ ok: false, error: message });
    }
  });

  router.put("/sessions/:session", requireAuth, async (req: Request, res: Response) => {
    const session = req.params.session || "default";
    try {
      const result = await wahaFetch(`/api/sessions/${encodeURIComponent(session)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body ?? {}),
      });
      return res.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ ok: false, error: message });
    }
  });

  router.delete("/sessions/:session", requireAuth, async (req: Request, res: Response) => {
    const session = req.params.session || "default";
    try {
      await wahaFetch(`/api/sessions/${encodeURIComponent(session)}`, { method: "DELETE" });
      return res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ ok: false, error: message });
    }
  });

  const forwardSessionCommand = (pathSuffix: string) =>
    async (req: Request, res: Response) => {
      const session = req.params.session || "default";
      try {
        const result = await wahaFetch(`/api/sessions/${encodeURIComponent(session)}/${pathSuffix}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: req.body ? JSON.stringify(req.body) : undefined,
        });
        return res.json({ ok: true, result });
      } catch (err) {
        if (err instanceof WahaHttpError && (err.status === 409 || err.status === 422 || err.status === 423)) {
          return res.json({ ok: true, conflict: true });
        }
        const message = err instanceof Error ? err.message : String(err);
        return res.status(502).json({ ok: false, error: message });
      }
    };

  router.post("/sessions/:session/start", requireAuth, forwardSessionCommand("start"));
  router.post("/sessions/:session/stop", requireAuth, forwardSessionCommand("stop"));
  router.post("/sessions/:session/logout", requireAuth, forwardSessionCommand("logout"));
  router.post("/sessions/:session/restart", requireAuth, forwardSessionCommand("restart"));

  router.get("/sessions/:session/me", requireAuth, async (req: Request, res: Response) => {
    const session = req.params.session || "default";
    try {
      const result = await wahaFetch(`/api/sessions/${encodeURIComponent(session)}/me`);
      return res.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ ok: false, error: message });
    }
  });

  router.get("/sessions/:session/auth/qr", requireAuth, async (req: Request, res: Response) => {
    const session = req.params.session || "default";
    const format = String(req.query.format || "base64").toLowerCase();

    const fetchQr = async () => {
      if (format === "raw") {
        return await wahaFetch(`/api/${encodeURIComponent(session)}/auth/qr?format=raw`, {
          headers: { Accept: "application/json" },
        });
      }
      if (format === "image") {
        return await wahaFetch(`/api/${encodeURIComponent(session)}/auth/qr`, {
          headers: { Accept: "image/png" },
        });
      }
      return await wahaFetch(`/api/${encodeURIComponent(session)}/auth/qr`, {
        headers: { Accept: "application/json" },
      });
    };

    try {
      const result = await fetchQr();
      return res.json({ ok: true, result });
    } catch (err) {
      if (err instanceof WahaHttpError && (err.status === 409 || err.status === 422 || err.status === 423)) {
        if (err.status === 422) {
          try {
            await wahaFetch(`/api/sessions/${encodeURIComponent(session)}/restart`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
          } catch (restartError) {
            if (!(restartError instanceof WahaHttpError) || (restartError.status !== 409 && restartError.status !== 423)) {
              const message = restartError instanceof Error ? restartError.message : String(restartError);
              const status = restartError instanceof WahaHttpError ? restartError.status : 502;
              return res.status(status).json({ ok: false, error: message });
            }
          }

          try {
            await sleep(1500);
            await wahaFetch(`/api/sessions/${encodeURIComponent(session)}/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
          } catch (startError) {
            if (!(startError instanceof WahaHttpError) || (startError.status !== 409 && startError.status !== 423)) {
              const message = startError instanceof Error ? startError.message : String(startError);
              const status = startError instanceof WahaHttpError ? startError.status : 502;
              return res.status(status).json({ ok: false, error: message });
            }
          }

          await sleep(1500);
          try {
            const retried = await fetchQr();
            return res.json({ ok: true, result: retried });
          } catch (retryError) {
            const message = retryError instanceof Error ? retryError.message : String(retryError);
            const status = retryError instanceof WahaHttpError ? retryError.status : 502;
            return res.status(status).json({ ok: false, error: message });
          }
        }
        return res.status(err.status).json({ ok: false, error: err.message });
      }
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ ok: false, error: message });
    }
  });

  router.post("/sessions/:session/auth/request-code", requireAuth, async (req: Request, res: Response) => {
    const session = req.params.session || "default";
    const phoneNumber = String(req.body?.phoneNumber || "").trim();
    const method = req.body?.method ? String(req.body.method) : "sms";
    if (!phoneNumber) {
      return res.status(400).json({ ok: false, error: "phoneNumber obrigatorio" });
    }
    try {
      const result = await wahaFetch(`/api/${encodeURIComponent(session)}/auth/request-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ phoneNumber, method }),
      });
      return res.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ ok: false, error: message });
    }
  });

  // -------- PROXY: ENVIOS DIRETOS (WAHA) --------
  router.post("/messages/text", requireAuth, async (req, res) => {
    const parsed = SendTextSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const body = {
        session: parsed.data.session,
        chatId: parsed.data.chatId,
        text: parsed.data.text,
        ...(parsed.data.mentions ? { mentions: parsed.data.mentions } : {}),
      };
      const r = await wahaFetch("/api/sendText", { method: "POST", body: JSON.stringify(body) });
      res.json({ ok: true, result: r });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  router.post("/messages/image", requireAuth, async (req, res) => {
    const parsed = SendImageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const r = await wahaFetch("/api/sendImage", { method: "POST", body: JSON.stringify(parsed.data) });
      res.json({ ok: true, result: r });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  router.post("/messages/video", requireAuth, async (req, res) => {
    const parsed = SendVideoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const r = await wahaFetch("/api/sendVideo", { method: "POST", body: JSON.stringify(parsed.data) });
      res.json({ ok: true, result: r });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  router.post("/messages/file", requireAuth, async (req, res) => {
    const parsed = SendFileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const r = await wahaFetch("/api/sendFile", { method: "POST", body: JSON.stringify(parsed.data) });
      res.json({ ok: true, result: r });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  router.post("/messages/voice", requireAuth, async (req, res) => {
    const parsed = SendVoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const r = await wahaFetch("/api/sendVoice", { method: "POST", body: JSON.stringify(parsed.data) });
      res.json({ ok: true, result: r });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  // -------- LISTAGEM DE CHATS (SUPABASE) --------
  const listWahaChats = async (req: Request, res: Response) => {
    const parsed = ChatsOverviewQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

    const { session, limit, offset, q, status } = parsed.data;
    const inbox = await loadWahaInboxBySession(session);
    if (!inbox) return res.status(404).json({ ok: false, error: "Inbox WAHA nao encontrada para a sessao" });

    const normalizedStatus = status ? status.trim().toUpperCase() : undefined;
    const searchNeedle = q?.trim().toLowerCase() || undefined;
    const cacheKey = k.list(inbox.company_id, inbox.id, normalizedStatus, searchNeedle, offset, limit);

    const cached = await rGet<{ items: ChatCacheItem[]; total: number }>(cacheKey);
    let payload: { items: ChatCacheItem[]; total: number };
    const lastMessageByChat = new Map<string, any>();

    if (cached) {
      payload = cached;
    } else {
      let chatQuery = supabaseAdmin
        .from("chats")
        .select(
          "id, created_at, status, last_message, last_message_at, last_message_from, last_message_type, last_message_media_url, inbox_id, customer_id, unread_count, assignee_agent",
          { count: "exact" },
        )
        .eq("inbox_id", inbox.id)
        .order("last_message_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (normalizedStatus && normalizedStatus !== "ALL") {
        chatQuery = chatQuery.eq("status", normalizedStatus);
      }

      const { data: chatRows, error, count } = await chatQuery;
      if (error) {
        console.error("[WAHA] list chats query failed:", error);
        return res.status(500).json({ ok: false, error: error.message });
      }

      const rows = (chatRows || []) as any[];
      const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter(Boolean)));

      const customersById: Record<string, { name: string | null; phone: string | null; avatar_url: string | null }> = {};
      if (customerIds.length > 0) {
        const { data: customerRows, error: customerErr } = await supabaseAdmin
          .from("customers")
          .select("id, name, phone, avatar_url")
          .in("id", customerIds);
        if (customerErr) {
          console.warn("[WAHA] customers lookup failed:", customerErr.message);
        } else {
          for (const row of (customerRows || []) as any[]) {
            customersById[row.id] = {
              name: row.name ?? null,
              phone: row.phone ?? null,
              avatar_url: row.avatar_url ?? null,
            };
          }
        }
      }

      const chatIds = rows.map((row) => row.id).filter((id: any) => typeof id === "string");
      if (chatIds.length > 0) {
        const { data: lastMsgs, error: lastErr } = await supabaseAdmin
          .from("chat_messages")
          .select("id, chat_id, external_id, content, type, view_status, created_at, media_url, is_from_customer")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: false });
        if (lastErr) {
          console.warn("[WAHA] last message lookup failed:", lastErr.message);
        } else {
          for (const row of (lastMsgs || []) as any[]) {
            const chatId = row.chat_id as string;
            if (!chatId || lastMessageByChat.has(chatId)) continue;
            lastMessageByChat.set(chatId, row);
          }
        }
      }

      const chatItems: ChatCacheItem[] = rows.map((row: any) => {
        const customer = row.customer_id ? customersById[row.customer_id] : undefined;
        const last = lastMessageByChat.get(row.id) || null;
        const inferredFrom = last ? (last.is_from_customer ? "CUSTOMER" : "AGENT") : (row.last_message_from ?? null);

        return {
          id: row.id,
          created_at: row.created_at,
          status: row.status ?? "OPEN",
          last_message: row.last_message ?? (last?.content ?? null),
          last_message_at: row.last_message_at ?? (last?.created_at ?? null),
          last_message_from: inferredFrom,
          last_message_type: row.last_message_type ?? (last?.type ?? null),
          last_message_media_url: row.last_message_media_url ?? (last?.media_url ?? null),
          last_message_id: last?.external_id || last?.id || null,
          last_message_view_status: last?.view_status ?? null,
          inbox_id: row.inbox_id ?? inbox.id,
          customer_id: row.customer_id ?? "",
          customer_name: customer?.name ?? null,
          customer_phone: customer?.phone ?? null,
          customer_avatar_url: customer?.avatar_url ?? null,
          unread_count: row.unread_count ?? null,
          assigned_agent_id: row.assignee_agent ?? null,
          assigned_agent_name: null,
          assigned_agent_user_id: null,
        };
      });

      let filteredItems = chatItems;
      if (searchNeedle) {
        filteredItems = chatItems.filter((item) => {
          const name = item.customer_name?.toLowerCase() ?? "";
          const phone = item.customer_phone ?? "";
          const lastMessage = item.last_message?.toLowerCase() ?? "";
          return (
            (name && name.includes(searchNeedle)) ||
            (phone && phone.includes(searchNeedle)) ||
            (lastMessage && lastMessage.includes(searchNeedle)) ||
            item.id.toLowerCase().includes(searchNeedle)
          );
        });
      }

      payload = {
        items: filteredItems,
        total: searchNeedle ? filteredItems.length : count ?? filteredItems.length,
      };

      await rSet(cacheKey, payload, TTL_LIST);
    }

    const wahaChats = payload.items.map((chat) => {
      const last = lastMessageByChat.get(chat.id);
      return mapChatCacheToWaha(chat, {
        session,
        remoteChatId: toWahaChatIdFromPhone(chat.customer_phone),
        lastMessage: last
          ? {
              id: last.id,
              external_id: last.external_id ?? null,
              content: last.content ?? null,
              created_at: last.created_at,
              type: last.type ?? null,
              view_status: last.view_status ?? null,
              media_url: last.media_url ?? null,
              is_from_customer: Boolean(last.is_from_customer),
            }
          : null,
      });
    });

    res.setHeader("X-Cache", cached ? "HIT" : "MISS");
    return res.json({
      ok: true,
      result: {
        session,
        total: payload.total,
        limit,
        offset,
        chats: wahaChats,
      },
    });
  };

  router.get("/chats", requireAuth, listWahaChats);
  router.get("/chats/overview", requireAuth, listWahaChats);

  router.get("/chats/:chatId", requireAuth, async (req: Request, res: Response) => {
    const session = typeof req.query.session === "string" ? req.query.session : "";
    if (!session) return res.status(400).json({ ok: false, error: "session obrigatoria" });

    const context = await resolveChatContext(session, req.params.chatId);
    if (!context) return res.status(404).json({ ok: false, error: "Chat nao encontrado para a sessao" });

    const cacheKey = k.chat(context.chat.id);
    const cachedChat = await rGet<ChatCacheItem>(cacheKey);
    let chatPayload: ChatCacheItem | null = cachedChat ?? null;
    let lastMessageRow: any | null = null;

    if (!chatPayload) {
      const { data: chatRow, error: chatErr } = await supabaseAdmin
        .from("chats")
        .select(
          "id, created_at, status, last_message, last_message_at, last_message_from, last_message_type, last_message_media_url, inbox_id, customer_id, unread_count, assignee_agent",
        )
        .eq("id", context.chat.id)
        .maybeSingle();
      if (chatErr || !chatRow) return res.status(404).json({ ok: false, error: "Chat nao encontrado" });

      const { data: customerRow } = await supabaseAdmin
        .from("customers")
        .select("id, name, phone, avatar_url")
        .eq("id", chatRow.customer_id)
        .maybeSingle();

      const { data: lastRows } = await supabaseAdmin
        .from("chat_messages")
        .select("id, external_id, content, type, view_status, created_at, media_url, is_from_customer")
        .eq("chat_id", context.chat.id)
        .order("created_at", { ascending: false })
        .limit(1);

      lastMessageRow = lastRows?.[0] ?? null;

      chatPayload = {
        id: chatRow.id,
        created_at: chatRow.created_at,
        status: chatRow.status ?? "OPEN",
        last_message: chatRow.last_message ?? (lastMessageRow?.content ?? null),
        last_message_at: chatRow.last_message_at ?? (lastMessageRow?.created_at ?? null),
        last_message_from:
          chatRow.last_message_from ??
          (lastMessageRow ? (lastMessageRow.is_from_customer ? "CUSTOMER" : "AGENT") : null),
        last_message_type: chatRow.last_message_type ?? (lastMessageRow?.type ?? null),
        last_message_media_url: chatRow.last_message_media_url ?? (lastMessageRow?.media_url ?? null),
        last_message_id: lastMessageRow?.external_id || lastMessageRow?.id || null,
        last_message_view_status: lastMessageRow?.view_status ?? null,
        inbox_id: chatRow.inbox_id ?? context.inbox.id,
        customer_id: chatRow.customer_id ?? "",
        customer_name: customerRow?.name ?? context.customer?.name ?? null,
        customer_phone: customerRow?.phone ?? context.customer?.phone ?? null,
        customer_avatar_url: customerRow?.avatar_url ?? context.customer?.avatar_url ?? null,
        unread_count: chatRow.unread_count ?? null,
        assigned_agent_id: chatRow.assignee_agent ?? null,
        assigned_agent_name: null,
        assigned_agent_user_id: null,
      };

      await rSet(cacheKey, chatPayload, TTL_CHAT);
    }

    const remoteChatId =
      context.remoteChatId ??
      toWahaChatIdFromPhone(chatPayload?.customer_phone ?? null) ??
      chatPayload?.customer_phone ??
      context.chat.id;

    const wahaChat = mapChatCacheToWaha(chatPayload!, {
      session,
      remoteChatId,
      lastMessage: lastMessageRow
        ? {
            id: lastMessageRow.id,
            external_id: lastMessageRow.external_id ?? null,
            content: lastMessageRow.content ?? null,
            created_at: lastMessageRow.created_at,
            type: lastMessageRow.type ?? null,
            view_status: lastMessageRow.view_status ?? null,
            media_url: lastMessageRow.media_url ?? null,
            is_from_customer: Boolean(lastMessageRow.is_from_customer),
          }
        : null,
    });

    res.setHeader("X-Cache", cachedChat ? "HIT" : "MISS");
    return res.json({ ok: true, result: wahaChat });
  });

  const listWahaMessages = async (req: Request, res: Response) => {
    const source = { ...req.query, chatId: req.params.chatId ?? req.query.chatId };
    const parsed = ChatMessagesQuery.safeParse(source);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

    const { session, chatId, limit } = parsed.data;
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const actualLimit = ensureLimit(limit, DEFAULT_LIMIT);

    const context = await resolveChatContext(session, chatId);
    if (!context) return res.status(404).json({ ok: false, error: "Chat nao encontrado para a sessao" });

    const cacheKey = k.msgsKey(context.chat.id, before, actualLimit);
    const cached = await rGet<MessageCacheItem[]>(cacheKey);
    let messages: MessageCacheItem[];

    if (cached) {
      messages = cached;
    } else {
      let messageQuery = supabaseAdmin
        .from("chat_messages")
        .select(
          "id, chat_id, external_id, content, type, view_status, created_at, media_url, is_from_customer, sender_id, quoted_message_id",
        )
        .eq("chat_id", context.chat.id)
        .order("created_at", { ascending: false })
        .limit(actualLimit);

      if (before) {
        messageQuery = messageQuery.lt("created_at", before);
      }

      const { data: rows, error } = await messageQuery;
      if (error) {
        console.error("[WAHA] list messages query failed:", error);
        return res.status(500).json({ ok: false, error: error.message });
      }

      const messageRows = (rows || []) as any[];
      const messageIds = messageRows.map((row) => row.id).filter((id: any) => typeof id === "string");

      const attachmentsByMessage: Record<string, AttachmentInfo[]> = {};
      if (messageIds.length > 0) {
        const { data: attachmentRows, error: attErr } = await supabaseAdmin
          .from("chat_attachments")
          .select("id, message_id, public_url, mime_type, filename, provider")
          .in("message_id", messageIds);
        if (attErr) {
          console.warn("[WAHA] attachments lookup failed:", attErr.message);
        } else {
          for (const row of (attachmentRows || []) as any[]) {
            const msgId = row.message_id as string;
            if (!attachmentsByMessage[msgId]) attachmentsByMessage[msgId] = [];
            attachmentsByMessage[msgId].push({
              id: row.id,
              message_id: msgId,
              public_url: row.public_url ?? null,
              mime_type: row.mime_type ?? null,
              filename: row.filename ?? null,
              provider: row.provider ?? null,
            });
          }
        }
      }

      const normalizedMessages: MessageCacheItem[] = messageRows.map((row: any) => {
        const attachments = attachmentsByMessage[row.id] ?? [];
        const isFromCustomer = Boolean(row.is_from_customer);
        return {
          id: row.id,
          external_id: row.external_id ?? null,
          chat_id: row.chat_id,
          body: row.content ?? null,
          content: row.content ?? null,
          sender_type: isFromCustomer ? "CUSTOMER" : "AGENT",
          sender_id: row.sender_id ?? null,
          created_at: row.created_at,
          view_status: row.view_status ?? null,
          type: row.type ?? null,
          media_url: row.media_url ?? attachments[0]?.public_url ?? null,
          attachments,
          quoted_message_id: row.quoted_message_id ?? null,
        };
      });

      messages = normalizedMessages.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      await rSet(cacheKey, messages, TTL_MSGS);
    }

    const hasMore = messages.length >= actualLimit;
    const nextBefore = hasMore ? messages[0].created_at : "";

    res.setHeader("X-Next-Before", hasMore ? nextBefore : "");
    res.setHeader("X-Cache", cached ? "HIT" : "MISS");

    const remoteChatId =
      context.remoteChatId ??
      toWahaChatIdFromPhone(context.customer?.phone ?? null) ??
      context.chat.id;

    const wahaMessages = messages.map((msg) => mapMessageCacheToWaha(msg, remoteChatId));

    return res.json({
      ok: true,
      result: {
        session,
        chatId: remoteChatId,
        internalChatId: context.chat.id,
        messages: wahaMessages,
        limit: actualLimit,
        before: hasMore ? nextBefore : null,
      },
    });
  };

  router.get("/chats/:chatId/messages", requireAuth, listWahaMessages);

  router.get("/chats/:chatId/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
    const session = typeof req.query.session === "string" ? req.query.session : "";
    if (!session) return res.status(400).json({ ok: false, error: "session obrigatoria" });

    const { chatId, messageId } = req.params;
    const context = await resolveChatContext(session, chatId);
    if (!context) return res.status(404).json({ ok: false, error: "Chat nao encontrado para a sessao" });

    const filterColumn = UUID_RE.test(messageId) ? "id" : "external_id";
    const { data: row, error } = await supabaseAdmin
      .from("chat_messages")
      .select(
        "id, chat_id, external_id, content, type, view_status, created_at, media_url, is_from_customer, sender_id, quoted_message_id",
      )
      .eq("chat_id", context.chat.id)
      .eq(filterColumn, messageId)
      .maybeSingle();

    if (error) {
      console.error("[WAHA] single message lookup failed:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }
    if (!row) return res.status(404).json({ ok: false, error: "Mensagem nao encontrada" });

    const { data: attachmentRows, error: attErr } = await supabaseAdmin
      .from("chat_attachments")
      .select("id, message_id, public_url, mime_type, filename, provider")
      .eq("message_id", row.id);
    if (attErr) {
      console.warn("[WAHA] attachments lookup failed:", attErr.message);
    }

    const attachments = (attachmentRows || []).map((att: any) => ({
      id: att.id,
      message_id: att.message_id,
      public_url: att.public_url ?? null,
      mime_type: att.mime_type ?? null,
      filename: att.filename ?? null,
      provider: att.provider ?? null,
    }));

    const message: MessageCacheItem = {
      id: row.id,
      external_id: row.external_id ?? null,
      chat_id: row.chat_id,
      body: row.content ?? null,
      content: row.content ?? null,
      sender_type: row.is_from_customer ? "CUSTOMER" : "AGENT",
      sender_id: row.sender_id ?? null,
      created_at: row.created_at,
      view_status: row.view_status ?? null,
      type: row.type ?? null,
      media_url: row.media_url ?? attachments[0]?.public_url ?? null,
      attachments,
      quoted_message_id: row.quoted_message_id ?? null,
    };

    const remoteChatId =
      context.remoteChatId ??
      toWahaChatIdFromPhone(context.customer?.phone ?? null) ??
      context.chat.id;

    const wahaMessage = mapMessageCacheToWaha(message, remoteChatId);

    return res.json({
      ok: true,
      result: {
        session,
        chatId: remoteChatId,
        internalChatId: context.chat.id,
        message: wahaMessage,
      },
    });
  });

  // -------- SUAS ROTAS QUE ENFILEIRAM (mantidas) --------
  router.post("/sendText", requireAuth, async (req: Request, res: Response) => {
    // mesma lógica de antes (rascunho + publish). Mantive para compat com seu fluxo.
    const body = z.object({
      inboxId: z.string().min(1),
      chatId: z.string().optional(),
      to: z.string().min(6),
      content: z.string().min(1),
      quotedMessageId: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });

    const { inboxId, chatId, to, content, quotedMessageId } = body.data;
    const companyId = String((req as any).user?.company_id || "");
    if (!companyId) return res.status(400).json({ error: "companyId ausente" });

    try {
      const creds = await getDecryptedCredsForInbox(inboxId);
      if (!creds || creds.provider !== WAHA_PROVIDER) {
        return res.status(400).json({ error: "Inbox não é WAHA ou não encontrada." });
      }

      const draft = await persistDraftMessage({
        companyId, chatId: chatId ?? null, inboxId, to,
        kind: "text", content, quotedMessageId: quotedMessageId ?? null, fromUserId: (req as any).user?.id,
      });
      const draftId = draft?.id ?? randomUUID();

      const payload: Record<string, unknown> = {
        to,
        type: "text",
        content,
        quotedMessageId: quotedMessageId ?? null,
      };
      payload.draftId = draftId;

      await publish(EX_APP, "outbound.request", {
        jobType: "outbound.request",
        provider: WAHA_PROVIDER,
        companyId,
        inboxId,
        chatId: chatId ?? null,
        payload,
      });

      await invalidateCompanyChatLists(companyId);
      res.json({ ok: true, draftId });
    } catch (e) {
      console.error("[WAHA] /sendText failed:", e);
      res.status(500).json({ error: "Falha ao enfileirar envio de mensagem WAHA." });
    }
  });

  router.post("/sendMedia", requireAuth, async (req: Request, res: Response) => {
    const body = z.object({
      inboxId: z.string().min(1),
      chatId: z.string().optional(),
      to: z.string().min(6),
      mediaUrl: z.string().url(),
      caption: z.string().optional(),
      kind: z.enum(["image","audio","video","document"]).default("image"),
      filename: z.string().optional(),
      mimeType: z.string().optional(),
      quotedMessageId: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });

    const { inboxId, chatId, to, mediaUrl, caption, kind, filename, mimeType, quotedMessageId } = body.data;
    const companyId = String((req as any).user?.company_id || "");
    if (!companyId) return res.status(400).json({ error: "companyId ausente" });

    try {
      const creds = await getDecryptedCredsForInbox(inboxId);
      if (!creds || creds.provider !== WAHA_PROVIDER) {
        return res.status(400).json({ error: "Inbox não é WAHA ou não encontrada." });
      }

      const draft = await persistDraftMessage({
        companyId, chatId: chatId ?? null, inboxId, to,
        kind: kind === "image" ? "image" : kind === "audio" ? "audio" : kind === "video" ? "video" : "document",
        mediaUrl, caption: caption ?? null, quotedMessageId: quotedMessageId ?? null, fromUserId: (req as any).user?.id,
      });
      const draftId = draft?.id ?? randomUUID();

      await publish(EX_APP, "outbound.request", {
        jobType: "outbound.request",
        provider: WAHA_PROVIDER,
        companyId, inboxId, chatId: chatId ?? null,
        payload: {
          to, type: "media", kind, mediaUrl,
          caption: caption ?? null, filename: filename ?? null, mimeType: mimeType ?? null,
          quotedMessageId: quotedMessageId ?? null, draftId,
        },
      });

      await invalidateCompanyChatLists(companyId);
      res.json({ ok: true, draftId });
    } catch (e) {
      console.error("[WAHA] /sendMedia failed:", e);
      res.status(500).json({ error: "Falha ao enfileirar envio de mídia WAHA." });
    }
  });

  // -------- Webhook (mesmo de antes) --------
  router.post("/webhook", async (req: Request, res: Response) => {
    try {
      if (!isValidWebhookAuth(req)) return res.status(401).json({ error: "Unauthorized" });

      const envelope = req.body as any;
      const eventType = String(envelope?.event || envelope?.type || "").toLowerCase();
      const sessionName = String(envelope?.session || req.query.session || "").trim();

      const inbox = sessionName ? await loadWahaInboxBySession(sessionName) : null;
      if (!inbox) {
        console.warn("[WAHA webhook] inbox not resolved", { session: sessionName, event: eventType });
        return res.status(202).json({ ok: true });
      }

      const job = {
        provider: WAHA_PROVIDER,
        inboxId: inbox.id,
        companyId: inbox.company_id,
        event: eventType,
        session: sessionName || null,
        payload: envelope?.payload ?? envelope,
        raw: envelope,
        receivedAt: new Date().toISOString(),
      };

      await publishMeta("inbound.message", job);

      res.json({ ok: true });
    } catch (e) {
      console.error("[WAHA] /webhook failed:", e);
      res.status(500).json({ error: "Webhook handling error" });
    }
  });

  app.use("/waha", router);
  console.log("[WAHA] routes registered at /waha");
}







