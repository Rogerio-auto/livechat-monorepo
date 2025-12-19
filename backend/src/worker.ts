// backend/src/worker.ts
import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { encryptMediaUrl, decryptMediaUrl, decryptSecret } from "../src/lib/crypto.ts";
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
import { getIO } from "./lib/io.ts";
import { runWithDistributedLock } from "./lib/distributedLock.ts";
import { ensureSingleWorkerInstance } from "./lib/singleInstance.ts";
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
import { redis, rDel, rSet, rGet, k, rememberMessageCacheKey } from "../src/lib/redis.ts";
import { supabaseAdmin } from "./lib/supabase.ts";
import { WAHA_PROVIDER, wahaFetch, fetchWahaChatDetails, WAHA_BASE_URL } from "../src/services/waha/client.ts";
import { runAgentReply, getAgent as getRuntimeAgent } from "./services/agents.runtime.ts";
import { enqueueMessage as bufferEnqueue, getDue as bufferGetDue, clearDue as bufferClearDue, popBatch as bufferPopBatch, parseListKey as bufferParseListKey, pauseBuffer as bufferPause, tryLock as bufferTryLock, releaseLock as bufferReleaseLock } from "./services/buffer.ts";
import { uploadBufferToStorage, buildStoragePath, pickFilename, uploadWahaMedia, downloadMediaToBuffer, getMediaBucket } from "../src/lib/storage.ts";
import { buildProxyUrl } from "../src/lib/mediaProxy.ts";
import { incrementUsage, checkLimit } from "../src/services/subscriptions.ts";
import { NotificationService } from "./services/NotificationService.ts";

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
const PAGE_LIMIT_PREWARM = 30;
const MAX_ATTEMPTS = Number(process.env.JOB_MAX_ATTEMPTS || 3);

// Meta Graph version used for Graph API requests
const META_GRAPH_VERSION = (process.env.META_GRAPH_VERSION || "v20.0").replace(/^v?/, "v");

// Local media directories and public bases
const MEDIA_DIR = process.env.MEDIA_DIR || path.resolve(process.cwd(), "media");
const MEDIA_PUBLIC_BASE = (process.env.MEDIA_PUBLIC_BASE || "").replace(/\/+$/, "");
const FILES_PUBLIC_BASE = (process.env.FILES_PUBLIC_BASE || "http://localhost:5000").replace(/\/+$/, "");

// Worker pool configuration
const INBOUND_WORKERS = Number(process.env.INBOUND_WORKERS ?? 2);
const INBOUND_PREFETCH = Number(process.env.INBOUND_PREFETCH ?? 5);
const INBOUND_MEDIA_WORKERS = Number(process.env.INBOUND_MEDIA_WORKERS ?? 2);
const INBOUND_MEDIA_PREFETCH = Number(process.env.INBOUND_MEDIA_PREFETCH ?? 5);
const OUTBOUND_WORKERS = Number(process.env.OUTBOUND_WORKERS ?? 2);
const OUTBOUND_PREFETCH = Number(process.env.OUTBOUND_PREFETCH ?? 5);

// Socket emit helper with small retry
async function emitSocketWithRetry(event: string, payload: any, attempts = 2): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await publish(EX_APP, event, payload);
      return true;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  return false;
}


// === Agent reply parsing helpers (multi-bubble + media) ===
type MediaKind = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
type ParsedItem =
  | { kind: "text"; content: string }
  | { kind: "media"; mediaUrl: string; mediaKind: MediaKind; filename?: string | null; mimeType?: string | null; caption?: string | null };

function guessMediaFromUrl(url: string): { mediaKind: MediaKind; filename: string | null; mimeType: string | null } {
  try {
    const u = new URL(url);
    const filename = u.pathname.split("/").pop() || null;
    const lower = (filename || "").toLowerCase();
    const byExt: Record<string, { k: MediaKind; m: string }> = {
      ".png": { k: "IMAGE", m: "image/png" },
      ".jpg": { k: "IMAGE", m: "image/jpeg" },
      ".jpeg": { k: "IMAGE", m: "image/jpeg" },
      ".gif": { k: "IMAGE", m: "image/gif" },
      ".webp": { k: "IMAGE", m: "image/webp" },
      ".heic": { k: "IMAGE", m: "image/heic" },
      ".mp4": { k: "VIDEO", m: "video/mp4" },
      ".mov": { k: "VIDEO", m: "video/quicktime" },
      ".3gp": { k: "VIDEO", m: "video/3gpp" },
      ".mp3": { k: "AUDIO", m: "audio/mpeg" },
      ".ogg": { k: "AUDIO", m: "audio/ogg" },
      ".opus": { k: "AUDIO", m: "audio/opus" },
      ".m4a": { k: "AUDIO", m: "audio/mp4" },
      ".pdf": { k: "DOCUMENT", m: "application/pdf" },
      ".doc": { k: "DOCUMENT", m: "application/msword" },
      ".docx": { k: "DOCUMENT", m: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      ".xls": { k: "DOCUMENT", m: "application/vnd.ms-excel" },
      ".xlsx": { k: "DOCUMENT", m: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      ".ppt": { k: "DOCUMENT", m: "application/vnd.ms-powerpoint" },
      ".pptx": { k: "DOCUMENT", m: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
      ".zip": { k: "DOCUMENT", m: "application/zip" },
      ".rar": { k: "DOCUMENT", m: "application/vnd.rar" },
    };
    const ext = Object.keys(byExt).find((e) => lower.endsWith(e)) || null;
    if (ext) return { mediaKind: byExt[ext].k, filename, mimeType: byExt[ext].m };
    return { mediaKind: "DOCUMENT", filename, mimeType: null };
  } catch {
    return { mediaKind: "DOCUMENT", filename: null, mimeType: null };
  }
}

function extractFirstUrlAndCaption(text: string): { url: string | null; caption: string | null } {
  const urlRe = /(https?:\/\/\S+)/i;
  const m = text.match(urlRe);
  if (!m) return { url: null, caption: null };
  const url = m[1];
  const before = text.slice(0, m.index ?? 0).trim();
  const after = text.slice((m.index ?? 0) + url.length).trim();
  const caption = [before, after].filter(Boolean).join(" ").trim() || null;
  return { url, caption };
}

function parseAgentReplyToItems(raw: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  let trimmed = (raw || "").trim();
  if (!trimmed) return items;

  // 1. Limpeza robusta para extrair JSON de blocos Markdown ou texto sujo
  let jsonCandidate = trimmed;
  
  // Remove blocos de código markdown (```json ... ``` ou ``` ... ```)
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    jsonCandidate = jsonBlockMatch[1].trim();
  } else {
    // Se não houver bloco, tenta encontrar o primeiro '{' e o último '}'
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonCandidate = trimmed.substring(firstBrace, lastBrace + 1).trim();
    }
  }

  // Try JSON of shape { message: ["..."] }
  try {
    let obj;
    try {
      obj = JSON.parse(jsonCandidate);
    } catch (e) {
      // Se falhar, tenta limpar quebras de linha literais dentro do JSON que quebram o parse
      // e remove possíveis escapes excessivos de barras
      const fixedJson = jsonCandidate
        .replace(/\n/g, " ") // Substitui quebras de linha reais por espaço
        .replace(/\r/g, "")  // Remove carriage returns
        .replace(/\\{2,}/g, "\\"); // Transforma \\\\ em \\
      obj = JSON.parse(fixedJson);
    }

    const arr = Array.isArray(obj?.message) ? obj.message : null;
    if (arr && arr.length) {
      for (const entry of arr) {
        const s = typeof entry === "string" ? entry.trim() : "";
        if (!s) continue;
        const { url, caption } = extractFirstUrlAndCaption(s);
        if (url) {
          const g = guessMediaFromUrl(url);
          items.push({ kind: "media", mediaUrl: url, mediaKind: g.mediaKind, filename: g.filename, mimeType: g.mimeType, caption });
        } else {
          items.push({ kind: "text", content: s });
        }
      }
      return items;
    }
  } catch (err) {
    // Se falhar o parse do JSON, continuamos para o fallback de texto puro
    // console.log("[AGENT][PARSE] JSON parse failed, falling back to raw text", { error: err.message });
  }

  // Fallback: treat as a single text bubble or media if it's a plain URL
  const { url, caption } = extractFirstUrlAndCaption(trimmed);
  if (url && (!caption || !caption.trim())) {
    const g = guessMediaFromUrl(url);
    items.push({ kind: "media", mediaUrl: url, mediaKind: g.mediaKind, filename: g.filename, mimeType: g.mimeType, caption: null });
  } else {
    items.push({ kind: "text", content: trimmed });
  }
  return items;
}

async function publishParsedItems(args: { provider: "META" | typeof WAHA_PROVIDER; inboxId: string | null | undefined; chatId: string; items: ParsedItem[] }): Promise<void> {
  const provider = args.provider;
  const inboxId = args.inboxId || undefined;
  
  // Enviar mensagens SEQUENCIALMENTE com delay (como loop do n8n)
  // Isso garante que as mensagens chegam na ordem correta
  for (let i = 0; i < args.items.length; i++) {
    const it = args.items[i];
    
    // Adicionar delay entre mensagens (exceto na primeira)
    if (i > 0) {
      const delayMs = Number(process.env.MESSAGE_SEQUENCE_DELAY_MS || 800);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    if (it.kind === "text") {
      await publish(EX_APP, "outbound.request", {
        provider,
        inboxId,
        chatId: args.chatId,
        payload: { content: it.content },
        attempt: 0,
        kind: "message.send",
      });
    } else {
      // media
      if (provider === WAHA_PROVIDER) {
        await publish(EX_APP, "outbound.request", {
          provider,
          inboxId,
          chatId: args.chatId,
          payload: {
            type: "media",
            kind: it.mediaKind.toLowerCase(),
            mediaUrl: it.mediaUrl,
            filename: it.filename ?? undefined,
            mimeType: it.mimeType ?? undefined,
            caption: it.caption ?? undefined,
          },
          attempt: 0,
          kind: "message.send",
        });
      } else {
        // META: let outbound worker convert to meta.sendMedia
        await publish(EX_APP, "outbound.request", {
          provider: "META",
          inboxId,
          chatId: args.chatId,
          payload: {
            type: "media",
            kind: it.mediaKind.toLowerCase(),
            mediaUrl: it.mediaUrl,
            filename: it.filename ?? undefined,
            mimeType: it.mimeType ?? undefined,
            caption: it.caption ?? undefined,
          },
          attempt: 0,
          kind: "message.send",
        });
      }
    }
  }
}
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
      // console.log("[metrics][worker]", {
      //   worker,
      //   durationMs,
      //   processed: metrics[worker].processed,
      //   ...meta,
      // });
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
      // console.log("[metrics][queue]", {
      //   queue: info.queue,
      //   depth: info.messageCount,
      //   consumers: info.consumerCount,
      // });
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
      try {
        // Remove from due set first to avoid double work
        const meta = bufferParseListKey(listKey);
        if (!meta) continue;
        // Acquire a short lock to prevent concurrent processing across workers
        const locked = await bufferTryLock(meta.companyId, meta.chatId, 20);
        if (!locked) {
          // Another worker is processing this chat; skip
          continue;
        }
        try {
          // Once locked, remove from due set to avoid other scans picking it up
          await bufferClearDue(listKey);
          const items = await bufferPopBatch(listKey);
          if (!items || items.length === 0) {
            continue;
          }
          const last = items[items.length - 1];
          if (!last) continue;
      // console.log("[BUFFER][FLUSH] 🔄 Flushing buffer", {
      //   chatId: meta.chatId,
      //   companyId: meta.companyId,
      //   itemCount: items.length,
      //   provider: last.provider,
      //   inboxId: last.inboxId,
      // });
      // Re-check chat status and get ai_agent_id
      const statusRow = await db.oneOrNone<{ status: string | null; ai_agent_id: string | null }>(
        `select status, ai_agent_id from public.chats where id = $1`,
        [meta.chatId],
      );
      const chatStatus = (statusRow?.status || "").toUpperCase();
      if (chatStatus !== "AI") {
        // drop silently
        // console.log("[BUFFER][FLUSH] ⏭️  Chat not in AI status, skipping", {
        //   chatId: meta.chatId,
        //   currentStatus: chatStatus,
        // });
        continue;
      }

      const chatAgentId = statusRow?.ai_agent_id ?? null;
      // console.log("[BUFFER][FLUSH] 🤖 Preparing agent reply", {
      //   chatId: meta.chatId,
      //   agentId: chatAgentId,
      //   messageCount: items.length,
      // });

      // Aggregate user messages into a single prompt
      const lines = items
        .map((it) => (typeof it.text === "string" ? it.text.trim() : ""))
        .filter((t) => t.length > 0);
      if (lines.length === 0) continue;

      const aggregated = lines.join("\n");
      try {
        // Pass contactId (customer_id) and leadId for tool auto-fill
        let chatCustomerId: string | undefined;
        let chatLeadId: string | undefined;
        try {
          const row = await db.oneOrNone<{ customer_id: string | null; lead_id: string | null }>(
            `select customer_id, lead_id from public.chats where id = $1`,
            [meta.chatId],
          );
          chatCustomerId = row?.customer_id || undefined;
          chatLeadId = row?.lead_id || undefined;
        } catch {}
        const ai = await runAgentReply({
          companyId: last.companyId,
          inboxId: last.inboxId,
          agentId: chatAgentId,
          userMessage: aggregated,
          chatId: meta.chatId,
          contactId: chatCustomerId,
          leadId: chatLeadId,
        });
        const reply = (ai.reply || "").trim();
        if (reply) {
          // console.log("[BUFFER][FLUSH] ✅ Agent replied successfully", {
          //   chatId: meta.chatId,
          //   agentId: ai.agentId,
          //   replyLength: reply.length,
          // });
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
          const items = parseAgentReplyToItems(reply);
          await publishParsedItems({ provider: last.provider, inboxId: last.inboxId || undefined, chatId: meta.chatId, items });
        }
      } catch (err) {
        console.warn("[buffer][flush] agent reply failed", {
          companyId: last.companyId,
          chatId: meta.chatId,
          error: err instanceof Error ? err.message : err,
        });
      }
    } finally {
      // Always release lock for this chat
      await bufferReleaseLock(meta.companyId, meta.chatId);
    }
      } catch (innerError) {
        console.warn("[buffer] inner flush error for chat", listKey, 
          innerError instanceof Error ? innerError.message : innerError);
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
  companyId: string | null;
  status: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_from?: "CUSTOMER" | "AGENT" | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_avatar_url?: string | null;
  customer_id: string | null;
  kind?: string | null;
  group_name?: string | null;
  group_avatar_url?: string | null;
  remote_id?: string | null;
  ai_agent_id?: string | null;
  ai_agent_name?: string | null;
  unread_count?: number | null;
} | null> {
  const row = await db.oneOrNone<{
    chat_id: string;
    inbox_id: string | null;
    company_id: string | null;
    status: string | null;
    last_message: string | null;
    last_message_at: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_avatar_url: string | null;
    customer_id: string | null;
    kind: string | null;
    group_name: string | null;
    group_avatar_url: string | null;
    remote_id: string | null;
    ai_agent_id: string | null;
    ai_agent_name: string | null;
    unread_count: number | null;
  }>(
    `select ch.id as chat_id,
            ch.inbox_id,
            ib.company_id,
            ch.status,
            ch.last_message,
            ch.last_message_at,
            ch.kind,
            ch.group_name,
            ch.group_avatar_url,
            ch.remote_id,
            ch.ai_agent_id,
            ch.unread_count,
            ag.name as ai_agent_name,
            cust.name as customer_name,
            cust.phone as customer_phone,
            NULL as customer_avatar_url,
            cust.id as customer_id
       from public.chats ch
  left join public.inboxes ib on ib.id = ch.inbox_id
 left join public.customers cust on cust.id = ch.customer_id
 left join public.agents ag on ag.id = ch.ai_agent_id
      where ch.id = $1`,
    [chatId],
  );
  if (!row) return null;
  return {
    chatId: row.chat_id,
    inboxId: row.inbox_id,
    companyId: row.company_id,
    status: row.status,
    last_message: row.last_message,
    last_message_at: row.last_message_at,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_avatar_url: row.customer_avatar_url,
    customer_id: row.customer_id,
    kind: row.kind,
    group_name: row.group_name,
    group_avatar_url: row.group_avatar_url,
    remote_id: row.remote_id,
    ai_agent_id: row.ai_agent_id,
    ai_agent_name: row.ai_agent_name,
    unread_count: row.unread_count,
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
      "audio/mp4": "m4a",
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

/**
 * Cache helper: get chat ID from cache or database
 * TTL: 1 hour (chats don't change remote_id frequently)
 */
async function getCachedChatId(inboxId: string, remoteId: string): Promise<string | null> {
  const cacheKey = k.chatLookup(inboxId, remoteId);
  const cached = await rGet<string>(cacheKey);
  if (cached) {
    // Validate that cached chatId still exists in DB (avoid phantom IDs)
    try {
      const exists = await db.oneOrNone<{ id: string }>(
        `SELECT id FROM public.chats WHERE id = $1 AND inbox_id = $2 LIMIT 1`,
        [cached, inboxId]
      );
      if (exists?.id) {
        // console.log('[worker][cache] Chat lookup HIT (validated in DB):', { inboxId, remoteId, chatId: cached });
        return cached;
      } else {
        // Cached ID is phantom - invalidate cache
        await rDel(cacheKey);
        // console.log('[worker][cache] Chat lookup HIT but phantom in DB, invalidated:', { inboxId, remoteId, cachedChatId: cached });
      }
    } catch (error) {
      console.warn('[worker][cache] Failed to validate cached chatId:', { inboxId, remoteId, cached, error: error instanceof Error ? error.message : error });
    }
  }

  // console.log('[worker][cache] Chat lookup MISS:', { inboxId, remoteId });
  const row = await db.oneOrNone<{ id: string }>(
    `SELECT id FROM public.chats WHERE inbox_id = $1 AND remote_id = $2 LIMIT 1`,
    [inboxId, remoteId]
  );

  if (row?.id) {
    // Cache for 1 hour
    await rSet(cacheKey, row.id, 3600);
    // console.log('[worker][cache] Chat lookup cached:', { inboxId, remoteId, chatId: row.id });
    return row.id;
  }

  return null;
}

/**
 * Cache helper: save chat ID to cache after creation
 */
async function cacheChatLookup(inboxId: string, remoteId: string, chatId: string): Promise<void> {
  const cacheKey = k.chatLookup(inboxId, remoteId);
  await rSet(cacheKey, chatId, 3600); // 1 hour
  // console.log('[worker][cache] Chat lookup saved:', { inboxId, remoteId, chatId });
}

/**
 * Cache helper: save chat ID under BOTH phone and LID identifiers to handle aliasing
 * When contact identified by LID, also cache under phone format and vice versa
 */
async function cacheChatLookupBiDirectional(
  inboxId: string,
  chatId: string,
  phoneFormatId: string | null,
  lidFormatId: string | null
): Promise<void> {
  const cacheDuration = 3600; // 1 hour

  // Cache under phone format if available
  if (phoneFormatId) {
    const phoneKey = k.chatLookup(inboxId, phoneFormatId);
    await rSet(phoneKey, chatId, cacheDuration);
    // console.log('[worker][cache] Chat lookup saved (phone):', { inboxId, phoneFormat: phoneFormatId, chatId });
  }

  // Cache under LID format if available
  if (lidFormatId) {
    const lidKey = k.chatLookup(inboxId, lidFormatId);
    await rSet(lidKey, chatId, cacheDuration);
    // console.log('[worker][cache] Chat lookup saved (LID):', { inboxId, lidFormat: lidFormatId, chatId });
  }
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
              caption,
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
        caption: row.caption ?? null,
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

function extractContentAndType(m: any): { content: string; type: string; caption: string | null; interactiveContent?: any | null } {
  const t = String(m?.type || "text").toLowerCase();

  switch (t) {
    case "text":
      return { content: String(m?.text?.body ?? ""), type: "TEXT", caption: null };
    case "image":
      return {
        content: m?.image?.caption ? `[IMAGE] ${m.image.caption}` : "[IMAGE]",
        type: "IMAGE",
        caption: m?.image?.caption ? String(m.image.caption) : null,
      };
    case "audio":
      return { content: "[AUDIO]", type: "AUDIO", caption: null };
    case "video":
      return {
        content: m?.video?.caption ? `[VIDEO] ${m.video.caption}` : "[VIDEO]",
        type: "VIDEO",
        caption: m?.video?.caption ? String(m.video.caption) : null,
      };
    case "document":
      return {
        content: m?.document?.filename
          ? `[DOCUMENT] ${m.document.filename}`
          : "[DOCUMENT]",
        type: "DOCUMENT",
        caption: m?.document?.caption ? String(m.document.caption) : null,
      };
    case "sticker":
      return { content: "[STICKER]", type: "STICKER", caption: null };
    case "location":
      return {
        content: `[LOCATION] ${m?.location?.latitude},${m?.location?.longitude}`,
        type: "LOCATION",
        caption: null,
      };
    case "contacts":
      return { content: "[CONTACTS]", type: "CONTACTS", caption: null };
    case "interactive":
      let interactiveText = "[INTERACTIVE]";
      const interactive = m?.interactive;
      if (interactive?.type === "button_reply") {
        interactiveText = interactive.button_reply?.title || "[BUTTON REPLY]";
      } else if (interactive?.type === "list_reply") {
        interactiveText = interactive.list_reply?.title || "[LIST REPLY]";
      }
      return {
        content: interactiveText,
        type: "INTERACTIVE",
        caption: null,
        interactiveContent: m?.interactive ?? null,
      };
    case "button":
      return {
        content: m?.button?.text ?? "[BUTTON]",
        type: "BUTTON",
        caption: null,
        interactiveContent: m?.button ?? null,
      };
    case "template":
      return {
        content: m?.template?.name ? `[TEMPLATE] ${m.template.name}` : "[TEMPLATE]",
        type: "TEMPLATE",
        caption: null,
        interactiveContent: m?.template ?? null,
      };
    case "order":
      return {
        content: "[ORDER]",
        type: "ORDER",
        caption: null,
        interactiveContent: m?.order ?? null,
      };
    case "system":
      return {
        content: m?.system?.body ?? "[SYSTEM]",
        type: "SYSTEM",
        caption: null,
        interactiveContent: m?.system ?? null,
      };
    case "unsupported":
      const errorDetails = m?.errors?.[0]?.error_data?.details || m?.errors?.[0]?.message || "Unknown error";
      return {
        content: `[UNSUPPORTED] ${errorDetails}`,
        type: "TEXT",
        caption: null,
      };
    default:
      console.warn("[META][inbound] Unknown message type:", t, JSON.stringify(m, null, 2));
      // Fallback to TEXT for unknown types to prevent DB enum errors
      return { content: `[${t.toUpperCase()}]`, type: "TEXT", caption: null };
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
  if (hinted === "BUTTON_REPLY" || hinted === "LIST_REPLY") return "INTERACTIVE";
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

/**
 * Extrai número e LID de um identificador Webhook
 * Exemplos:
 * - "55111999999999" => { phone: "55111999999999", lid: null }
 * - "5511999999999@lid" => { phone: "5511999999999", lid: "5511999999999@lid" }
 * - "5511999999999@c.us" => { phone: "5511999999999", lid: null }
 */
function extractPhoneAndLid(
  rawId: string | null | undefined,
): { phone: string | null; lid: string | null } {
  if (!rawId || typeof rawId !== "string") return { phone: null, lid: null };

  const trimmed = rawId.trim();
  if (!trimmed) return { phone: null, lid: null };

  // Se contém @lid, extrair antes e depois
  if (trimmed.includes("@lid")) {
    const beforeLid = trimmed.split("@")[0]; // "5511999999999" de "5511999999999@lid"
    return { phone: beforeLid, lid: trimmed };
  }

  // Se contém @c.us ou @g.us, é só o número
  if (trimmed.includes("@c.us") || trimmed.includes("@g.us")) {
    const beforeAt = trimmed.split("@")[0];
    return { phone: beforeAt, lid: null };
  }

  // Senão, assume que é um número puro
  return { phone: trimmed, lid: null };
}

/**
 * Resolve LID ↔ Número via API WAHA
 * Se só tem LID, busca o número (@c.us)
 * Se só tem número, busca o LID
 * Retorna sempre ambos os identificadores
 */
async function resolveWahaLidAndPhone(
  sessionName: string | null | undefined,
  contactId: string | null | undefined,
  inboxId: string,
): Promise<{ phone: string | null; lid: string | null }> {
  if (!sessionName || !contactId) {
    return { phone: null, lid: null };
  }

  const trimmed = String(contactId).trim();
  if (!trimmed) return { phone: null, lid: null };

  try {
    // Se já tem ambos, retorna
    if (trimmed.includes("@lid") && trimmed.includes("@c.us")) {
      const phone = trimmed.split("@c.us")[0];
      const lid = trimmed.split("|")[1] || null;
      return { phone, lid };
    }

    // Se é LID, busca o número correspondente
    if (trimmed.includes("@lid")) {
      try {
        const response = await wahaFetch<{ lid: string; pn: string }>(
          `/api/${encodeURIComponent(sessionName)}/lids/${encodeURIComponent(trimmed)}`,
        );
        if (response?.pn) {
          const pnNormalized = response.pn.replace("@c.us", "");
          return { phone: pnNormalized, lid: trimmed };
        }
      } catch (error) {
        console.warn("[WAHA][worker] Failed to resolve LID to phone number", {
          sessionName,
          lid: trimmed,
          error,
        });
      }
      // Se falhar, extrai o número do LID (antes do @)
      const phoneFromLid = trimmed.split("@")[0];
      return { phone: phoneFromLid, lid: trimmed };
    }

    // Se é número (@c.us), busca o LID correspondente
    if (trimmed.includes("@c.us")) {
      try {
        const response = await wahaFetch<{ lid: string; pn: string }>(
          `/api/${encodeURIComponent(sessionName)}/lids/pn/${encodeURIComponent(trimmed)}`,
        );
        if (response?.lid) {
          const phoneNormalized = trimmed.replace("@c.us", "");
          return { phone: phoneNormalized, lid: response.lid };
        }
      } catch (error) {
        console.warn("[WAHA][worker] Failed to resolve phone to LID", {
          sessionName,
          phone: trimmed,
          error,
        });
      }
      // Se falhar, usa o número puro
      const phoneNormalized = trimmed.replace("@c.us", "");
      return { phone: phoneNormalized, lid: null };
    }

    // Se é número puro (sem @c.us), adiciona o sufixo e tenta buscar LID
    const asContactId = `${trimmed}@c.us`;
    try {
      const response = await wahaFetch<{ lid: string; pn: string }>(
        `/api/${encodeURIComponent(sessionName)}/lids/pn/${encodeURIComponent(asContactId)}`,
      );
      if (response?.lid) {
        return { phone: trimmed, lid: response.lid };
      }
    } catch (error) {
      console.warn("[WAHA][worker] Failed to resolve pure phone to LID", {
        sessionName,
        phone: asContactId,
        error,
      });
    }

    return { phone: trimmed, lid: null };
  } catch (error) {
    console.error("[WAHA][worker] resolveWahaLidAndPhone unexpected error", {
      sessionName,
      contactId,
      error,
    });
    // Fallback: tenta extrair pelo menos o número
    const extracted = extractPhoneAndLid(contactId);
    return extracted;
  }
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
  
  // Process META statuses
  if (Array.isArray(value?.statuses)) {
    for (const s of value.statuses) {
      const wamid = String(s?.id || "");
      const status = String(s?.status || "");
      if (!wamid || !status) continue;

      const eventUid = `statuses:${wamid}:${status}`;
      const isNew = await saveWebhookEvent(inboxId, "META", eventUid, value);
      if (!isNew) continue;

      const mappedStatus = mapMetaStatusToViewStatus(status);
      await updateMessageStatusByExternalId({
        inboxId,
        externalId: wamid,
        viewStatus: mappedStatus,
      });
    }
  }

  // Process META messages
  if (Array.isArray(value?.messages)) {
    await handleMetaInboundMessages({ inboxId, companyId, value, messages: value.messages });
  }
}

async function handleMetaInboundMessages(args: {
  inboxId: string;
  companyId: string;
  value: any;
  messages: any[];
}): Promise<void> {
  const { inboxId, companyId, value, messages } = args;
  const pushname = getPushName(value);

  for (const m of messages) {
    const wamid = String(m?.id || "");
    if (!wamid) continue;

    // Dedupe
    const eventUid = `messages:${wamid}`;
    const isNew = await saveWebhookEvent(inboxId, "META", eventUid, value);
    if (!isNew) continue;

    const metaContext = extractMetaMessageContext(value, m);
    const isGroupMessage = typeof metaContext.groupId === "string" && metaContext.groupId.endsWith("@g.us");
    const participantWaId =
      (typeof m?.from === "string" && m.from) ||
      metaContext.participantId ||
      null;
    
    // ✅ Extrair número e LID do participantWaId
    const { phone: extractedPhone, lid: extractedLid } = extractPhoneAndLid(participantWaId);
    let remotePhone = extractedPhone ? normalizeMsisdn(extractedPhone) : null;

    // Allow alphanumeric senders (e.g. "WhatsApp")
    if (!remotePhone && extractedPhone && /[a-zA-Z]/.test(extractedPhone)) {
      remotePhone = extractedPhone;
    }

    if (!remotePhone && !isGroupMessage) {
      console.warn("[META][inbound] message without valid 'from'", { wamid, participantWaId });
      continue;
    }

    console.log("[META][inbound] Processing message", {
      wamid,
      participantWaId,
      extractedPhone,
      extractedLid,
      remotePhone,
      pushname,
      participantName: metaContext.participantName,
      isGroupMessage,
      inboxId,
      messageType: m?.type, // Log message type
    });
    // console.log("[META][inbound] Payload:", JSON.stringify(m, null, 2));

    // Ensure chat (group or direct)
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
      // console.log("[META][inbound] Group chat ensured", { chatId, groupId: metaContext.groupId });
    } else {
      const ensured = await ensureLeadCustomerChat({
        inboxId,
        companyId,
        phone: remotePhone || normalizeMsisdn(participantWaId || ""),
        name: metaContext.participantName ?? pushname ?? remotePhone ?? participantWaId ?? null,
        rawPhone: participantWaId || metaContext.participantId || remotePhone || null,
        lid: extractedLid,  // ✅ Passar o LID extraído
      });
      chatId = ensured.chatId;
      // console.log("[META][inbound] Direct chat ensured", {
      //   chatId,
      //   customerId: ensured.customerId,
      //   leadId: ensured.leadId,
      //   phone: remotePhone,
      //   rawPhone: participantWaId,
      //   lid: extractedLid,  // ✅ Log do LID
      // });
    }

    const { content, type, caption, interactiveContent } = extractContentAndType(m);
    
    // Parse timestamp corretamente (pode vir como number ou string)
    let createdAt: Date | null = null;
    if (m?.timestamp) {
      if (typeof m.timestamp === "number") {
        createdAt = new Date(m.timestamp * 1000);
      } else if (typeof m.timestamp === "string") {
        const timestampNum = parseInt(m.timestamp, 10);
        if (!isNaN(timestampNum)) {
          createdAt = new Date(timestampNum * 1000);
        }
      }
    }
    
    // Log para debug de timestamp inválido
    if (m?.timestamp && (!createdAt || isNaN(createdAt.getTime()))) {
      console.warn("[META][inbound] timestamp inválido detectado", {
        wamid,
        rawTimestamp: m?.timestamp,
        timestampType: typeof m?.timestamp,
        parsedTimestamp: createdAt,
      });
    }

    // Upsert remote participant for group messages
    let remoteParticipantId: string | null = null;
    if (isGroupMessage && metaContext.participantId) {
      const participant = await upsertChatRemoteParticipant({
        chatId,
        remoteId: metaContext.participantId,
        name: metaContext.participantName ?? pushname ?? null,
        phone: remotePhone ?? null,
        avatarUrl: metaContext.participantAvatarUrl ?? null,
        isAdmin: false, // Default to false for META messages (admin status not in payload)
        joinedAt: createdAt ?? undefined,
      });
      remoteParticipantId = participant?.id ?? null;
    }

    // Resolve replied message
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

    // ========== OPTIMIZATION: Emit draft message BEFORE database insert ==========
    // This provides instant UI feedback (~200-300ms faster perception)
    const draftTimestamp = new Date().toISOString();
    try {
      await emitSocketWithRetry("socket.livechat.inbound", {
        kind: "livechat.inbound.message",
        chatId,
        companyId,
        message: {
          id: `draft-${wamid}`, // Temporary ID
          chat_id: chatId,
          external_id: wamid,
          body: content,
          content,
          type,
          sender_type: "CUSTOMER",
          sender_id: null,
          sender_name: metaContext.participantName ?? pushname ?? null,
          sender_avatar_url: metaContext.participantAvatarUrl ?? null,
          created_at: createdAt?.toISOString() || draftTimestamp,
          view_status: "DRAFT",
          delivery_status: null,
          is_private: false,
          caption: caption ?? null,
          replied_message_id: repliedMessageId,
          remote_participant_id: remoteParticipantId,
          remote_sender_id: metaContext.participantId ?? participantWaId ?? null,
          remote_sender_name: metaContext.participantName ?? pushname ?? null,
          remote_sender_phone: remotePhone ?? null,
        },
        chatUpdate: {
          chatId,
          last_message: content || (() => {
            const t = (type || "").toUpperCase();
            switch (t) {
              case "IMAGE": return "📷 Imagem";
              case "VIDEO": return "🎥 Vídeo";
              case "AUDIO": return "🎵 Áudio";
              case "PTT": return "🎤 Áudio";
              case "DOCUMENT": return "📄 Documento";
              case "STICKER": return "💟 Figurinha";
              case "LOCATION": return "📍 Localização";
              case "CONTACT": return "👤 Contato";
              default: return "📎 Mídia";
            }
          })(),
          last_message_at: createdAt?.toISOString() || draftTimestamp,
          last_message_from: "CUSTOMER",
          last_message_type: type,
          customer_name: metaContext.participantName ?? pushname ?? null,
          customer_avatar_url: metaContext.participantAvatarUrl ?? null,
        },
      });
      // console.log("[META][inbound][DRAFT] Optimistic message emitted", { chatId, wamid });
    } catch (err) {
      console.error("[META][inbound][DRAFT] Failed to emit draft", { chatId, wamid, error: err });
    }

    // Insert message
    const inserted = await insertInboundMessage({
      chatId,
      externalId: wamid,
      content,
      type,
      caption,
      interactiveContent,
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

    // ========== OPTIMIZATION: Replace draft with confirmed message ==========
    try {
      await emitSocketWithRetry("socket.livechat.inbound", {
        kind: "livechat.inbound.message",
        chatId,
        companyId,
        message: {
          ...inserted,
          view_status: "DELIVERED", // Update from DRAFT to DELIVERED
        },
      });
      // console.log("[META][inbound][CONFIRMED] Draft replaced with real message", {
      //   chatId,
      //   messageId: inserted.id,
      //   draftId: `draft-${wamid}`,
      // });
    } catch (err) {
      console.error("[META][inbound][CONFIRMED] Failed to emit confirmed message", {
        chatId,
        messageId: inserted.id,
        error: err,
      });
    }

    // Increment unread_count (all META inbound messages are from customer)
    try {
      const updated = await db.oneOrNone<{ unread_count: number }>(
        `UPDATE public.chats
         SET unread_count = COALESCE(unread_count, 0) + 1,
             updated_at = now()
         WHERE id = $1
         RETURNING unread_count`,
        [chatId]
      );
      if (updated) {
        // console.log("[UNREAD_COUNT][increment][META] Chat incremented", {
        //   chatId,
        //   newCount: updated.unread_count,
        // });
      }
    } catch (err) {
      console.warn("[UNREAD_COUNT][increment][META] Failed to increment", {
        chatId,
        error: err instanceof Error ? err.message : err,
      });
    }

    // Enqueue media job if needed
    const msgType = String(m?.type || "").toLowerCase();
    let mediaRoot = ["document", "image", "audio", "video", "sticker"].includes(msgType)
      ? (m as any)?.[msgType] ?? null
      : null;
    
    // Check for media in template header
    if (msgType === "template" && !mediaRoot) {
      const components = (m as any)?.template?.components;
      if (Array.isArray(components)) {
        const header = components.find((c: any) => c.type === "header");
        if (header && header.parameters && Array.isArray(header.parameters)) {
           const mediaParam = header.parameters.find((p: any) => ["image", "video", "document"].includes(p.type));
           if (mediaParam) {
             mediaRoot = mediaParam[mediaParam.type];
             // Force type to be the media type so the media worker handles it correctly
             // But we keep the message type as TEMPLATE in the DB
           }
        }
      }
    }

    const mediaId =
      mediaRoot && typeof mediaRoot?.id === "string" && mediaRoot.id.trim() ? mediaRoot.id.trim() : null;
    const mediaFilename =
      mediaRoot && typeof mediaRoot?.filename === "string" && mediaRoot.filename.trim()
        ? mediaRoot.filename.trim()
        : null;
    
    // Determine media type for the job (if it came from template, use the inner type)
    const jobMediaType = (msgType === "template" && mediaRoot) 
       ? (mediaRoot.mime_type?.startsWith("image") ? "image" : mediaRoot.mime_type?.startsWith("video") ? "video" : "document")
       : msgType;

    await enqueueInboundMediaJob({
      provider: "META",
      inboxId,
      companyId,
      chatId,
      messageId: inserted.id,
      externalId: wamid,
      media: mediaId
        ? {
            type: jobMediaType,
            mediaId,
            filename: mediaFilename,
          }
        : null,
    });

    // Auto-reply / Buffer (Agents) — only if chat status == 'AI'
    try {
      const bodyText = typeof content === "string" ? content.trim() : "";
      if (bodyText) {
        const row = await db.oneOrNone<{ status: string | null; ai_agent_id: string | null }>(
          `select status, ai_agent_id from public.chats where id = $1`,
          [chatId],
        );
        const chatStatus = (row?.status || "").toUpperCase();
        if (chatStatus === "AI") {
          const chatAgentId = row?.ai_agent_id ?? null;
          const agent = await getRuntimeAgent(companyId, chatAgentId);
          const windowSec = Number(agent?.aggregation_window_sec || 0);
          const enabled = Boolean(agent?.aggregation_enabled) && windowSec > 0;
          const maxBatch = agent?.max_batch_messages ?? null;
          // console.log("[AGENT][AUTO-REPLY][META] 📥 Message received", {
          //   chatId,
          //   bodyLength: bodyText.length,
          //   aggregationEnabled: enabled,
          //   windowSec,
          //   maxBatch,
          //   agentId: chatAgentId,
          // });
          if (enabled) {
            // console.log("[AGENT][AUTO-REPLY][META] 📦 Enqueueing to buffer", { chatId });
            await bufferEnqueue({
              companyId,
              inboxId,
              chatId,
              provider: "META",
              text: bodyText,
              config: { windowSec, maxBatch },
            });
          } else {
            console.log("[AGENT][AUTO-REPLY][META] ⚡ Immediate reply (no buffer)", { chatId });
            let chatCustomerId2: string | undefined;
            let chatLeadId2: string | undefined;
            try {
              const row2 = await db.oneOrNone<{ customer_id: string | null; lead_id: string | null }>(
                `select customer_id, lead_id from public.chats where id = $1`,
                [chatId],
              );
              chatCustomerId2 = row2?.customer_id || undefined;
              chatLeadId2 = row2?.lead_id || undefined;
            } catch {}
            const ai = await runAgentReply({
              companyId,
              inboxId,
              agentId: chatAgentId,
              userMessage: bodyText,
              chatId,
              contactId: chatCustomerId2,
              leadId: chatLeadId2,
            });

            // Verificar se agente pulou a resposta
            if (ai.skipped) {
              console.log(`[agents][auto-reply][META] skipped: ${ai.reason}`);
            } else {
              const reply = (ai.reply || "").trim();
              if (reply) {
                console.log("[AGENT][AUTO-REPLY][META] ✅ Agent replied", {
                  chatId,
                  agentId: ai.agentId,
                  replyLength: reply.length,
                });
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
                const items = parseAgentReplyToItems(reply);
                await publishParsedItems({ provider: "META", inboxId, chatId, items });
                // Guard against pending buffer flush replying again for this chat
                console.log("[AGENT][AUTO-REPLY][META] 🔒 Pausing buffer to prevent double-reply", { chatId });
                try { await bufferPause(companyId, chatId, 8); } catch { /* ignore */ }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[agents][auto-reply][META] failed:", (e as any)?.message || e);
    }

    // Fetch message for socket
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
      caption: string | null;
      remote_participant_id: string | null;
      remote_sender_id: string | null;
      remote_sender_name: string | null;
      remote_sender_phone: string | null;
      remote_sender_avatar_url: string | null;
      remote_sender_is_admin: boolean | null;
      replied_message_id: string | null;
    }>(
      `select id, chat_id, content, is_from_customer, sender_id, sender_name, sender_avatar_url,
              created_at, type, view_status, media_url, caption, remote_participant_id, remote_sender_id,
              remote_sender_name, remote_sender_phone, remote_sender_avatar_url,
              remote_sender_is_admin, replied_message_id
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
      caption: msgRow.caption ?? null,
      remote_participant_id: msgRow.remote_participant_id ?? null,
      remote_sender_id: msgRow.remote_sender_id ?? null,
      remote_sender_name: msgRow.remote_sender_name ?? null,
      remote_sender_phone: msgRow.remote_sender_phone ?? null,
      remote_sender_avatar_url: msgRow.remote_sender_avatar_url ?? null,
      remote_sender_is_admin: msgRow.remote_sender_is_admin ?? null,
      replied_message_id: msgRow.replied_message_id ?? null,
    };
    // Fetch chat summary for socket
    let inboxIdForSocket: string | null = null;
    try {
      const chatRow = await db.oneOrNone<{ inbox_id: string | null }>(
        `select inbox_id from public.chats where id = $1`,
        [chatId],
      );
      inboxIdForSocket = chatRow?.inbox_id ?? null;
    } catch (e) {
      console.warn("[META][inbound] failed to load chat inbox for socket:", (e as any)?.message || e);
    }
    try {
      const chatSummary = await fetchChatUpdateForSocket(chatId);
      const socketSuccess = await emitSocketWithRetry("socket.livechat.inbound", {
        kind: "livechat.inbound.message",
        chatId,
        companyId,
        inboxId: inboxIdForSocket,
        message: mappedMessage,
        chatUpdate: chatSummary
          ? {
              ...chatSummary,
              last_message_from: mappedMessage.sender_type,
              companyId, // ✅ Ensure companyId is present
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
              companyId, // ✅ Ensure companyId is present in fallback chatUpdate
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
      console.warn("[META][inbound] failed to publish socket event:", (e as any)?.message || e);
    }

    // Update chat last_message
    try {
      await db.none(
        `update public.chats
           set last_message = $1, last_message_at = now()
         where id = $2`,
        [content, chatId],
      );
    } catch (e) {
      console.warn("[META][inbound] failed to update chat last_message:", (e as any)?.message || e);
    }

    // Invalidate caches and prewarm
    setTimeout(() => {
      warmChatMessagesCache(chatId).catch((error) => {
        console.warn("[META][inbound] warm cache failed", {
          chatId,
          error: error instanceof Error ? error.message : error,
        });
      });
    }, 0);

    try {
      await rDel(k.chat(chatId));
    } catch {}

    try {
      await invalidateChatCaches(chatId, {
        companyId,
        inboxId,
        kind: isGroupMessage ? "GROUP" : "DIRECT",
        chatType: isGroupMessage ? "GROUP" : "CONTACT",
        remoteId: isGroupMessage ? metaContext.groupId ?? null : participantWaId ?? null,
      });
    } catch (e) {
      console.warn("[META][inbound] failed to invalidate caches:", (e as any)?.message || e);
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
      if (!info?.url) throw new Error("Meta não retornou URL da mídia");

      console.log("[META][inbound.media] 📥 Downloading media from Meta", {
        mediaId,
        mimeType: info.mime_type,
        size: info.file_size,
      });

      const bin = await downloadMedia(graphCreds, info.url);
      const buf = Buffer.from(bin);

      const safeFilename = job.media.filename
        ? sanitizeFilename(job.media.filename)
        : `${mediaId}.${extFromMime(info.mime_type) || "bin"}`;

      // Upload para Supabase Storage ao invés de salvar no disco
      console.log("[META][inbound.media] ☁️  Uploading to Supabase Storage", {
        filename: safeFilename,
        size: buf.length,
      });

      const uploadResult = await uploadBufferToStorage({
        buffer: buf,
        contentType: info.mime_type || "application/octet-stream",
        path: buildStoragePath({
          companyId: companyKey || "unknown",
          chatId: chatId || "unknown",
          filename: safeFilename,
          prefix: "meta-inbound",
        }),
      });

      console.log("[META][inbound.media] ✅ Upload successful", {
        storagePath: uploadResult.path,
        publicUrl: uploadResult.publicUrl,
        sha256: uploadResult.sha256,
      });

      await db.none(
        `insert into public.chat_attachments
            (message_id, provider, provider_media_id, kind, mime_type, filename, bytes, sha256, storage_bucket, storage_key, public_url)
         values ($1,'META',$2,$3,$4,$5,$6,$7,'supabase',$8,$9)`,
        [
          messageId,
          mediaId,
          String(job.media.type || "").toUpperCase(),
          info.mime_type ?? null,
          job.media.filename ?? null,
          buf.length,
          uploadResult.sha256,
          uploadResult.path,
          uploadResult.publicUrl,
        ],
      );

      // Store public URL directly (no encryption needed - it's already public)
      // media_url = public_url for direct access, media_storage_path for proxy fallback
      await db.none(
        `update public.chat_messages set media_url = $2, media_storage_path = $3, media_public_url = $4, media_source = $5 where id = $1`,
        [messageId, uploadResult.publicUrl, uploadResult.path, uploadResult.publicUrl, "META"],
      );

      console.log("[META][inbound.media] 💾 Database updated", { messageId });

      // ✅ Emitir evento Socket.IO para atualizar frontend em tempo real
      try {
        const io = getIO();
        if (io && chatId) {
          // Buscar caption da mensagem
          const messageData = await db.oneOrNone<{ caption: string | null }>(
            'SELECT caption FROM public.chat_messages WHERE id = $1',
            [messageId]
          );
          
          io.to(`chat:${chatId}`).emit("message:media-ready", {
            messageId,
            media_url: buildProxyUrl(uploadResult.publicUrl),
            media_public_url: uploadResult.publicUrl,
            media_storage_path: uploadResult.path,
            caption: messageData?.caption ?? null,
          });
          
          console.log('[META][inbound.media] 📡 Socket event emitted:', { 
            messageId, 
            chatId, 
            hasCaption: !!messageData?.caption 
          });
        }
      } catch (socketError) {
        console.warn('[META][inbound.media] ⚠️ Failed to emit socket event:', socketError);
      }
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

/**
 * Verifica se uma inbox requer mídias sensíveis (proxy obrigatório)
 */
async function checkIfInboxSensitive(inboxId: string): Promise<boolean> {
  try {
    const { data: inbox } = await supabaseAdmin
      .from('inboxes')
      .select('force_sensitive_media, tags, metadata')
      .eq('id', inboxId)
      .maybeSingle();

    if (!inbox) return false;

    // Regra 1: Configuração explícita na inbox
    if (inbox.force_sensitive_media === true) {
      return true;
    }

    // Regra 2: Tags específicas
    const tags = Array.isArray(inbox.tags) ? inbox.tags : [];
    if (tags.includes('healthcare') || tags.includes('finance') || tags.includes('confidential')) {
      return true;
    }

    // Regra 3: Metadados
    const metadata = inbox.metadata || {};
    if (metadata.requires_privacy === true) {
      return true;
    }

    // Padrão: NÃO sensível (usa CDN público)
    return false;
  } catch (error) {
    console.error('[WAHA][worker] checkIfInboxSensitive failed:', error);
    // Em caso de erro, assume sensível (seguro por padrão)
    return true;
  }
}

/**
 * Processa mídia em background (não bloqueia a mensagem)
 * Atualiza a mensagem quando o upload terminar
 */
async function processMediaInBackground(args: {
  messageId: string;
  chatId: string;
  inboxId: string;
  companyId: string;
  mediaObj: any;
  isSensitive: boolean;
  payload: any;
}): Promise<void> {
  const { messageId, chatId, inboxId, companyId, mediaObj, isSensitive, payload } = args;
  
  console.log('[WAHA][background] 🎬 Starting media processing:', {
    messageId,
    chatId,
    hasMediaObj: !!mediaObj,
  });

  const m = mediaObj || {};
  let mediaSource: 'waha_file' | 'waha_url' | 'waha_base64' | null = null;
  let mediaData: string | null = null;
  let mimeType = m?.mimetype || 'application/octet-stream';

  // Detect source and data
  if (m.filePath) {
    mediaSource = 'waha_file';
    mediaData = m.filePath;
  } else if (m.file) {
    mediaSource = 'waha_file';
    mediaData = m.file;
  } else if (m.url) {
    mediaSource = 'waha_url';
    mediaData = m.url;
  } else if (m.base64) {
    mediaSource = 'waha_base64';
    mediaData = m.base64;
    mimeType = String(mimeType).split(";")[0].trim() || "application/octet-stream";
  }
  
  if (!mediaSource || !mediaData) {
    console.warn('[WAHA][background] No valid media source found');
    return;
  }

  console.log('[WAHA][background] 🔍 Media source detection:', {
    mediaSource,
    mimeType,
    dataLength: mediaData.length,
  });

  try {
    // Download/read media to buffer
    let extraHeaders: Record<string, string> | undefined;
    if (mediaSource === 'waha_url' && typeof mediaData === 'string' && mediaData.startsWith(WAHA_BASE_URL)) {
      try {
        const { apiKey } = await getWahaInboxConfig(inboxId);
        extraHeaders = {
          Authorization: `Bearer ${apiKey}`,
          "X-Api-Key": apiKey,
        };
      } catch (e) {
        console.warn('[WAHA][background] could not resolve inbox apiKey', e);
      }
    }

    const { buffer, mimeType: detectedMime } = await downloadMediaToBuffer({
      source: mediaSource === 'waha_file' ? 'file' : 
              mediaSource === 'waha_url' ? 'url' : 'base64',
      data: mediaData,
      mimeType,
      headers: extraHeaders,
    });

    // Upload to storage
    const filename = pickFilename(m?.filename, detectedMime);
    const mediaInfo = await uploadWahaMedia({
      buffer,
      contentType: detectedMime,
      filename,
      companyId,
      chatId,
      source: mediaSource
    });

    console.log('[WAHA][background] ✅ Media uploaded:', {
      messageId,
      storagePath: mediaInfo.storagePath,
      publicUrl: mediaInfo.publicUrl,
      size: buffer.length,
    });

    // Update message with media
    const publicUrl = isSensitive ? null : mediaInfo.publicUrl;
    await db.none(
      `UPDATE public.chat_messages
       SET media_url = $2,
           media_storage_path = $3,
           media_sha256 = $4,
           media_source = $5,
           is_media_sensitive = $6,
           updated_at = now()
       WHERE id = $1`,
      [messageId, mediaInfo.publicUrl, mediaInfo.storagePath, mediaInfo.sha256, mediaSource, isSensitive]
    );

    // Create attachment record
    await upsertWahaAttachment({
      messageId,
      chatId,
      inboxId,
      companyId,
      url: mediaInfo.publicUrl,
      mimeType: payload?.media?.mimetype ?? detectedMime ?? null,
      filename: payload?.media?.filename ?? filename ?? null,
    });

    // Update chat's last message media URL
    await db.none(
      `UPDATE public.chats
       SET last_message_media_url = $2,
           updated_at = now()
       WHERE id = $1`,
      [chatId, mediaInfo.publicUrl]
    );

    // Emit socket update with media
    try {
      // Buscar o caption da mensagem para enviar no evento
      const messageData = await db.oneOrNone<{ caption: string | null }>(
        'SELECT caption FROM public.chat_messages WHERE id = $1',
        [messageId]
      );

      const socketPayload = {
        kind: "livechat.media.ready",
        chatId,
        messageId,
        media_url: buildProxyUrl(publicUrl),
        media_public_url: publicUrl,
        media_storage_path: mediaInfo.storagePath,
        caption: messageData?.caption ?? null,
        companyId,
        chatUpdate: {
          chatId,
          last_message_media_url: buildProxyUrl(publicUrl),
        }
      };

      const socketSuccess = await emitSocketWithRetry("socket.livechat.media", socketPayload);
      
      if (socketSuccess) {
        console.log('[WAHA][background] 📡 Socket events emitted via queue:', { messageId, chatId, hasCaption: !!messageData?.caption });
      } else {
        console.warn('[WAHA][background] ⚠️ Failed to emit socket events via queue');
      }
    } catch (ioError) {
      console.warn('[WAHA][background] ⚠️ Failed to prepare/emit socket events:', ioError instanceof Error ? ioError.message : ioError);
    }

    console.log('[WAHA][background] 🎉 Media processing complete:', { messageId, chatId });
  } catch (error) {
    console.error('[WAHA][background] ❌ Media processing failed:', {
      messageId,
      chatId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

async function handleWahaMessage(job: WahaInboundPayload, payload: any) {
  // Unwrap common WAHA envelope shapes
  const msg = payload?.data ?? payload?.message ?? payload;
  
  // console.log('[WAHA][worker] 📥 Raw payload received:', {
  //   hasPayloadData: !!payload?.data,
  //   hasPayloadMessage: !!payload?.message,
  //   msgKeys: msg ? Object.keys(msg).slice(0, 20) : [],
  //   msgType: msg?.type,
  //   msgHasMedia: msg?.hasMedia,
  //   msgMediaKeys: msg?.media ? Object.keys(msg.media) : null,
  //   fullPayload: JSON.stringify(payload).substring(0, 500) // Primeiros 500 chars
  // });

  const messageId = String(msg?.id || "");
  if (messageId) {
    try {
      await saveWebhookEvent(job.inboxId, "WAHA", `waha:message:${messageId}`, job.raw ?? msg ?? payload);
    } catch (error) {
      console.warn("[WAHA][worker] saveWebhookEvent failed", { inboxId: job.inboxId, messageId, error });
    }
  }

  const chatJid = extractWahaChatId(msg);
  if (!chatJid) {
    console.warn("[WAHA][worker] message without chat id", { payload });
    return;
  }
  if (isWahaStatusBroadcast(chatJid) || isWahaStatusBroadcast(msg?.from) || isWahaStatusBroadcast(msg?.to)) {
    console.debug("[WAHA][worker] skipping status broadcast message", {
      inboxId: job.inboxId,
      chatJid,
      messageId,
    });
    return;
  }

  const name = extractWahaContactName(msg);
  const basePhone =
    normalizeMsisdn(chatJid) ||
    normalizeMsisdn(msg?.from) ||
    normalizeMsisdn(msg?.to);
  const isGroupChat = isWahaGroupJid(chatJid);

  let chatId: string;
  let phoneForLead = basePhone && basePhone.trim() ? basePhone : chatJid;

  let groupMeta: { name: string | null; avatarUrl: string | null } | null = null;

  // ========== WAHA LID RESOLUTION ==========
  // O webhook pode vir com:
  // - payload.from = "556999999999@c.us" (número)
  // - payload.from = "138955630588105@lid" (LID)
  // Precisamos resolver ambos para evitar criar chats duplicados
  
  const isGroupChat_check = isWahaGroupJid(chatJid);
  let resolvedPhone: string | null = null;
  let resolvedLid: string | null = null;

  if (!isGroupChat_check && !msg?.fromMe) {
    // Para mensagens de customer (não fromMe), resolve sempre número + LID
    try {
      const resolved = await resolveWahaLidAndPhone(
        job.session ?? "default",
        chatJid,
        job.inboxId
      );
      resolvedPhone = resolved.phone;
      resolvedLid = resolved.lid;
      
      // console.log('[WAHA][worker] 🔍 Resolved contact LID/Phone from API:', {
      //   chatJid,
      //   resolvedPhone,
      //   resolvedLid,
      // });
    } catch (error) {
      console.warn('[WAHA][worker] ⚠️ Failed to resolve LID/Phone, using local extraction', {
        chatJid,
        error,
      });
      // Fallback: usa extração local
      const extracted = extractPhoneAndLid(chatJid);
      resolvedPhone = extracted.phone;
      resolvedLid = extracted.lid;
    }
  }

  // Use resolved values if available, otherwise fallback
  const phoneForContact = resolvedPhone || phoneForLead;
  const lidForContact = resolvedLid || null;
  
  // console.log('[WAHA][worker] 📱 Contact identification:', { 
  //   chatJid,
  //   phoneForContact,
  //   lidForContact,
  //   isGroupChat: isGroupChat_check,
  //   messageId 
  // });

  // ========== OPTIMIZATION: Try cache first ==========
  let cachedChatId = await getCachedChatId(job.inboxId, chatJid);
  
  if (cachedChatId) {
    chatId = cachedChatId;
    // console.log('[WAHA][worker] ⚡ Chat found in cache:', { chatId, chatJid });
  } else if (isGroupChat) {
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
    // Cache the result
    await cacheChatLookup(job.inboxId, chatJid, chatId);
  } else {
    const ensured = await ensureLeadCustomerChat({
      inboxId: job.inboxId,
      companyId: job.companyId,
      phone: phoneForContact,
      name: name ?? phoneForContact,
      rawPhone: chatJid,
      lid: lidForContact,
    });
    chatId = ensured.chatId;
    
    // ========== NEW: Cache under BOTH phone and LID formats ==========
    // Build phone format ID: add @c.us suffix if not present
    let phoneFormatId: string | null = null;
    let lidFormatId: string | null = null;
    
    if (phoneForContact) {
      phoneFormatId = phoneForContact.includes("@") ? phoneForContact : `${phoneForContact}@c.us`;
    }
    
    if (lidForContact) {
      lidFormatId = lidForContact.includes("@") ? lidForContact : `${lidForContact}@lid`;
    }
    
    // Cache using bi-directional mapping
    await cacheChatLookupBiDirectional(job.inboxId, chatId, phoneFormatId, lidFormatId);
    // console.log('[WAHA][worker] 🔐 Chat cached with bi-directional mapping:', {
    //   chatId,
    //   phoneFormat: phoneFormatId,
    //   lidFormat: lidFormatId,
    // });
  }
  
  // Load group metadata if from cache and is group
  if (cachedChatId && isGroupChat && !groupMeta) {
    groupMeta = extractWahaGroupMetadata(payload);
    rememberAvatar(job.companyId, chatJid, groupMeta?.avatarUrl ?? null);
  }

  const isFromCustomer = !msg?.fromMe;
  const ackStatus = mapWahaAckToViewStatus(msg?.ack) ?? (isFromCustomer ? "Pending" : "Sent");
  
  // ========== DEDUPE: Check if message already exists (agent phone vs system) ==========
  // If fromMe=true, verify if this message was already sent by the system to avoid duplicates
  let existingMessage: { id: string; is_from_customer: boolean; sender_id: string | null } | null = null;
  let sentFromDevice: 'web' | 'whatsapp' | null = null;

  if (msg?.fromMe && messageId) {
    try {
      existingMessage = await db.oneOrNone<{ id: string; is_from_customer: boolean; sender_id: string | null }>(
        `SELECT id, is_from_customer, sender_id 
         FROM public.chat_messages 
         WHERE external_id = $1 AND inbox_id = $2`,
        [messageId, job.inboxId]
      );

      if (existingMessage) {
        // Message already exists - this is an echo from system-sent message
        // console.log('[WAHA][fromMe=true] Message already exists (system echo), updating status only', {
        //   messageId,
        //   existingId: existingMessage.id,
        //   chatId,
        // });

        // Update status if changed
        if (ackStatus) {
          await updateMessageStatusByExternalId({
            inboxId: job.inboxId,
            externalId: messageId,
            viewStatus: ackStatus,
          });
          
          const normalizedStatus = typeof ackStatus === "string" ? ackStatus.toUpperCase() : null;
          await publishApp("socket.livechat.status", {
            kind: "livechat.message.status",
            chatId,
            companyId: job.companyId,
            messageId: existingMessage.id,
            externalId: messageId,
            view_status: ackStatus,
            raw_status: ackStatus,
            status: normalizedStatus,
            draftId: job?.draftId ?? msg?.draftId ?? null,
            reason: null,
          });
        }
        
        return; // Skip insertion - message already processed
      }

      // Message doesn't exist - this is from agent's phone
      // console.log('[WAHA][fromMe=true] New message from agent phone (not system)', {
      //   messageId,
      //   chatJid,
      //   chatId,
      // });
      sentFromDevice = 'whatsapp'; // Mark as sent from WhatsApp phone
      
    } catch (error) {
      console.warn('[WAHA][fromMe] Failed to check existing message', {
        messageId,
        error: error instanceof Error ? error.message : error,
      });
    }
  } else if (!isFromCustomer) {
    // fromMe=false messages from system (shouldn't happen in practice)
    sentFromDevice = 'web';
  }
  
  // ========== OPTIMIZED: DETECT MEDIA BUT DON'T PROCESS YET ==========
  // Extract media from WAHA payload but defer processing to background
  let mediaObj: any = msg?.media || null;
  
  // console.log('[WAHA][worker] 📦 Media object extraction:', {
  //   hasMsgMedia: !!msg?.media,
  //   hasMsgFile: !!msg?.file,
  //   hasMsgUrl: !!msg?.url,
  //   msgMedia: msg?.media,
  //   msgFile: msg?.file,
  //   msgUrl: msg?.url,
  //   msgFilename: msg?.filename,
  //   msgMimetype: msg?.mimetype
  // });
  
  if (!mediaObj && msg?.file) {
    // Outbound-style schema echoed back or custom webhook shape
    const f = msg.file;
    mediaObj = {
      url: f?.url || undefined,
      base64: f?.data || undefined,
      filename: f?.filename || msg?.filename,
      mimetype: f?.mimetype || msg?.mimetype,
    };
  }
  if (!mediaObj && (msg?.url || msg?.mimetype || msg?.filename)) {
    mediaObj = {
      url: msg?.url,
      filename: msg?.filename,
      mimetype: msg?.mimetype,
    };
  }
  if (mediaObj && !msg?.media) {
    try { (msg as any).media = mediaObj; } catch {}
  }

  const hasMedia = Boolean(msg?.hasMedia || mediaObj);
  
  // console.log('[WAHA][worker] 🔍 Media detection:', {
  //   hasMedia,
  //   msgHasMedia: msg?.hasMedia,
  //   hasMediaObj: !!mediaObj,
  //   mediaObjKeys: mediaObj ? Object.keys(mediaObj) : [],
  //   messageId,
  //   chatJid
  // });

  // Determine if inbox requires sensitive media handling
  const isSensitive = await checkIfInboxSensitive(job.inboxId);
  
  // console.log('[WAHA][worker] Media sensitivity:', {
  //   inboxId: job.inboxId,
  //   isSensitive,
  //   hasMedia
  // });
  
  const messageType = deriveWahaMessageType(msg);
  
  // FIX: Friendly text for media types
  const getFriendlyMediaText = (type: string) => {
    switch (type) {
      case "IMAGE": return "📷 Imagem";
      case "VIDEO": return "🎥 Vídeo";
      case "AUDIO": return "🎵 Áudio";
      case "VOICE": return "🎤 Voz";
      case "DOCUMENT": return "📄 Documento";
      case "STICKER": return "💟 Figurinha";
      case "LOCATION": return "📍 Localização";
      case "CONTACT": return "👤 Contato";
      default: return type === "TEXT" ? "" : `[${type}]`;
    }
  };

  let rawBody = typeof msg?.body === "string" ? msg.body.trim() : "";
  // Fix artifacts
  if (rawBody.includes("?? audio") || rawBody.includes("?? Audio")) rawBody = "";

  const body =
    rawBody
      ? rawBody
      : hasMedia
        ? getFriendlyMediaText(messageType)
        : "";
  const createdAt =
    typeof msg?.timestamp === "number"
      ? new Date(msg.timestamp * 1000)
      : msg?.timestamp
        ? new Date(msg.timestamp)
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
      remoteMeta = extractWahaRemoteParticipant(msg);
    } else {
      const directRemoteId = normalizeWahaJid(msg?.from) || chatJid;
      remoteMeta = {
        remoteId: directRemoteId,
        name: name ?? null,
        phone: normalizeMsisdn(directRemoteId ?? "") || phoneForLead || null,
        avatarUrl:
          msg?.senderProfilePic ||
          msg?.authorAvatar ||
          msg?.contactAvatar ||
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

  const quotedExternalId = extractWahaQuotedMessageId(msg);
  const repliedMessageId =
    quotedExternalId && chatId
      ? await findChatMessageIdByExternalId(chatId, quotedExternalId)
      : null;

  // Extract interactive content for WAHA
  const interactiveContent = msg?.interactive || msg?.button || msg?.list || msg?.template || null;

  // Extract caption from message (WAHA sends caption in body for media messages)
  const caption = hasMedia && body && body !== getFriendlyMediaText(messageType) ? body : null;
  
  // console.log('[WAHA][worker] 📝 Caption extraction:', {
  //   hasMedia,
  //   body,
  //   messageType,
  //   extractedCaption: caption,
  //   messageId
  // });

  // ========== STEP 1: INSERT MESSAGE WITHOUT MEDIA (FAST PATH) ==========
  const upsertResult = await upsertChatMessage({
    chatId,
    externalId: messageId || `${chatId}:${Date.now()}`,
    isFromCustomer,
    content: body,
    type: messageType,
    viewStatus: ackStatus ?? null,
    sentFromDevice,
    caption: caption,
    // No media yet - will be updated in background
    mediaStoragePath: null,
    mediaPublicUrl: null,
    mediaSource: null,
    isMediaSensitive: isSensitive,
    mediaUrl: null,
    mediaSha256: null,
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
    interactiveContent,
  });

  if (!upsertResult) return;

  await touchChatAfterMessage({
    chatId,
    content: body,
    lastMessageFrom: isFromCustomer ? "CUSTOMER" : "AGENT",
    lastMessageType: upsertResult.message.type ?? messageType ?? "TEXT",
    lastMessageMediaUrl: null, // No media yet
    listContext: {
      companyId: job.companyId,
      inboxId: job.inboxId,
      kind: isGroupChat ? "GROUP" : "DIRECT",
      chatType: isGroupChat ? "GROUP" : "CONTACT",
      remoteId: isGroupChat ? chatJid : normalizeWahaJid(chatJid),
    },
  });

  if (!upsertResult.inserted) {
    if (ackStatus && !isFromCustomer) {
      const normalizedStatus = typeof ackStatus === "string" ? ackStatus.toUpperCase() : null;
      await publishApp("socket.livechat.status", {
        kind: "livechat.message.status",
        chatId,
        companyId: job.companyId,
        messageId: upsertResult.message.id,
        externalId: messageId,
        view_status: ackStatus,
        raw_status: ackStatus,
        status: normalizedStatus,
        draftId: job?.draftId ?? msg?.draftId ?? null,
        reason: null,
      });
    }
    return;
  }

  // Increment unread_count for inbound customer messages
  if (isFromCustomer) {
    try {
      const updated = await db.oneOrNone<{ unread_count: number }>(
        `UPDATE public.chats
         SET unread_count = COALESCE(unread_count, 0) + 1,
             updated_at = now()
         WHERE id = $1
         RETURNING unread_count`,
        [chatId]
      );
      if (updated) {
        console.log("[UNREAD_COUNT][increment][WAHA] Chat incremented", {
          chatId,
          newCount: updated.unread_count,
        });
      }
    } catch (err) {
      console.warn("[UNREAD_COUNT][increment][WAHA] Failed to increment", {
        chatId,
        error: err instanceof Error ? err.message : err,
      });
    }
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
    media_url: buildProxyUrl(upsertResult.message.media_url) ?? null,
    media_public_url: upsertResult.message.media_public_url ?? null,
    media_storage_path: upsertResult.message.media_storage_path ?? null,
    caption: caption ?? null,
    remote_sender_id: upsertResult.message.remote_sender_id ?? null,
    remote_sender_name: upsertResult.message.remote_sender_name ?? null,
    remote_sender_phone: upsertResult.message.remote_sender_phone ?? null,
    remote_sender_avatar_url: upsertResult.message.remote_sender_avatar_url ?? null,
    remote_sender_is_admin: upsertResult.message.remote_sender_is_admin ?? null,
    remote_participant_id: upsertResult.message.remote_participant_id ?? null,
    replied_message_id: upsertResult.message.replied_message_id ?? null,
    client_draft_id: job?.draftId ?? msg?.draftId ?? null,
  };

  // ========== STEP 2: EMIT SOCKET IMMEDIATELY (BEFORE MEDIA PROCESSING) ==========
  try {
    // console.log("[worker][WAHA] 🔄 Starting socket emission process:", {
    //   chatId,
    //   companyId: job.companyId,
    //   inboxId: job.inboxId,
    //   messageId: mappedMessage.id,
    //   sender_type: mappedMessage.sender_type,
    //   body_preview: mappedMessage.body?.substring(0, 50),
    // });

    const chatSummary = await fetchChatUpdateForSocket(chatId);
    
    // console.log("[worker][WAHA] 📊 Chat summary fetched:", {
    //   chatId,
    //   hasSummary: !!chatSummary,
    //   summary_keys: chatSummary ? Object.keys(chatSummary) : [],
    // });

    const chatUpdatePayload = chatSummary
      ? {
          ...chatSummary,
          last_message_from: mappedMessage.sender_type,
          companyId: job.companyId,
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
          companyId: job.companyId,
        };

    // console.log("[worker][WAHA] 📦 Socket payload prepared:", {
    //   chatId,
    //   companyId: job.companyId,
    //   has_chatUpdate: true,
    //   chatUpdate_companyId: chatUpdatePayload.companyId,
    //   chatUpdate_last_message_from: chatUpdatePayload.last_message_from,
    //   chatUpdate_last_message_preview: chatUpdatePayload.last_message?.substring(0, 30),
    // });

    const socketSuccess = await emitSocketWithRetry("socket.livechat.inbound", {
      kind: "livechat.inbound.message",
      chatId,
      companyId: job.companyId,
      inboxId: job.inboxId,
      message: mappedMessage,
      chatUpdate: chatUpdatePayload,
    });

    if (!socketSuccess) {
      console.error("[worker][WAHA] ❌ Socket emission FAILED after all retries:", {
        operation: 'inbound',
        messageId: mappedMessage.id,
        chatId,
        inboxId: job.inboxId,
        companyId: job.companyId,
        provider: 'WAHA',
        hasDraft: !!job?.draftId
      });
    } else {
      console.log("[worker][WAHA] ✅ Socket emitted successfully:", {
        event: "socket.livechat.inbound",
        chatId,
        inboxId: job.inboxId,
        messageId: mappedMessage.id,
        hasChatSummary: !!chatSummary,
        companyId: job.companyId,
        chatUpdate_companyId: chatUpdatePayload.companyId,
      });

      // 🔔 NOTIFICATION: Send notification to assigned user OR admins
      try {
        // 1. Fetch chat details to get assignee_agent (which links to inbox_users)
        const { data: chatData, error: chatError } = await supabaseAdmin
          .from("chats")
          .select("assignee_agent, customer_name, customer_phone")
          .eq("id", chatId)
          .single();

        const senderName = chatData?.customer_name || chatData?.customer_phone || "Cliente";
        const msgPreview = mappedMessage.body 
          ? (mappedMessage.body.length > 50 ? mappedMessage.body.substring(0, 50) + "..." : mappedMessage.body)
          : (hasMedia ? "📷 Mídia" : "Nova mensagem");

        const targetUserIds: string[] = [];

        if (chatData && chatData.assignee_agent) {
          // Resolve user_id from inbox_users
          const { data: inboxUser } = await supabaseAdmin
            .from("inbox_users")
            .select("user_id")
            .eq("id", chatData.assignee_agent)
            .single();
            
          if (inboxUser && inboxUser.user_id) {
            targetUserIds.push(inboxUser.user_id);
            console.log(`[worker][WAHA] 🔔 Chat assigned to agent ${chatData.assignee_agent} (User: ${inboxUser.user_id})`);
          } else {
             console.warn(`[worker][WAHA] ⚠️ Chat has assignee_agent ${chatData.assignee_agent} but could not resolve user_id`);
          }
        } 
        
        if (targetUserIds.length === 0) {
          console.log(`[worker][WAHA] 🔕 Chat ${chatId} has no assigned user (or resolution failed). Fetching admins...`);
          // Fetch admins/managers
          const { data: admins } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("company_id", job.companyId)
            .in("role", ["ADMIN", "MANAGER"]);
          
          if (admins && admins.length > 0) {
            targetUserIds.push(...admins.map(a => a.id));
            // console.log(`[worker][WAHA] 🔔 Will notify ${admins.length} admins/managers`);
          } else {
            // console.log(`[worker][WAHA] ⚠️ No admins found for company ${job.companyId}`);
          }
        }

        // Send notifications
        for (const userId of targetUserIds) {
          try {
            const notification = await NotificationService.create({
              type: "CHAT_MESSAGE",
              title: `Nova mensagem de ${senderName}`,
              message: msgPreview,
              userId: userId,
              companyId: job.companyId,
              data: {
                chatId,
                messageId: mappedMessage.id,
                senderName
              },
              category: "chat",
              actionUrl: `/livechat/${chatId}`
            });

            // Emit socket event via RabbitMQ (since we are in worker)
            await emitSocketWithRetry("socket.livechat.notification", {
              kind: "notification",
              userId: userId,
              notification: {
                ...notification,
                isNew: true
              }
            });
            // console.log(`[worker][WAHA] 📨 Socket event sent for user ${userId}`);
          } catch (innerErr) {
            console.error(`[worker][WAHA] ❌ Failed to notify user ${userId}:`, innerErr);
          }
        }
      } catch (notifError) {
        console.error("[worker][WAHA] ❌ Failed to send notification:", notifError);
      }
    }
  } catch (error) {
    console.error("[WAHA][worker] ❌ EXCEPTION during socket publish:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      chatId,
      companyId: job.companyId,
    });
  }

  // ========== STEP 3: PROCESS MEDIA IN BACKGROUND (NON-BLOCKING) ==========
  if (hasMedia && mediaObj) {
    // Don't await - process in background
    processMediaInBackground({
      messageId: upsertResult.message.id,
      chatId,
      inboxId: job.inboxId,
      companyId: job.companyId,
      mediaObj,
      isSensitive,
      payload,
    }).catch((error) => {
      console.error('[WAHA][worker] Background media processing failed:', {
        messageId: upsertResult.message.id,
        chatId,
        error: error instanceof Error ? error.message : error,
      });
    });
  }

  if (ackStatus && !isFromCustomer) {
    const normalizedStatus = typeof ackStatus === "string" ? ackStatus.toUpperCase() : null;
    await publishApp("socket.livechat.status", {
      kind: "livechat.message.status",
      chatId,
      companyId: job.companyId,
      messageId: mappedMessage.id,
      externalId: messageId,
      view_status: ackStatus,
      raw_status: ackStatus,
      status: normalizedStatus,
      draftId: job?.draftId ?? msg?.draftId ?? null,
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
      const row = await db.oneOrNone<{ status: string | null; ai_agent_id: string | null }>(
        `select status, ai_agent_id from public.chats where id = $1`,
        [chatId],
      );
      const chatStatus = (row?.status || "").toUpperCase();
      if (chatStatus === "AI") {
        const chatAgentId = row?.ai_agent_id ?? null;
        const agent = await getRuntimeAgent(job.companyId, chatAgentId);
        const windowSec = Number(agent?.aggregation_window_sec || 0);
        const enabled = Boolean(agent?.aggregation_enabled) && windowSec > 0;
        const maxBatch = agent?.max_batch_messages ?? null;
        console.log("[AGENT][AUTO-REPLY][WAHA] 📥 Message received", {
          chatId,
          bodyLength: body.length,
          aggregationEnabled: enabled,
          windowSec,
          maxBatch,
          agentId: chatAgentId,
        });
        if (enabled) {
          console.log("[AGENT][AUTO-REPLY][WAHA] 📦 Enqueueing to buffer", { chatId });
          await bufferEnqueue({
            companyId: job.companyId,
            inboxId: job.inboxId,
            chatId,
            provider: WAHA_PROVIDER,
            text: body,
            config: { windowSec, maxBatch },
          });
        } else {
          console.log("[AGENT][AUTO-REPLY][WAHA] ⚡ Immediate reply (no buffer)", { chatId });
          // Passar contactId (customer_id) e leadId para evitar falta na ferramenta
          let chatCustomerId3: string | undefined;
          let chatLeadId3: string | undefined;
          try {
            const rowCust = await db.oneOrNone<{ customer_id: string | null; lead_id: string | null }>(
              `select customer_id, lead_id from public.chats where id = $1`,
              [chatId]
            );
            chatCustomerId3 = rowCust?.customer_id || undefined;
            chatLeadId3 = rowCust?.lead_id || undefined;
          } catch {}
          const ai = await runAgentReply({
            companyId: job.companyId,
            inboxId: job.inboxId,
            agentId: chatAgentId,
            userMessage: body,
            chatId,
            contactId: chatCustomerId3,
            leadId: chatLeadId3,
          });

            // Verificar se agente pulou a resposta
            if (ai.skipped) {
              console.log(`[agents][auto-reply][WAHA] skipped: ${ai.reason}`);
            } else {
              const reply = (ai.reply || "").trim();
              if (reply) {
                console.log("[AGENT][AUTO-REPLY][WAHA] ✅ Agent replied", {
                  chatId,
                  agentId: ai.agentId,
                  replyLength: reply.length,
                });
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
                // Parse e envia múltiplas bolhas (texto + mídia)
                const items = parseAgentReplyToItems(reply);
                await publishParsedItems({ provider: WAHA_PROVIDER, inboxId: job.inboxId, chatId, items });
                // Guard against pending buffer flush replying again for this chat
                console.log("[AGENT][AUTO-REPLY][WAHA] 🔒 Pausing buffer to prevent double-reply", { chatId });
                try { await bufferPause(job.companyId, chatId, 8); } catch { /* ignore */ }
              }
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

  console.log("[READ_RECEIPTS][handleWahaAck] Processing message ack", {
    inboxId: job.inboxId,
    externalId: messageId,
    ackCode: payload?.ack,
    mappedStatus: status,
  });

  const statusUpdate = await updateMessageStatusByExternalId({
    inboxId: job.inboxId,
    externalId: messageId,
    viewStatus: status,
  });
  
  if (statusUpdate) {
    const normalizedStatus =
      typeof statusUpdate.viewStatus === "string" ? statusUpdate.viewStatus.toUpperCase() : null;
    
    console.log("[READ_RECEIPTS][handleWahaAck] Message status updated", {
      chatId: statusUpdate.chatId,
      messageId: statusUpdate.messageId,
      externalId: messageId,
      viewStatus: statusUpdate.viewStatus,
      normalizedStatus,
    });

    // Decrement unread_count when customer message is marked as READ
    if (normalizedStatus === "READ") {
      try {
        const decremented = await db.oneOrNone<{ id: string; unread_count: number }>(
          `WITH upd AS (
             UPDATE public.chat_messages
             SET view_status = 'read', updated_at = now()
             WHERE external_id = $1
               AND inbox_id = $2
               AND is_from_customer = TRUE
               AND (view_status IS DISTINCT FROM 'read')
             RETURNING chat_id
           )
           UPDATE public.chats c
           SET unread_count = GREATEST(0, COALESCE(unread_count, 0) - 1),
               updated_at = now()
           FROM upd
           WHERE c.id = upd.chat_id
           RETURNING c.id, c.unread_count`,
          [messageId, job.inboxId]
        );
        if (decremented) {
          console.log("[UNREAD_COUNT][decrement][WAHA] Chat decremented", {
            chatId: decremented.id,
            newCount: decremented.unread_count,
          });
        }
      } catch (err) {
        console.warn("[UNREAD_COUNT][decrement][WAHA] Failed to decrement", {
          messageId,
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    await publishApp("socket.livechat.status", {
      kind: "livechat.message.status",
      chatId: statusUpdate.chatId,
      companyId: job.companyId,
      messageId: statusUpdate.messageId,
      externalId: messageId,
      view_status: statusUpdate.viewStatus,
      raw_status: status,
      status: normalizedStatus,
      draftId: job?.draftId ?? payload?.draftId ?? null,
      reason: null,
    });

    console.log("[READ_RECEIPTS][handleWahaAck] Socket event published", {
      chatId: statusUpdate.chatId,
      messageId: statusUpdate.messageId,
      status: normalizedStatus,
    });
  } else {
    console.warn("[READ_RECEIPTS][handleWahaAck] No status update returned", {
      inboxId: job.inboxId,
      externalId: messageId,
      status,
    });
  }
}

export async function handleWahaOutboundRequest(job: any): Promise<void> {
  const inboxId = String(job?.inboxId || "");
  if (!inboxId) throw new Error("WAHA outbound sem inboxId");

  // Check message limit (soft warning)
  if (job.companyId) {
    try {
  const limitCheck = await checkLimit(job.companyId, "messages_per_month");
      if (!limitCheck.allowed) {
        console.warn("[worker][outbound][WAHA] ⚠️  MESSAGE LIMIT REACHED", {
          companyId: job.companyId,
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
        });
        // Continua enviando (soft limit) mas registra warning
      } else if (limitCheck.remaining !== undefined && limitCheck.remaining < 50) {
        console.warn("[worker][outbound][WAHA] ⚠️  APPROACHING MESSAGE LIMIT", {
          companyId: job.companyId,
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
        });
      }
    } catch (error) {
      console.warn("[worker][outbound][WAHA] failed to check message limit", {
        companyId: job.companyId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

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
    // Detecta o tipo correto da mídia baseado em mediaType ou mimeType do payload
    let kind = String(payload?.kind || "document").toLowerCase();
    
    // Se tiver mediaType no payload (vindo do template), usa ele
    if (payload?.mediaType) {
      const mt = String(payload.mediaType).toUpperCase();
      if (mt === "IMAGE") kind = "image";
      else if (mt === "VIDEO") kind = "video";
      else if (mt === "AUDIO") kind = "audio";
      else kind = "document";
    }
    // Senão, tenta detectar pelo mimeType
    else if (payload?.mimeType) {
      const mime = String(payload.mimeType).toLowerCase();
      if (mime.startsWith("image/")) kind = "image";
      else if (mime.startsWith("video/")) kind = "video";
      else if (mime.startsWith("audio/")) kind = "audio";
      else kind = "document";
    }
    
    if (!payload?.mediaUrl) {
      throw new Error("WAHA media requer mediaUrl");
    }

    // PRIORIDADE WAHA: sempre enviar áudio como Voice Note
    // Mesmo que o navegador gere WEBM, pedimos conversão no WAHA.
    const rawMime = String(payload?.mimeType || "");
    const normalizedMime = rawMime.split(";")[0].trim().toLowerCase();
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
      reply_to: payload?.quotedMessageId ?? undefined, // WAHA API expects 'reply_to'
      file: {
        url: payload.mediaUrl,
        filename: payload?.filename ?? undefined,
        // Use the actual mime type from payload, fallback to default based on kind
        mimetype: rawMime || (kind === "audio" ? "audio/ogg; codecs=opus" : normalizedMime || "application/octet-stream"),
      },
    };

    // Para maior compatibilidade com WAHA, habilita conversão quando enviar Voice
    if (endpoint === "/api/sendVoice") {
      body.convert = true;
    }

    console.log("[WAHA OUTBOUND][MEDIA]", {
      endpoint,
      remoteChatId,
      kind,
      mediaType: payload?.mediaType,
      mimetype: body?.file?.mimetype,
      filename: body?.file?.filename,
      hasUrl: !!body?.file?.url,
      convert: body?.convert === true,
    });

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
      body.reply_to = payload.quotedMessageId; // WAHA API expects 'reply_to'
    }

    response = await wahaFetch("/api/sendText", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  const externalId = extractWahaMessageId(response);
  console.log("[WAHA OUTBOUND] Extracted external_id from WAHA response:", { 
    externalId, 
    messageId: payload?.draftId || job?.messageId,
    hasResponse: !!response 
  });
  
  const contentForChat =
    messageType === "media"
      ? payload?.caption || `[${String(payload?.kind || "MEDIA").toUpperCase()}]`
      : String(payload?.content || "");

  let messageRow: any | null = null;
  let messageOperation: "insert" | "update" | null = null;
  if (internalChatId) {
    // Resolve sender identity metadata (name/avatar) for human agents
    // Resolve dbChatId first before any DB queries
    let dbChatId = internalChatId;
    const isUuid = (id: string | null) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "");

    if (!isUuid(dbChatId)) {
      if (remoteChatId) {
        const resolved = await findChatIdByRemoteId({ inboxId, remoteId: remoteChatId });
        if (resolved) {
          dbChatId = resolved;
        } else if (job?.companyId) {
          try {
            if (remoteChatId.endsWith("@g.us")) {
              const groupResult = await ensureGroupChat({
                inboxId,
                companyId: job.companyId,
                remoteId: remoteChatId,
                groupName: payload?.name || "Grupo",
              });
              if (groupResult?.chatId) dbChatId = groupResult.chatId;
            } else {
              const phone = remoteChatId.split("@")[0];
              const chat = await ensureLeadCustomerChat({
                inboxId,
                companyId: job.companyId,
                phone: phone,
                name: payload?.name || phone,
              });
              if (chat?.chatId) dbChatId = chat.chatId;
            }
          } catch (err) {
            console.warn("[worker][WAHA] Failed to ensure chat for outbound", err);
          }
        }
      } else {
        dbChatId = null;
      }
    }

    let wSenderName: string | null = null;
    let wSenderAvatarUrl: string | null = null;
    
    if (dbChatId) {
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
            [dbChatId],
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
    }

    console.log("[worker][WAHA] insertOutboundMessage params:", {
      messageId: payload?.draftId || job?.messageId || null,
      senderId: job?.senderId,
      senderName: wSenderName,
      senderAvatarUrl: wSenderAvatarUrl,
    });

    let upsert = null;
    if (dbChatId) {
      upsert = await insertOutboundMessage({
        chatId: dbChatId,
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
    } else {
      console.warn("[worker][WAHA] Skipping DB insert: No valid chat UUID found", { internalChatId, remoteChatId });
    }

    console.log("[worker][WAHA] insertOutboundMessage result:", {
      operation: upsert?.operation,
      messageId: upsert?.message?.id,
      external_id_saved: upsert?.message?.external_id,
      content: upsert?.message?.content?.substring(0, 50),
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
      // Preserve reply linkage so frontend can render quoted preview
      replied_message_id: (messageRow as any).replied_message_id ?? null,
      replied_message_external_id: (messageRow as any).replied_message_external_id ?? null,
      client_draft_id: job?.draftId ?? payload?.draftId ?? null,
    };

    const socketSuccess = await emitSocketWithRetry("socket.livechat.outbound", {
      kind: "livechat.outbound.message",
      chatId: mapped.chat_id,
      companyId: job.companyId,
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
      companyId: job.companyId,
      messageId: messageIdForStatus,
      externalId: externalId || null,
      view_status: viewStatus,
      raw_status: rawStatus,
      status: normalizedStatus,
      draftId: job?.draftId ?? payload?.draftId ?? null,
      reason: null,
    });
  }

  // Se vier metadados de campanha, atualiza status do delivery
  if (job.campaignId && job.campaignRecipientId && job.campaignStepId) {
    console.log(`[campaigns][WAHA] 🔍 tentando atualizar delivery: campaign=${job.campaignId} recipient=${job.campaignRecipientId} step=${job.campaignStepId} externalId=${externalId || "null"}`);
    try {
      const { data: updated, error } = await supabaseAdmin
        .from("campaign_deliveries")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          external_id: externalId || null,
          chat_message_id: messageIdForStatus || null,
        })
        .eq("campaign_id", job.campaignId)
        .eq("recipient_id", job.campaignRecipientId)
        .eq("step_id", job.campaignStepId)
        .eq("status", "PENDING")
        .select("id");
      if (error) {
        console.error(`[campaigns] ❌ erro update delivery SENT (WAHA): campaign=${job.campaignId} recipient=${job.campaignRecipientId}`, error);
      } else if (updated && updated.length > 0) {
        console.log(`[campaigns] 🟢 DELIVERY SENT (WAHA): campaign=${job.campaignId} recipient=${job.campaignRecipientId} delivery=${updated[0].id} externalId=${externalId || "null"}`);
        // Emite estatísticas atualizadas via socket
        await emitCampaignStats(job.campaignId, job.companyId);
      } else {
        console.warn(`[campaigns] ⚠️  nenhum delivery atualizado (WAHA): campaign=${job.campaignId} recipient=${job.campaignRecipientId} - delivery não estava PENDING?`);
      }
    } catch (err) {
      console.warn("[campaigns] falha update delivery SENT (WAHA)", (err as any)?.message || err);
    }
  } else if (job.campaignId) {
    console.warn(`[campaigns][WAHA] ⚠️  job tem campaignId mas faltam metadados: campaignId=${job.campaignId} recipientId=${job.campaignRecipientId || "MISSING"} stepId=${job.campaignStepId || "MISSING"}`);
  }

  console.log("[worker][outbound][WAHA] message sent", {
    inboxId,
    chatId: chatIdForStatus,
    externalId: externalId || null,
    remoteChatId,
  });

  // Track message usage for subscription limits
  if (job.companyId && externalId) {
    try {
      await incrementUsage(job.companyId, "messages_sent", 1);
      console.log("[worker][outbound][WAHA] usage tracked", {
        companyId: job.companyId,
        metric: "messages_sent",
      });
    } catch (error) {
      console.warn("[worker][outbound][WAHA] failed to track message usage", {
        companyId: job.companyId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

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

async function sendWahaText(args: {
  inboxId: string;
  chatJid: string;
  content: string;
}): Promise<{ messageId: string | null }> {
  // Buscar inbox completa e credenciais
  const inbox = await db.oneOrNone<{ 
    base_url: string | null; 
    instance_id: string | null;
    provider: string | null;
  }>(
    `SELECT base_url, instance_id, provider FROM inboxes WHERE id = $1`,
    [args.inboxId]
  );

  if (!inbox) {
    throw new Error(`Inbox ${args.inboxId} not found`);
  }

  // Buscar API key do inbox_secrets
  const secret = await db.oneOrNone<{ provider_api_key: string | null }>(
    `SELECT provider_api_key FROM inbox_secrets WHERE inbox_id = $1`,
    [args.inboxId]
  );

  const baseUrl = inbox.base_url || process.env.WAHA_BASE_URL || "http://localhost:3000";
  const session = inbox.instance_id || "default";
  const apiKey = secret?.provider_api_key ? decryptSecret(secret.provider_api_key) : "";

  const url = `${baseUrl}/api/sendText`;
  const body = {
    session,
    chatId: args.chatJid,
    text: args.content,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const message = (json as any)?.message || response.statusText;
    const err = new Error(`WAHA sendText failed: ${message}`);
    (err as any).retryable = response.status >= 500 || response.status === 429;
    throw err;
  }

  const messageId = (json as any)?.id || null;
  return { messageId };
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
            // If payload is media, convert to meta.sendMedia job
            const p = job?.payload || {};
            if (String(p?.type || "").toLowerCase() === "media" && p?.mediaUrl) {
              jobKind = "meta.sendMedia";
              meta.jobType = jobKind;
              provider = provider || "META";
              meta.provider = provider;
              // Normalize fields used by meta.sendMedia handler
              job.chatId = job.chatId || job?.payload?.chatId || job?.chat_id || null;
              job.inboxId = job.inboxId || job?.payload?.inboxId || null;
              job.public_url = p.mediaUrl;
              job.mime_type = p.mimeType || "";
              job.filename = p.filename || null;
              job.caption = p.caption || null;
            } else {
              jobKind = "message.send";
              meta.jobType = jobKind;
              provider = provider || "META";
              meta.provider = provider;
            }
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
          const messageId = job.messageId ? String(job.messageId) : "";
          const storageKey = String(job.storage_key || "");
          let mimeType = String(job.mime_type || "");
          meta.chatId = chatId || meta.chatId || null;
          meta.provider = provider || meta.provider || "META";
          if (!chatId) throw new Error("meta.sendMedia missing chatId");

        const { chat_id, customer_phone, inbox_id } =
          await getChatWithCustomerPhone(chatId);

        const inboxId = String(job.inboxId || inbox_id || "");
        if (!inboxId) throw new Error("inboxId missing");

        const creds = await getDecryptedCredsForInbox(inboxId);
        if (!creds?.access_token || !creds?.phone_number_id) {
          throw new Error("missing_meta_credentials");
        }

        // Permite enviar via arquivo Supabase Storage (storage_key) OU via URL pública (public_url)
        const publicUrl = typeof job.public_url === "string" && job.public_url ? String(job.public_url) : "";
        if (!storageKey && !publicUrl) {
          throw new Error("meta.sendMedia requires storage_key or public_url");
        }

        console.log("[meta.sendMedia] 📦 Processing media", {
          chatId,
          storageKey: storageKey || "(none)",
          publicUrl: publicUrl ? publicUrl.slice(0, 80) + "..." : "(none)",
        });

        // Download da mídia - de Supabase Storage ou URL pública
        let mediaBuffer: Buffer;
        let effectiveMime = mimeType || "application/octet-stream";

        if (storageKey) {
          // Download do Supabase Storage
          console.log("[meta.sendMedia] ☁️  Downloading from Supabase Storage", { storageKey });
          const bucket = getMediaBucket();
          const { data, error } = await supabaseAdmin.storage.from(bucket).download(storageKey);
          
          if (error || !data) {
            throw new Error(`Failed to download from Supabase Storage: ${error?.message || "no data"}`);
          }
          
          mediaBuffer = Buffer.from(await data.arrayBuffer());
          // Se não temos mimeType, tentar obter do arquivo
          if (!mimeType) {
            effectiveMime = data.type || "application/octet-stream";
          }
        } else if (publicUrl) {
          // Download de URL pública
          console.log("[meta.sendMedia] 🌐 Downloading from public URL");
          const res = await fetch(publicUrl);
          if (!res.ok) {
            throw new Error(`download_public_url ${res.status}`);
          }
          mediaBuffer = Buffer.from(await res.arrayBuffer());
          const mimeFromUrl = res.headers.get("content-type");
          if (!mimeType && mimeFromUrl) {
            effectiveMime = mimeFromUrl;
          }
        } else {
          throw new Error("media_source_missing");
        }

        // Salvar temporariamente no disco para upload ao Meta (Meta API exige arquivo)
        const tmpDir = path.join(MEDIA_DIR, "tmp");
        await fs.mkdir(tmpDir, { recursive: true });
        const ext = extFromMime(effectiveMime) || "bin";
        const tmpPath = path.join(tmpDir, `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
        await fs.writeFile(tmpPath, mediaBuffer);
        
        console.log("[meta.sendMedia] 💾 Temporary file created", {
          path: tmpPath,
          size: mediaBuffer.length,
          mime: effectiveMime,
        });

        const filename = String(job.filename || `media.${ext}`);
        const mediaType = effectiveMime.startsWith("image/")
          ? "IMAGE"
          : effectiveMime.startsWith("video/")
            ? "VIDEO"
            : effectiveMime.startsWith("audio/")
              ? "AUDIO"
              : "DOCUMENT";

        // upload para Meta
        const mediaId = await graphUploadMedia(
          { access_token: creds.access_token, phone_number_id: creds.phone_number_id },
          tmpPath,
          effectiveMime,
          filename,
        );
        
        console.log("[meta.sendMedia] ✅ Uploaded to Meta", { mediaId, mimeType: effectiveMime });

        // Limpar arquivo temporário
        try {
          await fs.unlink(tmpPath);
        } catch (e) {
          console.warn("[meta.sendMedia] Failed to cleanup temp file:", tmpPath);
        }

        // normaliza número para E.164 sem '+'
        function toE164(n: string): string {
          const only = String(n || "").replace(/\D+/g, "");
          return only.replace(/^00/, ""); // ex: 0055... -> 55...
        }
        const to = toE164(customer_phone);

        // envia mídia
        const wamid = await graphSendMedia(
          { access_token: creds.access_token, phone_number_id: creds.phone_number_id },
          to,                   // <<< usa o n??mero normalizado
          mediaType,
          mediaId,
          job.caption ?? null,
          filename,
        );
        console.log("[outbound] graphSendMedia ok", { wamid });

        // garante persist??ncia do status, com ou sem wamid (se houver messageId fornecido)
        if (messageId) {
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
        }

        // (opcional) se ainda quiser manter seu helper que upserta logs/etc:
        const upsert = await insertOutboundMessage({
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
          companyId: job.companyId,
          messageId: messageId || (upsert?.message?.id || null),
          externalId: wamid || null,
          view_status: "Sent",
          raw_status: "sent",
          status: "SENT",
          draftId: job?.draftId ?? null,
          reason: null,
        });

        // Se vier metadados de campanha, atualiza status do delivery
        if (job.campaignId && job.campaignRecipientId && job.campaignStepId) {
          console.log(`[campaigns][META][MEDIA] 🔍 tentando atualizar delivery: campaign=${job.campaignId} recipient=${job.campaignRecipientId} step=${job.campaignStepId} wamid=${wamid || "null"}`);
          try {
            const { data: updated, error } = await supabaseAdmin
              .from("campaign_deliveries")
              .update({
                status: "SENT",
                sent_at: new Date().toISOString(),
                external_id: wamid || null,
                chat_message_id: messageId || (upsert?.message?.id || null) || null,
              })
              .eq("campaign_id", job.campaignId)
              .eq("recipient_id", job.campaignRecipientId)
              .eq("step_id", job.campaignStepId)
              .eq("status", "PENDING")
              .select("id");
            if (error) {
              console.error(`[campaigns] ❌ erro update delivery SENT (media): campaign=${job.campaignId} recipient=${job.campaignRecipientId}`, error);
            } else if (updated && updated.length > 0) {
              console.log(`[campaigns] 🟢 DELIVERY SENT (MEDIA): campaign=${job.campaignId} recipient=${job.campaignRecipientId} delivery=${updated[0].id} wamid=${wamid || "null"}`);
              // Emite estatísticas atualizadas via socket
              await emitCampaignStats(job.campaignId, job.companyId);
            } else {
              console.warn(`[campaigns] ⚠️  nenhum delivery atualizado (media): campaign=${job.campaignId} recipient=${job.campaignRecipientId} - delivery não estava PENDING?`);
            }
          } catch (err) {
            console.warn("[campaigns] falha update delivery SENT (media)", (err as any)?.message || err);
          }
        } else if (job.campaignId) {
          console.warn(`[campaigns][META][MEDIA] ⚠️  job tem campaignId mas faltam metadados: campaignId=${job.campaignId} recipientId=${job.campaignRecipientId || "MISSING"} stepId=${job.campaignStepId || "MISSING"}`);
        }

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
      const content = String(job.payload?.content || job.content || "");
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

      if (job.campaignId && job.campaignRecipientId && job.campaignStepId) {
        console.log(`[campaigns][META][TEXT] 🔍 tentando atualizar delivery: campaign=${job.campaignId} recipient=${job.campaignRecipientId} step=${job.campaignStepId} wamid=${wamid || "null"}`);
        try {
          const { data: updated, error } = await supabaseAdmin
            .from("campaign_deliveries")
            .update({
              status: "SENT",
              sent_at: new Date().toISOString(),
              external_id: wamid || null,
              chat_message_id: job.messageId || (upsert?.message?.id || null) || null,
            })
            .eq("campaign_id", job.campaignId)
            .eq("recipient_id", job.campaignRecipientId)
            .eq("step_id", job.campaignStepId)
            .eq("status", "PENDING")
            .select("id");
          if (error) {
            console.error(`[campaigns] ❌ erro update delivery SENT (text): campaign=${job.campaignId} recipient=${job.campaignRecipientId}`, error);
          } else if (updated && updated.length > 0) {
            console.log(`[campaigns] 🟢 DELIVERY SENT (TEXT): campaign=${job.campaignId} recipient=${job.campaignRecipientId} delivery=${updated[0].id} wamid=${wamid || "null"}`);
            // Emite estatísticas atualizadas via socket
            await emitCampaignStats(job.campaignId, job.companyId);
          } else {
            console.warn(`[campaigns] ⚠️  nenhum delivery atualizado (text): campaign=${job.campaignId} recipient=${job.campaignRecipientId} - delivery não estava PENDING?`);
          }
        } catch (err) {
          console.warn("[campaigns] falha update delivery SENT (text)", (err as any)?.message || err);
        }
      } else if (job.campaignId) {
        console.warn(`[campaigns][META][TEXT] ⚠️  job tem campaignId mas faltam metadados: campaignId=${job.campaignId} recipientId=${job.campaignRecipientId || "MISSING"} stepId=${job.campaignStepId || "MISSING"}`);
      }

      try {
        await publishApp("socket.livechat.status", {
          kind: "livechat.message.status",
          chatId,
          companyId: job.companyId,
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
            companyId: job.companyId,
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
              companyId: job.companyId,
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

  // 🔒 Garante que apenas 1 instância do worker está rodando (por tipo)
  await ensureSingleWorkerInstance(target);

  // Ajuste de concorrência via env:
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
      startCronJobs();
      break;
    case "all":
    default:
      await Promise.all([
        startInboundWorkers(INBOUND_WORKERS, INBOUND_PREFETCH),
        startInboundMediaWorkers(INBOUND_MEDIA_WORKERS, INBOUND_MEDIA_PREFETCH),
        startOutboundWorkers(OUTBOUND_WORKERS, OUTBOUND_PREFETCH),
      ]);
      startCronJobs();
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
          and (ib.waha_status IS NULL OR ib.waha_status NOT IN ('FAILED', 'STOPPED', 'CLOSED', 'LOGGED_OUT'))
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
        // Se o erro for de sessão FAILED, marcar inbox como desconectada
        if (error instanceof Error && error.message?.includes('status":"FAILED"')) {
          console.warn("[WAHA][sync] Session FAILED detected, marking inbox as disconnected", {
            inboxId: group.inbox_id,
            remoteId,
          });
          
          try {
            await supabaseAdmin
              .from("inboxes")
              .update({ 
                waha_status: "FAILED",
                waha_last_error: error.message,
                updated_at: new Date().toISOString()
              })
              .eq("id", group.inbox_id);
            
            console.log("[WAHA][sync] Inbox marked as FAILED, will stop sync attempts", {
              inboxId: group.inbox_id,
            });
          } catch (updateError) {
            console.error("[WAHA][sync] Failed to update inbox status", {
              inboxId: group.inbox_id,
              error: updateError,
            });
          }
        } else {
          console.warn("[WAHA][sync] failed to refresh group metadata", {
            inboxId: group.inbox_id,
            remoteId,
            error,
          });
        }
      }
    }
  } catch (error) {
    console.warn("[WAHA][sync] metadata job error", error);
  } finally {
    wahaGroupSyncRunning = false;
  }
}

// Helper para emitir estatísticas de campanha via socket.io
async function emitCampaignStats(campaignId: string, companyId?: string | null) {
  try {
    // Busca estatísticas atualizadas
    const { count: totalRecipients } = await supabaseAdmin
      .from("campaign_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    const { data: deliveries } = await supabaseAdmin
      .from("campaign_deliveries")
      .select("status")
      .eq("campaign_id", campaignId);

    const stats = {
      campaign_id: campaignId,
      total_recipients: totalRecipients || 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0,
    };

    if (deliveries) {
      deliveries.forEach((d: any) => {
        if (d.status === "SENT") stats.sent++;
        else if (d.status === "DELIVERED") stats.delivered++;
        else if (d.status === "READ") stats.read++;
        else if (d.status === "FAILED") stats.failed++;
        else if (d.status === "PENDING") stats.pending++;
      });
    }

    let io: any = null;
    try {
      io = getIO();
    } catch (e) {
      // Ambiente sem Socket.IO inicializado (ex: worker isolado); apenas log leve
      console.log(`[campaigns] (stats) socket indisponível, pulando emissão campaign=${campaignId}`);
    }
    if (io) {
      io.to(`campaign:${campaignId}`).emit("campaign:stats", stats);
      if (companyId) io.to(`company:${companyId}`).emit("campaign:stats", stats);
      console.log(`[campaigns] 📡 socket emitido: campaign=${campaignId} stats=${JSON.stringify(stats)}`);
    }
  } catch (error) {
    console.warn(`[campaigns] falha ao emitir stats via socket: campaign=${campaignId}`, error);
  }
}

/**
 * Calcula batchSize adaptativo baseado em quality_rating e tier da inbox
 */
async function getAdaptiveBatchSize(inboxId: string): Promise<number> {
  try {
    const { data: inbox } = await supabaseAdmin
      .from("inboxes")
      .select("meta_quality_rating, meta_messaging_tier, provider")
      .eq("id", inboxId)
      .single();

    if (!inbox) return 3; // Fallback conservador

    // Se não é Meta, usar padrão conservador
    if (inbox.provider !== "META_CLOUD") {
      return 3;
    }

    const quality = inbox.meta_quality_rating || "UNKNOWN";
    const tier = inbox.meta_messaging_tier || "UNKNOWN";

    // Bloqueio total se RED
    if (quality === "RED") {
      console.error(`[campaigns] 🔴 Quality rating RED - inbox ${inboxId} bloqueada`);
      return 0;
    }

    // Ultra conservador se YELLOW
    if (quality === "YELLOW") {
      console.warn(`[campaigns] 🟡 Quality rating YELLOW - modo conservador`);
      return 2; // 2 msgs/min
    }

    // Ajustar por tier se GREEN ou UNKNOWN
    console.log(`[campaigns] 🟢 Quality rating ${quality}, tier ${tier}`);
    
    switch (tier) {
      case "TIER_1K":
        return 3; // 3 msgs/min = 180/hora = 4.320/dia (com folga)
      case "TIER_10K":
        return 5; // 5 msgs/min = 300/hora = 7.200/dia
      case "TIER_100K":
        return 10; // 10 msgs/min = 600/hora = 14.400/dia
      case "TIER_UNLIMITED":
        return 20; // 20 msgs/min = 1.200/hora = 28.800/dia
      default:
        return 3; // Conservador por padrão
    }
  } catch (error) {
    console.error(`[campaigns] Erro ao buscar adaptive batch size:`, error);
    return 3; // Fallback seguro
  }
}

/**
 * Trata erros específicos da Meta API
 */
async function handleMetaError(error: any, campaignId: string, recipientId: string): Promise<void> {
  const errorCode = error?.error?.code || error?.code;
  const errorMessage = error?.error?.message || error?.message;

  console.error(`[campaigns] Meta Error ${errorCode}: ${errorMessage}`);

  switch (errorCode) {
    case 130472: // Rate limit exceeded
      console.warn(`[campaigns] 🚫 RATE LIMIT atingido - pausando campaign=${campaignId} por 5 minutos`);
      
      await supabaseAdmin
        .from("campaigns")
        .update({
          status: "PAUSED",
          paused_at: new Date().toISOString(),
          pause_reason: "Rate limit exceeded (130472)",
          resume_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Resume em 5 min
        })
        .eq("id", campaignId);
      
      // Emitir alerta via socket
      await publishApp("socket.campaign.alert", {
        kind: "campaign.rate_limit",
        campaignId,
        severity: "critical",
        message: "Rate limit atingido - campanha pausada por 5 minutos",
      });
      break;

    case 131026: // Recipient cannot be sender (fora janela 24h)
      console.warn(`[campaigns] ⏰ Fora da janela 24h: recipient=${recipientId}`);
      
      await supabaseAdmin
        .from("campaign_deliveries")
        .update({
          status: "FAILED",
          error_message: "Fora da janela de 24h para iniciar conversa",
        })
        .eq("campaign_id", campaignId)
        .eq("recipient_id", recipientId);
      break;

    case 131047: // Re-engagement message required
      console.warn(`[campaigns] 🔄 Re-engagement necessário: recipient=${recipientId}`);
      
      await supabaseAdmin
        .from("campaign_deliveries")
        .update({
          status: "FAILED",
          error_message: "Re-engagement necessário (usuário inativo >24h)",
        })
        .eq("campaign_id", campaignId)
        .eq("recipient_id", recipientId);
      break;

    case 131051: // Message undeliverable (blocked)
      console.warn(`[campaigns] 🚫 Bloqueado pelo usuário: recipient=${recipientId}`);
      
      await supabaseAdmin
        .from("campaign_deliveries")
        .update({
          status: "FAILED",
          error_message: "Bloqueado pelo usuário (131051)",
        })
        .eq("campaign_id", campaignId)
        .eq("recipient_id", recipientId);
      
      // Incrementar contador de bloqueios
      const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .select("id, name")
        .eq("id", campaignId)
        .single();
      
      // Calcular block rate
      const { data: deliveries } = await supabaseAdmin
        .from("campaign_deliveries")
        .select("status, error_message")
        .eq("campaign_id", campaignId);
      
      if (deliveries && deliveries.length > 0) {
        const total = deliveries.length;
        const blocked = deliveries.filter(
          d => d.status === "FAILED" && d.error_message?.includes("131051")
        ).length;
        const blockRate = (blocked / total) * 100;
        
        console.log(`[campaigns] 📊 Block rate: ${blockRate.toFixed(2)}% (${blocked}/${total})`);
        
        // Pausar se block rate > 5%
        if (blockRate > 5) {
          console.error(`[campaigns] 🚨 CRÍTICO: Block rate ${blockRate.toFixed(2)}% > 5% - PAUSANDO campanha`);
          
          await supabaseAdmin
            .from("campaigns")
            .update({
              status: "PAUSED",
              paused_at: new Date().toISOString(),
              pause_reason: `Block rate crítico: ${blockRate.toFixed(2)}%`,
            })
            .eq("id", campaignId);
          
          // Emitir alerta crítico
          await publishApp("socket.campaign.alert", {
            kind: "campaign.high_block_rate",
            campaignId,
            severity: "critical",
            message: `Taxa de bloqueio crítica: ${blockRate.toFixed(2)}% - campanha pausada`,
            block_rate: blockRate,
            campaign_name: campaign?.name,
          });
        } else if (blockRate > 2) {
          // Warning se > 2%
          await publishApp("socket.campaign.alert", {
            kind: "campaign.warning_block_rate",
            campaignId,
            severity: "warning",
            message: `Taxa de bloqueio em atenção: ${blockRate.toFixed(2)}%`,
            block_rate: blockRate,
          });
        }
      }
      break;

    default:
      console.error(`[campaigns] ❌ Erro não tratado ${errorCode}: ${errorMessage}`);
  }
}

async function tickCampaigns() {
  return runWithDistributedLock("campaigns:tick", async () => {
    try {
      const now = new Date().toISOString();
      console.log(`[campaigns] ping ${now} (Worker PID ${process.pid})`);
      // campanhas ativas
      const { data: camps } = await supabaseAdmin
    .from("campaigns")
  	.select("id, name, company_id, inbox_id, rate_limit_per_minute, start_at, end_at, status, send_windows, timezone")
    .in("status", ["SCHEDULED","RUNNING"]);

    for (const c of camps || []) {
      if (!c.inbox_id) continue;
      
      // Busca provider da inbox para enviar corretamente
      let inboxProvider: string = "META"; // fallback
      try {
        const { data: inboxData } = await supabaseAdmin
          .from("inboxes")
          .select("provider")
          .eq("id", c.inbox_id)
          .maybeSingle();
        inboxProvider = (inboxData?.provider || "META").toUpperCase();
      } catch (e: any) {
        console.warn(`[campaigns] falha ao buscar inbox provider: campaign=${c.id} inbox=${c.inbox_id}`, e?.message);
      }
      
      // respeita janela de agendamento absoluto (start_at/end_at)
      const nowDt = new Date(now).getTime();
      const startOk = c.start_at ? nowDt >= new Date(c.start_at as any).getTime() : true;
      const notEnded = c.end_at ? nowDt <= new Date(c.end_at as any).getTime() : true;
      if (!startOk || !notEnded) {
        // se ainda não começou, mantém SCHEDULED; se passou do fim, só completa se houve envios
        if (!notEnded) {
          try {
            // Primeiro verifica se existe algum recipient cadastrado para esta campanha
            const { count: totalCount } = await supabaseAdmin
              .from("campaign_recipients")
              .select("id", { count: "exact", head: true })
              .eq("campaign_id", c.id);

            if ((totalCount ?? 0) === 0) {
              console.log(`[campaigns] ⏸️ janela encerrada, sem recipients: id=${c.id} (${c.name || ""}) mantendo status=${c.status}`);
            } else {
              // Verifica deliveries: só completa se não houver PENDING e houver entregas suficientes
              const { count: pendDel } = await supabaseAdmin
                .from("campaign_deliveries")
                .select("id", { count: "exact", head: true })
                .eq("campaign_id", c.id)
                .eq("status", "PENDING");
              const { count: doneDel } = await supabaseAdmin
                .from("campaign_deliveries")
                .select("id", { count: "exact", head: true })
                .eq("campaign_id", c.id)
                .in("status", ["SENT","DELIVERED","READ","FAILED"] as any);

              if ((pendDel ?? 0) === 0 && (doneDel ?? 0) >= (totalCount ?? 0)) {
                if (c.status !== "COMPLETED") {
                  await supabaseAdmin.from("campaigns").update({ status: "COMPLETED" }).eq("id", c.id);
                }
                console.log(`[campaigns] status COMPLETED: id=${c.id} (${c.name || ""}) [fim da janela; deliveries=${doneDel}/${totalCount}]`);
              } else {
                console.log(`[campaigns] ⏳ fim da janela, aguardando deliveries: id=${c.id} (${c.name || ""}) PENDING=${pendDel ?? 0} DONE=${doneDel ?? 0} TOTAL=${totalCount}`);
              }
            }
          } catch (e: any) {
            console.warn(`[campaigns] erro ao avaliar fim de janela para completar campaign=${c.id}:`, e?.message || e);
          }
        }
        continue;
      }

      // se estava SCHEDULED e já passou da data de início -> RUNNING
      if (c.status === "SCHEDULED") {
        await supabaseAdmin.from("campaigns").update({ status: "RUNNING" }).eq("id", c.id);
        console.log(`[campaigns] status RUNNING: id=${c.id} (${c.name || ""})`);
      }

      // janela diária (send_windows)
      const sw: any = c.send_windows;
      if (sw?.enabled) {
        const tz = sw.timezone || c.timezone || "UTC";
        // extrai HH:mm e weekday no timezone usando Intl
        const fmt = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          weekday: "short",
          hour12: false,
        });
        const parts = fmt.formatToParts(new Date());
        const hh = parts.find(p => p.type === "hour")?.value || "00";
        const mm = parts.find(p => p.type === "minute")?.value || "00";
        const wd = parts.find(p => p.type === "weekday")?.value || "Mon";
        const weekdayMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
        const weekday = weekdayMap[wd] ?? 0;
        const hhmm = `${hh}:${mm}`;
        const ranges: string[] = (sw.weekdays?.[String(weekday)] || []).filter((r: string) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(r));
        const inWindow = ranges.some(r => {
          const [a,b] = r.split("-");
          return hhmm >= a && hhmm <= b;
        });
        if (!inWindow) {
          // fora da janela diária, pula envio dessa campanha (mantém status)
          console.log(`[campaigns] fora da janela diária: id=${c.id} (${c.name || ""}) tz=${tz} weekday=${weekday} hhmm=${hhmm}`);
          continue;
        }
      }

      // ===== ADAPTIVE RATE LIMITING =====
      // Ajusta batchSize baseado em quality_rating e tier da inbox
      const batchSize = await getAdaptiveBatchSize(c.inbox_id);
      const limit = batchSize;
      
      if (batchSize === 0) {
        console.error(`[campaigns] 🔴 BLOQUEADO: Quality rating RED - pausando campaign=${c.id}`);
        await supabaseAdmin
          .from("campaigns")
          .update({ status: "PAUSED", paused_at: new Date().toISOString(), pause_reason: "Quality rating RED" })
          .eq("id", c.id);
        continue;
      }
      
      console.log(`[campaigns] 📊 rate limit: campaign=${c.id} (${c.name || ""}) batchSize=${batchSize} mensagens neste ciclo`);
      
      const { data: step } = await supabaseAdmin
        .from("campaign_steps").select("id, template_id, delay_sec")
        .eq("campaign_id", c.id).order("position", { ascending: true }).limit(1).maybeSingle();
      if (!step?.id) continue;

      const { data: tpl } = await supabaseAdmin
        .from("message_templates").select("id, kind, payload")
        .eq("id", step.template_id).maybeSingle();
      if (!tpl?.id) continue;

      let { data: recipients } = await supabaseAdmin
        .from("campaign_recipients")
        .select("id, phone, last_step_sent")
        .eq("campaign_id", c.id)
        .is("last_step_sent", null)
        .limit(limit);
      console.log(`[campaigns] 🔍 processando: campaign=${c.id} (${c.name || ""}) recipients pendentes=${recipients?.length || 0}`);

      if ((recipients?.length || 0) === 0) {
        try {
          // Se não há recipients novos e também não há deliveries, tenta recuperar
          const { count: deliveriesCount } = await supabaseAdmin
            .from("campaign_deliveries")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", c.id);
          if ((deliveriesCount ?? 0) === 0) {
            const { data: allRecipients } = await supabaseAdmin
              .from("campaign_recipients")
              .select("id, phone, last_step_sent")
              .eq("campaign_id", c.id)
              .limit(limit);
            if ((allRecipients?.length || 0) > 0) {
              recipients = allRecipients || [];
              console.log(`[campaigns] 🩹 recuperação: reenfileirando recipients sem delivery campaign=${c.id} count=${recipients.length}`);
            }
          }
        } catch (e:any) {
          console.warn(`[campaigns] falha recuperação recipients sem delivery campaign=${c.id}`, e?.message || e);
        }
      }

      let messagesSentThisCycle = 0;
      for (const r of recipients || []) {
        console.log(`[campaigns] 🔄 iniciando recipient: campaign=${c.id} recipient=${r.id} phone=${r.phone}`);
        
        // **LOCK OTIMISTA**: Marca recipient como processando IMEDIATAMENTE
        // para evitar que outros ciclos peguem o mesmo recipient
        const { error: lockError } = await supabaseAdmin
          .from("campaign_recipients")
          .update({ last_step_sent: 1, last_sent_at: new Date().toISOString() })
          .eq("id", r.id)
          .is("last_step_sent", null); // Só atualiza se ainda estiver null
        
        if (lockError) {
          console.warn(`[campaigns] ⚠️  falha ao obter lock: recipient=${r.id} - pulando (provavelmente já processado)`);
          continue;
        }
        
        console.log(`[campaigns] 🔒 lock obtido: recipient=${r.id}`);
        
        // Delay entre mensagens para distribuir ao longo do minuto
        // Com 3-4 mensagens por minuto, dá ~15-20s entre cada
        if (messagesSentThisCycle > 0) {
          const delayMs = 15000 + Math.floor(Math.random() * 5000); // 15-20s randomizado
          console.log(`[campaigns] ⏱️  aguardando ${delayMs}ms antes do próximo envio...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const payloadObj: any = tpl.payload || {};
        const isMetaTemplate = inboxProvider.includes("META") && !!payloadObj.meta_template_name;
        const isText = (tpl.kind || "").toUpperCase() === "TEXT";
        const content = isText ? String(payloadObj?.text || "") : null;
        
        // Detecta mídia embutida em payload mesmo com kind=TEXT
        const hasInlineMedia = !!payloadObj.mediaUrl || !!payloadObj.storage_key || !!payloadObj.public_url;
        const treatAsMedia = hasInlineMedia && !!payloadObj.mediaUrl;
        
        console.log(`[campaigns] 📋 template info: campaign=${c.id} kind=${tpl.kind} isMetaTemplate=${isMetaTemplate} treatAsMedia=${treatAsMedia} hasContent=${!!content}`);

        // Garante existência do chat (necessário para outbound worker)
        let chatId: string | null = null;
        try {
          if (c.company_id) {
            console.log(`[campaigns] 🔗 criando/buscando chat: campaign=${c.id} phone=${r.phone}`);
            const ensured = await ensureLeadCustomerChat({
              inboxId: c.inbox_id,
              companyId: c.company_id,
              phone: r.phone,
              name: null,
              rawPhone: r.phone,
            });
            chatId = ensured.chatId;
            console.log(`[campaigns] ✅ chat resolvido: campaign=${c.id} chatId=${chatId}`);
          } else {
            console.warn(`[campaigns] ⚠️  company_id ausente: campaign=${c.id}`);
          }
        } catch (e: any) {
          console.error(`[campaigns] ❌ erro ensureLeadCustomerChat phone=${r.phone} campaign=${c.id}:`, e?.message || e);
        }
        if (!chatId) {
          console.warn(`[campaigns] ⚠️  chatId não resolvido; pulando envio phone=${r.phone} campaign=${c.id}`);
          continue;
        }

        // Cria registro de delivery PENDING antes de enfileirar para poder aparecer nas estatísticas imediatamente
        let createdDeliveryId: string | null = null;
        try {
          const insertDelivery = await supabaseAdmin
            .from("campaign_deliveries")
            .insert({
              campaign_id: c.id,
              recipient_id: r.id,
              step_id: step.id,
              inbox_id: c.inbox_id,
              status: "PENDING",
              queued_at: new Date().toISOString(),
            })
            .select("id")
            .maybeSingle();
          const insertedId = (insertDelivery as any)?.data?.id;
          if (!insertedId) {
            console.warn(`[campaigns] falha ao inserir delivery (sem id retornado) campaign=${c.id} recipient=${r.id}`);
          } else {
            console.log(`[campaigns] 🟡 DELIVERY PENDING: campaign=${c.id} (${c.name || ""}) recipient=${r.id} phone=${r.phone} delivery=${insertedId}`);
            createdDeliveryId = insertedId;
            // Emite estatísticas atualizadas via socket
            await emitCampaignStats(c.id, c.company_id);
          }
        } catch (e: any) {
          console.error(`[campaigns] erro insert campaign_deliveries: campaign=${c.id} recipient=${r.id} err=${e?.message || e}`);
        }

        // Se for Meta Template, envia diretamente usando sendTemplateMessage
        if (isMetaTemplate) {
          console.log(`[campaigns] 📨 enviando META TEMPLATE: campaign=${c.id} (${c.name || ""}) templateName=${payloadObj.meta_template_name} phone=${r.phone}`);
          try {
            const { sendTemplateMessage } = await import("./services/meta/templates.ts");
            
            // Para templates sem variáveis, não enviar components
            // Se tiver send_components (estrutura de envio), usa ela; senão, deixa undefined
            const sendComponents = payloadObj.send_components || undefined;
            
            const { wamid } = await sendTemplateMessage({
              inboxId: c.inbox_id,
              customerPhone: r.phone,
              templateName: payloadObj.meta_template_name,
              languageCode: payloadObj.language_code || payloadObj.language?.code || "pt_BR",
              components: sendComponents,
            });
            
            console.log(`[campaigns] ✅ META TEMPLATE enviado: campaign=${c.id} wamid=${wamid}`);
            
            // Detecta tipo de mídia do template baseado nos componentes
            let messageType = "TEMPLATE";
            const components = payloadObj.components || [];
            const headerComp = components.find((c: any) => c.type === "HEADER");
            if (headerComp?.format === "IMAGE") messageType = "IMAGE";
            else if (headerComp?.format === "VIDEO") messageType = "VIDEO";
            else if (headerComp?.format === "DOCUMENT") messageType = "DOCUMENT";
            
            // Insere mensagem no chat_messages com template_id
            const messageRow = await db.oneOrNone<{ id: string; chat_id: string }>(
              `insert into public.chat_messages
                 (chat_id, is_from_customer, external_id, content, type, view_status, template_id)
               values ($1, false, $2, $3, $4, 'Sent', $5)
               on conflict (chat_id, external_id) do update
                 set view_status = excluded.view_status,
                     content = excluded.content,
                     type = excluded.type,
                     template_id = excluded.template_id,
                     updated_at = now()
               returning id, chat_id`,
              [
                chatId,
                wamid,
                payloadObj.text || payloadObj.meta_template_name,
                messageType,
                tpl.id, // template_id from message_templates
              ]
            );
            
            const messageId = messageRow?.id || null;
            console.log(`[campaigns] 💾 mensagem salva: campaign=${c.id} messageId=${messageId} type=${messageType}`);
            
            // Atualiza delivery para SENT
            if (createdDeliveryId) {
              const { error: updateErr } = await supabaseAdmin
                .from("campaign_deliveries")
                .update({
                  status: "SENT",
                  sent_at: new Date().toISOString(),
                  external_id: wamid,
                  chat_message_id: messageId,
                })
                .eq("id", createdDeliveryId);
              
              if (updateErr) {
                console.error(`[campaigns] ❌ erro update delivery SENT (meta template): campaign=${c.id} delivery=${createdDeliveryId}`, updateErr);
              } else {
                console.log(`[campaigns] 🟢 DELIVERY SENT (META TEMPLATE): campaign=${c.id} delivery=${createdDeliveryId} wamid=${wamid}`);
                await emitCampaignStats(c.id, c.company_id);
              }
            }
            
            // Lock já foi obtido no início do loop, não precisa atualizar novamente
            messagesSentThisCycle++;
            
            // Emite evento via socket para atualizar UI
            try {
              await publishApp("socket.livechat.status", {
                kind: "livechat.message.status",
                chatId,
                companyId: c.company_id,
                messageId,
                externalId: wamid,
                view_status: "Sent",
                raw_status: "sent",
                status: "SENT",
                draftId: null,
                reason: null,
              });
              
              // Emite mensagem completa para aparecer na interface
              if (messageId) {
                await publishApp("socket.livechat.outbound", {
                  kind: "livechat.outbound.message",
                  chatId,
                  companyId: c.company_id,
                  inboxId: c.inbox_id,
                  message: {
                    id: messageId,
                    chat_id: chatId,
                    body: payloadObj.text || payloadObj.meta_template_name,
                    sender_type: "AGENT",
                    sender_id: null,
                    sender_name: null,
                    sender_avatar_url: null,
                    created_at: new Date().toISOString(),
                    view_status: "Sent",
                    type: messageType,
                    is_private: false,
                    media_url: null,
                    template_id: tpl.id,
                    client_draft_id: null,
                  },
                });
              }
            } catch (err) {
              console.warn("[campaigns] falha ao publicar status via socket", (err as any)?.message || err);
            }
          } catch (e: any) {
            console.error(`[campaigns] ❌ erro ao enviar META TEMPLATE: campaign=${c.id} recipient=${r.id}`, e?.message || e);
            // Marca delivery como FAILED
            if (createdDeliveryId) {
              await supabaseAdmin
                .from("campaign_deliveries")
                .update({
                  status: "FAILED",
                  error_message: e?.message || "Erro ao enviar template",
                })
                .eq("id", createdDeliveryId);
              await emitCampaignStats(c.id, c.company_id);
            }
          }
        }
        // Enfileira mensagem TEXT simples
        else if (!treatAsMedia) {
          if (!content) {
            console.warn(`[campaigns] ⚠️  template vazio não enviado: campaign=${c.id} recipient=${r.id}`);
            continue;
          }
          console.log(`[campaigns] 📤 enfileirando TEXT: campaign=${c.id} (${c.name || ""}) provider=${inboxProvider} phone=${r.phone}`);
          await publish(EX_APP, "outbound.request", {
            jobType: "message.send",
            provider: inboxProvider,
            inboxId: c.inbox_id,
            chatId,
            content,
            customerPhone: r.phone,
            campaignId: c.id,
            campaignRecipientId: r.id,
            campaignStepId: step.id,
            companyId: c.company_id,
          });
        }
        // Enfileira mensagem com MEDIA
        else {
          const mediaPayload = {
            type: "media",
            mediaUrl: payloadObj.mediaUrl,
            filename: payloadObj.filename || null,
            mimeType: payloadObj.mimeType || null,
            mediaType: payloadObj.mediaType || null,
            caption: content || payloadObj.caption || null,
          };
          console.log(`[campaigns] 📤 enfileirando MEDIA: campaign=${c.id} (${c.name || ""}) provider=${inboxProvider} phone=${r.phone} mediaUrl=${payloadObj.mediaUrl} mediaType=${payloadObj.mediaType}`);
          await publish(EX_APP, "outbound.request", {
            jobType: "outbound.request", // será normalizado para meta.sendMedia ou waha
            provider: inboxProvider,
            inboxId: c.inbox_id,
            chatId,
            campaignId: c.id,
            campaignRecipientId: r.id,
            campaignStepId: step.id,
            companyId: c.company_id,
            payload: mediaPayload,
            attempt: 0,
          });
          
          messagesSentThisCycle++; // Incrementa contador (lock já foi obtido no início)
        }
      }

      console.log(`[campaigns] 📊 ciclo finalizado: campaign=${c.id} (${c.name || ""}) mensagens enviadas=${messagesSentThisCycle}`);

      // Verifica status da campanha SEMPRE após processar recipients
      // Primeiro verifica se existe algum recipient cadastrado para esta campanha
      const { count: totalCount } = await supabaseAdmin
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id);
      
      // Se não tem nenhum recipient, não marca como COMPLETED (campanha ainda não foi populada)
      if ((totalCount ?? 0) === 0) {
        console.log(`[campaigns] ⏸️  aguardando recipients: id=${c.id} (${c.name || ""}) - nenhum destinatário cadastrado ainda`);
        continue;
      }
      
      // Verifica deliveries: não completa enquanto houver PENDING
      const { count: pendDel } = await supabaseAdmin
        .from("campaign_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .eq("status", "PENDING");
      const { count: doneDel } = await supabaseAdmin
        .from("campaign_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .in("status", ["SENT","DELIVERED","READ","FAILED"] as any);
      
      // Verifica quantos recipients ainda não foram processados
      const { count: remainingRecipients } = await supabaseAdmin
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .is("last_step_sent", null);
      
      console.log(`[campaigns] 📊 status atual: campaign=${c.id} (${c.name || ""}) totalRecipients=${totalCount} remaining=${remainingRecipients ?? 0} pendingDeliveries=${pendDel ?? 0} doneDeliveries=${doneDel ?? 0}`);
      
      // Só marca COMPLETED se:
      // 1. Não há recipients pendentes (last_step_sent = null)
      // 2. Não há deliveries PENDING
      // 3. Número de deliveries finalizados >= número de recipients
      if ((remainingRecipients ?? 0) === 0 && (pendDel ?? 0) === 0 && (doneDel ?? 0) >= (totalCount ?? 0)) {
        await supabaseAdmin.from("campaigns").update({ status: "COMPLETED" }).eq("id", c.id);
        console.log(`[campaigns] ✅ status COMPLETED: id=${c.id} (${c.name || ""}) [deliveries finalizados: ${doneDel} de ${totalCount}]`);
      } else {
        console.log(`[campaigns] ⏳ aguardando processamento: campaign=${c.id} (${c.name || ""}) REMAINING=${remainingRecipients ?? 0} PENDING=${pendDel ?? 0} DONE=${doneDel ?? 0} TOTAL=${totalCount}`);
      }
    }
    } catch (err) {
      console.error("[campaigns] tick error:", (err as any)?.message || err);
    }
  }, 50); // TTL de 50 segundos (menor que intervalo de 60s)
}

// Task reminders - roda a cada 1 minuto (DEBUG)
import { checkAndSendReminders } from "./jobs/taskReminders.js";
import { runAutoTaskCreation } from "./jobs/autoTaskCreation.js";
import { runAutoAgentFollowup } from "./jobs/autoAgentFollowup.js";
import { dailyConsolidationJob, weeklyOpenAISyncJob, monthlyCleanupJob, stripeSyncJob } from "./jobs/sync-openai-usage.job.js";

function startCronJobs() {
  console.log("[worker] 🕒 Starting CRON jobs (Campaigns, Reminders, Auto-Tasks, OpenAI)...");

  setInterval(() => {
    console.log("[worker] ⏰ Triggering task reminder check...");
    runWithDistributedLock("task:reminders", checkAndSendReminders, 50);
  }, 60_000);

  // Auto-criação de tarefas - roda a cada 6 horas
  setInterval(() => runWithDistributedLock("auto:task", runAutoTaskCreation, 21000), 6 * 60 * 60_000);
  runAutoTaskCreation(); // Executar imediatamente na inicialização

  // Auto-follow-up de agentes - roda a cada 2 minutos
  setInterval(() => runWithDistributedLock("auto:followup", runAutoAgentFollowup, 100), 2 * 60_000);
  runAutoAgentFollowup().catch(err => console.error("[worker] autoAgentFollowup init error:", err));

  // OpenAI Usage Consolidation - roda a cada 24 horas
  setInterval(() => runWithDistributedLock("openai:consolidation", dailyConsolidationJob, 23 * 60 * 60), 24 * 60 * 60_000);
  
  // Stripe Sync - roda a cada 24 horas (após a consolidação)
  setInterval(() => runWithDistributedLock("openai:stripe-sync", stripeSyncJob, 23 * 60 * 60), 24 * 60 * 60_000 + 3600_000);

  // OpenAI Project Sync - roda a cada 7 dias
  setInterval(() => runWithDistributedLock("openai:sync", weeklyOpenAISyncJob, 6 * 24 * 60 * 60), 7 * 24 * 60 * 60_000);

  // OpenAI Cleanup - roda a cada 30 dias
  // OBS: setInterval tem limite de ~24 dias (2^31-1 ms). 30 dias causa overflow e roda instantaneamente.
  // Solução: Rodar verificação a cada 1 dia. O lock de 29 dias impede execução duplicada.
  setInterval(() => runWithDistributedLock("openai:cleanup", monthlyCleanupJob, 29 * 24 * 60 * 60), 24 * 60 * 60_000);

  // roda a cada 60s
  setInterval(tickCampaigns, 60_000);
  setInterval(() => runWithDistributedLock("sync:groups", syncWahaGroupMetadata, 240), 300_000);
}

if (!process.env.SKIP_WORKER_AUTOSTART) {
  main().catch((e) => {
    console.error("[worker] fatal:", e);
    process.exit(1);
  });
}


