// backend/src/worker.ts
import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { encryptMediaUrl, decryptMediaUrl } from "../src/lib/crypto.ts";
import {
  publish,
  publishApp,
  getQueueInfo,
  consume,
  EX_DLX,
  Q_INBOUND,
  Q_OUTBOUND,
  Q_INBOUND_MEDIA,
  EX_APP,
} from "../src/queue/rabbit.ts";
import db from "../src/pg.ts";
import { normalizeMsisdn } from "../src/util.ts";
import {
  saveWebhookEvent,
  updateMessageStatusByExternalId,
  ensureLeadCustomerChat,
  ensureGroupChat,
  insertInboundMessage,
  getDecryptedCredsForInbox,
  getChatWithCustomerPhone,
  insertOutboundMessage,
  upsertChatMessage,
  touchChatAfterMessage,
  invalidateChatCaches,
  upsertChatRemoteParticipant,
  findChatIdByRemoteId,
  markChatRemoteParticipantLeft,
  findChatMessageIdByExternalId,
} from "../src/services/meta/store.ts";
import { redis, rDel, rSet, k, rememberMessageCacheKey } from "../src/lib/redis.ts";
import { supabaseAdmin } from "./lib/supabase.ts";
import { WAHA_PROVIDER, wahaFetch, fetchWahaChatDetails } from "../src/services/waha/client.ts";
import { runAgentReply, getAgent as getRuntimeAgent } from "./services/agents.runtime.ts";
import { enqueueMessage as bufferEnqueue, getDue as bufferGetDue, clearDue as bufferClearDue, popBatch as bufferPopBatch, parseListKey as bufferParseListKey } from "./services/buffer.ts";

const TTL_AVATAR = Number(process.env.CACHE_TTL_AVATAR || 300);

function rememberAvatar(
  companyId: string | null | undefined,
  remoteId: string | null | undefined,
  url: string | null | undefined,
): void {
  if (!companyId) return;
  if (typeof remoteId !== "string" || !remoteId.trim()) return;
  if (typeof url !== "string" || !url.trim()) return;
  rSet(k.avatar(companyId, remoteId.trim()), url.trim(), TTL_AVATAR).catch((error) => {
    console.warn("[worker] avatar cache set failed", { companyId, remoteId, error });
  });
}

type MetaInboundPayload = {
  inboxId: string;
  companyId: string;
  provider: "META";
  value: any;
  receivedAt: string;
};
type WahaInboundPayload = {
  inboxId: string;
  companyId: string;
  provider: "WAHA";
  event: string;
  session?: string | null;
  payload: any;
  receivedAt: string;
  raw?: any;
  draftId?: string | null;
};
type InboundJobPayload = MetaInboundPayload | WahaInboundPayload;
type InboundMediaJobPayload = {
  provider: "META";
  inboxId: string;
  companyId: string;
  chatId: string;
  messageId: string;
  externalId?: string | null;
  media?: {
    type: string;
    mediaId: string;
    filename?: string | null;
  } | null;
};

const CACHE_TTL_MSGS = Math.max(30, Number(process.env.CACHE_TTL_MSGS ?? 60));
const PAGE_LIMIT_PREWARM = 20;
const MAX_ATTEMPTS = Number(process.env.JOB_MAX_ATTEMPTS || 3);
const SOCKET_RETRY_ATTEMPTS = 3;
const SOCKET_RETRY_BASE_DELAY = 5000; // 5s
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT_BACKEND || 5000}`;

/**
 * Converts an encrypted media URL token to a proxy URL
 * This allows the frontend to fetch media through our backend proxy
 */
function buildProxyUrl(encryptedToken: string | null | undefined): string | null {
  if (!encryptedToken) return null;
  
  // If already a full URL (not encrypted), return as-is
  if (encryptedToken.startsWith("http://") || encryptedToken.startsWith("https://")) {
    return encryptedToken;
  }
  
  return `${BACKEND_BASE_URL}/media/proxy?token=${encodeURIComponent(encryptedToken)}`;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Emit socket event with automatic retry and exponential backoff
 * @param event - Event name to publish
 * @param data - Event payload
 * @param maxAttempts - Maximum retry attempts (default: 3)
 * @returns true if succeeded, false if all retries failed
 */
async function emitSocketWithRetry(
  event: string,
  data: any,
  maxAttempts: number = SOCKET_RETRY_ATTEMPTS
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await publishApp(event, data);
      
      if (attempt > 1) {
        console.log(`[Socket] ✅ Success on attempt ${attempt}/${maxAttempts}:`, {
          event,
          chatId: data?.chatId,
          messageId: data?.message?.id
        });
      }
      
      return true;
    } catch (err) {
      const isLastAttempt = attempt === maxAttempts;
      
      console.warn(`[Socket] ⚠️ Attempt ${attempt}/${maxAttempts} failed:`, {
        event,
        chatId: data?.chatId,
        messageId: data?.message?.id,
        error: err instanceof Error ? err.message : String(err),
        willRetry: !isLastAttempt
      });
      
      if (!isLastAttempt) {
        // Exponential backoff: 5s, 10s, 20s
        const delay = SOCKET_RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
        console.log(`[Socket] ⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Final failure - log as metric
        console.error(`[Socket] ❌ METRIC: All ${maxAttempts} attempts failed:`, {
          event,
          chatId: data?.chatId,
          messageId: data?.message?.id,
          inboxId: data?.inboxId,
          totalRetryTime: `${(SOCKET_RETRY_BASE_DELAY * (Math.pow(2, maxAttempts) - 1)) / 1000}s`
        });
      }
    }
  }
  
  return false;
}

const INBOUND_WORKERS = parsePositiveInt(process.env.INBOUND_WORKERS, 1);
const INBOUND_PREFETCH = parsePositiveInt(process.env.INBOUND_PREFETCH, 1);
const INBOUND_MEDIA_WORKERS = parsePositiveInt(process.env.INBOUND_MEDIA_WORKERS, 1);
const INBOUND_MEDIA_PREFETCH = parsePositiveInt(process.env.INBOUND_MEDIA_PREFETCH, 2);
const OUTBOUND_WORKERS = parsePositiveInt(process.env.OUTBOUND_WORKERS, 2);
const OUTBOUND_PREFETCH = parsePositiveInt(process.env.OUTBOUND_PREFETCH, 5);

// === M??dia local / Graph ===
const MEDIA_DIR =
  process.env.MEDIA_DIR || path.resolve(process.cwd(), "media");
const MEDIA_PUBLIC_BASE =
  (process.env.MEDIA_PUBLIC_BASE || "").replace(/\/+$/, "");
const FILES_PUBLIC_BASE = (
  process.env.FILES_PUBLIC_BASE || "http://localhost:5000"
).replace(/\/+$/, "");
const META_GRAPH_VERSION = (process.env.META_GRAPH_VERSION || "v20.0").replace(
  /^v?/,
  "v",
);

let chatAttachmentsSupportsChatId = true;
let wahaGroupSyncRunning = false;

const METRICS_INTERVAL_MS = Number(process.env.METRICS_INTERVAL_MS || 30_000); // Ajuste via env se precisar.
const BUFFER_TICK_MS = Math.max(250, Number(process.env.BUFFER_TICK_MS || 1000));
const BUFFER_MAX_FLUSH_PER_TICK = Math.max(1, Number(process.env.BUFFER_MAX_FLUSH || 50));

const metrics = {
  inbound: { processed: 0 },
  inboundMedia: { processed: 0 },
  outbound: { processed: 0 },
};

function measureJob<T>(
  worker: "inbound" | "inboundMedia" | "outbound",
  meta: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  return fn()
    .then((result) => {
      metrics[worker].processed += 1;
      const durationMs = Number((performance.now() - started).toFixed(1));
      console.log("[metrics][worker]", {
        worker,
        durationMs,
        processed: metrics[worker].processed,
        ...meta,
      });
      return result;
    })
    .catch((error) => {
      const durationMs = Number((performance.now() - started).toFixed(1));
      console.error("[metrics][worker]", {
        worker,
        durationMs,
        ...meta,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    });
}

async function logQueueStats(): Promise<void> {
  const queues = [Q_INBOUND, Q_INBOUND_MEDIA, Q_OUTBOUND];
  for (const queue of queues) {
    try {
      const info = await getQueueInfo(queue);
      console.log("[metrics][queue]", {
        queue: info.queue,
        depth: info.messageCount,
        consumers: info.consumerCount,
      });
    } catch (error) {
      console.error("[metrics][queue]", {
        queue,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}

const queueMetricsInterval = setInterval(logQueueStats, METRICS_INTERVAL_MS);
queueMetricsInterval.unref?.();

const stopQueueMetricsInterval = (): void => {
  clearInterval(queueMetricsInterval);
};

process.once("beforeExit", stopQueueMetricsInterval);
process.once("exit", stopQueueMetricsInterval);

void logQueueStats();

// === Buffer scheduler ===
async function flushDueBuffers(): Promise<void> {
  try {
    const dueKeys = await bufferGetDue(new Date());
    if (!dueKeys || dueKeys.length === 0) return;
    const slice = dueKeys.slice(0, BUFFER_MAX_FLUSH_PER_TICK);
    for (const listKey of slice) {
      // Remove from due set first to avoid double work
      await bufferClearDue(listKey);
      const items = await bufferPopBatch(listKey);
      if (!items || items.length === 0) continue;
      const meta = bufferParseListKey(listKey);
      const last = items[items.length - 1];
      if (!meta || !last) continue;
      // Re-check chat status
      const statusRow = await db.oneOrNone<{ status: string | null }>(
        `select status from public.chats where id = $1`,
        [meta.chatId],
      );
      const chatStatus = (statusRow?.status || "").toUpperCase();
      if (chatStatus !== "AI") {
        // drop silently
        continue;
      }

      // Aggregate user messages into a single prompt
      const lines = items
        .map((it) => (typeof it.text === "string" ? it.text.trim() : ""))
        .filter((t) => t.length > 0);
      if (lines.length === 0) continue;

      const aggregated = lines.join("\n");
      try {
        const ai = await runAgentReply({
          companyId: last.companyId,
          inboxId: last.inboxId,
          userMessage: aggregated,
          chatHistory: [],
        });
        const reply = (ai.reply || "").trim();
        if (reply) {
          if (ai.agentId) {
            try {
              await db.none(
                `update public.chats set ai_agent_id = $2, updated_at = now() where id = $1`,
                [meta.chatId, ai.agentId],
              );
            } catch (err) {
              console.warn("[buffer][flush] failed to set ai_agent_id", err instanceof Error ? err.message : err);
            }
          }
          await publish(EX_APP, "outbound.request", {
            provider: last.provider,
            inboxId: last.inboxId,
            chatId: meta.chatId,
            payload: { content: reply },
            attempt: 0,
            kind: "message.send",
          });
        }
      } catch (err) {
        console.warn("[buffer][flush] agent reply failed", {
          companyId: last.companyId,
          chatId: meta.chatId,
          error: err instanceof Error ? err.message : err,
        });
      }
    }
  } catch (error) {
    console.warn("[buffer] flush tick failed", error instanceof Error ? error.message : error);
  }
}

const bufferInterval = setInterval(() => {
  void flushDueBuffers();
}, BUFFER_TICK_MS);
bufferInterval.unref?.();


async function fetchChatUpdateForSocket(chatId: string): Promise<{
  chatId: string;
  inboxId: string | null;
  status: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_from?: "CUSTOMER" | "AGENT" | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  kind?: string | null;
  group_name?: string | null;
  group_avatar_url?: string | null;
  remote_id?: string | null;
  ai_agent_id?: string | null;
  ai_agent_name?: string | null;
} | null> {
  const row = await db.oneOrNone<{
    chat_id: string;
    inbox_id: string | null;
    status: string | null;
    last_message: string | null;
    last_message_at: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_id: string | null;
    kind: string | null;
    group_name: string | null;
    group_avatar_url: string | null;
    remote_id: string | null;
    ai_agent_id: string | null;
    ai_agent_name: string | null;
  }>(
    `select ch.id as chat_id,
            ch.inbox_id,
            ch.status,
            ch.last_message,
            ch.last_message_at,
            ch.kind,
            ch.group_name,
            ch.group_avatar_url,
            ch.remote_id,
            ch.ai_agent_id,
            ag.name as ai_agent_name,
            cust.name as customer_name,
            cust.phone as customer_phone,
            cust.id as customer_id
       from public.chats ch
 left join public.customers cust on cust.id = ch.customer_id
 left join public.agents ag on ag.id = ch.ai_agent_id
      where ch.id = $1`,
    [chatId],
  );
  if (!row) return null;
  return {
    chatId: row.chat_id,
    inboxId: row.inbox_id,
    status: row.status,
    last_message: row.last_message,
    last_message_at: row.last_message_at,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_id: row.customer_id,
    kind: row.kind,
    group_name: row.group_name,
    group_avatar_url: row.group_avatar_url,
    remote_id: row.remote_id,
    ai_agent_id: row.ai_agent_id,
    ai_agent_name: row.ai_agent_name,
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
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
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "pptx",
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

type GraphCreds = { access_token: string; phone_number_id?: string };

async function enqueueInboundMediaJob(payload: InboundMediaJobPayload): Promise<void> {
  await publishApp("inbound.media", payload);
}

async function getMediaInfo(
  creds: GraphCreds,
  mediaId: string,
): Promise<{
  id: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
  url?: string;
}> {
  const u = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${mediaId}`);
  u.searchParams.set("access_token", creds.access_token);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`getMediaInfo ${res.status}: ${await res.text()}`);
  return (await res.json()) as any;
}
async function downloadMedia(
  creds: GraphCreds,
  url: string,
): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });
  if (!res.ok) throw new Error(`downloadMedia ${res.status}: ${await res.text()}`);
  return await res.arrayBuffer();
}

async function getWahaInboxConfig(inboxId: string): Promise<{ session: string; apiKey: string }> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  if ((creds.provider || "").toUpperCase() !== WAHA_PROVIDER) {
    throw new Error("Inbox nao eh WAHA");
  }

  const row = await db.oneOrNone<{ instance_id: string | null; phone_number_id: string | null }>(
    `select instance_id, phone_number_id from public.inboxes where id = $1`,
    [inboxId],
  );
  if (!row) throw new Error("Inbox WAHA nao encontrada");

  const session = String(row.instance_id || row.phone_number_id || creds.phone_number_id || "").trim();
  if (!session) {
    throw new Error("Inbox WAHA sem instance_id configurado");
  }

  const apiKey = String(creds.access_token || "").trim();
  if (!apiKey) {
    throw new Error("Inbox WAHA sem API key configurado");
  }

  return { session, apiKey };
}

function ensureWahaChatId(to?: string | null, fallbackPhone?: string | null): string | null {
  const candidate = typeof to === "string" ? to.trim() : "";
  if (candidate) {
    if (candidate.includes("@")) return candidate;
    const digits = normalizeMsisdn(candidate);
    if (digits) return `${digits}@c.us`;
  }
  if (fallbackPhone) {
    const digits = normalizeMsisdn(fallbackPhone);
    if (digits) return `${digits}@c.us`;
  }
  return null;
}

function extractWahaMessageId(response: any): string | null {
  if (!response) return null;
  if (typeof response === "string" && response.trim()) return response.trim();

  const candidates: Array<string | null | undefined> = [
    response.id,
    response.Id,
    response.ID,
    response.messageId,
    response.messageID,
    response.message_id,
    response?.result?.id,
    response?.data?.id,
    Array.isArray(response?.messages) ? response.messages[0]?.id : undefined,
  ];

  if (response?.message && typeof response.message === "object") {
    candidates.push(
      response.message.id,
      response.message.messageId,
      response.message.messageID,
    );
  }

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

async function warmChatMessagesCache(chatId: string, limit = PAGE_LIMIT_PREWARM): Promise<void> {
  try {
    const rows = await db.any<{
      id: string;
      chat_id: string;
      content: string | null;
      is_from_customer: boolean;
      sender_id: string | null;
      sender_name: string | null;
      sender_avatar_url: string | null;
      created_at: string;
      type: string | null;
      view_status: string | null;
      media_url: string | null;
      remote_participant_id: string | null;
      remote_sender_id: string | null;
      remote_sender_name: string | null;
      remote_sender_phone: string | null;
      remote_sender_avatar_url: string | null;
      remote_sender_is_admin: boolean | null;
      replied_message_id: string | null;
    }>(
      `select id,
              chat_id,
              content,
              is_from_customer,
              sender_id,
              sender_name,
              sender_avatar_url,
              created_at,
              type,
              view_status,
              media_url,
              remote_participant_id,
              remote_sender_id,
              remote_sender_name,
              remote_sender_phone,
              remote_sender_avatar_url,
              remote_sender_is_admin,
              replied_message_id
         from public.chat_messages
        where chat_id = $1
        order by created_at desc
        limit $2`,
      [chatId, limit],
    );

    const mappedAsc = rows
      .slice()
      .reverse()
      .map((row) => ({
        id: row.id,
        chat_id: row.chat_id,
        body: row.content,
        sender_type: row.is_from_customer ? "CUSTOMER" : "AGENT",
        sender_id: row.sender_id,
        sender_name: row.sender_name,
  sender_avatar_url: row.sender_avatar_url ?? null,
        created_at: row.created_at,
        view_status: row.view_status,
        type: row.type ?? "TEXT",
        is_private: false,
        media_url: row.media_url ?? null,
        remote_participant_id: row.remote_participant_id ?? null,
        remote_sender_id: row.remote_sender_id ?? null,
        remote_sender_name: row.remote_sender_name ?? null,
        remote_sender_phone: row.remote_sender_phone ?? null,
        remote_sender_avatar_url: row.remote_sender_avatar_url ?? null,
        remote_sender_is_admin: row.remote_sender_is_admin ?? null,
        replied_message_id: row.replied_message_id ?? null,
      }));

    const hasMore = rows.length === limit;
    const nextBefore = hasMore && mappedAsc.length > 0 ? mappedAsc[0].created_at : "";
    const payload = {
      items: mappedAsc,
      nextBefore,
      hasMore,
    };

    const cacheKey = k.msgsKey(chatId, undefined, limit);
    const envelope = {
      data: payload,
      meta: {
        etag: createHash("sha1").update(JSON.stringify(payload)).digest("base64url"),
        lastModified: mappedAsc.length > 0 ? mappedAsc[mappedAsc.length - 1].created_at : new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      },
    };

    await rSet(cacheKey, envelope, CACHE_TTL_MSGS);
    await rememberMessageCacheKey(chatId, cacheKey, CACHE_TTL_MSGS);
  } catch (err) {
    console.warn("[worker][cache] warmChatMessagesCache failed", {
      chatId,
      error: err instanceof Error ? err.message : err,
    });
  }
}

async function graphUploadMedia(
  creds: { access_token: string; phone_number_id: string },
  absPath: string,
  mime: string,
  filename: string,
): Promise<string> {
  const fd = new FormData();
  const data = await fs.readFile(absPath);
  const arrayBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mime });
  fd.append("file", blob, filename);
  fd.append("messaging_product", "whatsapp");

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${creds.phone_number_id}/media`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.access_token}` },
    body: fd,
  });
  if (!res.ok) {
    throw new Error(`graphUploadMedia ${res.status}: ${await res.text()}`);
  }
  const payload = (await res.json()) as any;
  const mediaId = payload?.id;
  if (!mediaId) {
    throw new Error("graphUploadMedia missing media id");
  }
  return mediaId;
}

async function graphSendMedia(
  creds: { access_token: string; phone_number_id: string },
  to: string,
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT",
  mediaId: string,
  caption?: string | null,
  filename?: string | null,
): Promise<string | undefined> {
  const payload: any = {
    messaging_product: "whatsapp",
    to,
    type: kind.toLowerCase(),
  };

  if (kind === "DOCUMENT") {
    payload.document = {
      id: mediaId,
      caption: caption ?? undefined,
      filename: filename ?? undefined,
    };
  } else if (kind === "IMAGE") {
    payload.image = { id: mediaId, caption: caption ?? undefined };
  } else if (kind === "VIDEO") {
    payload.video = { id: mediaId, caption: caption ?? undefined };
  } else if (kind === "AUDIO") {
    payload.audio = { id: mediaId };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${creds.phone_number_id}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`graphSendMedia ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as any;
  return json?.messages?.[0]?.id || null;
}

function getPushName(value: any): string | null {
  return (
    value?.contacts?.[0]?.profile?.name ??
    value?.contacts?.[0]?.name ??
    null
  );
}

function extractContentAndType(m: any): { content: string; type: string } {
  const t = String(m?.type || "text").toLowerCase();

  switch (t) {
    case "text":
      return { content: String(m?.text?.body ?? ""), type: "TEXT" };
    case "image":
      return {
        content: m?.image?.caption ? `[IMAGE] ${m.image.caption}` : "[IMAGE]",
        type: "IMAGE",
      };
    case "audio":
      return { content: "[AUDIO]", type: "AUDIO" };
    case "video":
      return {
        content: m?.video?.caption ? `[VIDEO] ${m.video.caption}` : "[VIDEO]",
        type: "VIDEO",
      };
    case "document":
      return {
        content: m?.document?.filename
          ? `[DOCUMENT] ${m.document.filename}`
          : "[DOCUMENT]",
        type: "DOCUMENT",
      };
    case "sticker":
      return { content: "[STICKER]", type: "STICKER" };
    case "location":
      return {
        content: `[LOCATION] ${m?.location?.latitude},${m?.location?.longitude}`,
        type: "LOCATION",
      };
    case "contacts":
      return { content: "[CONTACTS]", type: "CONTACTS" };
    default:
      return { content: `[${t.toUpperCase()}]`, type: t.toUpperCase() };
  }
}

function mapMetaStatusToViewStatus(status: string): string {
  const key = (status || "").toLowerCase();
  if (key === "read") return "read";
  if (key === "delivered") return "Received";
  if (key === "sent") return "Sent";
  return "Pending";
}

function normalizeWahaJid(jid?: string | null): string | null {
  if (!jid) return null;
  return String(jid).replace("@s.whatsapp.net", "@c.us");
}

function extractWahaChatId(payload: any): string | null {
  const primary = payload?.fromMe ? payload?.to : payload?.from;
  const normalized = normalizeWahaJid(primary);
  if (normalized) return normalized;
  const messageId = typeof payload?.id === "string" ? payload.id : "";
  const parts = messageId.split("_");
  if (parts.length >= 3) {
    return normalizeWahaJid(parts[1]);
  }
  return null;
}

function isWahaStatusBroadcast(jid: string | null | undefined): boolean {
  if (!jid) return false;
  const normalized = jid.toLowerCase();
  return normalized === "status@broadcast" || normalized.endsWith(":status@broadcast");
}

function extractWahaContactName(payload: any): string | null {
  return (
    payload?.pushName ||
    payload?.senderName ||
    payload?._data?.notifyName ||
    payload?.notifyName ||
    null
  );
}

function mapWahaAckToViewStatus(ack: unknown): string | null {
  const numeric =
    typeof ack === "number"
      ? ack
      : typeof ack === "string"
        ? Number.parseInt(ack, 10)
        : Number.NaN;
  if (Number.isNaN(numeric)) return null;
  switch (numeric) {
    case 0:
      return "Pending";
    case 1:
      return "Sent";
    case 2:
      return "Received";
    case 3:
    case 4:
    case 5:
      return "read";
    default:
      return null;
  }
}

function deriveWahaMessageType(payload: any): string {
  const mime = payload?.media?.mimetype;
  if (typeof mime === "string") {
    if (mime.startsWith("image/")) return "IMAGE";
    if (mime.startsWith("video/")) return "VIDEO";
    if (mime.startsWith("audio/")) return "AUDIO";
    if (mime.includes("application/pdf") || mime.includes("application/")) return "DOCUMENT";
  }
  const hinted = String(payload?.type || "").toUpperCase();
  if (hinted) return hinted;
  return payload?.hasMedia ? "DOCUMENT" : "TEXT";
}

function isWahaGroupJid(jid?: string | null): boolean {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

function extractWahaGroupMetadata(payload: any): { name: string | null; avatarUrl: string | null } {
  const chat = payload?.chat || payload?._data?.chat || {};
  const name =
    payload?.chatName ||
    payload?.groupSubject ||
    chat?.name ||
    chat?.subject ||
    payload?.notifyName ||
    payload?.senderName ||
    null;
  const avatar =
    chat?.imgUrl ||
    chat?.img ||
    payload?.chatPicUrl ||
    payload?.groupPictureUrl ||
    payload?.groupPic ||
    null;
  return { name: name ?? null, avatarUrl: avatar ?? null };
}

function extractWahaRemoteParticipant(payload: any): {
  remoteId: string | null;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isAdmin: boolean | null;
} {
  const raw =
    payload?.author ||
    payload?.participant ||
    payload?.key?.participant ||
    payload?.id?.participant ||
    payload?.from ||
    null;
  const normalized = normalizeWahaJid(raw);
  const digits = normalized ? normalizeMsisdn(normalized) : null;
  const participantInfo =
    payload?.participant ||
    payload?.chat?.participants?.find((p: any) => normalizeWahaJid(p?.id) === normalized) ||
    null;
  const avatar =
    participantInfo?.imgUrl ||
    participantInfo?.img ||
    payload?.participantProfilePic ||
    payload?.authorAvatar ||
    null;
  const isAdmin =
    typeof participantInfo?.isAdmin === "boolean"
      ? participantInfo.isAdmin
      : typeof payload?.isParticipantAdmin === "boolean"
        ? payload.isParticipantAdmin
        : typeof payload?.participantIsAdmin === "boolean"
          ? payload.participantIsAdmin
          : null;

  const name =
    payload?.senderName ||
    payload?.authorName ||
    participantInfo?.name ||
    participantInfo?.notifyName ||
    payload?.pushName ||
    null;

  return {
    remoteId: normalized,
    name: name ?? null,
    phone: digits || null,
    avatarUrl: avatar ?? null,
    isAdmin,
  };
}

function extractWahaQuotedMessageId(payload: any): string | null {
  if (typeof payload?.quotedMsgId === "string") return payload.quotedMsgId;
  if (payload?.quotedMessage && typeof payload.quotedMessage.id === "string") {
    return payload.quotedMessage.id;
  }
  if (payload?.contextInfo && typeof payload.contextInfo.stanzaId === "string") {
    return payload.contextInfo.stanzaId;
  }
  return null;
}

function buildMetaContactsIndex(value: any): Map<string, any> {
  const map = new Map<string, any>();
  if (Array.isArray(value?.contacts)) {
    for (const contact of value.contacts) {
      const waId = typeof contact?.wa_id === "string" ? contact.wa_id : null;
      if (waId) map.set(waId, contact);
    }
  }
  return map;
}

function metaContactName(contact: any): string | null {
  if (!contact) return null;
  return (
    contact?.profile?.name ??
    contact?.name ??
    contact?.profile?.first_name ??
    contact?.pushname ??
    null
  );
}

function metaContactAvatar(contact: any): string | null {
  if (!contact) return null;
  return (
    contact?.profile?.profile_pic ??
    contact?.profile?.profile_picture_url ??
    contact?.profile_pic ??
    contact?.profile_pic_url ??
    contact?.avatar ??
    null
  );
}

function extractMetaMessageContext(
  value: any,
  message: any,
): {
  groupId: string | null;
  groupName: string | null;
  groupAvatarUrl: string | null;
  participantId: string | null;
  participantName: string | null;
  participantAvatarUrl: string | null;
  contactsIndex: Map<string, any>;
} {
  const contactsIndex = buildMetaContactsIndex(value);

  const candidateGroupIds = [
    message?.group_id,
    message?.groupId,
    message?.context?.group_id,
    message?.context?.group?.id,
    message?.context?.id,
    message?.from,
    message?.to,
  ];

  let groupId: string | null = null;
  for (const candidate of candidateGroupIds) {
    if (typeof candidate === "string" && candidate.endsWith("@g.us")) {
      groupId = candidate;
      break;
    }
  }

  if (!groupId) {
    for (const key of contactsIndex.keys()) {
      if (key.endsWith("@g.us")) {
        groupId = key;
        break;
      }
    }
  }

  const participantId =
    (typeof message?.author === "string" && message.author) ||
    (typeof message?.participant === "string" && message.participant) ||
    (groupId ? (typeof message?.from === "string" && !message.from.endsWith("@g.us") ? message.from : null) : message?.from) ||
    null;

  const groupContact = groupId ? contactsIndex.get(groupId) : undefined;
  const participantContact = participantId ? contactsIndex.get(participantId) : undefined;

  const groupName =
    metaContactName(groupContact) ??
    message?.group_name ??
    message?.context?.group?.name ??
    null;
  const groupAvatarUrl = metaContactAvatar(groupContact) ?? null;

  const participantName = metaContactName(participantContact) ?? null;
  const participantAvatarUrl = metaContactAvatar(participantContact) ?? null;

  return {
    groupId,
    groupName,
    groupAvatarUrl,
    participantId,
    participantName,
    participantAvatarUrl,
    contactsIndex,
  };
}

async function upsertWahaAttachment(args: {
  messageId: string;
  chatId: string;
  inboxId: string;
  companyId: string;
  url: string;
  mimeType?: string | null;
  filename?: string | null;
}) {
  if (!chatAttachmentsSupportsChatId) return;
  try {
    await db.none(
      `insert into public.chat_attachments
         (message_id, chat_id, inbox_id, provider, storage_bucket, storage_key, public_url, mime_type, filename, bytes)
       values ($1, $2, $3, 'WAHA', null, null, $4, $5, $6, null)
       on conflict (message_id) do update
         set public_url = excluded.public_url,
             mime_type  = coalesce(excluded.mime_type,  public.chat_attachments.mime_type),
             filename   = coalesce(excluded.filename,   public.chat_attachments.filename),
             updated_at = now()`,
      [args.messageId, args.chatId, args.inboxId, args.url, args.mimeType ?? null, args.filename ?? null],
    );
  } catch (error) {
    const code = (error as any)?.code;
    if (code === "42703") {
      chatAttachmentsSupportsChatId = false;
      console.warn("[WAHA][attachments] chat_attachments schema missing chat metadata. Skipping WAHA attachments from now on.");
    } else {
      console.warn("[WAHA][attachments] failed to upsert attachment", {
        messageId: args.messageId,
        error,
      });
    }
  }
}

async function handleInboundChange(job: InboundJobPayload) {
  if (job.provider === "WAHA") {
    await handleWahaInbound(job);
    return;
  }

  const { inboxId, companyId, value } = job;
  const pushname = getPushName(value);

  if (Array.isArray(value?.statuses)) {
    for (const s of value.statuses) {
      const wamid = String(s?.id || "");
      const status = String(s?.status || "");
      if (!wamid || !status) continue;

      const eventUid = `statuses:${wamid}:${status}`;
      const isNew = await saveWebhookEvent(inboxId, "META", eventUid, value);
      if (!isNew) continue;

      const mappedStatus = mapMetaStatusToViewStatus(status);
      const statusUpdate = await updateMessageStatusByExternalId({
        inboxId,
        externalId: wamid,
        viewStatus: mappedStatus,
      });
      if (statusUpdate) {
        try {
          const normalizedStatus =
            typeof statusUpdate.viewStatus === "string"
              ? statusUpdate.viewStatus.toUpperCase()
              : null;
          await publishApp("socket.livechat.status", {
            kind: "livechat.message.status",
            chatId: statusUpdate.chatId,
            messageId: statusUpdate.messageId,
            externalId: wamid,
            view_status: statusUpdate.viewStatus,
            raw_status: status,
            status: normalizedStatus,
            draftId: null,
            reason: null,
          });
        } catch (err) {
          console.warn(
            "[inbound] failed to publish status event:",
            (err as any)?.message || err,
          );
        }
      }
    }
  }

  if (Array.isArray(value?.messages)) {
    for (const m of value.messages) {
      const wamid = String(m?.id || "");
      if (!wamid) continue;

      const eventUid = `messages:${wamid}`;
      const isNew = await saveWebhookEvent(inboxId, "META", eventUid, value);
      if (!isNew) continue;

      const metaContext = extractMetaMessageContext(value, m);
      const isGroupMessage = typeof metaContext.groupId === "string" && metaContext.groupId.endsWith("@g.us");
      const participantWaId =
        (typeof m?.from === "string" && m.from) ||
        metaContext.participantId ||
        null;
      const remotePhone = participantWaId ? normalizeMsisdn(participantWaId) : null;

      if (!remotePhone && !isGroupMessage) {
        console.warn("[inbound] message without valid 'from'", m);
        continue;
      }

      let chatId: string;
      if (isGroupMessage && metaContext.groupId) {
        const ensured = await ensureGroupChat({
          inboxId,
          companyId,
          remoteId: metaContext.groupId,
          groupName: metaContext.groupName ?? null,
          groupAvatarUrl: metaContext.groupAvatarUrl ?? null,
        });
        chatId = ensured.chatId;
      } else {
        const ensured = await ensureLeadCustomerChat({
          inboxId,
          companyId,
          phone: remotePhone || normalizeMsisdn(participantWaId || ""),
          name: metaContext.participantName ?? pushname ?? remotePhone ?? participantWaId ?? null,
          rawPhone: participantWaId || metaContext.participantId || remotePhone || null,
        });
        chatId = ensured.chatId;
      }

      const { content, type } = extractContentAndType(m);
      const createdAt =
        typeof m?.timestamp === "number"
          ? new Date(m.timestamp * 1000)
          : m?.timestamp
            ? new Date(m.timestamp)
            : null;

      let remoteParticipantId: string | null = null;
      if (isGroupMessage && metaContext.participantId) {
        const participant = await upsertChatRemoteParticipant({
          chatId,
          remoteId: metaContext.participantId,
          name: metaContext.participantName ?? pushname ?? null,
          phone: remotePhone ?? null,
          avatarUrl: metaContext.participantAvatarUrl ?? null,
          joinedAt: createdAt ?? undefined,
        });
        remoteParticipantId = participant?.id ?? null;
      }

      const quotedExternalId =
        typeof m?.context?.id === "string"
          ? m.context.id
          : typeof m?.context?.quoted_message_id === "string"
            ? m.context.quoted_message_id
            : null;
      const repliedMessageId =
        quotedExternalId && chatId
          ? await findChatMessageIdByExternalId(chatId, quotedExternalId)
          : null;

      const inserted = await insertInboundMessage({
        chatId,
        externalId: wamid,
        content,
        type,
        remoteParticipantId,
        remoteSenderId: metaContext.participantId ?? participantWaId ?? null,
        remoteSenderName: metaContext.participantName ?? pushname ?? null,
        remoteSenderPhone: remotePhone ?? null,
        remoteSenderAvatarUrl: metaContext.participantAvatarUrl ?? null,
        remoteSenderIsAdmin: null,
        repliedMessageId,
        createdAt,
      });
      if (!inserted) {
        continue;
      }

      const msgType = String(m?.type || "").toLowerCase();
      const mediaRoot = ["document", "image", "audio", "video", "sticker"].includes(msgType)
        ? (m as any)?.[msgType] ?? null
        : null;
      const mediaId =
        mediaRoot && typeof mediaRoot?.id === "string" && mediaRoot.id.trim() ? mediaRoot.id.trim() : null;
      const mediaFilename =
        mediaRoot && typeof mediaRoot?.filename === "string" && mediaRoot.filename.trim()
          ? mediaRoot.filename.trim()
          : null;

      await enqueueInboundMediaJob({
        provider: "META",
        inboxId,
        companyId,
        chatId,
        messageId: inserted.id,
        externalId: wamid,
        media: mediaId
          ? {
              type: msgType,
              mediaId,
              filename: mediaFilename,
            }
          : null,
      });


          // ====== Auto-reply / Buffer (Agents) — META inbound (only if chat status == 'AI') ======
          try {
            const bodyText = typeof content === "string" ? content.trim() : "";
            if (!bodyText) {
              // do nothing
            } else {
              const row = await db.oneOrNone<{ status: string | null }>(
                `select status from public.chats where id = $1`,
                [chatId],
              );
              const chatStatus = (row?.status || "").toUpperCase();
              if (chatStatus === "AI") {
                // Check agent aggregation config
                const agent = await getRuntimeAgent(companyId, null);
                const windowSec = Number(agent?.aggregation_window_sec || 0);
                const enabled = Boolean(agent?.aggregation_enabled) && windowSec > 0;
                const maxBatch = agent?.max_batch_messages ?? null;
                if (enabled) {
                  await bufferEnqueue({
                    companyId,
                    inboxId,
                    chatId,
                    provider: "META",
                    text: bodyText,
                    config: { windowSec, maxBatch },
                  });
                } else {
                  const ai = await runAgentReply({
                    companyId,
                    inboxId,
                    userMessage: bodyText,
                    chatHistory: [],
                  });
                  const reply = (ai.reply || "").trim();
                  if (reply) {
                    if (ai.agentId) {
                      try {
                        await db.none(
                          `update public.chats set ai_agent_id = $2, updated_at = now() where id = $1`,
                          [chatId, ai.agentId],
                        );
                      } catch (err) {
                        console.warn("[agents] failed to set ai_agent_id", err instanceof Error ? err.message : err);
                      }
                    }
                    await publish(EX_APP, "outbound.request", {
                      provider: "META",
                      inboxId,
                      chatId,
                      payload: { content: reply },
                      attempt: 0,
                      kind: "message.send",
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.warn("[agents][auto-reply][META] failed:", (e as any)?.message || e);
          }
      const msgRow = await db.one<{
        id: string;
        chat_id: string;
        content: string | null;
        is_from_customer: boolean;
        sender_id: string | null;
        sender_name: string | null;
        sender_avatar_url: string | null;
        created_at: string;
        type: string | null;
        view_status: string | null;
        media_url: string | null;
        remote_participant_id: string | null;
        remote_sender_id: string | null;
        remote_sender_name: string | null;
        remote_sender_phone: string | null;
        remote_sender_avatar_url: string | null;
        remote_sender_is_admin: boolean | null;
        replied_message_id: string | null;
      }>(
        `select id,
                chat_id,
                content,
                is_from_customer,
                sender_id,
                sender_name,
                sender_avatar_url,
                created_at,
                type,
                view_status,
                media_url,
                remote_participant_id,
                remote_sender_id,
                remote_sender_name,
                remote_sender_phone,
                remote_sender_avatar_url,
                remote_sender_is_admin,
                replied_message_id
           from public.chat_messages where id = $1`,
        [inserted.id],
      );

      const mappedMessage = {
        id: msgRow.id,
        chat_id: msgRow.chat_id,
        body: msgRow.content,
        sender_type: msgRow.is_from_customer ? ("CUSTOMER" as const) : ("AGENT" as const),
        sender_id: msgRow.sender_id,
        sender_name: msgRow.sender_name,
  sender_avatar_url: msgRow.sender_avatar_url ?? null,
        created_at: msgRow.created_at,
        view_status: msgRow.view_status,
        type: msgRow.type ?? "TEXT",
        is_private: false,
        media_url: buildProxyUrl(msgRow.media_url) ?? null,
        remote_participant_id: msgRow.remote_participant_id ?? null,
        remote_sender_id: msgRow.remote_sender_id ?? null,
        remote_sender_name: msgRow.remote_sender_name ?? null,
        remote_sender_phone: msgRow.remote_sender_phone ?? null,
        remote_sender_avatar_url: msgRow.remote_sender_avatar_url ?? null,
        remote_sender_is_admin: msgRow.remote_sender_is_admin ?? null,
        replied_message_id: msgRow.replied_message_id ?? null,
      };

      let inboxIdForSocket: string | null = null;
      try {
        const chatRow = await db.oneOrNone<{ inbox_id: string | null }>(
          `select inbox_id from public.chats where id = $1`,
          [chatId],
        );
        inboxIdForSocket = chatRow?.inbox_id ?? null;
      } catch (e) {
        console.warn(
          "[inbound] failed to load chat inbox for socket broadcast:",
          (e as any)?.message || e,
        );
      }

      try {
        const chatSummary = await fetchChatUpdateForSocket(chatId);
        const socketSuccess = await emitSocketWithRetry("socket.livechat.inbound", {
          kind: "livechat.inbound.message",
          chatId,
          inboxId: inboxIdForSocket,
          message: mappedMessage,
          chatUpdate: chatSummary
            ? {
                ...chatSummary,
                last_message_from: mappedMessage.sender_type,
              }
            : {
                chatId,
                inboxId: inboxIdForSocket,
                last_message: mappedMessage.body,
                last_message_at: mappedMessage.created_at,
                last_message_from: mappedMessage.sender_type,
                customer_name: isGroupMessage ? null : metaContext.participantName ?? pushname ?? null,
                customer_phone: isGroupMessage ? null : remotePhone ?? null,
                kind: isGroupMessage ? "GROUP" : null,
                group_name: isGroupMessage ? metaContext.groupName ?? null : null,
                group_avatar_url: isGroupMessage ? metaContext.groupAvatarUrl ?? null : null,
                remote_id: isGroupMessage ? metaContext.groupId ?? null : participantWaId ?? null,
              },
        });

        if (!socketSuccess) {
          console.error("[worker][META] METRIC: Socket emission failed after all retries:", {
            operation: 'inbound',
            messageId: mappedMessage.id,
            chatId,
            inboxId: inboxIdForSocket,
            provider: 'META'
          });
        }
      } catch (e) {
        console.warn(
          "[inbound] failed to publish socket event:",
          (e as any)?.message || e,
        );
      }

      try {
        await db.none(
          `update public.chats
             set last_message = $1,
                 last_message_at = now()
           where id = $2`,
          [content, chatId],
        );
      } catch (e) {
        console.warn(
          "[inbound] failed to update chat last_message:",
          (e as any)?.message || e,
        );
      }

      setTimeout(() => {
        warmChatMessagesCache(chatId).catch((error) => {
          console.warn("[inbound] warm cache failed", {
            chatId,
            error: error instanceof Error ? error.message : error,
          });
        });
      }, 0);

      try {
        await rDel(k.chat(chatId));
      } catch {}

      // Cache de listas e pre-aquecimento ficam para o job assincrono.
      // O socket ja recebeu o evento acima.
    }
  }
}

async function handleInboundMediaJob(job: InboundMediaJobPayload): Promise<void> {
  if (job.provider !== "META") {
    console.warn("[inbound.media] unsupported provider", job.provider);
    return;
  }

  const { inboxId, companyId, chatId, messageId, externalId } = job;
  const companyKey = typeof companyId === "string" && companyId.trim() ? companyId.trim() : "";

  if (job.media && job.media.mediaId) {
    const mediaId = job.media.mediaId;
    try {
      const creds = await getDecryptedCredsForInbox(inboxId);
      const graphCreds: GraphCreds = {
        access_token: creds.access_token,
        phone_number_id: creds.phone_number_id ?? undefined,
      };
      const info = await getMediaInfo(graphCreds, mediaId);
      if (!info?.url) throw new Error("Meta n??o retornou URL da m??dia");

      const bin = await downloadMedia(graphCreds, info.url);
      const buf = Buffer.from(bin);

      const ymd = new Date().toISOString().slice(0, 10);
      const safeBase = job.media.filename
        ? sanitizeFilename(job.media.filename)
        : `${mediaId}.${extFromMime(info.mime_type) || "bin"}`;
      const ownerSegment = companyKey || "unknown";
      const keyBase = (externalId && externalId.trim()) || messageId;
      const relativeKey = `${ownerSegment}/${chatId}/${ymd}/${keyBase}-${safeBase}`;
      const absFilePath = path.join(MEDIA_DIR, relativeKey);

      await ensureDir(path.dirname(absFilePath));
      await fs.writeFile(absFilePath, buf);

      const publicUrl = MEDIA_PUBLIC_BASE
        ? `${MEDIA_PUBLIC_BASE}/${relativeKey}`
        : `${FILES_PUBLIC_BASE}/files/${messageId}`;

      await db.none(
        `insert into public.chat_attachments
            (message_id, provider, provider_media_id, kind, mime_type, filename, bytes, sha256, storage_bucket, storage_key, public_url)
         values ($1,'META',$2,$3,$4,$5,$6,$7,'local',$8,$9)`,
        [
          messageId,
          mediaId,
          String(job.media.type || "").toUpperCase(),
          info.mime_type ?? null,
          job.media.filename ?? null,
          buf.length,
          info.sha256 ?? null,
          relativeKey,
          publicUrl,
        ],
      );

      // Encrypt the public URL before storing in database
      const encryptedUrl = encryptMediaUrl(publicUrl);

      await db.none(
        `update public.chat_messages set media_url = $2 where id = $1`,
        [messageId, encryptedUrl],
      );
    } catch (err) {
      console.error("[inbound.media] media handling error:", (err as any)?.message || err);
      throw err;
    }
  }

  if (chatId) {
    try {
      await invalidateChatCaches(chatId, {
        companyId: job.companyId,
        inboxId,
      });
    } catch (err) {
      console.warn("[inbound.media] cache invalidate failure:", (err as any)?.message || err);
    }

    try {
      await warmChatMessagesCache(chatId);
    } catch (err) {
      console.warn("[inbound.media] cache prewarm error:", (err as any)?.message || err);
    }
  }
}

async function handleWahaInbound(job: WahaInboundPayload) {
  const eventKey = (job.event || "").toLowerCase();
  const payload = job.payload ?? {};
  try {
    switch (eventKey) {
      case "message":
      case "message.any":
        await handleWahaMessage(job, payload);
        break;
      case "participants.update":
      case "group.participants":
      case "group.participants.update":
      case "group.participants.add":
      case "group.participants.remove":
      case "group.participants.left":
      case "group.participants.leave":
      case "group.participants.promote":
      case "group.participants.demote":
      case "chat.participant.add":
      case "chat.participant.remove":
      case "chat.participant.join":
      case "chat.participant.leave":
      case "chat.participants.update":
        await handleWahaParticipantEvent(job, payload);
        break;
      case "message.ack":
        await handleWahaAck(job, payload);
        break;
      case "message.revoked":
        console.log("[WAHA][worker] message.revoked received", { inboxId: job.inboxId, messageId: payload?.id });
        await handleWahaAck(job, { ...payload, ack: -1 });
        break;
      case "message.reaction":
        console.log("[WAHA][worker] message.reaction received", {
          inboxId: job.inboxId,
          messageId: payload?.reaction?.messageId,
          reaction: payload?.reaction?.text,
        });
        break;
      default:
        console.log("[WAHA][worker] unhandled event", { event: job.event, inboxId: job.inboxId });
    }
  } catch (error) {
    console.error("[WAHA][worker] failed to process event", {
      event: job.event,
      inboxId: job.inboxId,
      error,
    });
  }
}

async function handleWahaMessage(job: WahaInboundPayload, payload: any) {
  const messageId = String(payload?.id || "");
  if (messageId) {
    try {
      await saveWebhookEvent(job.inboxId, "WAHA", `waha:message:${messageId}`, job.raw ?? payload);
    } catch (error) {
      console.warn("[WAHA][worker] saveWebhookEvent failed", { inboxId: job.inboxId, messageId, error });
    }
  }

  const chatJid = extractWahaChatId(payload);
  if (!chatJid) {
    console.warn("[WAHA][worker] message without chat id", { payload });
    return;
  }
  if (isWahaStatusBroadcast(chatJid) || isWahaStatusBroadcast(payload?.from) || isWahaStatusBroadcast(payload?.to)) {
    console.debug("[WAHA][worker] skipping status broadcast message", {
      inboxId: job.inboxId,
      chatJid,
      messageId,
    });
    return;
  }

  const name = extractWahaContactName(payload);
  const basePhone =
    normalizeMsisdn(chatJid) ||
    normalizeMsisdn(payload?.from) ||
    normalizeMsisdn(payload?.to);
  const isGroupChat = isWahaGroupJid(chatJid);

  let chatId: string;
  let phoneForLead = basePhone && basePhone.trim() ? basePhone : chatJid;

  let groupMeta: { name: string | null; avatarUrl: string | null } | null = null;

  if (isGroupChat) {
    groupMeta = extractWahaGroupMetadata(payload);
    rememberAvatar(job.companyId, chatJid, groupMeta?.avatarUrl ?? null);
    const ensured = await ensureGroupChat({
      inboxId: job.inboxId,
      companyId: job.companyId,
      remoteId: chatJid,
      groupName: groupMeta?.name ?? name ?? chatJid,
      groupAvatarUrl: groupMeta?.avatarUrl ?? null,
    });
    chatId = ensured.chatId;
  } else {
    const ensured = await ensureLeadCustomerChat({
      inboxId: job.inboxId,
      companyId: job.companyId,
      phone: phoneForLead,
      name: name ?? phoneForLead,
      rawPhone: chatJid,
    });
    chatId = ensured.chatId;
  }

  const isFromCustomer = !payload?.fromMe;
  const ackStatus = mapWahaAckToViewStatus(payload?.ack) ?? (isFromCustomer ? "Pending" : "Sent");
  const mediaUrl = payload?.hasMedia ? payload?.media?.url ?? null : null;
  
  // Encrypt media URL before storing in database
  const encryptedMediaUrl = encryptMediaUrl(mediaUrl);
  
  const messageType = deriveWahaMessageType(payload);
  const body =
    typeof payload?.body === "string" && payload.body.trim()
      ? payload.body
      : mediaUrl
        ? `[${messageType}]`
        : "";
  const createdAt =
    typeof payload?.timestamp === "number"
      ? new Date(payload.timestamp * 1000)
      : payload?.timestamp
        ? new Date(payload.timestamp)
        : null;

  let remoteMeta:
    | {
        remoteId: string | null;
        name: string | null;
        phone: string | null;
        avatarUrl: string | null;
        isAdmin: boolean | null;
      }
    | null = null;

  if (isFromCustomer) {
    if (isGroupChat) {
      remoteMeta = extractWahaRemoteParticipant(payload);
    } else {
      const directRemoteId = normalizeWahaJid(payload?.from) || chatJid;
      remoteMeta = {
        remoteId: directRemoteId,
        name: name ?? null,
        phone: normalizeMsisdn(directRemoteId ?? "") || phoneForLead || null,
        avatarUrl:
          payload?.senderProfilePic ||
          payload?.authorAvatar ||
          payload?.contactAvatar ||
          null,
        isAdmin: null,
      };
      rememberAvatar(job.companyId, directRemoteId, remoteMeta.avatarUrl ?? null);
    }
  }

  let remoteParticipantId: string | null = null;
  if (isGroupChat && remoteMeta?.remoteId && isFromCustomer) {
    rememberAvatar(job.companyId, remoteMeta.remoteId, remoteMeta.avatarUrl ?? null);
    const participant = await upsertChatRemoteParticipant({
      chatId,
      remoteId: remoteMeta.remoteId,
      name: remoteMeta.name ?? null,
      phone: remoteMeta.phone ?? null,
      avatarUrl: remoteMeta.avatarUrl ?? null,
      isAdmin: remoteMeta.isAdmin ?? null,
      joinedAt: createdAt ?? undefined,
    });
    remoteParticipantId = participant?.id ?? null;
  }

  const quotedExternalId = extractWahaQuotedMessageId(payload);
  const repliedMessageId =
    quotedExternalId && chatId
      ? await findChatMessageIdByExternalId(chatId, quotedExternalId)
      : null;

  const upsertResult = await upsertChatMessage({
    chatId,
    externalId: messageId || `${chatId}:${Date.now()}`,
    isFromCustomer,
    content: body,
    type: messageType,
    viewStatus: ackStatus ?? null,
    mediaUrl: encryptedMediaUrl, // Store encrypted URL
    createdAt,
    remoteParticipantId,
    remoteSenderId: remoteMeta?.remoteId ?? null,
    remoteSenderName: remoteMeta
      ? remoteMeta.name ?? (isGroupChat ? remoteMeta.phone ?? null : name ?? phoneForLead ?? null)
      : null,
    remoteSenderPhone: remoteMeta
      ? remoteMeta.phone ?? (isGroupChat ? null : phoneForLead ?? null)
      : null,
    remoteSenderAvatarUrl: remoteMeta?.avatarUrl ?? null,
    remoteSenderIsAdmin: remoteMeta?.isAdmin ?? null,
    repliedMessageId,
  });

  if (!upsertResult) return;

  await touchChatAfterMessage({
    chatId,
    content: body,
    lastMessageFrom: isFromCustomer ? "CUSTOMER" : "AGENT",
    lastMessageType: upsertResult.message.type ?? messageType ?? "TEXT",
    lastMessageMediaUrl: upsertResult.message.media_url ?? mediaUrl ?? null,
    listContext: {
      companyId: job.companyId,
      inboxId: job.inboxId,
      kind: isGroupChat ? "GROUP" : "DIRECT",
      chatType: isGroupChat ? "GROUP" : "CONTACT",
      remoteId: isGroupChat ? chatJid : normalizeWahaJid(chatJid),
    },
  });

  if (mediaUrl) {
    await upsertWahaAttachment({
      messageId: upsertResult.message.id,
      chatId,
      inboxId: job.inboxId,
      companyId: job.companyId,
      url: mediaUrl,
      mimeType: payload?.media?.mimetype ?? null,
      filename: payload?.media?.filename ?? null,
    });
  }

  if (!upsertResult.inserted) {
    if (ackStatus && !isFromCustomer) {
      const normalizedStatus = typeof ackStatus === "string" ? ackStatus.toUpperCase() : null;
      await publishApp("socket.livechat.status", {
        kind: "livechat.message.status",
        chatId,
        messageId: upsertResult.message.id,
        externalId: messageId,
        view_status: ackStatus,
        raw_status: ackStatus,
        status: normalizedStatus,
        draftId: job?.draftId ?? payload?.draftId ?? null,
        reason: null,
      });
    }
    return;
  }

  const mappedMessage = {
    id: upsertResult.message.id,
    chat_id: chatId,
    body,
    sender_type: isFromCustomer ? ("CUSTOMER" as const) : ("AGENT" as const),
    sender_id: upsertResult.message.sender_id ?? null,
    created_at: upsertResult.message.created_at,
    view_status: upsertResult.message.view_status ?? ackStatus ?? "Pending",
    type: upsertResult.message.type ?? messageType,
    is_private: false,
    media_url: buildProxyUrl(upsertResult.message.media_url) ?? buildProxyUrl(encryptedMediaUrl) ?? null,
    remote_sender_id: upsertResult.message.remote_sender_id ?? null,
    remote_sender_name: upsertResult.message.remote_sender_name ?? null,
    remote_sender_phone: upsertResult.message.remote_sender_phone ?? null,
    remote_sender_avatar_url: upsertResult.message.remote_sender_avatar_url ?? null,
    remote_sender_is_admin: upsertResult.message.remote_sender_is_admin ?? null,
    remote_participant_id: upsertResult.message.remote_participant_id ?? null,
    replied_message_id: upsertResult.message.replied_message_id ?? null,
    client_draft_id: job?.draftId ?? payload?.draftId ?? null,
  };

  try {
    const chatSummary = await fetchChatUpdateForSocket(chatId);
    const socketSuccess = await emitSocketWithRetry("socket.livechat.inbound", {
      kind: "livechat.inbound.message",
      chatId,
      inboxId: job.inboxId,
      message: mappedMessage,
      chatUpdate: chatSummary
        ? {
            ...chatSummary,
            last_message_from: mappedMessage.sender_type,
          }
        : {
            chatId,
            inboxId: job.inboxId,
            last_message: mappedMessage.body,
            last_message_at: mappedMessage.created_at,
            last_message_from: mappedMessage.sender_type,
            customer_name: isGroupChat ? null : name ?? null,
            customer_phone: isGroupChat ? null : phoneForLead ?? null,
            kind: isGroupChat ? "GROUP" : null,
            group_name: isGroupChat ? groupMeta?.name ?? name ?? chatJid : null,
            group_avatar_url: isGroupChat ? groupMeta?.avatarUrl ?? null : null,
            remote_id: isGroupChat ? chatJid : normalizeWahaJid(chatJid),
          },
    });

    if (!socketSuccess) {
      console.error("[worker][WAHA] METRIC: Socket emission failed after all retries:", {
        operation: 'inbound',
        messageId: mappedMessage.id,
        chatId,
        inboxId: job.inboxId,
        provider: 'WAHA',
        hasDraft: !!job?.draftId
      });
    }
  } catch (error) {
    console.warn("[WAHA][worker] failed to publish socket inbound message", error);
  }

  if (ackStatus && !isFromCustomer) {
    const normalizedStatus = typeof ackStatus === "string" ? ackStatus.toUpperCase() : null;
    await publishApp("socket.livechat.status", {
      kind: "livechat.message.status",
      chatId,
      messageId: mappedMessage.id,
      externalId: messageId,
      view_status: ackStatus,
      raw_status: ackStatus,
      status: normalizedStatus,
      draftId: job?.draftId ?? payload?.draftId ?? null,
      reason: null,
    });
  }

  try {
    await invalidateChatCaches(chatId, {
      companyId: job.companyId,
      inboxId: job.inboxId,
      kind: isGroupChat ? "GROUP" : "DIRECT",
      chatType: isGroupChat ? "GROUP" : "CONTACT",
      remoteId: isGroupChat ? chatJid : normalizeWahaJid(chatJid),
    });
  } catch (error) {
    console.warn("[WAHA][worker] failed to invalidate caches after inbound", {
      chatId,
      error,
    });
  }

  // ====== Auto-reply / Buffer (Agents) — WAHA inbound (from customer only, and chat status == 'AI') ======
  try {
    if (isFromCustomer && body && body.trim()) {
      const row = await db.oneOrNone<{ status: string | null }>(
        `select status from public.chats where id = $1`,
        [chatId],
      );
      const chatStatus = (row?.status || "").toUpperCase();
      if (chatStatus === "AI") {
        const agent = await getRuntimeAgent(job.companyId, null);
        const windowSec = Number(agent?.aggregation_window_sec || 0);
        const enabled = Boolean(agent?.aggregation_enabled) && windowSec > 0;
        const maxBatch = agent?.max_batch_messages ?? null;
        if (enabled) {
          await bufferEnqueue({
            companyId: job.companyId,
            inboxId: job.inboxId,
            chatId,
            provider: WAHA_PROVIDER,
            text: body,
            config: { windowSec, maxBatch },
          });
        } else {
          const ai = await runAgentReply({
            companyId: job.companyId,
            inboxId: job.inboxId,
            userMessage: body,
            chatHistory: [],
          });
          const reply = (ai.reply || "").trim();
          if (reply) {
            if (ai.agentId) {
              try {
                await db.none(
                  `update public.chats set ai_agent_id = $2, updated_at = now() where id = $1`,
                  [chatId, ai.agentId],
                );
              } catch (err) {
                console.warn("[agents] failed to set ai_agent_id", err instanceof Error ? err.message : err);
              }
            }
            await publish(EX_APP, "outbound.request", {
              provider: WAHA_PROVIDER,
              inboxId: job.inboxId,
              chatId,
              payload: { content: reply },
              attempt: 0,
              kind: "message.send",
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn("[agents][auto-reply][WAHA] failed:", (e as any)?.message || e);
  }
}

async function handleWahaParticipantEvent(job: WahaInboundPayload, payload: any) {
  const rawGroup =
    payload?.id ||
    payload?.chatId ||
    payload?.jid ||
    payload?.groupId ||
    payload?.group?.id ||
    payload?.chat?.id ||
    null;
  const groupJid = normalizeWahaJid(rawGroup);
  if (!groupJid || !isWahaGroupJid(groupJid)) {
    return;
  }

  const groupMeta = extractWahaGroupMetadata(payload);
  const ensured = await ensureGroupChat({
    inboxId: job.inboxId,
    companyId: job.companyId,
    remoteId: groupJid,
    groupName: groupMeta.name ?? null,
    groupAvatarUrl: groupMeta.avatarUrl ?? null,
  });
  const chatId = ensured.chatId;

  const participantSources: any[] = [];
  const push = (value: any) => {
    if (Array.isArray(value)) {
      for (const item of value) participantSources.push(item);
    } else if (value) {
      participantSources.push(value);
    }
  };

  push(payload?.participants);
  push(payload?.participantIds);
  push(payload?.participant_id);
  push(payload?.participant);
  push(payload?.user);
  push(payload?.users);

  const participants = participantSources
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return item.id || item.jid || item.user || item.number || item;
      }
      return null;
    })
    .map((value) => normalizeWahaJid(value))
    .filter(Boolean) as string[];

  if (!participants.length) {
    return;
  }

  const infoMap = new Map<
    string,
    {
      name?: string | null;
      avatarUrl?: string | null;
      isAdmin?: boolean | null;
    }
  >();

  const collectInfo = (source: any) => {
    if (!Array.isArray(source)) return;
    for (const entry of source) {
      const normalized = normalizeWahaJid(entry?.id || entry?.jid || entry?.user || entry);
      if (!normalized) continue;
      infoMap.set(normalized, {
        name:
          entry?.name ||
          entry?.notifyName ||
          entry?.pushName ||
          entry?.displayName ||
          null,
        avatarUrl: entry?.imgUrl || entry?.img || entry?.avatarUrl || entry?.profilePicUrl || null,
        isAdmin:
          typeof entry?.isAdmin === "boolean"
            ? entry.isAdmin
            : typeof entry?.admin === "boolean"
              ? entry.admin
              : undefined,
      });
    }
  };

  collectInfo(payload?.participantsInfo);
  collectInfo(payload?.participants_details);
  collectInfo(payload?.participantsData);
  collectInfo(payload?.participants_metadata);

  const admins = Array.isArray(payload?.admins)
    ? (payload.admins as any[]).map((adm) => normalizeWahaJid(adm)).filter(Boolean)
    : [];

  const action = String(
    payload?.action ||
      payload?.type ||
      payload?.event ||
      payload?.status ||
      payload?.change ||
      "",
  ).toLowerCase();

  const timestampIso =
    typeof payload?.timestamp === "number"
      ? new Date(payload.timestamp * 1000).toISOString()
      : payload?.timestamp
        ? new Date(payload.timestamp).toISOString()
        : null;

  for (const remoteId of participants) {
    const info = infoMap.get(remoteId) || {};
    const normalizedAdmin =
      typeof info.isAdmin === "boolean"
        ? info.isAdmin
        : admins.includes(remoteId)
          ? true
          : null;

    if (
      action.includes("remove") ||
      action.includes("leave") ||
      action.includes("left") ||
      action.includes("kick") ||
      action.includes("delete")
    ) {
      await markChatRemoteParticipantLeft({
        chatId,
        remoteId,
        leftAt: timestampIso ?? undefined,
      }).catch((error) => {
        console.warn("[WAHA][worker] markChatRemoteParticipantLeft failed", {
          chatId,
          remoteId,
          error,
        });
      });
    } else {
      await upsertChatRemoteParticipant({
        chatId,
        remoteId,
        name: info.name ?? null,
        phone: normalizeMsisdn(remoteId),
        avatarUrl: info.avatarUrl ?? null,
        isAdmin: normalizedAdmin,
        joinedAt: timestampIso ?? undefined,
      }).catch((error) => {
        console.warn("[WAHA][worker] upsertChatRemoteParticipant (event) failed", {
          chatId,
          remoteId,
          error,
        });
      });
    }
  }
}

async function handleWahaAck(job: WahaInboundPayload, payload: any) {
  const messageId = String(payload?.id || payload?.messageId || "");
  if (!messageId) return;
  const chatCandidate =
    normalizeWahaJid(payload?.chatId) ||
    normalizeWahaJid(payload?.from) ||
    normalizeWahaJid(payload?.to) ||
    null;
  if (isWahaStatusBroadcast(chatCandidate)) {
    console.debug("[WAHA][worker] skipping status broadcast ack", {
      inboxId: job.inboxId,
      messageId,
    });
    return;
  }
  const status = mapWahaAckToViewStatus(payload?.ack);
  if (!status) return;
  const statusUpdate = await updateMessageStatusByExternalId({
    inboxId: job.inboxId,
    externalId: messageId,
    viewStatus: status,
  });
  if (statusUpdate) {
    const normalizedStatus =
      typeof statusUpdate.viewStatus === "string" ? statusUpdate.viewStatus.toUpperCase() : null;
    await publishApp("socket.livechat.status", {
      kind: "livechat.message.status",
      chatId: statusUpdate.chatId,
      messageId: statusUpdate.messageId,
      externalId: messageId,
      view_status: statusUpdate.viewStatus,
      raw_status: status,
      status: normalizedStatus,
      draftId: job?.draftId ?? payload?.draftId ?? null,
      reason: null,
    });
  }
}

export async function handleWahaOutboundRequest(job: any): Promise<void> {
  const inboxId = String(job?.inboxId || "");
  if (!inboxId) throw new Error("WAHA outbound sem inboxId");

  const payload = job?.payload ?? {};
  const internalChatId = job?.chatId
    ? String(job.chatId)
    : payload?.chatId
      ? String(payload.chatId)
      : null;

  const toCandidate = payload?.chatId ?? payload?.to ?? null;
  let remoteChatId = ensureWahaChatId(typeof toCandidate === "string" ? toCandidate : null);

  if (!remoteChatId && internalChatId) {
    try {
      const chatInfo = await getChatWithCustomerPhone(internalChatId);
      remoteChatId = ensureWahaChatId(null, chatInfo.customer_phone);
    } catch (error) {
      console.warn("[worker][WAHA] nao foi possivel resolver o chatId remoto", {
        chatId: internalChatId,
        error,
      });
    }
  }

  if (!remoteChatId) {
    throw new Error("WAHA outbound sem chatId/to valido");
  }

  const { session, apiKey } = await getWahaInboxConfig(inboxId);
  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  };

  const messageType = String(payload?.type || "text").toLowerCase();
  let response: any;

  if (messageType === "media") {
    const kind = String(payload?.kind || "document").toLowerCase();
    if (!payload?.mediaUrl) {
      throw new Error("WAHA media requer mediaUrl");
    }

    const endpoint =
      kind === "image"
        ? "/api/sendImage"
        : kind === "video"
          ? "/api/sendVideo"
          : kind === "audio"
            ? "/api/sendVoice"
            : "/api/sendFile";

    const body: any = {
      session,
      chatId: remoteChatId,
      caption: payload?.caption ?? undefined,
      quotedMessageId: payload?.quotedMessageId ?? undefined,
      file: {
        url: payload.mediaUrl,
        filename: payload?.filename ?? undefined,
        mimetype: payload?.mimeType ?? undefined,
      },
    };

    response = await wahaFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } else {
    const content = String(payload?.content || "").trim();
    if (!content) throw new Error("WAHA text requer content");

    const body: any = {
      session,
      chatId: remoteChatId,
      text: content,
    };
    if (Array.isArray(payload?.mentions) && payload.mentions.length > 0) {
      body.mentions = payload.mentions;
    }
    if (payload?.quotedMessageId) {
      body.quotedMessageId = payload.quotedMessageId;
    }

    response = await wahaFetch("/api/sendText", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  const externalId = extractWahaMessageId(response);
  const contentForChat =
    messageType === "media"
      ? payload?.caption || `[${String(payload?.kind || "MEDIA").toUpperCase()}]`
      : String(payload?.content || "");

  let messageRow: any | null = null;
  let messageOperation: "insert" | "update" | null = null;
  if (internalChatId) {
    // Resolve sender identity metadata (name/avatar) for human agents
    let wSenderName: string | null = null;
    let wSenderAvatarUrl: string | null = null;
    try {
      // FIRST: Check if this is a human agent message (senderId provided)
      if (job?.senderId || job?.senderUserSupabaseId) {
        // If senderId provided, it's the local users.id; query by id
        // If senderUserSupabaseId provided, it's auth user.id; query by user_id
        const userId = job.senderId || job.senderUserSupabaseId;
        const lookupColumn = job.senderId ? 'id' : 'user_id';
        const userRow = await db.oneOrNone<{ id: string; name: string | null; email: string | null; avatar: string | null }>(
          `select id, name, email, avatar from public.users where ${lookupColumn} = $1`,
          [userId],
        );
        if (userRow) {
          wSenderName = userRow.name || userRow.email || null;
          wSenderAvatarUrl = userRow.avatar || null;
          // Ensure we use local ID for persistence
          if (!job.senderId) {
            job.senderId = userRow.id;
          }
        }
      } else {
        // FALLBACK: If no senderId, check if it's an AI agent message
        const chatRow = await db.oneOrNone<{ ai_agent_id: string | null }>(
          `select ai_agent_id from public.chats where id = $1`,
          [internalChatId],
        );
        if (chatRow?.ai_agent_id) {
          const agentRow = await db.oneOrNone<{ name: string | null }>(
            `select name from public.agents where id = $1`,
            [chatRow.ai_agent_id],
          );
          wSenderName = agentRow?.name ?? null;
        }
      }
    } catch (e) {
      console.warn("[worker][WAHA] failed to resolve sender identity", e instanceof Error ? e.message : e);
    }

    console.log("[worker][WAHA] insertOutboundMessage params:", {
      messageId: payload?.draftId || job?.messageId || null,
      senderId: job?.senderId,
      senderName: wSenderName,
      senderAvatarUrl: wSenderAvatarUrl,
    });

    const upsert = await insertOutboundMessage({
      chatId: internalChatId,
      inboxId,
      customerId: String(job?.customerId || ""),
      externalId: externalId ?? null,
      content: contentForChat,
      type:
        messageType === "media"
          ? String(payload?.kind || "DOCUMENT").toUpperCase()
          : "TEXT",
      senderId: job?.senderId || job?.senderUserSupabaseId || null,
      senderName: wSenderName ?? null,
      senderAvatarUrl: wSenderAvatarUrl ?? null,
      messageId: payload?.draftId || job?.messageId || null,
      viewStatus: externalId ? "Sent" : "Pending",
    });

    console.log("[worker][WAHA] insertOutboundMessage result:", {
      operation: upsert?.operation,
      messageId: upsert?.message?.id,
      sender_id: upsert?.message?.sender_id,
      sender_name: upsert?.message?.sender_name,
      sender_avatar_url: upsert?.message?.sender_avatar_url,
    });
    messageRow = upsert?.message ?? null;
    messageOperation = upsert?.operation ?? null;

    if (messageRow && messageType === "media" && payload?.mediaUrl) {
      await db.none(
        `update public.chat_messages
            set media_url = $2,
                updated_at = now()
          where id = $1`,
        [messageRow.id, payload.mediaUrl],
      );
      messageRow.media_url = payload.mediaUrl;
    }

    if (messageRow) {
      try {
        await touchChatAfterMessage({
          chatId: messageRow.chat_id,
          content: messageRow.content,
          lastMessageFrom: "AGENT",
          lastMessageType: messageRow.type ?? (messageType === "media" ? "DOCUMENT" : "TEXT"),
          lastMessageMediaUrl: messageRow.media_url ?? payload?.mediaUrl ?? null,
          listContext: {
            companyId: job.companyId,
            inboxId,
          },
        });
      } catch (error) {
        console.warn("[worker][WAHA] touchChatAfterMessage failed", {
          chatId: messageRow.chat_id,
          error,
        });
      }
    } else if (!messageRow && internalChatId) {
      try {
        await touchChatAfterMessage({
          chatId: internalChatId,
          content: contentForChat,
          lastMessageFrom: "AGENT",
          lastMessageType:
            messageType === "media"
              ? String(payload?.kind || "DOCUMENT").toUpperCase()
              : "TEXT",
          lastMessageMediaUrl: payload?.mediaUrl ?? null,
          listContext: {
            companyId: job.companyId,
            inboxId,
          },
        });
      } catch (error) {
        console.warn("[worker][WAHA] touchChatAfterMessage failed (no message row)", {
          chatId: internalChatId,
          error,
        });
      }
    }
  }

  const chatIdForStatus = messageRow?.chat_id || internalChatId || null;
  const messageIdForStatus = messageRow?.id || payload?.draftId || job?.messageId || null;
  const viewStatus = externalId ? "Sent" : "Pending";

  const chatSummary =
    chatIdForStatus && messageOperation === "insert"
      ? await fetchChatUpdateForSocket(chatIdForStatus)
      : null;

  if (messageRow) {
    const mapped = {
      id: messageRow.id,
      chat_id: messageRow.chat_id,
      body: messageRow.content,
      sender_type: "AGENT" as const,
      sender_id: messageRow.sender_id,
      sender_name: (messageRow as any).sender_name ?? null,
      sender_avatar_url: (messageRow as any).sender_avatar_url ?? null,
      created_at: messageRow.created_at,
      view_status: messageRow.view_status ?? viewStatus,
      type: messageRow.type ?? (messageType === "media" ? "DOCUMENT" : "TEXT"),
      is_private: false,
      media_url: buildProxyUrl(messageRow.media_url) ?? null,
      client_draft_id: job?.draftId ?? payload?.draftId ?? null,
    };

    const socketSuccess = await emitSocketWithRetry("socket.livechat.outbound", {
      kind: "livechat.outbound.message",
      chatId: mapped.chat_id,
      inboxId,
      message: mapped,
      chatUpdate: chatSummary
        ? {
            ...chatSummary,
            last_message_from: mapped.sender_type,
          }
        : undefined,
    });

    if (!socketSuccess) {
      console.error("[worker][WAHA] METRIC: Socket emission failed after all retries:", {
        operation: 'outbound',
        messageId: mapped.id,
        chatId: mapped.chat_id,
        inboxId,
        provider: 'WAHA'
      });
    }
  }

  if (chatIdForStatus && messageIdForStatus) {
    const normalizedStatus = typeof viewStatus === "string" ? viewStatus.toUpperCase() : null;
    const rawStatus = String(viewStatus || "").toLowerCase();
    await publishApp("socket.livechat.status", {
      kind: "livechat.message.status",
      chatId: chatIdForStatus,
      messageId: messageIdForStatus,
      externalId: externalId || null,
      view_status: viewStatus,
      raw_status: rawStatus,
      status: normalizedStatus,
      draftId: job?.draftId ?? payload?.draftId ?? null,
      reason: null,
    });
  }

  console.log("[worker][outbound][WAHA] message sent", {
    inboxId,
    chatId: chatIdForStatus,
    externalId: externalId || null,
    remoteChatId,
  });

  if (chatIdForStatus) {
    setTimeout(() => {
      warmChatMessagesCache(chatIdForStatus).catch((error) => {
        console.warn("[worker][WAHA] warm cache failed", {
          chatId: chatIdForStatus,
          error: error instanceof Error ? error.message : error,
        });
      });
    }, 0);

    try {
      await invalidateChatCaches(chatIdForStatus, {
        companyId: job.companyId,
        inboxId,
        kind: typeof remoteChatId === "string" && remoteChatId.includes("@g.us") ? "GROUP" : "DIRECT",
        chatType: typeof remoteChatId === "string" && remoteChatId.includes("@g.us") ? "GROUP" : "CONTACT",
        remoteId: remoteChatId ?? null,
      });
    } catch (error) {
      console.warn("[worker][WAHA] failed to invalidate caches after outbound", {
        chatId: chatIdForStatus,
        error,
      });
    }
  }
}

function buildInboundMetricsMeta(job: InboundJobPayload): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    provider: job.provider,
  };

  if (job.provider === "WAHA") {
    const payload: any = job.payload ?? {};
    const chat: any = payload?.chat ?? {};
    const chatId =
      typeof payload?.chatId === "string"
        ? payload.chatId
        : typeof chat?.id === "string"
          ? chat.id
          : typeof chat?.jid === "string"
            ? chat.jid
            : typeof payload?.remoteJid === "string"
              ? payload.remoteJid
              : typeof job.session === "string"
                ? job.session
                : null;
    const type =
      typeof job.event === "string"
        ? job.event
        : typeof payload?.type === "string"
          ? payload.type
          : typeof payload?.message?.type === "string"
            ? payload.message.type
            : null;
    meta.chatId = chatId ?? null;
    meta.type = type ?? null;
  } else {
    const value: any = job.value ?? {};
    const messages = Array.isArray(value?.messages) ? value.messages : [];
    const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
    const firstMessage = messages.find(Boolean) as any;
    const firstStatus = statuses.find(Boolean) as any;
    const chatId =
      (firstMessage && typeof firstMessage.chatId === "string" && firstMessage.chatId) ||
      (firstMessage && typeof firstMessage.from === "string" && firstMessage.from) ||
      (firstMessage && typeof firstMessage.id === "string" && firstMessage.id) ||
      null;
    const type =
      (firstMessage && typeof firstMessage.type === "string" && firstMessage.type) ||
      (firstStatus && typeof firstStatus.status === "string" && firstStatus.status) ||
      null;
    meta.chatId = chatId ?? null;
    meta.type = type ?? null;
  }

  if (!("chatId" in meta)) meta.chatId = null;
  if (!("type" in meta)) meta.type = null;

  return meta;
}

function buildInboundMediaMetricsMeta(job: InboundMediaJobPayload): Record<string, unknown> {
  return {
    provider: job.provider,
    chatId: job.chatId,
    type: job.media?.type ?? null,
  };
}

function buildOutboundMetricsMeta(job: any): Record<string, unknown> {
  const chatId =
    (typeof job?.chatId === "string" && job.chatId) ||
    (typeof job?.chat_id === "string" && job.chat_id) ||
    (typeof job?.customerPhone === "string" && job.customerPhone) ||
    null;
  return {
    jobType:
      (typeof job?.jobType === "string" && job.jobType) ||
      (typeof job?.kind === "string" && job.kind) ||
      null,
    provider: typeof job?.provider === "string" ? job.provider : null,
    chatId,
  };
}

async function startInboundWorkerInstance(index: number, prefetch: number): Promise<void> {
  const label = `[worker][inbound#${index}]`;
  console.log(`${label} starting (prefetch=${prefetch})`);
  await consume(
    Q_INBOUND,
    async (msg, ch) => {
      if (!msg) return;
      try {
        const job = JSON.parse(msg.content.toString()) as InboundJobPayload;
        const meta = buildInboundMetricsMeta(job);
        await measureJob("inbound", meta, async () => {
          await handleInboundChange(job);
        });
        ch.ack(msg);
      } catch (e: any) {
        console.error("[inbound.worker] error:", e?.message || e);
        ch.nack(msg, false, false);
      }
    },
    {
      prefetch,
      options: { noAck: false, consumerTag: `inbound-${index}` },
    },
  );
  console.log(`${label} listening on:`, Q_INBOUND);
}

async function startInboundWorkers(count: number, prefetch: number): Promise<void> {
  const tasks = Array.from({ length: count }, (_, idx) => startInboundWorkerInstance(idx + 1, prefetch));
  await Promise.all(tasks);
}

async function startInboundMediaWorkerInstance(index: number, prefetch: number): Promise<void> {
  const label = `[worker][inbound-media#${index}]`;
  console.log(`${label} starting (prefetch=${prefetch})`);
  await consume(
    Q_INBOUND_MEDIA,
    async (msg, ch) => {
      if (!msg) return;
      try {
        const job = JSON.parse(msg.content.toString()) as InboundMediaJobPayload;
        const meta = buildInboundMediaMetricsMeta(job);
        await measureJob("inboundMedia", meta, async () => {
          await handleInboundMediaJob(job);
        });
        ch.ack(msg);
      } catch (e: any) {
        console.error("[inbound.media.worker] error:", e?.message || e);
        ch.nack(msg, false, false);
      }
    },
    {
      prefetch,
      options: { noAck: false, consumerTag: `inbound-media-${index}` },
    },
  );
  console.log(`${label} listening on:`, Q_INBOUND_MEDIA);
}

async function startInboundMediaWorkers(count: number, prefetch: number): Promise<void> {
  const tasks = Array.from({ length: count }, (_, idx) => startInboundMediaWorkerInstance(idx + 1, prefetch));
  await Promise.all(tasks);
}

async function sendMetaText(args: {
  inboxId: string;
  customerPhone: string;
  content: string;
}) {
  const creds = await getDecryptedCredsForInbox(args.inboxId);
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${creds.phone_number_id}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: args.customerPhone,
    type: "text",
    text: { body: args.content },
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = (json as any)?.error?.code || response.status;
    const type = (json as any)?.error?.type || "MetaError";
    const message = (json as any)?.error?.message || response.statusText;
    const err = new Error(`[${code}] ${type}: ${message}`);
    (err as any).retryable =
      response.status >= 500 || response.status === 429;
    throw err;
  }
  const wamid = (json as any)?.messages?.[0]?.id || null;
  return { wamid };
}

async function startOutboundWorkerInstance(index: number, prefetch: number): Promise<void> {
  const label = `[worker][outbound#${index}]`;
  console.log(`${label} starting (prefetch=${prefetch})`);
  await consume(
    Q_OUTBOUND,
    async (msg, ch) => {
    if (!msg) return;

    let job: any;
    try {
      job = JSON.parse(msg.content.toString());
    } catch {
      await publish(EX_DLX, "outbound.dlq", {
        raw: msg.content.toString(),
        error: "invalid_json",
      });
      ch.ack(msg);
      return;
    }

    const headerAttempt = Number((msg.properties.headers as any)?.attempt ?? 0) || 0;
    const attempt = Math.max(
      headerAttempt,
      Number(job?.attempt ?? 0) || 0,
    );
    const meta = buildOutboundMetricsMeta(job);

    try {
      await measureJob("outbound", meta, async () => {
        let jobKind = String(job?.jobType || job?.kind || "");
        let provider = String(job?.provider || "").toUpperCase();
        const jobKindLower = jobKind.toLowerCase();
        meta.jobType = jobKind || null;
        meta.provider = provider || meta.provider || null;
        if (typeof job?.chatId === "string" && !meta.chatId) {
          meta.chatId = job.chatId;
        }

        if (jobKindLower === "outbound.request") {
          if (provider === WAHA_PROVIDER) {
            if (typeof job?.chatId === "string") {
              meta.chatId = job.chatId;
            }
            await handleWahaOutboundRequest(job);
            ch.ack(msg);
            return;
          }
          if (!provider || provider === "META" || provider === "META_CLOUD") {
            jobKind = "message.send";
            meta.jobType = jobKind;
            provider = provider || "META";
            meta.provider = provider;
          } else {
            throw new Error(`unknown provider ${provider} for outbound.request`);
          }
        }

        if (provider === WAHA_PROVIDER && jobKind === "message.send") {
          meta.jobType = jobKind;
          if (typeof job?.chatId === "string") {
            meta.chatId = job.chatId;
          }
          await handleWahaOutboundRequest(job);
          ch.ack(msg);
          return;
        }

        if (jobKind === "livechat.startChat") {
          meta.jobType = jobKind;
          ch.ack(msg);
          return;
        }

        if (jobKind === "meta.sendMedia") {
          meta.jobType = jobKind;
          const chatId = String(job.chatId || "");
          const messageId = String(job.messageId || "");
          const storageKey = String(job.storage_key || "");
          const mimeType = String(job.mime_type || "");
          meta.chatId = chatId || meta.chatId || null;
          meta.provider = provider || meta.provider || "META";
          if (!chatId || !messageId || !storageKey || !mimeType) {
            throw new Error("meta.sendMedia missing fields");
          }

        const { chat_id, customer_phone, inbox_id } =
          await getChatWithCustomerPhone(chatId);

        const inboxId = String(job.inboxId || inbox_id || "");
        if (!inboxId) throw new Error("inboxId missing");

        const creds = await getDecryptedCredsForInbox(inboxId);
        if (!creds?.access_token || !creds?.phone_number_id) {
          throw new Error("missing_meta_credentials");
        }

        const abs = path.join(MEDIA_DIR, storageKey);
        try {
          await fs.access(abs);
        } catch {
          throw new Error("media_file_missing");
        }

        const filename = String(job.filename || path.basename(abs));
        const mediaType = mimeType.startsWith("image/")
          ? "IMAGE"
          : mimeType.startsWith("video/")
            ? "VIDEO"
            : mimeType.startsWith("audio/")
              ? "AUDIO"
              : "DOCUMENT";

        // upload
        const mediaId = await graphUploadMedia(
          { access_token: creds.access_token, phone_number_id: creds.phone_number_id },
          abs,
          mimeType,
          filename,
        );
        console.log("[outbound] graphUploadMedia ok", { mediaId, mimeType });

        // normaliza n??mero para E.164 sem '+'
        function toE164(n: string): string {
          const only = String(n || "").replace(/\D+/g, "");
          return only.replace(/^00/, ""); // ex: 0055... -> 55...
        }
        const to = toE164(customer_phone);

        // envia m??dia
        const wamid = await graphSendMedia(
          { access_token: creds.access_token, phone_number_id: creds.phone_number_id },
          to,                   // <<< usa o n??mero normalizado
          mediaType,
          mediaId,
          job.caption ?? null,
          filename,
        );
        console.log("[outbound] graphSendMedia ok", { wamid });

        // garante persist??ncia do status, com ou sem wamid
        if (!wamid) {
          console.error("[outbound] graphSendMedia retornou 200 mas sem wamid");
          await db.none(
            `update public.chat_messages
       set view_status = 'Sent'
     where id = $1`,
            [messageId]
          );
        } else {
          await db.none(
            `update public.chat_messages
       set external_id = $2,
           view_status = 'Sent'
     where id = $1`,
            [messageId, wamid]
          );
        }

        // (opcional) se ainda quiser manter seu helper que upserta logs/etc:
        await insertOutboundMessage({
          chatId: chat_id,
          inboxId,
          customerId: String(job.customerId || ""),
          externalId: wamid || null,
          content: job.caption || filename,
          type: mediaType,
          senderId: job.senderId || job.senderUserSupabaseId || null,
          messageId,
          viewStatus: "Sent",
        });

        // avisa o front SEMPRE
        await publishApp("socket.livechat.status", {
          kind: "livechat.message.status",
          chatId,
          messageId,
          externalId: wamid || null,
          view_status: "Sent",
          raw_status: "sent",
          status: "SENT",
          draftId: job?.draftId ?? null,
          reason: null,
        });

        console.log("[worker][outbound] media sent", { chatId, inboxId, messageId, wamid });
        meta.chatId = chat_id ?? chatId;

        setTimeout(() => {
          const targetChatId = chat_id ?? chatId;
          if (!targetChatId) return;
          warmChatMessagesCache(targetChatId).catch((error) => {
            console.warn("[worker][outbound] warm cache failed", {
              chatId: targetChatId,
              error: error instanceof Error ? error.message : error,
            });
          });
        }, 0);


        ch.ack(msg);
        return;
      }

      if (jobKind !== "message.send" && jobKind !== "send-text") {
        throw new Error(`unknown jobType: ${jobKind}`);
      }

      const chatId = String(job.chatId || "");
      const content = String(job.content || "");
      if (!chatId || !content) throw new Error("chatId/content missing");

      const { chat_id, customer_phone, inbox_id } =
        await getChatWithCustomerPhone(chatId);

      const inboxId = String(job.inboxId || inbox_id || "");
      if (!inboxId) throw new Error("inboxId missing");

      const { wamid } = await sendMetaText({
        inboxId,
        customerPhone: customer_phone,
        content,
      });

      // Resolve sender_name: check if AI agent or human user
      let senderName: string | null = null;
      let senderAvatarUrl: string | null = null;
      try {
        const chatRow = await db.oneOrNone<{ ai_agent_id: string | null }>(
          `select ai_agent_id from public.chats where id = $1`,
          [chat_id],
        );
        if (chatRow?.ai_agent_id) {
          const agentRow = await db.oneOrNone<{ name: string | null }>(
            `select name from public.agents where id = $1`,
            [chatRow.ai_agent_id],
          );
          senderName = agentRow?.name ?? null;
        } else if (job.senderId || job.senderUserSupabaseId) {
          // If senderId provided, it's the local users.id; query by id
          // If senderUserSupabaseId provided, it's auth user.id; query by user_id
          const userId = job.senderId || job.senderUserSupabaseId;
          const lookupColumn = job.senderId ? 'id' : 'user_id';
          const userRow = await db.oneOrNone<{ id: string; name: string | null; email: string | null; avatar: string | null }>(
            `select id, name, email, avatar from public.users where ${lookupColumn} = $1`,
            [userId],
          );
          if (userRow) {
            senderName = userRow.name || userRow.email || null;
            senderAvatarUrl = userRow.avatar || null;
            // Ensure we use local ID for persistence
            if (!job.senderId) {
              job.senderId = userRow.id;
            }
          }
        }
      } catch (err) {
        console.warn("[worker][outbound] failed to resolve sender_name", err instanceof Error ? err.message : err);
      }

      const upsert = await insertOutboundMessage({
        chatId: chat_id,
        inboxId,
        customerId: String(job.customerId || ""),
        externalId: wamid,
        content,
        type: "TEXT",
        senderId: job.senderId || job.senderUserSupabaseId || null,
        senderName,
        senderAvatarUrl,
        messageId: job.messageId || null,
        viewStatus: "Sent",
      });

      try {
        await publishApp("socket.livechat.status", {
          kind: "livechat.message.status",
          chatId,
          messageId: job.messageId || upsert?.message?.id || null,
          externalId: wamid || null,
          view_status: "Sent",
          raw_status: "sent",
          status: "SENT",
          draftId: job?.draftId ?? null,
          reason: null,
        });
      } catch (err) {
        console.warn(
          "[worker][outbound] failed to publish status event:",
          (err as any)?.message || err,
        );
      }

      if (upsert?.message && upsert.operation === "insert") {
        const mapped = {
          id: upsert.message.id,
          chat_id: upsert.message.chat_id,
          body: upsert.message.content,
          sender_type: "AGENT" as const,
          sender_id: upsert.message.sender_id,
          sender_name: (upsert.message as any).sender_name ?? senderName ?? null,
          sender_avatar_url: (upsert.message as any).sender_avatar_url ?? senderAvatarUrl ?? null,
          created_at: upsert.message.created_at,
          view_status: upsert.message.view_status ?? "Sent",
          type: upsert.message.type ?? "TEXT",
          is_private: false,
          media_url: upsert.message.media_url ?? null,
          client_draft_id: job?.draftId ?? null,
        };
        try {
          const chatSummary = await fetchChatUpdateForSocket(mapped.chat_id);
          const socketSuccess = await emitSocketWithRetry("socket.livechat.outbound", {
            kind: "livechat.outbound.message",
            chatId: mapped.chat_id,
            inboxId,
            message: mapped,
            chatUpdate: chatSummary
              ? { ...chatSummary, last_message_from: mapped.sender_type }
              : {
                  chatId: mapped.chat_id,
                  inboxId,
                  last_message: mapped.body,
                  last_message_at: mapped.created_at,
                  last_message_from: mapped.sender_type,
                  last_message_type: mapped.type,
                  last_message_media_url: mapped.media_url,
                },
          });

          if (!socketSuccess) {
            console.error("[worker][META] METRIC: Socket emission failed after all retries:", {
              operation: 'outbound',
              messageId: mapped.id,
              chatId: mapped.chat_id,
              inboxId,
              provider: 'META'
            });
          }
        } catch (err) {
          console.warn(
            "[worker][outbound] failed to publish outbound message event:",
            (err as any)?.message || err,
          );
        }
      }

        console.log("[worker][outbound] message sent", {
          chatId,
          inboxId,
          wamid,
        });
        meta.chatId = chat_id ?? chatId;

        setTimeout(() => {
          const targetChatId = chat_id ?? chatId;
          if (!targetChatId) return;
          warmChatMessagesCache(targetChatId).catch((error) => {
            console.warn("[worker][outbound] warm cache failed", {
              chatId: targetChatId,
              error: error instanceof Error ? error.message : error,
            });
          });
        }, 0);

        ch.ack(msg);
      });
    } catch (e: any) {
      console.error("[worker][outbound] error", {
        message: e?.message || e,
        job,
        attempt,
      });
      const retryable = !!e?.retryable;
      const next = attempt + 1;
      if (retryable && next <= MAX_ATTEMPTS) {
        await publish(
          EX_DLX,
          "outbound.retry",
          { ...job, attempt: next },
          { headers: { attempt: next } },
        );
      } else {
        await publish(EX_DLX, "outbound.dlq", {
          ...job,
          attempt,
          error: e?.message || String(e),
        });
        try {
          const chatIdPayload = typeof job?.chatId === "string" ? job.chatId : null;
          const messageIdPayload = typeof job?.messageId === "string" ? job.messageId : null;
          if (chatIdPayload && (messageIdPayload || job?.draftId)) {
            await publishApp("socket.livechat.status", {
              kind: "livechat.message.status",
              chatId: chatIdPayload,
              messageId: messageIdPayload,
              externalId: (job as any)?.externalId ?? null,
              view_status: "Error",
              raw_status: "error",
              status: "ERROR",
              draftId: job?.draftId ?? null,
              reason: e?.message || String(e),
            });
          }
        } catch (notifyError) {
          console.warn("[worker][outbound] failed to emit error status", {
            chatId: job?.chatId,
            messageId: job?.messageId,
            error: notifyError instanceof Error ? notifyError.message : notifyError,
          });
        }
      }
      ch.ack(msg);
    }
    },
    {
      prefetch,
      options: { noAck: false, consumerTag: `outbound-${index}` },
    },
  );
  console.log(`${label} listening on:`, Q_OUTBOUND);
}

async function startOutboundWorkers(count: number, prefetch: number): Promise<void> {
  const tasks = Array.from({ length: count }, (_, idx) => startOutboundWorkerInstance(idx + 1, prefetch));
  await Promise.all(tasks);
}

async function main(): Promise<void> {
  const target = (process.argv[2] ?? "all").toLowerCase();

  // Ajuste de concorr??ncia via env:
  // INBOUND_WORKERS / INBOUND_PREFETCH / INBOUND_MEDIA_WORKERS / INBOUND_MEDIA_PREFETCH / OUTBOUND_WORKERS / OUTBOUND_PREFETCH
  switch (target) {
    case "inbound":
      await startInboundWorkers(INBOUND_WORKERS, INBOUND_PREFETCH);
      break;
    case "inbound-media":
      await startInboundMediaWorkers(INBOUND_MEDIA_WORKERS, INBOUND_MEDIA_PREFETCH);
      break;
    case "outbound":
      await startOutboundWorkers(OUTBOUND_WORKERS, OUTBOUND_PREFETCH);
      break;
    case "all":
    default:
      await Promise.all([
        startInboundWorkers(INBOUND_WORKERS, INBOUND_PREFETCH),
        startInboundMediaWorkers(INBOUND_MEDIA_WORKERS, INBOUND_MEDIA_PREFETCH),
        startOutboundWorkers(OUTBOUND_WORKERS, OUTBOUND_PREFETCH),
      ]);
      console.log(
        `[worker] inbound(${INBOUND_WORKERS}) inbound-media(${INBOUND_MEDIA_WORKERS}) outbound(${OUTBOUND_WORKERS}) running.`,
      );
      break;
  }
}


async function syncWahaGroupMetadata(): Promise<void> {
  if (wahaGroupSyncRunning) return;
  wahaGroupSyncRunning = true;
  try {
    const groupsRaw = await db.any(
      `select ch.id as chat_id,
              ch.inbox_id,
              ch.remote_id,
              ib.company_id
         from public.chats ch
         join public.inboxes ib on ib.id = ch.inbox_id
        where (ch.kind = 'GROUP' or ch.remote_id like '%@g.us')
          and ib.provider = $1
          and ch.remote_id is not null
        order by ch.updated_at desc
        limit 10`,
      [WAHA_PROVIDER],
    ) as Array<{
      chat_id: string;
      inbox_id: string;
      remote_id: string | null;
      company_id: string;
    }> | null;

    for (const group of groupsRaw ?? []) {
      const remoteId = group.remote_id;
      if (!remoteId) continue;

      let config: { session: string; apiKey: string };
      try {
        config = await getWahaInboxConfig(group.inbox_id);
      } catch (error) {
        console.warn("[WAHA][sync] skipped inbox config", {
          inboxId: group.inbox_id,
          error,
        });
        continue;
      }

      try {
        const details = await fetchWahaChatDetails(config.session, remoteId, config.apiKey);
        const groupName =
          details?.subject ?? details?.name ?? details?.title ?? details?.topic ?? null;
        const groupAvatar =
          details?.pictureUrl ??
          details?.picture ??
          details?.pic ??
          details?.img ??
          details?.avatar ??
          null;

        rememberAvatar(group.company_id, remoteId, groupAvatar ?? null);

        await ensureGroupChat({
          inboxId: group.inbox_id,
          companyId: group.company_id,
          remoteId,
          groupName: groupName ?? null,
          groupAvatarUrl: groupAvatar ?? null,
        });

        const participants = Array.isArray(details?.participants)
          ? details.participants
          : Array.isArray(details?.participantsInfo)
            ? details.participantsInfo
            : [];

        for (const entry of participants) {
          const participantRemote = normalizeWahaJid(
            entry?.id || entry?.jid || entry?.user || entry,
          );
          if (!participantRemote) continue;
          rememberAvatar(
            group.company_id,
            participantRemote,
            entry?.profilePicUrl || entry?.imgUrl || entry?.profile_pic || entry?.avatar || null,
          );
          await upsertChatRemoteParticipant({
            chatId: group.chat_id,
            remoteId: participantRemote,
            name:
              entry?.name ||
              entry?.notifyName ||
              entry?.pushName ||
              entry?.displayName ||
              null,
            phone: normalizeMsisdn(participantRemote),
            avatarUrl:
              entry?.profilePicUrl ||
              entry?.imgUrl ||
              entry?.profile_pic ||
              entry?.avatar ||
              null,
            isAdmin:
              typeof entry?.isAdmin === "boolean"
                ? entry.isAdmin
                : typeof entry?.admin === "boolean"
                  ? entry.admin
                  : null,
            joinedAt:
              typeof entry?.joinTimestamp === "number"
                ? new Date(entry.joinTimestamp * 1000)
                : undefined,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.warn("[WAHA][sync] failed to refresh group metadata", {
          inboxId: group.inbox_id,
          remoteId,
          error,
        });
      }
    }
  } catch (error) {
    console.warn("[WAHA][sync] metadata job error", error);
  } finally {
    wahaGroupSyncRunning = false;
  }
}

async function tickCampaigns() {
  try {
    const now = new Date().toISOString();
    // campanhas ativas
    const { data: camps } = await supabaseAdmin
      .from("campaigns")
      .select("id, inbox_id, rate_limit_per_minute, start_at, end_at, status")
      .in("status", ["SCHEDULED","RUNNING"]);

    for (const c of camps || []) {
      if (!c.inbox_id) continue;

      // pega at?? N recipients ainda sem envio (last_step_sent is null)
      const limit = Math.max(1, Number(c.rate_limit_per_minute || 30));
      const { data: step } = await supabaseAdmin
        .from("campaign_steps").select("id, template_id, delay_sec")
        .eq("campaign_id", c.id).order("position", { ascending: true }).limit(1).maybeSingle();
      if (!step?.id) continue;

      const { data: tpl } = await supabaseAdmin
        .from("message_templates").select("id, kind, payload")
        .eq("id", step.template_id).maybeSingle();
      if (!tpl?.id) continue;

      const { data: recipients } = await supabaseAdmin
        .from("campaign_recipients")
        .select("id, phone, last_step_sent")
        .eq("campaign_id", c.id)
        .is("last_step_sent", null)
        .limit(limit);

      for (const r of recipients || []) {
        if ((tpl.kind || "").toUpperCase() === "TEXT") {
          const content = String((tpl.payload as any)?.text || "");
          if (!content) continue;
          await publish(EX_APP, "outbound", {
            jobType: "message.send",
            inboxId: c.inbox_id,
            content,
            customerPhone: r.phone,
          });
        } else {
          await publish(EX_APP, "outbound", {
            jobType: "meta.sendMedia",
            inboxId: c.inbox_id,
            media: (tpl.payload as any),
            customerPhone: r.phone,
          });
        }

        // opcional: j?? marca progresso local (o evento real pode atualizar depois)
        await supabaseAdmin
          .from("campaign_recipients")
          .update({ last_step_sent: 1, last_sent_at: new Date().toISOString() })
          .eq("id", r.id);
      }
    }
  } catch (err) {
    console.error("[campaigns] tick error:", (err as any)?.message || err);
  }
}

// roda a cada 60s
setInterval(tickCampaigns, 60_000);
setInterval(syncWahaGroupMetadata, 300_000);

if (!process.env.SKIP_WORKER_AUTOSTART) {
  main().catch((e) => {
    console.error("[worker] fatal:", e);
    process.exit(1);
  });
}


