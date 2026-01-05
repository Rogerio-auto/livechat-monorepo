import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import express from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireInboxAccess } from "../middlewares/requireInboxAccess.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { getIO } from "../lib/io.js";
import { NotificationService } from "../services/NotificationService.js";
import { EX_APP, publish } from "../queue/rabbit.js"; // <??" padroniza ??oqueue???
import {
  redis,
  rGet,
  rSet,
  rDel,
  k,
  clearMessageCache,
  rememberMessageCacheKey,
  rememberListCacheKey,
  clearListCacheIndexes,
} from "../lib/redis.js";
import { WAHA_PROVIDER, fetchWahaChatPicture, fetchWahaContactPicture, fetchWahaGroupPicture, deleteWahaMessage, editWahaMessage } from "../services/waha/client.js";
import { normalizeMsisdn } from "../util.js";
import { getAgent as getRuntimeAgent } from "../services/agents.runtime.js";
import { transformMessagesMediaUrls, transformMessageMediaUrl } from "../lib/mediaProxy.js";
import messagesRouter from "./livechat.messages.js";
import { logger } from "../lib/logger.js";
import { 
  SendMessageSchema, 
  CreateChatSchema, 
  UpdateChatStatusSchema, 
  TransferChatSchema 
} from "../schemas/chat.schema.ts";

const TTL_LIST = Math.max(60, Number(process.env.CACHE_TTL_LIST || 120));
const TTL_CHAT = Number(process.env.CACHE_TTL_CHAT || 30);
const TTL_MSGS = Math.max(60, Number(process.env.CACHE_TTL_MSGS || 60));
const PRIVATE_CHAT_CACHE_TTL = Math.max(60, Number(process.env.PRIVATE_CHAT_CACHE_TTL || TTL_MSGS * 2));
const TRACE_EXPLAIN = process.env.LIVECHAT_TRACE_EXPLAIN === "1";
const TTL_AVATAR = Number(process.env.CACHE_TTL_AVATAR || 300);

let chatsSupportsLastMessageType = true;
let chatsSupportsLastMessageMediaUrl = true;

// Multer (memória) para uploads multipart (ex.: /messages/media)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

type CacheEnvelope<T> = {
  data: T;
  meta: {
    etag: string;
    lastModified: string;
    cachedAt: string;
  };
};

type QueryTraceEntry = {
  label: string;
  table: string;
  durationMs: number;
  rows?: number;
  count?: number | null;
  error?: string;
  plan?: unknown;
};

function buildCacheEnvelope<T>(data: T, lastModifiedIso?: string | null): CacheEnvelope<T> {
  const serialized = JSON.stringify(data);
  const etag = createHash("sha1").update(serialized).digest("base64url");
  const lastModified = lastModifiedIso || new Date().toISOString();
  return {
    data,
    meta: {
      etag,
      lastModified,
      cachedAt: new Date().toISOString(),
    },
  };
}

function ensureEnvelope<T>(raw: CacheEnvelope<T> | T, lastModifiedHint?: string | null): CacheEnvelope<T> {
  if (raw && typeof raw === "object" && "meta" in (raw as any) && "data" in (raw as any)) {
    const env = raw as CacheEnvelope<T>;
    if (!env.meta?.etag) {
      const rebuilt = buildCacheEnvelope(env.data, env.meta?.lastModified || lastModifiedHint);
      return rebuilt;
    }
    return env;
  }
  return buildCacheEnvelope(raw as T, lastModifiedHint);
}

async function warmChatMessagesCache(chatId: string, limit = 20): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select(
        "id, chat_id, content, is_from_customer, sender_id, created_at, type, view_status, media_url, caption, remote_participant_id, remote_sender_id, remote_sender_name, remote_sender_phone, remote_sender_avatar_url, remote_sender_is_admin, replied_message_id, replied_message_external_id, interactive_content",
      )
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[livechat/messages] warm cache skipped", error);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    const mappedAsc = rows
      .slice()
      .reverse()
      .map((row: any) => ({
        id: row.id,
        chat_id: row.chat_id,
        body: row.content,
        sender_type: row.type === "SYSTEM" ? "SYSTEM" : (row.is_from_customer ? "CUSTOMER" : (row.sender_id ? "AGENT" : "AI")),
        sender_id: row.sender_id || null,
        created_at: row.created_at,
        view_status: row.view_status || null,
        type: row.type || "TEXT",
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
        interactive_content: row.interactive_content ?? null,
      }));

    // Transform encrypted media URLs to proxy URLs
    const messagesWithProxyUrls = transformMessagesMediaUrls(mappedAsc);

    const hasMore = rows.length === limit;
    const nextBefore = hasMore && messagesWithProxyUrls.length > 0 ? messagesWithProxyUrls[0].created_at : "";
    const payload = {
      items: messagesWithProxyUrls,
      nextBefore,
      hasMore,
    };
    const lastModifiedIso =
      messagesWithProxyUrls.length > 0 ? messagesWithProxyUrls[messagesWithProxyUrls.length - 1].created_at : new Date().toISOString();
    const envelope = buildCacheEnvelope(payload, lastModifiedIso);
    const cacheKey = k.msgsKey(chatId, undefined, limit);
    await rSet(cacheKey, envelope, TTL_MSGS);
    await rememberMessageCacheKey(chatId, cacheKey, TTL_MSGS);
  } catch (err) {
    console.warn("[livechat/messages] warm cache failed:", err instanceof Error ? err.message : err);
  }
}

function applyConditionalHeaders(res: express.Response, envelope: CacheEnvelope<any>) {
  res.setHeader("ETag", envelope.meta.etag);
  res.setHeader("Last-Modified", new Date(envelope.meta.lastModified).toUTCString());
}

function isFreshRequest(req: express.Request, envelope: CacheEnvelope<any>): boolean {
  const ifNoneMatch = req.headers["if-none-match"];
  if (typeof ifNoneMatch === "string" && ifNoneMatch.length > 0) {
    if (ifNoneMatch.split(",").map((part) => part.trim()).includes(envelope.meta.etag)) {
      return true;
    }
  } else if (Array.isArray(ifNoneMatch) && ifNoneMatch.includes(envelope.meta.etag)) {
    return true;
  }

  const ifModifiedSince = req.headers["if-modified-since"];
  if (typeof ifModifiedSince === "string") {
    const sinceTs = Date.parse(ifModifiedSince);
    const lastTs = Date.parse(envelope.meta.lastModified);
    if (!Number.isNaN(sinceTs) && !Number.isNaN(lastTs) && lastTs <= sinceTs) {
      return true;
    }
  }

  return false;
}

async function traceSupabase<T>(
  label: string,
  table: string,
  log: QueryTraceEntry[],
  execute: () => Promise<{ data: T; error: any; count?: number | null }>,
  explain?: () => Promise<any>,
) {
  let plan: unknown = undefined;
  if (TRACE_EXPLAIN && explain) {
    try {
      const planResp = await explain();
      plan = (planResp as any)?.data ?? planResp ?? null;
    } catch (err) {
      plan = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  const started = performance.now();
  const result = await execute();
  const durationMs = performance.now() - started;

  log.push({
    label,
    table,
    durationMs,
    rows: Array.isArray(result.data) ? (result.data as any[]).length : undefined,
    count: result.count ?? null,
    error: result.error ? result.error.message ?? String(result.error) : undefined,
    plan,
  });

  return result;
}

const ALLOWED_CHAT_STATUSES = new Set([
  "OPEN",
  "PENDING",
  "CLOSED",
  "ASSIGNED",
  "AI",
  "RESOLVED",
]);
const ALLOWED_CHAT_KINDS = new Set(["GROUP", "DIRECT"]);

function normalizeSupabaseError(error: any, fallbackMessage = "Unexpected error") {
  let message = error?.message ?? fallbackMessage;
  let details = error?.details ?? undefined;
  let hint = error?.hint ?? undefined;
  let code = error?.code ?? undefined;

  if (typeof message === "string" && message.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(message);
      message = parsed?.message || message;
      details = details ?? parsed?.details ?? undefined;
      hint = hint ?? parsed?.hint ?? undefined;
      code = code ?? parsed?.code ?? undefined;
    } catch {
      // ignore parse errors, keep original message
    }
  }

  return {
    error: message || fallbackMessage,
    details,
    hint,
    code,
  };
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string | null;
      name?: string | null;
      role?: string | null;
      company_id?: string | null;
    }

    interface Request {
      user?: User; // agora req.user existe no tipo
    }
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toUuidArray(arr: any[]): string[] {
  const out: string[] = [];
  for (const v of arr || []) {
    const s =
      typeof v === "string"
        ? v
        : v && typeof v === "object" && typeof v.id === "string"
        ? v.id
        : "";
    if (s && UUID_RE.test(s)) out.push(s);
  }
  return Array.from(new Set(out));
}

function buildChatSelectFields(): string {
  const fields = [
    "id",
    "company_id",
    "inbox_id",
    "customer_id",
    "kind",
    "chat_type",
    "remote_id",
    "group_name",
    "group_avatar_url",
    "external_id",
    "status",
    "last_message",
    "last_message_at",
    "last_message_from",
    "unread_count",
    "created_at",
    "updated_at",
    "assignee_agent",
    "ai_agent_id",
    "department_id",
    "team_id",
  ];
  if (chatsSupportsLastMessageType) fields.push("last_message_type");
  if (chatsSupportsLastMessageMediaUrl) fields.push("last_message_media_url");
  fields.push(
    "inbox:inboxes!inner(id, company_id)",
    "ai_agent:agents!chats_ai_agent_id_fkey(id, name)",
    "customer:customers(id, name, phone)",
    "department:departments(id, name, color, icon)",
  );
  return fields.join(",");
}

function flattenChatRow(row: any) {
  if (!row || typeof row !== "object") return row;

  if (row.inbox) delete row.inbox;

  if (row.ai_agent) {
    row.ai_agent_id = row.ai_agent?.id ?? null;
    row.ai_agent_name = row.ai_agent?.name ?? null;
    delete row.ai_agent;
  } else {
    row.ai_agent_id = row.ai_agent_id ?? null;
    row.ai_agent_name = row.ai_agent_name ?? null;
  }

  if (row.department) {
    row.department_name = row.department?.name ?? null;
    row.department_color = row.department?.color ?? null;
    row.department_icon = row.department?.icon ?? null;
    delete row.department;
  } else {
    row.department_name = row.department_name ?? null;
    row.department_color = row.department_color ?? null;
    row.department_icon = row.department_icon ?? null;
  }

  if (row.customer) {
    row.customer_name = row.customer?.name ?? null;
    row.customer_phone = row.customer?.phone ?? null;
    delete row.customer;
  } else {
    row.customer_name = row.customer_name ?? null;
    row.customer_phone = row.customer_phone ?? null;
  }

  return row;
}


export function registerLivechatChatRoutes(app: express.Application) {
  // Mount messages sub-router for GET /livechat/messages/:id
  app.use("/livechat/messages", messagesRouter);

  // Listar chats (com cache)
  app.get("/livechat/chats", requireAuth, requireInboxAccess, async (req: any, res) => {
    const reqLabel = `livechat.chats#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    console.time(reqLabel);
    const handlerStart = performance.now();
    const queryLog: QueryTraceEntry[] = [];
    let timerClosed = false;
    const endTimer = (meta?: Record<string, unknown>) => {
      if (!timerClosed) {
        console.timeEnd(reqLabel);
        timerClosed = true;
      }
      if (meta) {
        const totalMs = performance.now() - handlerStart;
        console.log("[livechat/chats]", { durationMs: Number(totalMs.toFixed(2)), ...meta });
      }
    };

    try {
      const inboxId = (req.query.inboxId as string) || undefined;
      const rawStatus = (req.query.status as string) || undefined;
      const rawKind = (req.query.kind as string) || undefined;
      const departmentId = (req.query.department_id as string) || undefined;
      const q = (req.query.q as string) || undefined;
      const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 20;
      const offset = req.query.offset ? Math.max(0, Number(req.query.offset)) : 0;

      const normalizedStatus = rawStatus ? rawStatus.trim().toUpperCase() : undefined;
      if (
        normalizedStatus &&
        normalizedStatus !== "ALL" &&
        !ALLOWED_CHAT_STATUSES.has(normalizedStatus)
      ) {
        endTimer({ error: "invalid_status" });
        return res.status(400).json({ error: "Status invalido" });
      }
      let kindFilter: "GROUP" | "DIRECT" | undefined;
      if (rawKind) {
        const normalizedKind = rawKind.trim().toUpperCase();
        if (!ALLOWED_CHAT_KINDS.has(normalizedKind)) {
          endTimer({ error: "invalid_kind" });
          return res.status(400).json({ error: "Kind invalido" });
        }
        kindFilter = normalizedKind as "GROUP" | "DIRECT";
      }
      if (inboxId && !UUID_RE.test(inboxId)) {
        endTimer({ error: "invalid_inbox" });
        return res.status(400).json({ error: "Inbox invalida" });
      }
      
      if (departmentId && !UUID_RE.test(departmentId)) {
        endTimer({ error: "invalid_department" });
        return res.status(400).json({ error: "Departamento inválido" });
      }

      const statusFilter =
        normalizedStatus && normalizedStatus !== "ALL" ? normalizedStatus : undefined;
      const statusSegment = statusFilter ?? "ALL";
      const kindSegment = kindFilter ?? "ALL";
      const deptSegment = departmentId || undefined;

      const actorResp = await traceSupabase(
        "users.company",
        "users",
        queryLog,
        async () =>
          await supabaseAdmin
            .from("users")
            .select("company_id")
            .eq("user_id", req.user.id)
            .maybeSingle(),
      );
      if (actorResp.error) {
        endTimer({ error: actorResp.error.message, queries: queryLog });
        return res.status(500).json({ error: actorResp.error.message });
      }

      const companyId = (actorResp.data as any)?.company_id ?? null;
      if (!companyId) {
        endTimer({ error: "no_company", queries: queryLog });
        return res.status(404).json({ error: "Usuario sem company_id" });
      }
      if (companyId && !req.user?.company_id) (req.user as any).company_id = companyId;

      const cacheKey = k.list(
        companyId,
        inboxId || null,
        statusSegment,
        kindSegment,
        q || null,
        offset,
        limit,
        deptSegment,
      );
      const listIndexKey = k.listIndex(companyId, inboxId || null, statusSegment, kindSegment, deptSegment);
      
      console.log("[GET /chats] Buscando cache:", { cacheKey, listIndexKey });
      
      const cachedRaw = await rGet<
        CacheEnvelope<{ items: any[]; total: number }> | { items: any[]; total: number }
      >(cacheKey);
      if (cachedRaw) {
        console.log("[GET /chats] CACHE HIT - retornando dados do cache");
        const cachedEnvelope = ensureEnvelope(cachedRaw);
        // Log primeiro chat do cache para debug
        if (cachedEnvelope.data?.items?.[0]) {
          console.log("[GET /chats] Primeiro chat do cache:", {
            id: cachedEnvelope.data.items[0].id,
            ai_agent_id: cachedEnvelope.data.items[0].ai_agent_id,
            ai_agent_name: cachedEnvelope.data.items[0].ai_agent_name,
          });
        }
        applyConditionalHeaders(res, cachedEnvelope);
        res.setHeader("X-Cache", "HIT");
        if (isFreshRequest(req, cachedEnvelope)) {
          res.status(304).end();
          endTimer({ cache: "HIT-304", key: cacheKey, queries: queryLog });
          return;
        }
        res.json(cachedEnvelope.data);
        endTimer({
          cache: "HIT",
          key: cacheKey,
          items: cachedEnvelope.data?.items?.length ?? 0,
          total: cachedEnvelope.data?.total ?? 0,
          kind: kindSegment,
          queries: queryLog,
        });
        return;
      }

      console.log("[GET /chats] CACHE MISS - buscando do banco");
      res.setHeader("X-Cache", "MISS");
      // debug: cache MISS

      if (inboxId) {
        const inboxResp = await traceSupabase(
          "inboxes.check",
          "inboxes",
          queryLog,
          async () =>
            await supabaseAdmin
              .from("inboxes")
              .select("id")
              .eq("id", inboxId)
              .eq("company_id", companyId)
              .maybeSingle(),
        );
        if (inboxResp.error) {
          endTimer({ error: inboxResp.error.message, queries: queryLog });
          return res.status(500).json({ error: inboxResp.error.message });
        }
        if (!inboxResp.data) {
          endTimer({ error: "inbox_not_found", queries: queryLog });
          return res.status(404).json({ error: "Inbox nao encontrada" });
        }
      }

      const runChatsQuery = async (label: string) =>
        await traceSupabase(
          label,
          "chats",
          queryLog,
          async () => {
            let query = supabaseAdmin
              .from("chats")
              .select(buildChatSelectFields(), { count: "exact" })
              // Filtrar por company_id via join com inbox
              .eq("inbox.company_id", companyId)
              .order("last_message_at", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: true });
            if (inboxId) query = query.eq("inbox_id", inboxId);
            if (departmentId) query = query.eq("department_id", departmentId);
            if (statusFilter) {
              query = query.eq("status", statusFilter);
              // PENDING status: only show chats with unread messages
              if (statusFilter === "PENDING") {
                query = query.gt("unread_count", 0);
              }
            }
            if (kindFilter === "GROUP") {
              query = query.or(
                [
                  "kind.eq.GROUP",
                  "remote_id.ilike.%@g.us",
                  "chat_type.eq.GROUP",
                ].join(","),
              );
            } else if (kindFilter === "DIRECT") {
              query = query.or("kind.eq.DIRECT,kind.is.null");
              query = query.or("remote_id.is.null,remote_id.not.ilike.%@g.us");
              query = query.or(
                [
                  "chat_type.eq.CONTACT",
                  "chat_type.is.null",
                ].join(","),
              );
            }
            // When searching, fetch more results without text filter
            // and filter client-side to include customer name/phone
            const fetchLimit = q && q.trim() ? Math.max(limit * 3, 100) : limit;
            
            // Only apply database text filter if NOT searching customer fields
            // (we'll filter everything client-side when searching)
            // Commenting out the .or() filter to fetch all chats when searching
            // if (q && q.trim()) {
            //   const term = q.trim();
            //   query = query.or(
            //     [
            //       `last_message.ilike.%${term}%`,
            //       `external_id.ilike.%${term}%`,
            //     ].join(",")
            //   );
            // }
            
            return await query.range(offset, offset + Math.max(0, fetchLimit - 1));
          },
        );

      let listResp = await runChatsQuery("chats.list");
      if (listResp.error) {
        const message = String(listResp.error.message || "").toLowerCase();
        let retried = false;
        if (chatsSupportsLastMessageType && message.includes("last_message_type")) {
          chatsSupportsLastMessageType = false;
          retried = true;
        }
        if (chatsSupportsLastMessageMediaUrl && message.includes("last_message_media_url")) {
          chatsSupportsLastMessageMediaUrl = false;
          retried = true;
        }
        if (retried) {
          listResp = await runChatsQuery("chats.list.retry");
        }
      }

      if (listResp.error) {
        const parsedError = normalizeSupabaseError(listResp.error);
        endTimer({ error: parsedError.error, queries: queryLog });
        return res.status(500).json(parsedError);
      }

      const rawItems = ((listResp.data || []) as any[]).map((row: any) => (row ? flattenChatRow(row) : row));
      
      // Client-side filtering for all searchable fields when query exists
      let items = rawItems;
      if (q && q.trim()) {
        const searchTerm = q.trim().toLowerCase();
        items = rawItems.filter((chat: any) => {
          const lastMessage = (chat.last_message || '').toLowerCase();
          const externalId = (chat.external_id || '').toLowerCase();
          const customerName = (chat.customer_name || '').toLowerCase();
          const customerPhone = (chat.customer_phone || '').toLowerCase();
          
          return lastMessage.includes(searchTerm) || 
                 externalId.includes(searchTerm) ||
                 customerName.includes(searchTerm) || 
                 customerPhone.includes(searchTerm);
        });
        // Limit to original requested limit after filtering
        items = items.slice(0, limit);
      }
      const remoteIdSet = new Set<string>();
      for (const chat of items as any[]) {
        if (!chat) continue;
        const remoteCandidate =
          (typeof chat.remote_id === "string" && chat.remote_id.trim()) ||
          (typeof chat.external_id === "string" && chat.external_id.trim()) ||
          null;
        if (remoteCandidate) {
          remoteIdSet.add(remoteCandidate);
        }
      }

      const linkIds = toUuidArray(items.map((c: any) => c.assignee_agent));
      const customerIds = toUuidArray(items.map((c: any) => c.customer_id));
      
      // Coletar telefones para busca de leads por telefone também (evita erro de duplicidade)
      const chatPhones = items
        .map((c: any) => c.customer_phone || c.remote_id?.split('@')[0] || c.external_id?.split('@')[0])
        .filter((p): p is string => typeof p === 'string' && p.length > 5);

      const [linksResp, customersResp, leadsResp] = await Promise.all([
        linkIds.length
          ? traceSupabase(
              "inbox_users.by_id",
              "inbox_users",
              queryLog,
              async () =>
                await supabaseAdmin
                  .from("inbox_users")
                  .select("id, user_id")
                  .in("id", linkIds),
            )
          : Promise.resolve({ data: [], error: null, count: null } as const),
        customerIds.length
          ? traceSupabase(
              "customers.display",
              "customers",
              queryLog,
              async () =>
                await supabaseAdmin
                  .from("customers")
                  .select("id, name, phone, msisdn")
                  .in("id", customerIds),
            )
          : Promise.resolve({ data: [], error: null, count: null } as const),
        (customerIds.length || chatPhones.length)
          ? traceSupabase(
              "leads.display",
              "leads",
              queryLog,
              async () => {
                let query = supabaseAdmin
                  .from("leads")
                  .select("id, name, phone, kanban_column_id, customer_id")
                  .eq("company_id", companyId);
                
                const filters = [];
                if (customerIds.length) {
                  filters.push(`customer_id.in.(${customerIds.join(",")})`);
                  filters.push(`id.in.(${customerIds.join(",")})`);
                }
                if (chatPhones.length) {
                  filters.push(`phone.in.(${chatPhones.map(p => `"${p}"`).join(",")})`);
                }
                
                return await query.or(filters.join(","));
              }
            )
          : Promise.resolve({ data: [], error: null, count: null } as const),
      ]);

      // Buscar nomes das colunas do kanban
      const kanbanColumnIds = toUuidArray(
        (leadsResp.data || []).map((lead: any) => lead.kanban_column_id).filter(Boolean)
      );
      const kanbanColumnsResp = kanbanColumnIds.length
        ? await traceSupabase(
            "kanban_columns.names",
            "kanban_columns",
            queryLog,
            async () =>
              await supabaseAdmin
                .from("kanban_columns")
                .select("id, name")
                .in("id", kanbanColumnIds),
          )
        : { data: [], error: null, count: null };

      const kanbanColumnNames: Record<string, string> = {};
      if (kanbanColumnsResp.data) {
        for (const col of kanbanColumnsResp.data as any[]) {
          if (col?.id) kanbanColumnNames[col.id] = col.name || null;
        }
      }

      let avatarByRemote: Record<string, string | null> = {};
      if (remoteIdSet.size > 0 && companyId) {
        const remoteList = Array.from(remoteIdSet);
        const avatarKeys = remoteList.map((remote) => k.avatar(companyId, remote));
        try {
          const rawValues = await redis.mget(...avatarKeys);
          avatarByRemote = Object.fromEntries(
            remoteList.map((remote, index) => {
              const raw = rawValues[index];
              if (!raw) return [remote, null];
              try {
                return [remote, JSON.parse(raw)];
              } catch {
                return [remote, raw];
              }
            }),
          );
          const withCache = Object.values(avatarByRemote).filter(Boolean).length;
          console.debug("[AVATAR][cache] leitura Redis", { total: remoteList.length, cached: withCache, misses: remoteList.length - withCache });
        } catch (error) {
          console.warn("[livechat/chats] avatar cache lookup failed", {
            companyId,
            count: remoteList.length,
            error,
          });
        }

        // Attempt best-effort WAHA picture fetch for cache misses, when chat inbox is WAHA
        try {
          const inboxIdsAll = toUuidArray((items as any[]).map((c: any) => c.inbox_id));
          let inboxRows: Array<{ id: string; provider: string | null; instance_id: string | null }> = [];
          if (inboxIdsAll.length) {
            const inboxResp = await supabaseAdmin
              .from("inboxes")
              .select("id, provider, instance_id")
              .in("id", inboxIdsAll);
            if (!inboxResp.error && Array.isArray(inboxResp.data)) {
              inboxRows = inboxResp.data as any[];
            }
          }

          const sessionByInbox: Record<string, string> = {};
          for (const row of inboxRows) {
            const provider = (row?.provider || "").toString().toUpperCase();
            const session = (row?.instance_id || "").toString().trim();
            if (provider === WAHA_PROVIDER && session && UUID_RE.test(String(row.id))) {
              sessionByInbox[String(row.id)] = session;
            }
          }

          const pendingRemotes = new Set<string>();
          const fetchTasks: Promise<void>[] = [];
          const MAX_AVATAR_FETCH = 20; // Limit to same as page size
          let fetchCount = 0;
          const allowGroupFetch = kindFilter === "GROUP"; // only fetch group pictures in Groups tab
          const allowDirectFetch = kindFilter !== "GROUP"; // fetch directs in Direct or All
          
          for (const chat of items as any[]) {
            if (fetchCount >= MAX_AVATAR_FETCH) break; // Stop after limit
            
            const remoteKey =
              (typeof chat.remote_id === "string" && chat.remote_id.trim()) ||
              (typeof chat.external_id === "string" && chat.external_id.trim()) ||
              null;
            if (!remoteKey) continue;
            if (avatarByRemote[remoteKey]) continue; // already cached

            const inboxIdForChat = typeof chat.inbox_id === "string" ? chat.inbox_id : null;
            if (!inboxIdForChat) continue;
            const session = sessionByInbox[inboxIdForChat];
            if (!session) continue;
            if (pendingRemotes.has(remoteKey)) continue;
            pendingRemotes.add(remoteKey);
            fetchCount++;

            const isGroup =
              (typeof chat.kind === "string" && chat.kind.toUpperCase() === "GROUP") ||
              (typeof remoteKey === "string" && remoteKey.toLowerCase().endsWith("@g.us"));

            // Respect tab: only fetch group pics on Groups tab, direct pics on Direct/All
            if (isGroup && !allowGroupFetch) continue;
            if (!isGroup && !allowDirectFetch) continue;

            // Normalize remoteKey for WAHA: ensure @c.us or @g.us suffix
            let normalizedRemoteKey = remoteKey;
            if (!remoteKey.includes('@')) {
              normalizedRemoteKey = isGroup ? `${remoteKey}@g.us` : `${remoteKey}@c.us`;
            }

            fetchTasks.push(
              (async () => {
                try {
                  const picResp = isGroup
                    ? await fetchWahaGroupPicture(session, normalizedRemoteKey)
                    : await fetchWahaContactPicture(session, normalizedRemoteKey, { refresh: false });
                  const url = (picResp && typeof picResp.url === "string" && picResp.url.trim()) || null;
                  if (url) {
                    console.debug("[AVATAR][livechat/chats] foto fetched do WAHA", { remoteKey, normalizedRemoteKey, isGroup, url: url.substring(0, 80) });
                    avatarByRemote[remoteKey] = url;
                    try {
                      await rSet(k.avatar(companyId, remoteKey), url, TTL_AVATAR);
                    } catch (cacheErr) {
                      console.warn("[livechat/chats] avatar cache set failed", { remoteKey, error: cacheErr });
                    }
                  } else {
                    console.debug("[AVATAR][livechat/chats] foto não retornada pelo WAHA", { remoteKey, normalizedRemoteKey, isGroup });
                  }
                } catch (fetchErr) {
                  console.warn("[AVATAR][livechat/chats] erro ao buscar foto do WAHA", { remoteKey, normalizedRemoteKey, isGroup, error: (fetchErr as any)?.message || fetchErr });
                }
              })(),
            );
          }

          if (fetchTasks.length) {
            // OTIMIZAÇÃO: Não aguardar o fetch de avatares para não travar o carregamento da lista.
            // Os avatares serão buscados em background e salvos no Redis para a próxima requisição.
            // Isso faz a lista carregar instantaneamente, mesmo que na primeira vez alguns avatares não apareçam.
            Promise.allSettled(fetchTasks).then((results) => {
               const successCount = results.filter(r => r.status === 'fulfilled').length;
               console.debug(`[AVATAR] Background fetch concluído: ${successCount}/${fetchTasks.length} salvos no cache.`);
            }).catch(err => console.error("[AVATAR] Background fetch error:", err));
          }
        } catch (avatarResolveErr) {
          console.warn("[livechat/chats] avatar resolve pipeline failed", avatarResolveErr);
        }
      }

      let usersResp: { data: any[] | null; error: any } = { data: [], error: null };
      if (linkIds.length && Array.isArray((linksResp as any).data)) {
        const userIds = toUuidArray(((linksResp as any).data || []).map((row: any) => row.user_id));
        if (userIds.length) {
          usersResp = await traceSupabase(
            "users.by_id",
            "users",
            queryLog,
            async () =>
              await supabaseAdmin
                .from("users")
                .select("id, name, avatar")
                .in("id", userIds),
          );
        }
      }

      if ((linksResp as any).error) {
        console.warn("[livechat/chats] enrich agents skipped", (linksResp as any).error);
      }
      if (usersResp.error) {
        console.warn("[livechat/chats] enrich users skipped", usersResp.error);
      }

      const userIdByLink: Record<string, string> = {};
      for (const row of (((linksResp as any).data || []) as any[])) {
        const lid = row?.id;
        const uid = row?.user_id;
        if (UUID_RE.test(String(lid)) && UUID_RE.test(String(uid))) {
          userIdByLink[String(lid)] = String(uid);
        }
      }

      const usersById: Record<string, { name: string | null; avatar: string | null }> = {};
      for (const row of (usersResp.data || []) as any[]) {
        usersById[String(row.id)] = {
          name: row?.name || row?.id || null,
          avatar: row?.avatar || null,
        };
      }

      for (const chat of items as any[]) {
        const linkId = chat.assignee_agent || null;
        const userId = linkId ? userIdByLink[linkId] : null;
        chat.assigned_agent_id = linkId;
        chat.assigned_agent_user_id = userId || null;
        chat.assigned_agent_name = userId ? usersById[userId]?.name || null : null;
        chat.assigned_agent_avatar_url = userId ? usersById[userId]?.avatar || null : null;
      }

      const customerDisplay: Record<string, { name: string | null; phone: string | null }> = {};
      for (const row of (((customersResp as any).data || []) as any[])) {
        const id = String(row.id);
        customerDisplay[id] = {
          name: row?.name || null,
          phone: row?.phone || row?.msisdn || null,
        };
      }
      for (const row of (((leadsResp as any).data || []) as any[])) {
        const id = String(row.customer_id || row.id);
        if (!customerDisplay[id]) {
          customerDisplay[id] = {
            name: row?.name || null,
            phone: row?.phone || null,
          };
        } else {
          if (!customerDisplay[id].name) {
            customerDisplay[id].name = row?.name || customerDisplay[id].name;
          }
          if (!customerDisplay[id].phone) {
            customerDisplay[id].phone = row?.phone || customerDisplay[id].phone;
          }
        }
      }

      // Mapear stage_id e stage_name dos leads
      const leadStages: Record<string, { stage_id: string | null; stage_name: string | null }> = {};
      const leadByPhone: Record<string, { stage_id: string | null; stage_name: string | null }> = {};
      
      for (const row of (((leadsResp as any).data || []) as any[])) {
        const id = String(row.customer_id || row.id);
        const phone = row.phone;
        const columnId = row.kanban_column_id;
        
        const leadInfo = {
          stage_id: columnId || null,
          stage_name: columnId ? kanbanColumnNames[columnId] || null : null,
        };
        
        leadStages[id] = leadInfo;
        if (phone) leadByPhone[phone] = leadInfo;
      }

      for (const chat of items as any[]) {
        const display = customerDisplay[String(chat.customer_id)] || null;
        chat.customer_name = display?.name || null;
        chat.customer_phone = display?.phone || null;

        // Adicionar stage_id e stage_name do lead (por ID ou por Telefone)
        const phoneKey = chat.customer_phone || 
                         chat.remote_id?.split('@')[0] || 
                         chat.external_id?.split('@')[0];
                         
        const leadStage = leadStages[String(chat.customer_id)] || 
                          (phoneKey ? leadByPhone[phoneKey] : null) || 
                          null;
                          
        chat.stage_id = leadStage?.stage_id || null;
        chat.stage_name = leadStage?.stage_name || null;
        chat.is_lead = !!leadStage;

        const remoteKey =
          (typeof chat.remote_id === "string" && chat.remote_id.trim()) ||
          (typeof chat.external_id === "string" && chat.external_id.trim()) ||
          null;
        const cachedAvatar = remoteKey ? avatarByRemote[remoteKey] ?? null : null;
        const isGroupChatKind =
          typeof chat.kind === "string" && chat.kind.toUpperCase() === "GROUP";

        if (isGroupChatKind) {
          if (!chat.group_avatar_url && cachedAvatar) {
            chat.group_avatar_url = cachedAvatar;
          }
          chat.customer_avatar_url = chat.group_avatar_url ?? cachedAvatar ?? null;
        } else {
          chat.customer_avatar_url = cachedAvatar ?? null;
        }
        
        // Debug: log avatar resolution for first 3 chats
        if ((items as any[]).indexOf(chat) < 3) {
          console.debug("[AVATAR][enrich]", {
            chatId: chat.id,
            remoteKey,
            isGroup: isGroupChatKind,
            cachedAvatar: cachedAvatar ? cachedAvatar.substring(0, 60) + '...' : null,
            final_customer_avatar_url: chat.customer_avatar_url ? chat.customer_avatar_url.substring(0, 60) + '...' : null,
          });
        }

        if (!chat.display_name) {
          if (chat.customer_name) {
            chat.display_name = chat.customer_name;
          } else if (isGroupChatKind && chat.group_name) {
            chat.display_name = chat.group_name;
          } else if (remoteKey) {
            chat.display_name = remoteKey.replace(/@.*/, "");
          }
        }

        const senderRaw =
          typeof chat.last_message_from === "string"
            ? chat.last_message_from.trim().toUpperCase()
            : "";
        chat.last_message_from =
          senderRaw === "CUSTOMER" || senderRaw === "AGENT" ? senderRaw : null;

        const typeRaw =
          typeof chat.last_message_type === "string"
            ? chat.last_message_type.trim().toUpperCase()
            : "";
        chat.last_message_type = typeRaw || null;

        const mediaUrlRaw =
          typeof chat.last_message_media_url === "string"
            ? chat.last_message_media_url.trim()
            : "";
        chat.last_message_media_url = mediaUrlRaw || null;
        
        // OTIMIZAÇÃO: Formatar last_message para tipos de mídia (substituir [IMAGE], [MEDIA] etc por ícones amigáveis)
        const normalizedType = (chat.last_message_type || "MEDIA").toString().toUpperCase();
        const isBracketStyle = chat.last_message && /^\[[A-Z]+\]$/.test(chat.last_message);
        const isArtifactStyle = chat.last_message && /^\?\?\s*(audio|documento|imagem|vídeo|sticker)/i.test(chat.last_message);
        
        if ((!chat.last_message && chat.last_message_media_url) || isBracketStyle || isArtifactStyle) {
          switch (normalizedType) {
            case "IMAGE": chat.last_message = "📷 Imagem"; break;
            case "VIDEO": chat.last_message = "🎥 Vídeo"; break;
            case "AUDIO": chat.last_message = "� Áudio"; break;
            case "PTT": chat.last_message = "🎤 Áudio"; break;
            case "DOCUMENT": chat.last_message = "📄 Documento"; break;
            case "STICKER": chat.last_message = "🎨 Sticker"; break;
            case "LOCATION": chat.last_message = "📍 Localização"; break;
            case "CONTACT": chat.last_message = "👤 Contato"; break;
            default: chat.last_message = "📎 Mídia"; break;
          }
        } else if (chat.last_message && (chat.last_message.includes("??") || chat.last_message.includes("["))) {
           // Corrigir encoding incorreto de emojis e artefatos
           chat.last_message = chat.last_message
             .replace(/\?\?\s*audio/gi, "🎤 Áudio")
             .replace(/\?\?\s*Documento/gi, "📄 Documento")
             .replace(/\?\?\s*Imagem/gi, "📷 Imagem")
             .replace(/\?\?\s*Vídeo/gi, "🎥 Vídeo")
             .replace(/\?\?\s*Sticker/gi, "🎨 Sticker")
             .replace(/\[AUDIO\]/gi, "🎤 Áudio")
             .replace(/\[IMAGE\]/gi, "📷 Imagem")
             .replace(/\[VIDEO\]/gi, "🎥 Vídeo")
             .replace(/\[DOCUMENT\]/gi, "📄 Documento")
             .replace(/\[STICKER\]/gi, "🎨 Sticker");
        }

        const chatTypeUpper = typeof chat.chat_type === "string" ? chat.chat_type.toUpperCase() : null;
        if (chatTypeUpper === "GROUP" || chatTypeUpper === "GRUPO") {
          chat.kind = "GROUP";
          chat.chat_type = "GROUP";
        } else if (!chatTypeUpper && chat.kind !== "GROUP") {
          chat.kind = "DIRECT";
          chat.chat_type = "CONTACT";
        } else if (!chatTypeUpper) {
          chat.chat_type = "CONTACT";
        }
        if (!chat.display_name) {
          chat.display_name = chat.group_name || chat.customer_name || chat.remote_id || chat.external_id || chat.id;
        }
      }

      // Attach AI agent identity: prefer per-chat agent; fallback to active company agent when null
      try {
        const activeAgent = await getRuntimeAgent(companyId, null);
        for (const chat of items as any[]) {
          if (!chat.ai_agent_id) {
            chat.ai_agent_id = activeAgent?.id ?? null;
            chat.ai_agent_name = activeAgent?.name ?? null;
          }
        }
      } catch (err) {
        console.warn("[livechat/chats] get active agent failed", err instanceof Error ? err.message : err);
      }

      // Load tags for all chats in batch (efficient query)
      try {
        const chatIds = items.map((c: any) => c.id);
        if (chatIds.length > 0) {
          const { data: chatTags } = await supabaseAdmin
            .from('chat_tags')
            .select('chat_id, tag_id')
            .in('chat_id', chatIds);
          
          // Group tags by chat_id
          const tagsByChat = new Map<string, string[]>();
          if (chatTags) {
            for (const ct of chatTags) {
              const existing = tagsByChat.get(ct.chat_id) || [];
              existing.push(ct.tag_id);
              tagsByChat.set(ct.chat_id, existing);
            }
          }
          
          // Attach tags to chats
          for (const chat of items as any[]) {
            chat.tag_ids = tagsByChat.get(chat.id) || [];
          }
        }
      } catch (err) {
        console.warn("[livechat/chats] load tags failed", err instanceof Error ? err.message : err);
        // Fallback to empty tags
        for (const chat of items as any[]) {
          chat.tag_ids = [];
        }
      }

      const payload = { items, total: listResp.count ?? items.length };
      const lastModifiedIso =
        items.length > 0
          ? items[0].last_message_at ||
            items[0].updated_at ||
            items[0].created_at ||
            new Date().toISOString()
          : new Date().toISOString();
      const envelope = buildCacheEnvelope(payload, lastModifiedIso);
      
      console.log("[GET /chats] Salvando no cache:", cacheKey);
      // Log primeiro chat para debug
      if (items[0]) {
        console.log("[GET /chats] Primeiro chat do banco:", {
          id: items[0].id,
          ai_agent_id: items[0].ai_agent_id,
          ai_agent_name: items[0].ai_agent_name,
        });
      }
      
      await rSet(cacheKey, envelope, TTL_LIST);
      await rememberListCacheKey(listIndexKey, cacheKey, TTL_LIST);
      console.log("[GET /chats] Cache salvo com sucesso");
      
      try {
        await Promise.all(
          items
            .filter((chat: any) => chat?.id && UUID_RE.test(String(chat.id)))
            .map((chat: any) => rSet(k.chat(chat.id), chat, TTL_CHAT)),
        );
      } catch (cacheErr) {
        console.warn("[livechat/chats] chat cache populate failed:", cacheErr);
      }
      applyConditionalHeaders(res, envelope);
      res.json(payload);
      endTimer({
        cache: "MISS",
        key: cacheKey,
        items: payload.items.length,
        total: payload.total,
        kind: kindSegment,
        queries: queryLog,
      });
      return;
    } catch (e: any) {
      const parsedError = normalizeSupabaseError(e, "chat list error");
      endTimer({ error: parsedError.error, queries: queryLog });
      return res.status(500).json(parsedError);
    } finally {
      endTimer();
    }
  });
  app.post("/livechat/messages", requireAuth, async (req: any, res, next) => {
    const startedAt = performance.now();
    let insertedId: string | null = null;
    let logStatus: "ok" | "error" = "ok";
    let logError: string | null = null;
    
    try {
      const { chatId, text, senderType, reply_to } = SendMessageSchema.parse(req.body);
      
      const logMetrics = () => {
        const durationMs = Number((performance.now() - startedAt).toFixed(1));
        logger.info("[metrics][api] /livechat/messages", {
          chatId,
          durationMs,
          insertedId,
          status: logStatus,
          error: logError,
        });
      };

      const authUserId = typeof req.user?.id === "string" ? req.user.id : null;
      const needsSenderId = String(senderType).toUpperCase() !== "CUSTOMER";
      const chatSelect = `
        id,
        inbox_id,
        customer_id,
        external_id,
        inbox:inboxes (
          id,
          provider,
          company_id
        ),
        customer:customers (
          phone,
          msisdn
        )
      `;

      const [chatResp, userResp] = await Promise.all([
        supabaseAdmin.from("chats").select(chatSelect).eq("id", chatId).maybeSingle(),
        needsSenderId && authUserId
          ? supabaseAdmin
              .from("users")
              .select("id, name, email, avatar")
              .eq("user_id", authUserId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as { data: any; error: any }),
      ]);

      console.log("[POST /livechat/messages] 🔍 User resolution:", {
        needsSenderId,
        authUserId,
        userRespData: userResp?.data,
        userRespError: userResp?.error,
      });

      if (userResp?.error) {
        console.warn("[livechat:send] user lookup failed", userResp.error.message || userResp.error);
      }
      const senderSupabaseId: string | null =
        (userResp?.data as any)?.id && typeof (userResp.data as any).id === "string"
          ? (userResp.data as any).id
          : null;
      const senderName: string | null =
        userResp?.data?.name || userResp?.data?.email || null;
      const senderAvatarUrl: string | null = userResp?.data?.avatar || null;

      console.log("[POST /livechat/messages] 📝 Resolved sender:", {
        senderSupabaseId,
        senderName,
        senderAvatarUrl,
      });

      const chatRow = chatResp?.data as any;
      if (chatResp?.error) {
        logStatus = "error";
        logError = chatResp.error.message || "chat_load_error";
        return res.status(500).json({ error: chatResp.error.message });
      }
      if (!chatRow?.inbox_id) {
        logStatus = "error";
        logError = "inbox_missing";
        return res.status(404).json({ error: "Inbox do chat nao encontrada" });
      }

      const inboxRow = (chatRow as any)?.inbox || null;
      if (!inboxRow) {
        logStatus = "error";
        logError = "inbox_not_found";
        return res.status(404).json({ error: "Inbox nao encontrada" });
      }

      const inboxId = String(chatRow.inbox_id);
      const provider = String((inboxRow as any)?.provider || "").toUpperCase();
      const isWahaProvider = provider === WAHA_PROVIDER;
      const companyId =
        (typeof req.user?.company_id === "string" && req.user.company_id.trim()) ||
        (typeof (inboxRow as any)?.company_id === "string" && String((inboxRow as any).company_id).trim()) ||
        null;

      if (isWahaProvider && (!companyId || typeof companyId !== "string")) {
        logStatus = "error";
        logError = "company_missing_for_waha";
        return res.status(400).json({ error: "companyId ausente para inbox WAHA" });
      }

      const customerRow = (chatRow as any)?.customer || null;
      const customerPhoneCandidates = customerRow
        ? [
            customerRow.phone,
            customerRow.msisdn,
          ]
        : [];
      const customerPhone =
        customerPhoneCandidates.find((value: unknown) => typeof value === "string" && value.trim()) ||
        null;

      let wahaRecipient: string | null = null;
      if (isWahaProvider) {
        const digits = normalizeMsisdn((customerPhone as string | null) || "");
        if (digits) {
          wahaRecipient = `${digits}@c.us`;
        } else if (typeof chatRow?.external_id === "string" && chatRow.external_id.trim()) {
          wahaRecipient = chatRow.external_id.trim();
        }
      }

      const nowIso = new Date().toISOString();
      const isFromCustomer = String(senderType).toUpperCase() === "CUSTOMER";

      // Resolve external_id if replying
      let repliedMessageExternalId: string | null = null;
      if (reply_to) {
        try {
          const { data: originalMsg } = await supabaseAdmin
            .from("chat_messages")
            .select("external_id")
            .eq("id", reply_to)
            .maybeSingle();
          if (originalMsg?.external_id) {
            repliedMessageExternalId = String(originalMsg.external_id);
            console.log("[POST /livechat/messages] Resolved reply external_id:", repliedMessageExternalId);
          }
        } catch (e) {
          console.warn("[POST /livechat/messages] Failed to resolve reply external_id:", e);
        }
      }

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("chat_messages")
        .insert([
          {
            chat_id: chatId,
            content: String(text),
            type: "TEXT",
            is_from_customer: isFromCustomer,
            sender_id: senderSupabaseId,
            sender_name: senderName,
            sender_avatar_url: senderAvatarUrl,
            created_at: nowIso,
            view_status: "Pending",
            replied_message_id: reply_to || null, // Save UUID for frontend
            replied_message_external_id: repliedMessageExternalId, // Save external_id for WAHA
          },
        ])
        .select(
          "id, chat_id, content, is_from_customer, sender_id, sender_name, sender_avatar_url, created_at, view_status, type, replied_message_id, replied_message_external_id",
        )
        .single();
      
      console.log("[POST /livechat/messages] 💾 Inserted message:", {
        id: inserted?.id,
        sender_id: inserted?.sender_id,
        sender_name: (inserted as any)?.sender_name,
        sender_avatar_url: (inserted as any)?.sender_avatar_url,
        replied_message_id: (inserted as any)?.replied_message_id,
        replied_message_external_id: (inserted as any)?.replied_message_external_id,
        reply_to_received: reply_to,
        insertError: insErr,
      });
      
      if (insErr) {
        logStatus = "error";
        logError = insErr.message || "insert_error";
        return res.status(500).json({ error: insErr.message });
      }
      insertedId = inserted?.id ?? null;

      const io = getIO();

      // ✅ AUTO-ASSIGN: Se agente enviar mensagem em chat sem assignee, atribui automaticamente
      if (!isFromCustomer && senderSupabaseId) {
        try {
          const { data: chatData } = await supabaseAdmin
            .from("chats")
            .select("assignee_id")
            .eq("id", chatId)
            .maybeSingle();
          
          if (chatData && !chatData.assignee_id) {
            // Chat sem assignee, atribuir ao agente que está enviando
            const { error: assignError } = await supabaseAdmin
              .from("chats")
              .update({ 
                assignee_id: senderSupabaseId,
                updated_at: nowIso
              })
              .eq("id", chatId);
            
            if (!assignError) {
              console.log("[POST /livechat/messages] ✅ Auto-assigned chat to agent:", {
                chatId,
                agentId: senderSupabaseId,
                agentName: senderName,
              });
              
              // Emitir evento de atribuição via socket
              if (io) {
                io.to(`chat:${chatId}`).emit("chat:assigned", {
                  chatId,
                  assignee_id: senderSupabaseId,
                  assignee_name: senderName,
                  assignee_avatar_url: senderAvatarUrl,
                });
              }
            } else {
              console.warn("[POST /livechat/messages] ⚠️ Failed to auto-assign:", assignError);
            }
          }
        } catch (autoAssignError) {
          console.warn("[POST /livechat/messages] ⚠️ Auto-assign error:", autoAssignError);
        }
      }

      await supabaseAdmin
        .from("chats")
        .update({ 
          last_message: String(text), 
          last_message_at: nowIso,
          last_message_from: isFromCustomer ? "CUSTOMER" : "AGENT"
        })
        .eq("id", chatId);

      const runCacheInvalidation = () => {
        setTimeout(() => {
          Promise.all([
            rDel(k.chat(chatId)),
            clearMessageCache(chatId, (key) => key.includes(":nil:")),
            warmChatMessagesCache(chatId).catch((err) => {
              console.warn("[livechat:send] warm cache failure", err instanceof Error ? err.message : err);
            }),
          ]).catch((err) => {
            console.warn("[livechat:send] cache invalidate failure", err instanceof Error ? err.message : err);
          });
        }, 0);
      };

      if (io) {
        const mapped = {
          id: inserted.id,
          chat_id: inserted.chat_id,
          body: inserted.content,
          sender_type: inserted.is_from_customer ? "CUSTOMER" : (inserted.type === "SYSTEM" ? "SYSTEM" : (inserted.sender_id ? "AGENT" : "AI")),
          sender_id: inserted.sender_id || null,
          sender_name: (inserted as any).sender_name || senderName || null,
          sender_avatar_url: (inserted as any).sender_avatar_url || senderAvatarUrl || null,
          created_at: inserted.created_at,
          view_status: inserted.view_status || "Pending",
          type: inserted.type || "TEXT",
          is_private: false,
          replied_message_id: (inserted as any)?.replied_message_id || null,
        };
        
        console.log("[POST /livechat/messages] 📡 Socket emit message:new:", {
          messageId: mapped.id,
          sender_id: mapped.sender_id,
          sender_name: mapped.sender_name,
          sender_avatar_url: mapped.sender_avatar_url,
        });
        
        io.to(`chat:${chatId}`).emit("message:new", mapped);

        // 🔔 Enviar notificação se mensagem for do CUSTOMER
        if (isFromCustomer && companyId) {
          try {
            // Buscar agentes atribuídos ao chat para notificar
            const { data: chatData } = await supabaseAdmin
              .from("chats")
              .select("assignee_agent")
              .eq("id", chatId)
              .maybeSingle();

            if (chatData?.assignee_agent) {
              // Buscar user_id do agente através do inbox_users
              const { data: linkData } = await supabaseAdmin
                .from("inbox_users")
                .select("user_id")
                .eq("id", chatData.assignee_agent)
                .maybeSingle();

              if (linkData?.user_id) {
                // 👀 Verificar se o agente está visualizando o chat
                const chatViewers = (req.app.locals.io as any)?._chatViewers;
                const isViewingChat = chatViewers?.get(chatId)?.has(linkData.user_id);
                
                if (isViewingChat) {
                  console.log("[POST /livechat/messages] 👁️ Agente já está visualizando o chat, notificação suprimida:", linkData.user_id);
                } else {
                  await NotificationService.create({
                    title: `💬 ${senderName || "Cliente"}`,
                    message: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
                    type: "CHAT_MESSAGE",
                    userId: linkData.user_id,
                    companyId: companyId as string,
                    data: { chatId, messageId: inserted.id },
                    actionUrl: `/dashboard/livechat?chat=${chatId}`,
                  });
                  console.log("[POST /livechat/messages] 🔔 Notificação enviada para agente:", linkData.user_id);
                }
              }
            }
          } catch (notifError) {
            console.warn("[POST /livechat/messages] ⚠️ Erro ao enviar notificação:", notifError);
          }
        }
      }

      if (isWahaProvider) {
        const safeCompanyId = companyId as string;

        const payload: Record<string, any> = {
          type: "text",
          content: String(text),
          draftId: inserted.id,
        };
        if (wahaRecipient) payload.to = wahaRecipient;
        if (repliedMessageExternalId) {
          payload.quotedMessageId = repliedMessageExternalId;
          console.log("[POST /livechat/messages] Sending WAHA with quotedMessageId:", repliedMessageExternalId);
        }
        
        await publish(EX_APP, "outbound.request", {
          jobType: "outbound.request",
          provider: WAHA_PROVIDER,
          companyId: safeCompanyId,
          inboxId,
          chatId,
          customerId: chatRow.customer_id,
          messageId: inserted.id,
          payload,
          attempt: 0,
          createdAt: nowIso,
          senderUserSupabaseId: senderSupabaseId,
        });
      } else {
        await publish(EX_APP, "outbound.request", {
          jobType: "message.send",
          kind: "send-text",
          provider: "META",
          chatId,
          inboxId: chatRow.inbox_id,
          customerId: chatRow.customer_id,
          messageId: inserted.id,
          content: String(text),
          attempt: 0,
          createdAt: nowIso,
          senderUserSupabaseId: senderSupabaseId,
        });
      }

      runCacheInvalidation();
      return res.status(201).json({ ok: true, data: inserted });
    } catch (e: any) {
      logger.error("[livechat:send] error (service route)", { error: e.message, stack: e.stack });
      logStatus = "error";
      logError = e?.message || "send error";
      next(e);
    } finally {
      logMetrics();
    }
  });

  // Edit a message (WAHA)
  app.put("/livechat/chats/:chatId/messages/:messageId", requireAuth, async (req: any, res) => {
    const { chatId, messageId } = req.params as { chatId: string; messageId: string };
    const { text, linkPreview = true, linkPreviewHighQuality = false } = req.body || {};
    if (!chatId || !messageId || !text) return res.status(400).json({ error: "chatId, messageId e text obrigatorios" });
    try {
      const msgResp = await supabaseAdmin
        .from("chat_messages")
        .select("id, chat_id, external_id, is_from_customer")
        .eq("id", messageId)
        .maybeSingle();
      if (msgResp.error || !msgResp.data) return res.status(404).json({ error: "Mensagem nao encontrada" });
      const msg = msgResp.data as any;
      if (msg.chat_id !== chatId) return res.status(400).json({ error: "Mensagem nao pertence ao chat" });
      if (msg.is_from_customer) return res.status(403).json({ error: "Nao permitido editar mensagem do cliente" });
      if (!msg.external_id) return res.status(400).json({ error: "Mensagem sem external_id para WAHA" });

      const chatResp = await supabaseAdmin
        .from("chats")
        .select("id, external_id, inbox:inboxes(id, provider, instance_id), customer:customers(phone, msisdn)")
        .eq("id", chatId)
        .maybeSingle();
      if (chatResp.error || !chatResp.data) return res.status(404).json({ error: "Chat nao encontrado" });
      const chatRow = chatResp.data as any;
      const provider = String(chatRow?.inbox?.provider || "").toUpperCase();
      if (provider !== WAHA_PROVIDER) return res.status(400).json({ error: "Apenas chats WAHA suportados" });
      const session = String(chatRow?.inbox?.instance_id || "").trim();
      if (!session) return res.status(400).json({ error: "Sessao WAHA ausente" });

      // Resolve remote chat id
      let remoteId: string | null = null;
      remoteId = typeof chatRow?.external_id === "string" && chatRow.external_id.trim() ? chatRow.external_id.trim() : null;
      if (!remoteId) {
        const phone = (chatRow?.customer?.phone || chatRow?.customer?.msisdn || "") as string;
        const digits = (phone || "").replace(/\D+/g, "");
        remoteId = digits ? `${digits}@c.us` : null;
      }
      if (!remoteId) return res.status(400).json({ error: "remote chat id ausente" });

      const wahaMessageId: string = String(msg.external_id);
      await editWahaMessage(session, remoteId, wahaMessageId, { text, linkPreview, linkPreviewHighQuality });

      const { data: updated, error } = await supabaseAdmin
        .from("chat_messages")
        .update({ content: String(text), view_status: "Edited" })
        .eq("id", messageId)
        .select("id, chat_id, content, created_at, type, view_status")
        .single();
      if (error) return res.status(500).json({ error: error.message });

      // optionally emit socket update
      try {
        const io = getIO();
        if (io) {
          io.to(`chat:${chatId}`).emit("message:new", {
            id: updated.id,
            chat_id: updated.chat_id,
            body: updated.content,
            content: updated.content,
            view_status: updated.view_status || "Edited",
            type: updated.type || "TEXT",
          });
        }
      } catch {}

      return res.json({ ok: true, data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "edit_error" });
    }
  });

  // Delete a message (WAHA)
  app.delete("/livechat/chats/:chatId/messages/:messageId", requireAuth, async (req: any, res) => {
    const { chatId, messageId } = req.params as { chatId: string; messageId: string };
    if (!chatId || !messageId) return res.status(400).json({ error: "chatId e messageId obrigatorios" });
    try {
      const msgResp = await supabaseAdmin
        .from("chat_messages")
        .select("id, chat_id, external_id, is_from_customer")
        .eq("id", messageId)
        .maybeSingle();
      if (msgResp.error || !msgResp.data) return res.status(404).json({ error: "Mensagem nao encontrada" });
      const msg = msgResp.data as any;
      if (msg.chat_id !== chatId) return res.status(400).json({ error: "Mensagem nao pertence ao chat" });
      if (msg.is_from_customer) return res.status(403).json({ error: "Nao permitido apagar mensagem do cliente" });
      if (!msg.external_id) return res.status(400).json({ error: "Mensagem sem external_id para WAHA" });

      const chatResp = await supabaseAdmin
        .from("chats")
        .select("id, external_id, inbox:inboxes(id, provider, instance_id), customer:customers(phone, msisdn)")
        .eq("id", chatId)
        .maybeSingle();
      if (chatResp.error || !chatResp.data) return res.status(404).json({ error: "Chat nao encontrado" });
      const chatRow = chatResp.data as any;
      const provider = String(chatRow?.inbox?.provider || "").toUpperCase();
      if (provider !== WAHA_PROVIDER) return res.status(400).json({ error: "Apenas chats WAHA suportados" });
      const session = String(chatRow?.inbox?.instance_id || "").trim();
      if (!session) return res.status(400).json({ error: "Sessao WAHA ausente" });

      let remoteId: string | null = null;
      remoteId = typeof chatRow?.external_id === "string" && chatRow.external_id.trim() ? chatRow.external_id.trim() : null;
      if (!remoteId) {
        const phone = (chatRow?.customer?.phone || chatRow?.customer?.msisdn || "") as string;
        const digits = (phone || "").replace(/\D+/g, "");
        remoteId = digits ? `${digits}@c.us` : null;
      }
      if (!remoteId) return res.status(400).json({ error: "remote chat id ausente" });

      const wahaMessageId: string = String(msg.external_id);
      await deleteWahaMessage(session, remoteId, wahaMessageId);

      const { data: updated, error } = await supabaseAdmin
        .from("chat_messages")
        .update({ content: null, view_status: "Deleted" })
        .eq("id", messageId)
        .select("id, chat_id, content, created_at, type, view_status")
        .single();
      if (error) return res.status(500).json({ error: error.message });

      try {
        const io = getIO();
        if (io) {
          io.to(`chat:${chatId}`).emit("message:new", {
            id: updated.id,
            chat_id: updated.chat_id,
            body: null,
            content: null,
            view_status: updated.view_status || "Deleted",
            type: updated.type || "TEXT",
          });
        }
      } catch {}

      return res.json({ ok: true, data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "delete_error" });
    }
  });

  app.post("/livechat/chats", requireAuth, async (req, res, next) => {
    try {
      const { inboxId, customerId, externalId, initialMessage } = CreateChatSchema.parse(req.body);

      const payload: any = {
        inbox_id: inboxId,
        customer_id: customerId,
        company_id: (req as any).user?.company_id || null,
        external_id: externalId || null,
        status: "OPEN",
      };

    const { data: chat, error: errUpsert } = await supabaseAdmin
      .from("chats")
      .upsert(payload, { onConflict: "inbox_id,customer_id" })
      .select("*")
      .single();

    if (errUpsert) return res.status(500).json({ error: errUpsert.message });

    setTimeout(() => {
      Promise.all([
        rDel(k.chat(chat.id)),
        clearMessageCache(chat.id, (key) => key.includes(":nil:")),
        warmChatMessagesCache(chat.id).catch((err) => {
          console.warn("[livechat:create-chat] warm cache failure", err instanceof Error ? err.message : err);
        }),
      ]).catch((err) => {
        console.warn("[livechat:create-chat] cache invalidate failure", err instanceof Error ? err.message : err);
      });
    }, 0);

    if (initialMessage) {
      const nowIso = new Date().toISOString();
      const { error: errMsg } = await supabaseAdmin
        .from("chat_messages")
        .insert([{
          chat_id: chat.id,
          content: String(initialMessage),
          type: "TEXT",
          is_from_customer: false,
          sender_id: req.user?.id || null,
          created_at: nowIso,
          view_status: "Pending",
        }]);
      if (errMsg) return res.status(500).json({ error: errMsg.message });

      await supabaseAdmin
        .from("chats")
        .update({ 
          last_message: String(initialMessage), 
          last_message_at: nowIso,
          last_message_from: "AGENT"
        })
        .eq("id", chat.id);

      setTimeout(() => {
        Promise.all([
          rDel(k.chat(chat.id)),
          clearMessageCache(chat.id, (key) => key.includes(":nil:")),
          warmChatMessagesCache(chat.id).catch((err) => {
            console.warn("[livechat:create-chat] warm cache failure (initial message)", err instanceof Error ? err.message : err);
          }),
        ]).catch((err) => {
          console.warn("[livechat:create-chat] cache invalidate failure (initial message)", err instanceof Error ? err.message : err);
        });
      }, 0);

      await publish(EX_APP, "outbound.request", {
        jobType: "message.send",
        kind: "send-text",
        provider: "META",
        chatId: chat.id,
        inboxId,
        customerId,
        messageId: null,
        content: String(initialMessage),
        attempt: 0,
        createdAt: nowIso,
      });
    }

    return res.status(201).json(chat);
    } catch (error) {
      next(error);
    }
  });

  // Detalhar chat (com cache)
  app.get("/livechat/chats/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };

    // 🔒 SEGURANÇA: Validar company_id do usuário
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ error: "Empresa não identificada" });
    }

    const cacheKey = k.chat(id);
    const cached = await rGet<any>(cacheKey);
    // Validar company_id mesmo no cache
    if (cached && cached.company_id === companyId) {
      return res.json(cached);
    }

    // Validar company_id via inbox_id
    const { data, error } = await supabaseAdmin
      .from("chats")
      .select("*, ai_agent:agents!chats_ai_agent_id_fkey(id, name), inbox_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Chat não encontrado" });
    
    const flattened = flattenChatRow(data);

    // Validar que a inbox pertence à empresa
    if (flattened.inbox_id) {
      const { data: inboxData } = await supabaseAdmin
        .from("inboxes")
        .select("company_id")
        .eq("id", flattened.inbox_id)
        .eq("company_id", companyId)
        .maybeSingle();
      
      if (!inboxData) {
        return res.status(404).json({ error: "Chat não encontrado ou acesso negado" });
      }
    }

    // Fallback to active company agent if missing
    try {
      const companyId = flattened.company_id ?? null;
      if (companyId && !flattened.ai_agent_id) {
        const activeAgent = await getRuntimeAgent(companyId, null);
        flattened.ai_agent_id = activeAgent?.id ?? null;
        flattened.ai_agent_name = activeAgent?.name ?? null;
      }
    } catch (err) {
      console.warn("[livechat/chat] enrich ai agent failed", err instanceof Error ? err.message : err);
    }

    await rSet(cacheKey, flattened, TTL_CHAT);
    return res.json(flattened);
  });

  // Atualizar status (invalida chat + listas)
  app.put("/livechat/chats/:id/status", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: "status obrigatorio" });

    // 🔒 SEGURANÇA: Validar company_id do usuário
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ error: "Empresa não identificada" });
    }

    // Primeiro validar se o chat pertence à empresa via inbox_id
    const { data: chatCheck } = await supabaseAdmin
      .from("chats")
      .select("id, inbox_id")
      .eq("id", id)
      .maybeSingle();
    
    if (!chatCheck) {
      return res.status(404).json({ error: "Chat não encontrado" });
    }
    
    // Validar que a inbox pertence à empresa
    if ((chatCheck as any).inbox_id) {
      const { data: inboxData } = await supabaseAdmin
        .from("inboxes")
        .select("company_id")
        .eq("id", (chatCheck as any).inbox_id)
        .eq("company_id", companyId)
        .maybeSingle();
      
      if (!inboxData) {
        return res.status(404).json({ error: "Chat não encontrado ou acesso negado" });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("chats")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // System message for status change
    try {
      const authUserId = (req as any).user.id as string;
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("user_id", authUserId)
        .maybeSingle();
      const actorName = u?.name || "Alguém";
      
      const statusLabel = status === "OPEN" ? "Aberto" :
                          status === "RESOLVED" ? "Resolvido" :
                          status === "PENDING" ? "Pendente" :
                          status === "CLOSED" ? "Fechado" :
                          status === "ASSIGNED" ? "Atribuído" :
                          status === "AI" ? "IA" : status;

      const content = `${actorName} alterou o status para "${statusLabel}"`;
      
      const { data: insertedMsg, error: insertError } = await supabaseAdmin.from("chat_messages").insert({
        chat_id: id,
        content,
        type: "SYSTEM",
        is_from_customer: false,
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertError) {
        console.error("[PUT /status] Failed to insert system message:", insertError);
      } else if (insertedMsg) {
        const io = getIO();
        io?.to(`chat:${id}`).emit("message:new", {
            id: insertedMsg.id,
            chat_id: id,
            content,
            type: "SYSTEM",
            sender_type: "SYSTEM",
            created_at: insertedMsg.created_at,
        });
      }
    } catch (e) {
      console.error("Failed to insert system message for status change", e);
    }

    await rDel(k.chat(id));
    // companyId já foi validado acima
    if (companyId) {
      const inboxCandidate = (data as any)?.inbox_id ?? null;
      const remoteId = (data as any)?.remote_id ?? null;
      const chatType = (data as any)?.chat_type ?? null;
      let baseKind =
        typeof (data as any)?.kind === "string" && (data as any).kind
          ? String((data as any).kind).trim().toUpperCase()
          : null;
      const chatTypeUpper = typeof chatType === "string" ? chatType.trim().toUpperCase() : null;
      if (!baseKind && chatTypeUpper) {
        baseKind = chatTypeUpper === "GROUP" ? "GROUP" : "DIRECT";
      }
      if (
        !baseKind &&
        typeof remoteId === "string" &&
        remoteId.trim().toLowerCase().includes("@g.us")
      ) {
        baseKind = "GROUP";
      }

      const statuses = new Set<string>(["ALL"]);
      const statusUpper = typeof status === "string" ? status.trim().toUpperCase() : "";
      if (statusUpper) statuses.add(statusUpper);

      const kinds = new Set<string>(["ALL"]);
      if (baseKind) kinds.add(baseKind);

      const inboxes = new Set<string | null>([inboxCandidate ?? null, null]);
      const departments = new Set<string | null>([
        (data as any)?.department_id ?? null,
        null,
      ]);
      const indexKeys: string[] = [];
      for (const inbox of inboxes) {
        for (const statusKey of statuses) {
          for (const kindKey of kinds) {
            for (const deptId of departments) {
              indexKeys.push(k.listIndex(companyId, inbox, statusKey, kindKey, deptId));
            }
          }
        }
      }
      await clearListCacheIndexes(indexKeys);
    }

    return res.json(data);
  });

  // Atualizar departamento do chat
  app.put("/livechat/chats/:id/department", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    let { department_id: departmentId } = (req.body || {}) as { department_id?: string | null };

    // 🔒 SEGURANÇA: Validar company_id do usuário
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ error: "Empresa não identificada" });
    }

    console.info("[livechat] PUT /livechat/chats/:id/department", {
      chatId: id,
      requestedDepartmentId: departmentId ?? null,
      userId: req.user?.id ?? null,
      companyId,
    });

    if (departmentId === "") departmentId = null;
    if (departmentId !== null && departmentId !== undefined && typeof departmentId !== "string") {
      return res.status(400).json({ error: "department_id deve ser string ou null" });
    }
    if (departmentId && !UUID_RE.test(departmentId)) {
      return res.status(400).json({ error: "Departamento inválido" });
    }

    const { data: chatRowRaw, error: chatError } = await supabaseAdmin
      .from("chats")
      .select(buildChatSelectFields())
      .eq("id", id)
      .maybeSingle();

    const chatRow = chatRowRaw ? flattenChatRow(chatRowRaw) : null;

    if (chatError) {
      console.error("[livechat] department update failed loading chat", {
        chatId: id,
        error: chatError.message,
      });
      return res.status(500).json({ error: chatError.message });
    }
    if (!chatRow) {
      console.warn("[livechat] department update chat not found", { chatId: id });
      return res.status(404).json({ error: "Chat não encontrado" });
    }
    
    // Validar que a inbox pertence à empresa
    const chatInboxId = (chatRow as any).inbox_id;
    if (chatInboxId) {
      const { data: inboxData } = await supabaseAdmin
        .from("inboxes")
        .select("company_id")
        .eq("id", chatInboxId)
        .eq("company_id", companyId)
        .maybeSingle();
      
      if (!inboxData) {
        return res.status(404).json({ error: "Chat não encontrado ou acesso negado" });
      }
    }

    console.debug("[livechat] department update current chat", {
      chatId: id,
      currentDepartmentId: (chatRow as any)?.department_id ?? null,
    });

    let departmentMeta: { id: string; name: string | null; color: string | null; icon: string | null } | null = null;
    if (departmentId) {
      const { data: deptRow, error: deptError } = await supabaseAdmin
        .from("departments")
        .select("id, name, color, icon, company_id")
        .eq("id", departmentId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (deptError) {
        console.error("[livechat] department update failed loading department", {
          chatId: id,
          departmentId,
          error: deptError.message,
        });
        return res.status(500).json({ error: deptError.message });
      }
      if (!deptRow) {
        console.warn("[livechat] department update department not found", {
          chatId: id,
          departmentId,
        });
        return res.status(404).json({ error: "Departamento não encontrado" });
      }
      departmentMeta = {
        id: deptRow.id,
        name: deptRow.name ?? null,
        color: deptRow.color ?? null,
        icon: deptRow.icon ?? null,
      };
    }

    const previousDepartmentId = (chatRow as any)?.department_id ?? null;

    const { data: updatedRaw, error: updateError } = await supabaseAdmin
      .from("chats")
      .update({ department_id: departmentId ?? null })
      .eq("id", id)
      .select(buildChatSelectFields())
      .single();

    const updatedRow = updatedRaw ? flattenChatRow(updatedRaw) : null;

    if (updateError) {
      console.error("[livechat] department update failed writing chat", {
        chatId: id,
        departmentId: departmentId ?? null,
        error: updateError.message,
      });
      return res.status(500).json({ error: updateError.message });
    }
    if (!updatedRow) {
      console.error("[livechat] department update missing updated row", {
        chatId: id,
        departmentId: departmentId ?? null,
      });
      return res.status(500).json({ error: "Falha ao atualizar departamento do chat" });
    }

    const departmentPayloadName = departmentMeta?.name ?? updatedRow.department_name ?? null;
    const departmentPayloadColor = departmentMeta?.color ?? updatedRow.department_color ?? null;
    const departmentPayloadIcon = departmentMeta?.icon ?? updatedRow.department_icon ?? null;

    console.info("[livechat] department update success", {
      chatId: id,
      previousDepartmentId,
      nextDepartmentId: updatedRow?.department_id ?? null,
    });

    // System message for department change
    try {
      const authUserId = req.user?.id;
      let actingLocalUserId: string | null = null;
      let actorName = "Alguém";

      // Resolve user ID and Name
      if (authUserId) {
        const { data: uExt } = await supabaseAdmin.from("users").select("id, name").eq("user_id", authUserId).maybeSingle();
        if (uExt) {
          actingLocalUserId = uExt.id;
          if (uExt.name) actorName = uExt.name;
        } else {
          const { data: uLoc } = await supabaseAdmin.from("users").select("id, name").eq("id", authUserId).maybeSingle();
          if (uLoc) {
            actingLocalUserId = uLoc.id;
            if (uLoc.name) actorName = uLoc.name;
          }
        }
      }
      
      const deptName = departmentPayloadName || "Sem departamento";
      const content = `${actorName} alterou o departamento para "${deptName}"`;
      
      const { data: insertedMsg, error: insertError } = await supabaseAdmin.from("chat_messages").insert({
        chat_id: id,
        content,
        type: "SYSTEM",
        is_from_customer: false,
        sender_id: actingLocalUserId, // Include sender_id
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertError) {
        console.error("[PUT /department] Failed to insert system message:", insertError);
      } else if (insertedMsg) {
        const io = getIO();
        io?.to(`chat:${id}`).emit("message:new", {
            id: insertedMsg.id,
            chat_id: id,
            content,
            type: "SYSTEM",
            sender_type: "SYSTEM",
            created_at: insertedMsg.created_at,
        });
      }
    } catch (e) {
      console.error("Failed to insert system message for department change", e);
    }

    await rDel(k.chat(id));

    const statuses = new Set<string>(["ALL"]);
    const statusUpper = typeof updatedRow?.status === "string" ? updatedRow.status.trim().toUpperCase() : "";
    if (statusUpper) statuses.add(statusUpper);

    let baseKind =
      typeof updatedRow?.kind === "string" && updatedRow.kind
        ? String(updatedRow.kind).trim().toUpperCase()
        : null;
    const chatType = typeof updatedRow?.chat_type === "string" ? updatedRow.chat_type.trim().toUpperCase() : null;
    if (!baseKind && chatType) {
      baseKind = chatType === "GROUP" ? "GROUP" : "DIRECT";
    }
    const kinds = new Set<string>(["ALL"]);
    if (baseKind) kinds.add(baseKind);

    const inboxes = new Set<string | null>([(updatedRow as any)?.inbox_id ?? null, null]);
    const departments = new Set<string | null>([
      previousDepartmentId ?? null,
      updatedRow?.department_id ?? null,
      null,
    ]);

    const indexKeys: string[] = [];
    for (const inbox of inboxes) {
      for (const statusKey of statuses) {
        for (const kindKey of kinds) {
          for (const dept of departments) {
            indexKeys.push(k.listIndex(companyId, inbox, statusKey, kindKey, dept));
          }
        }
      }
    }
    await clearListCacheIndexes(indexKeys);

    const io = getIO();
    if (io) {
      io.to(`chat:${id}`).emit("chat:department-changed", {
        kind: "livechat.chat.department-changed",
        chatId: id,
        department_id: updatedRow?.department_id ?? null,
        department_name: departmentPayloadName,
        department_color: departmentPayloadColor,
        department_icon: departmentPayloadIcon,
      });
      
      const chatCompanyId = (updatedRow as any)?.company_id;
      if (chatCompanyId) {
        io.to(`company:${chatCompanyId}`).emit("chat:updated", {
          chatId: id,
          department_id: updatedRow?.department_id ?? null,
          department_name: departmentPayloadName,
          department_color: departmentPayloadColor,
          department_icon: departmentPayloadIcon,
        });
      } else {
        io.emit("chat:updated", {
          chatId: id,
          department_id: updatedRow?.department_id ?? null,
          department_name: departmentPayloadName,
          department_color: departmentPayloadColor,
          department_icon: departmentPayloadIcon,
        });
      }
    }

    return res.json({
      ...updatedRow,
      department_name: departmentPayloadName,
      department_color: departmentPayloadColor,
      department_icon: departmentPayloadIcon,
    });
  });

  // Atualizar agente de IA do chat
  app.put("/livechat/chats/:id/ai-agent", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const { agentId } = req.body || {};
    
    console.log("[PUT /ai-agent] Iniciando atualização", { chatId: id, agentId });
    
    // Permitir null para remover agente
    if (agentId !== null && typeof agentId !== "string") {
      return res.status(400).json({ error: "agentId deve ser string ou null" });
    }

    // Pegar company_id do usuário autenticado
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ error: "Empresa não identificada" });
    }
    
    console.log("[PUT /ai-agent] Company ID do usuário:", companyId);

    // Verificar se chat existe e pertence à empresa do usuário (via inbox E company_id direto)
    const { data: chatData, error: chatError } = await supabaseAdmin
      .from("chats")
      .select("id, inbox:inboxes!inner(id, company_id)")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("inbox.company_id", companyId)
      .maybeSingle();

    console.log("[PUT /ai-agent] Resultado da query:", { chatData, chatError });

    if (chatError) {
      console.error("[PUT /ai-agent] Erro ao buscar chat:", { id, error: chatError });
      return res.status(500).json({ error: "Erro ao buscar chat" });
    }

    if (!chatData) {
      console.error("[PUT /ai-agent] Chat não encontrado ou não pertence à empresa:", { id, companyId });
      return res.status(404).json({ error: "Chat não encontrado ou não pertence à sua empresa" });
    }

    console.log("[PUT /ai-agent] Chat validado com sucesso");

    // Se agentId fornecido, validar se existe e pertence à empresa
    if (agentId) {
      const { data: agent, error: agentError } = await supabaseAdmin
        .from("agents")
        .select("id, name, status")
        .eq("id", agentId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (agentError) return res.status(500).json({ error: agentError.message });
      if (!agent) return res.status(404).json({ error: "Agente não encontrado" });
      if (agent.status !== "ACTIVE") {
        return res.status(400).json({ error: "Agente não está ativo" });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("chats")
      .update({ ai_agent_id: agentId })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[PUT /ai-agent] Erro no update:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log("[PUT /ai-agent] Chat atualizado no banco:", { chatId: id, ai_agent_id: data.ai_agent_id });

    // Invalidar cache do chat individual
    try {
      await rDel(k.chat(id));
      console.log("[PUT /ai-agent] Cache individual invalidado:", k.chat(id));
    } catch (delErr) {
      console.error("[PUT /ai-agent] Erro ao deletar cache individual:", delErr);
    }
    
    // Invalidar todos os caches de listagem dessa empresa
    console.log("[PUT /ai-agent] Verificando company_id:", companyId);
    if (companyId) {
      console.log("[PUT /ai-agent] Entrando no bloco de invalidação de cache");
      try {
        const pattern = k.listPrefixCompany(companyId);
        console.log("[PUT /ai-agent] Pattern gerado:", pattern);
        const keys = await redis.keys(pattern);
        console.log("[PUT /ai-agent] Padrão de listagem:", pattern, "| Keys encontradas:", keys.length);
        if (keys && keys.length > 0) {
          await redis.del(...keys);
          console.log("[PUT /ai-agent] Deletadas", keys.length, "keys de listagem");
        }
        // Também invalidar os índices de set
        const setPattern = `lc:list:set:${companyId}:*`;
        const setKeys = await redis.keys(setPattern);
        console.log("[PUT /ai-agent] Padrão de set:", setPattern, "| Keys encontradas:", setKeys.length);
        if (setKeys && setKeys.length > 0) {
          await redis.del(...setKeys);
          console.log("[PUT /ai-agent] Deletadas", setKeys.length, "keys de set");
        }
      } catch (cacheErr) {
        console.warn("[PUT /ai-agent] Failed to clear list cache:", cacheErr);
      }
    }

    // Buscar nome do agente para resposta
    let agentName = null;
    if (agentId) {
      const { data: agentData } = await supabaseAdmin
        .from("agents")
        .select("name")
        .eq("id", agentId)
        .maybeSingle();
      agentName = agentData?.name ?? null;
    }

    // System message for AI Agent assignment
    try {
      const authUserId = req.user?.id;
      let actingLocalUserId: string | null = null;
      let actorName = "Alguém";

      // Resolve user ID and Name
      if (authUserId) {
        const { data: uExt } = await supabaseAdmin.from("users").select("id, name").eq("user_id", authUserId).maybeSingle();
        if (uExt) {
          actingLocalUserId = uExt.id;
          if (uExt.name) actorName = uExt.name;
        } else {
          const { data: uLoc } = await supabaseAdmin.from("users").select("id, name").eq("id", authUserId).maybeSingle();
          if (uLoc) {
            actingLocalUserId = uLoc.id;
            if (uLoc.name) actorName = uLoc.name;
          }
        }
      }
      
      let content = "";
      if (agentId) {
        content = `${actorName} atribuiu o agente de IA "${agentName || 'Desconhecido'}"`;
      } else {
        content = `${actorName} removeu o agente de IA`;
      }
      
      const { data: insertedMsg, error: insertError } = await supabaseAdmin.from("chat_messages").insert({
        chat_id: id,
        content,
        type: "SYSTEM",
        is_from_customer: false,
        sender_id: actingLocalUserId, // Include sender_id
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertError) {
        console.error("[PUT /ai-agent] Failed to insert system message:", insertError);
      } else if (insertedMsg) {
        const io = getIO();
        io?.to(`chat:${id}`).emit("message:new", {
            id: insertedMsg.id,
            chat_id: id,
            content,
            type: "SYSTEM",
            sender_type: "SYSTEM",
            created_at: insertedMsg.created_at,
        });
      }
    } catch (e) {
      console.error("Failed to insert system message for AI agent change", e);
    }

    // Emitir evento socket para atualizar UI
    try {
      const io = getIO();
      if (io) {
        io.to(`chat:${id}`).emit("chat:agent-changed", {
          kind: "livechat.chat.agent-changed",
          chatId: id,
          ai_agent_id: agentId,
          ai_agent_name: agentName,
        });
      }
    } catch (socketErr) {
      console.warn("[livechat/chats] failed to emit agent-changed event:", socketErr);
    }

    console.log("[PUT /ai-agent] Retornando resposta:", { 
      chatId: id, 
      ai_agent_id: agentId, 
      ai_agent_name: agentName 
    });

    return res.json({ 
      ...data, 
      ai_agent_id: agentId,
      ai_agent_name: agentName 
    });
  });

  // Listar mensagens (publicas + privadas) com cache
  app.get("/livechat/chats/:id/messages", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    
    // 🔒 SEGURANÇA: Validar company_id do usuário
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ error: "Empresa não identificada" });
    }
    
    // ✅ CORREÇÃO: Desabilitar cache do navegador para mensagens
    // O cache do Redis é suficiente e mais controlável
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(100, Math.trunc(limitParam)))
      : 20;
    const beforeRaw = (req.query.before as string) || undefined;
    const before = beforeRaw && beforeRaw.trim() ? beforeRaw : undefined;

    const reqLabel = `livechat.messages#${id}#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    console.time(reqLabel);
    const handlerStart = performance.now();
    const queryLog: QueryTraceEntry[] = [];
    let timerClosed = false;
    const endTimer = (meta?: Record<string, unknown>) => {
      if (!timerClosed) {
        console.timeEnd(reqLabel);
        timerClosed = true;
      }
      if (meta) {
        const totalMs = performance.now() - handlerStart;
        console.log("[livechat/messages]", { chatId: id, durationMs: Number(totalMs.toFixed(2)), ...meta });
      }
    };

    try {
      // 🔒 SEGURANÇA: Validar que o chat pertence à empresa do usuário via inbox_id
      const { data: chatOwnership, error: ownershipError } = await supabaseAdmin
        .from("chats")
        .select("id, inbox_id")
        .eq("id", id)
        .maybeSingle();
      
      if (ownershipError) {
        endTimer({ error: ownershipError.message, queries: queryLog });
        return res.status(500).json({ error: ownershipError.message });
      }
      
      if (!chatOwnership) {
        endTimer({ error: "chat_not_found", queries: queryLog });
        return res.status(404).json({ error: "Chat não encontrado" });
      }
      
      // Validar que a inbox pertence à empresa
      const chatInboxId = (chatOwnership as any).inbox_id;
      if (chatInboxId) {
        const { data: inboxData } = await supabaseAdmin
          .from("inboxes")
          .select("company_id")
          .eq("id", chatInboxId)
          .eq("company_id", companyId)
          .maybeSingle();
        
        if (!inboxData) {
          endTimer({ error: "chat_not_found_or_unauthorized", queries: queryLog });
          return res.status(404).json({ error: "Chat não encontrado ou acesso negado" });
        }
      }
      const cacheKey = k.msgsKey(id, before, limit);
      const privMetaKey = k.privateChat(id);
      const [cachedRaw, cachedPrivMeta] = await Promise.all([
        rGet<
          CacheEnvelope<{ items: any[]; nextBefore: string; hasMore: boolean }> |
          { items: any[]; nextBefore?: string; hasMore?: boolean } |
          any[]
        >(cacheKey),
        rGet<{ privateChatId: string | null }>(privMetaKey),
      ]);
      
      if (cachedRaw) {
        const cachedEnvelope = ensureEnvelope(cachedRaw);
        const cachedData = Array.isArray(cachedEnvelope.data)
          ? {
              items: cachedEnvelope.data,
              nextBefore:
                cachedEnvelope.data.length > 0
                  ? cachedEnvelope.data[0]?.created_at ?? ""
                  : "",
              hasMore: cachedEnvelope.data.length > 0,
            }
          : cachedEnvelope.data || { items: [], nextBefore: "", hasMore: false };
        const responseItems = Array.isArray(cachedData)
          ? cachedData
          : cachedData.items ?? [];
        const nextBeforeCached = Array.isArray(cachedData)
          ? (responseItems.length > 0 ? responseItems[0]?.created_at ?? "" : "")
          : cachedData.nextBefore ?? "";
        const hasMoreCached = Array.isArray(cachedData)
          ? responseItems.length > 0
          : Boolean(cachedData.hasMore);
        applyConditionalHeaders(res, cachedEnvelope);
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Next-Before", hasMoreCached ? nextBeforeCached : "");
        if (isFreshRequest(req, cachedEnvelope)) {
          res.status(304).end();
          endTimer({ cache: "HIT-304", key: cacheKey, queries: queryLog });
          return;
        }
        
        // ✅ Apply media URL transformation even for cached messages
        const transformedCached = await transformMessagesMediaUrls(responseItems);
        
        res.json(transformedCached);
        endTimer({
          cache: "HIT",
          key: cacheKey,
          count: responseItems.length,
          queries: queryLog,
        });
        return;
      }

      res.setHeader("X-Cache", "MISS");

      const pubResp = await traceSupabase(
        "chat_messages.page",
        "chat_messages",
        queryLog,
        async () => {
          let query = supabaseAdmin
            .from("chat_messages")
            .select(
              "id, chat_id, content, is_from_customer, sender_id, sender_name, sender_avatar_url, created_at, type, view_status, media_url, media_storage_path, media_public_url, caption, is_media_sensitive, remote_participant_id, remote_sender_id, remote_sender_name, remote_sender_phone, remote_sender_avatar_url, remote_sender_is_admin, replied_message_id, replied_message_external_id, interactive_content",
            )
            .eq("chat_id", id)
            .order("created_at", { ascending: false })
            .limit(limit);
          if (before) query = query.lt("created_at", before);
          return await query;
        },
      );

      let privateChatId: string | null = cachedPrivMeta?.privateChatId ?? null;
      let privChatError: any = null;

      if (!cachedPrivMeta) {
        const privResp = await traceSupabase(
          "private_chats.single",
          "private_chats",
          queryLog,
          async () =>
            await supabaseAdmin
              .from("private_chats")
              .select("id")
              .eq("chat_id", id)
              .maybeSingle(),
        );
        if (privResp.error) {
          privChatError = privResp.error;
        } else {
          privateChatId = privResp.data?.id ?? null;
          await rSet(privMetaKey, { privateChatId }, PRIVATE_CHAT_CACHE_TTL);
        }
      } else {
        queryLog.push({
          label: "private_chats.cache",
          table: "private_chats",
          durationMs: 0,
          rows: privateChatId ? 1 : 0,
          count: null,
        });
      }

      if (pubResp.error) {
        endTimer({ error: pubResp.error.message ?? "messages query error", queries: queryLog });
        return res.status(500).json({ error: pubResp.error.message ?? "messages query error" });
      }

      const pubRowsDesc = (pubResp.data || []) as any[];
      
      console.log(`[livechat/messages] Found ${pubRowsDesc.length} messages for chat ${id}`);
      
      const mappedPubAsc = [...pubRowsDesc]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((row: any) => ({
          id: row.id,
          chat_id: row.chat_id,
          body: row.content,
          sender_type: row.is_from_customer ? "CUSTOMER" : (row.type === "SYSTEM" ? "SYSTEM" : (row.sender_id ? "AGENT" : "AI")),
          sender_id: row.sender_id || null,
          sender_name: row.sender_name || null,
          sender_avatar_url: row.sender_avatar_url || null,
          created_at: row.created_at,
          view_status: row.view_status || null,
          type: row.type || "TEXT",
          is_private: false,
          media_url: row.media_url ?? null,
          media_storage_path: row.media_storage_path ?? null,
          media_public_url: row.media_public_url ?? null,
          caption: row.caption ?? null,
          is_media_sensitive: row.is_media_sensitive ?? false,
          remote_participant_id: row.remote_participant_id ?? null,
          remote_sender_id: row.remote_sender_id ?? null,
          remote_sender_name: row.remote_sender_name ?? null,
          remote_sender_phone: row.remote_sender_phone ?? null,
          remote_sender_avatar_url: row.remote_sender_avatar_url ?? null,
          remote_sender_is_admin: row.remote_sender_is_admin ?? null,
          replied_message_id: row.replied_message_id ?? null,
          interactive_content: row.interactive_content ?? null,
        }));

      let mappedPrivate: any[] = [];
      if (privChatError) {
        console.warn("[livechat/messages] private chat lookup skipped", privChatError);
      } else if (privateChatId) {
        console.log(`[livechat/messages] Found private_chat_id: ${privateChatId}, fetching messages...`);
        const privateMsgsResp = await traceSupabase(
          "private_messages.list",
          "private_messages",
          queryLog,
          async () =>
            await supabaseAdmin
              .from("private_messages")
              .select("id, content, private_chat_id, sender_id, created_at")
              .eq("private_chat_id", privateChatId)
              .order("created_at", { ascending: true }),
        );
        if (privateMsgsResp.error) {
          console.warn("[livechat/messages] private messages skipped", privateMsgsResp.error);
        } else {
          const privRows = (privateMsgsResp.data || []) as any[];
          console.log(`[livechat/messages] Found ${privRows.length} private messages`);
          const senderIds = toUuidArray(privRows.map((row) => row.sender_id));
          let senderNames: Record<string, string> = {};
          if (senderIds.length > 0) {
            const privUsersResp = await traceSupabase(
              "users.private_names",
              "users",
              queryLog,
              async () =>
                await supabaseAdmin
                  .from("users")
                  .select("id, name")
                  .in("id", senderIds),
            );
            if (!privUsersResp.error) {
              senderNames = Object.fromEntries(
                ((privUsersResp.data || []) as any[]).map((row: any) => [
                  String(row.id),
                  row?.name || row?.id || null,
                ]),
              );
            } else {
              console.warn("[livechat/messages] private sender names skipped", privUsersResp.error);
            }
          }
          mappedPrivate = privRows.map((row: any) => ({
            id: row.id,
            chat_id: id,
            body: row.content,
            sender_type: "AGENT",
            sender_id: row.sender_id || null,
            created_at: row.created_at,
            view_status: null,
            type: "PRIVATE",
            is_private: true,
            sender_name: row.sender_id ? senderNames[row.sender_id] || null : null,
            media_url: null,
            caption: null,
          }));
        }
      }

      const combined = [...mappedPubAsc, ...mappedPrivate].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const hasMore = pubRowsDesc.length === limit;
      const nextBefore = hasMore && mappedPubAsc.length > 0 ? mappedPubAsc[0].created_at : "";

      res.setHeader("X-Next-Before", hasMore ? nextBefore : "");

      // ✅ Apply media URL transformation (storage-first: public URL or proxy)
      const transformedItems = await transformMessagesMediaUrls(combined);

      const payload = {
        items: transformedItems,
        nextBefore,
        hasMore,
      };
      const lastModifiedIso =
        combined.length > 0
          ? combined[combined.length - 1].created_at
          : new Date().toISOString();
      const envelope = buildCacheEnvelope(payload, lastModifiedIso);
      await rSet(cacheKey, envelope, TTL_MSGS);
      await rememberMessageCacheKey(id, cacheKey, TTL_MSGS);
      applyConditionalHeaders(res, envelope);
      res.json(payload.items);
      endTimer({
        cache: "MISS",
        key: cacheKey,
        count: payload.items.length,
        queries: queryLog,
      });
      return;
    } catch (err: any) {
      const parsedError = normalizeSupabaseError(err, "messages error");
      endTimer({ error: parsedError.error, queries: queryLog });
      return res.status(500).json(parsedError);
    } finally {
      endTimer();
    }
  });
  app.post("/livechat/chats/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const { id: chatId } = req.params as { id: string };
      const { text, senderType = "AGENT", draftId } = req.body || {};
      if (!text) return res.status(400).json({ error: "text obrigatorio" });

      // 🔒 SEGURANÇA: Validar company_id do usuário
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(401).json({ error: "Empresa não identificada" });
      }

      const clientDraftId =
        typeof draftId === "string" && draftId.trim().length > 0 ? draftId.trim() : null;

      const { data: chat, error: chatErr } = await supabaseAdmin
        .from("chats")
        .select("id, inbox_id, status, customer_id")
        .eq("id", chatId)
        .maybeSingle();
      
      if (chatErr) return res.status(500).json({ error: chatErr.message });
      if (!chat) return res.status(404).json({ error: "Chat não encontrado" });
      
      // Validar que a inbox pertence à empresa
      const chatInboxId = (chat as any).inbox_id;
      if (chatInboxId) {
        const { data: inboxData } = await supabaseAdmin
          .from("inboxes")
          .select("company_id")
          .eq("id", chatInboxId)
          .eq("company_id", companyId)
          .maybeSingle();
        
        if (!inboxData) {
          return res.status(404).json({ error: "Chat não encontrado ou acesso negado" });
        }
      }

      const isFromCustomer = String(senderType).toUpperCase() === "CUSTOMER";
      const nowIso = new Date().toISOString();

      // Resolve sender_name and avatar from user if agent message
      let senderId: string | null = null;
      let senderName: string | null = null;
      let senderAvatarUrl: string | null = null;
      if (!isFromCustomer && req.user?.id) {
        try {
          const userRow = await supabaseAdmin
            .from("users")
            .select("id, name, email, avatar")
            .eq("user_id", req.user.id)
            .maybeSingle();
          if (userRow?.data) {
            senderId = userRow.data.id || null;
            senderName = userRow.data.name || userRow.data.email || null;
            senderAvatarUrl = (userRow.data as any).avatar || null;
          }
        } catch (err) {
          console.warn("[livechat:send] failed to resolve sender_name", err instanceof Error ? err.message : err);
        }
      }

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("chat_messages")
        .insert([{
          chat_id: chatId,
          content: String(text),
          type: "TEXT",
          is_from_customer: isFromCustomer,
          sender_id: senderId,
          sender_name: senderName,
          sender_avatar_url: senderAvatarUrl,
          created_at: nowIso,
          view_status: "Pending",
          company_id: req.user?.company_id || null,
          inbox_id: chat.inbox_id || null,
          from_user_id: req.user?.id || null,
        }])
        .select("id, chat_id, content, is_from_customer, sender_id, sender_name, sender_avatar_url, created_at, view_status, type")
        .single();
      if (insErr) return res.status(500).json({ error: insErr.message });

      await supabaseAdmin
        .from("chats")
        .update({ 
          last_message: String(text), 
          last_message_at: nowIso,
          last_message_from: isFromCustomer ? "CUSTOMER" : "AGENT"
        })
        .eq("id", chatId);

      // invalida caches relacionados e reaquece mensagens recentes
      setTimeout(() => {
        Promise.all([
          rDel(k.chat(chatId)),
          clearMessageCache(chatId, (key) => key.includes(":nil:")),
          warmChatMessagesCache(chatId).catch((err) => {
            console.warn("[livechat:chat-message] warm cache failure", err instanceof Error ? err.message : err);
          }),
        ]).catch((err) => {
          console.warn("[livechat:chat-message] cache invalidate failure", err instanceof Error ? err.message : err);
        });
      }, 0);

      const io = getIO();
      const mappedForCache = {
        ...(inserted as any),
        client_draft_id: clientDraftId,
      };
      if (io) {
        const mapped = {
          id: inserted.id,
          chat_id: inserted.chat_id,
          body: inserted.content,
          sender_type: inserted.is_from_customer ? "CUSTOMER" : (inserted.type === "SYSTEM" ? "SYSTEM" : (inserted.sender_id ? "AGENT" : "AI")),
          sender_id: inserted.sender_id || senderId || null,
          sender_name: inserted.sender_name || senderName || null,
          sender_avatar_url: (inserted as any).sender_avatar_url || senderAvatarUrl || null,
          created_at: inserted.created_at,
          view_status: inserted.view_status || "Pending",
          type: inserted.type || "TEXT",
          is_private: false,
          client_draft_id: clientDraftId,
        };
        io.to(`chat:${chatId}`).emit("message:new", mapped);
        
        const chatCompanyId = (chat as any)?.company_id;
        if (chatCompanyId) {
          io.to(`company:${chatCompanyId}`).emit("chat:updated", {
            chatId,
            inboxId: (chat as any).inbox_id,
            last_message: String(text),
            last_message_at: nowIso,
            last_message_from: mapped.sender_type,
          });
        } else {
          io.emit("chat:updated", {
            chatId,
            inboxId: (chat as any).inbox_id,
            last_message: String(text),
            last_message_at: nowIso,
            last_message_from: mapped.sender_type,
          });
        }
      }

      // Se for AGENTE -> manda para a fila outbound
      if (!isFromCustomer) {
        await publish(EX_APP, "outbound.request", {
          jobType: "message.send",
          kind: "send-text",
          provider: "META",
          chatId,
          inboxId: (chat as any).inbox_id,
          customerId: (chat as any).customer_id,
          messageId: inserted.id,
          content: String(text),
          senderId: senderId || req.user?.id || null,
          attempt: 0,
          createdAt: nowIso,
          draftId: clientDraftId,
        });
      }

      return res.status(201).json({ ok: true, data: mappedForCache, draftId: clientDraftId });
    } catch (e: any) {
      console.error("[livechat:send] error", e);
      const draftId =
        typeof req?.body?.draftId === "string" && req.body.draftId.trim().length > 0
          ? req.body.draftId.trim()
          : null;
      return res.status(500).json({
        ok: false,
        error: e?.message || "send error",
        draftId,
      });
    }
  });

  // Enviar arquivo (base64) — invalida mensagens/listas/chat
  app.post("/livechat/chats/:id/messages/file", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    const { filename, mime, data } = (req.body || {}) as { filename?: string; mime?: string; data?: string };
    if (!filename || !data) return res.status(400).json({ error: "filename e data obrigatorios" });
    const contentType = mime || "application/octet-stream";

    try {
      const buffer = Buffer.from(
        String(data).replace(/^data:[^;]+;base64,/, ""),
        "base64"
      );
      const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
      const path = `${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      try {
        await (supabaseAdmin as any).storage.createBucket("chat-uploads", { public: true });
      } catch { }

      const { data: up, error: upErr } = await supabaseAdmin
        .storage
        .from("chat-uploads")
        .upload(path, buffer, { contentType, upsert: false });
      if (upErr) return res.status(500).json({ error: upErr.message });

      const pub = supabaseAdmin.storage.from("chat-uploads").getPublicUrl(up!.path);
      const url = (pub as any)?.data?.publicUrl || null;

      const nowIso = new Date().toISOString();
      const kind = contentType.startsWith("image/")
        ? "IMAGE"
        : contentType.startsWith("audio/")
          ? "AUDIO"
          : "FILE";

      // Resolve sender from users table using user_id (auth ID) to get local id
      let senderId: string | null = null;
      let senderName: string | null = null;
      let senderAvatarUrl: string | null = null;
      
      console.log("[POST /messages/file] 🔍 Starting sender resolution:", {
        authUserId: req.user?.id,
        hasUser: !!req.user,
      });
      
      if (req.user?.id) {
        const userRow = await supabaseAdmin
          .from("users")
          .select("id, name, email, avatar")
          .eq("user_id", req.user.id)
          .maybeSingle();
        
        console.log("[POST /messages/file] 📊 User lookup result:", {
          found: !!userRow.data,
          data: userRow.data,
          error: userRow.error,
        });
        
        if (userRow.data) {
          senderId = userRow.data.id;
          senderName = userRow.data.name || userRow.data.email || null;
          senderAvatarUrl = userRow.data.avatar || null;
        }
      }

      console.log("[POST /messages/file] 📝 Resolved sender:", {
        senderId,
        senderName,
        senderAvatarUrl,
      });

      const { data: inserted, error } = await supabaseAdmin
        .from("chat_messages")
        .insert([{
          chat_id: id,
          content: String(url || filename),
          type: kind,
          is_from_customer: false,
          sender_id: senderId,
          sender_name: senderName,
          sender_avatar_url: senderAvatarUrl,
          created_at: nowIso,
          view_status: "Sent",
        }])
        .select("id, chat_id, content, is_from_customer, sender_id, sender_name, sender_avatar_url, created_at, view_status, type")
        .single();
      
      console.log("[POST /messages/file] 💾 Inserted message:", {
        id: inserted?.id,
        sender_id: inserted?.sender_id,
        sender_name: inserted?.sender_name,
        sender_avatar_url: inserted?.sender_avatar_url,
        error,
      });
      
      if (error) return res.status(500).json({ error: error.message });

      await supabaseAdmin
        .from("chats")
        .update({ 
          last_message: `[Arquivo] ${filename}`, 
          last_message_at: nowIso,
          last_message_from: "AGENT" // File upload endpoint is always from agent
        })
        .eq("id", id);

      // invalida caches e reaquece mensagens
      setTimeout(() => {
        Promise.all([
          rDel(k.chat(id)),
          clearMessageCache(id, (key) => key.includes(":nil:")),
          warmChatMessagesCache(id).catch((err) => {
            console.warn("[livechat:chat-file] warm cache failure", err instanceof Error ? err.message : err);
          }),
        ]).catch((err) => {
          console.warn("[livechat:chat-file] cache invalidate failure", err instanceof Error ? err.message : err);
        });
      }, 0);

      const mapped = {
        id: inserted.id,
        chat_id: inserted.chat_id,
        body: inserted.content,
        sender_type: inserted.is_from_customer ? "CUSTOMER" : (inserted.type === "SYSTEM" ? "SYSTEM" : (inserted.sender_id ? "AGENT" : "AI")),
        sender_id: inserted.sender_id || senderId || null,
        sender_name: inserted.sender_name || senderName || null,
        sender_avatar_url: inserted.sender_avatar_url || senderAvatarUrl || null,
        created_at: inserted.created_at,
        view_status: inserted.view_status || null,
        type: inserted.type || kind,
        is_private: false,
      };

      console.log("[POST /messages/file] 📡 Socket emit message:new:", {
        messageId: mapped.id,
        sender_id: mapped.sender_id,
        sender_name: mapped.sender_name,
        sender_avatar_url: mapped.sender_avatar_url,
      });

      const io = getIO();
      io?.to(`chat:${id}`).emit("message:new", mapped);
      io?.emit("chat:updated", {
        chatId: id,
        last_message: `[Arquivo] ${filename}`,
        last_message_at: nowIso,
        last_message_from: mapped.sender_type,
      });

      return res.status(201).json(mapped);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "upload error" });
    }
  });

  // Enviar mídia (multipart ou JSON base64) — alias mais compatível com o front
  // Suporta: image/*, video/*, audio/*, application/*
  app.post("/livechat/chats/:id/messages/media", requireAuth, upload.single("file"), async (req: any, res) => {
    const { id: chatId } = req.params as { id: string };

    try {
      // 1) Extrai buffer/nome/mime a partir de multipart ou JSON base64
      let buffer: Buffer | null = null;
      let filename: string | null = null;
      let contentType: string = "application/octet-stream";
      const reply_to = req.body.reply_to || null;

      if (req.file && req.file.buffer) {
        buffer = req.file.buffer as Buffer;
        filename = req.file.originalname || "upload.bin";
        contentType = req.file.mimetype || contentType;
      } else if (req.body && (req.body.data || req.body.base64)) {
        const b64 = String(req.body.data || req.body.base64);
        buffer = Buffer.from(b64.replace(/^data:[^;]+;base64,/, ""), "base64");
        filename = req.body.filename || "upload.bin";
        contentType = req.body.mime || req.body.mimetype || contentType;
      }

      if (!buffer || !filename) {
        return res.status(400).json({ error: "arquivo ausente (use multipart field 'file' ou JSON {filename, data})" });
      }

      // 2) Upload no Storage (bucket público)
      const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
      const path = `${chatId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      try {
        await (supabaseAdmin as any).storage.createBucket("chat-uploads", { public: true });
      } catch {}

      const { data: up, error: upErr } = await supabaseAdmin
        .storage
        .from("chat-uploads")
        .upload(path, buffer, { contentType, upsert: false });
      if (upErr) return res.status(500).json({ error: upErr.message });

      const pub = supabaseAdmin.storage.from("chat-uploads").getPublicUrl(up!.path);
      const publicUrl = (pub as any)?.data?.publicUrl || null;

      // 3) Resolve provider/recipient para possível envio outbound
      const chatSelect = `
        id,
        inbox_id,
        customer_id,
        external_id,
        inbox:inboxes (
          id,
          provider,
          company_id
        ),
        customer:customers (
          phone,
          msisdn
        )
      `;
      const { data: chatRow, error: chatErr } = await supabaseAdmin
        .from("chats").select(chatSelect).eq("id", chatId).maybeSingle();
      if (chatErr) return res.status(500).json({ error: chatErr.message });
      if (!chatRow) return res.status(404).json({ error: "Chat nao encontrado" });

      const inboxRow = (chatRow as any)?.inbox || null;
      if (!inboxRow) return res.status(404).json({ error: "Inbox nao encontrada" });

      const inboxId = String(chatRow.inbox_id);
      const provider = String((inboxRow as any)?.provider || "").toUpperCase();
      const isWahaProvider = provider === WAHA_PROVIDER;
      const companyId =
        (typeof req.user?.company_id === "string" && req.user.company_id.trim()) ||
        (typeof (inboxRow as any)?.company_id === "string" && String((inboxRow as any).company_id).trim()) ||
        null;

      // 4) Resolve remetente (para nome/avatar no histórico)
      let senderId: string | null = null;
      let senderName: string | null = null;
      let senderAvatarUrl: string | null = null;
      if (req.user?.id) {
        try {
          const u = await supabaseAdmin
            .from("users")
            .select("id, name, email, avatar")
            .eq("user_id", req.user.id)
            .maybeSingle();
          if (u?.data) {
            senderId = u.data.id;
            senderName = u.data.name || u.data.email || null;
            senderAvatarUrl = u.data.avatar || null;
          }
        } catch {}
      }

      // 5) Persiste mensagem
      const nowIso = new Date().toISOString();
      const kind = contentType.startsWith("image/")
        ? "IMAGE"
        : contentType.startsWith("video/")
          ? "VIDEO"
          : contentType.startsWith("audio/")
            ? "AUDIO"
            : "FILE";

      // Resolve external_id if replying
      let repliedMessageExternalId: string | null = null;
      if (reply_to) {
        try {
          const { data: originalMsg } = await supabaseAdmin
            .from("chat_messages")
            .select("external_id")
            .eq("id", reply_to)
            .maybeSingle();
          if (originalMsg?.external_id) {
            repliedMessageExternalId = String(originalMsg.external_id);
            console.log("[MEDIA UPLOAD] Resolved reply external_id:", repliedMessageExternalId);
          }
        } catch (e) {
          console.warn("[MEDIA UPLOAD] Failed to resolve reply external_id:", e);
        }
      }

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("chat_messages")
        .insert([{
          chat_id: chatId,
          content: String(filename),
          type: kind,
          is_from_customer: false,
          sender_id: senderId,
          sender_name: senderName,
          sender_avatar_url: senderAvatarUrl,
          created_at: nowIso,
          view_status: "Pending",
          media_public_url: publicUrl,
          media_storage_path: up?.path ?? null,
          is_media_sensitive: false,
          replied_message_id: reply_to || null, // Save UUID for frontend
          replied_message_external_id: repliedMessageExternalId, // Save external_id for WAHA
        }])
        .select("id, chat_id, content, is_from_customer, sender_id, sender_name, sender_avatar_url, created_at, view_status, type, replied_message_id, replied_message_external_id")
        .single();
      if (insErr) return res.status(500).json({ error: insErr.message });

      await supabaseAdmin
        .from("chats")
        .update({ 
          last_message: `[Arquivo] ${filename}`, 
          last_message_at: nowIso,
          last_message_from: "AGENT"
        })
        .eq("id", chatId);

      // invalida caches e aquece
      setTimeout(() => {
        Promise.all([
          rDel(k.chat(chatId)),
          clearMessageCache(chatId, (key) => key.includes(":nil:")),
          warmChatMessagesCache(chatId).catch(() => {}),
        ]).catch(() => {});
      }, 0);

      // 6) Socket
      const mapped = {
        id: inserted.id,
        chat_id: inserted.chat_id,
        body: inserted.content,
        sender_type: inserted.is_from_customer ? "CUSTOMER" : (inserted.type === "SYSTEM" ? "SYSTEM" : (inserted.sender_id ? "AGENT" : "AI")),
        sender_id: inserted.sender_id || senderId || null,
        sender_name: inserted.sender_name || senderName || null,
        sender_avatar_url: inserted.sender_avatar_url || senderAvatarUrl || null,
        created_at: inserted.created_at,
        view_status: inserted.view_status || "Pending",
        type: inserted.type || kind,
        is_private: false,
        media_url: publicUrl,
        replied_message_id: (inserted as any)?.replied_message_id || null,
      };
      const io = getIO();
      io?.to(`chat:${chatId}`).emit("message:new", mapped);
      io?.emit("chat:updated", {
        chatId,
        last_message: `[Arquivo] ${filename}`,
        last_message_at: nowIso,
        last_message_from: mapped.sender_type,
      });

  // 7) Enfileira envio outbound: WAHA ou META
  if (isWahaProvider && companyId) {
        // Resolve destinatário WAHA
        const customerRow = (chatRow as any)?.customer || null;
        const candidates = customerRow ? [customerRow.phone, customerRow.msisdn] : [];
        const customerPhone = candidates.find((v: unknown) => typeof v === "string" && v.trim()) || null;
        let wahaRecipient: string | null = null;
        if (customerPhone) {
          const digits = normalizeMsisdn(customerPhone as string);
          if (digits) wahaRecipient = `${digits}@c.us`;
        } else if (typeof chatRow?.external_id === "string" && chatRow.external_id.trim()) {
          wahaRecipient = chatRow.external_id.trim();
        }

        const mediaKind = kind === "AUDIO" ? "audio" : kind === "IMAGE" ? "image" : kind === "VIDEO" ? "video" : "document";
        
        const payload: any = {
          type: "media",
          kind: mediaKind,
          mediaUrl: publicUrl,
          filename,
          mimeType: contentType,
          draftId: inserted.id,
        };
        if (wahaRecipient) payload.to = wahaRecipient;
        if (repliedMessageExternalId) {
          payload.quotedMessageId = repliedMessageExternalId;
          console.log("[MEDIA UPLOAD] Sending WAHA with quotedMessageId:", repliedMessageExternalId);
        }

        await publish(EX_APP, "outbound.request", {
          jobType: "outbound.request",
          provider: WAHA_PROVIDER,
          companyId,
          inboxId,
          chatId,
          customerId: chatRow.customer_id,
          messageId: inserted.id,
          payload,
          attempt: 0,
          createdAt: nowIso,
          senderUserSupabaseId: senderId,
        });
      } else {
        // META (Cloud API): consome via worker "meta.sendMedia"; agora suporta URL pública
        await publish(EX_APP, "outbound.request", {
          jobType: "meta.sendMedia",
          provider: "META",
          inboxId,
          chatId,
          customerId: chatRow.customer_id,
          messageId: inserted.id,
          public_url: publicUrl,
          mime_type: contentType,
          filename,
          attempt: 0,
          createdAt: nowIso,
          senderUserSupabaseId: senderId,
        });
      }

      return res.status(201).json({ ok: true, data: mapped });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "media upload error" });
    }
  });

  // Mensagens privadas - listar (mantive sem cache para simplificar)
  app.get("/livechat/chats/:id/private/messages", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    try {
      const { data: privChat, error: errPc } = await supabaseAdmin
        .from("private_chats")
        .select("id")
        .eq("chat_id", id)
        .maybeSingle();
      if (errPc) return res.status(500).json({ error: errPc.message });
      if (!privChat?.id) return res.json([]);

      const { data, error } = await supabaseAdmin
        .from("private_messages")
        .select("id, content, sender_id, created_at, media_url")
        .eq("private_chat_id", privChat.id)
        .order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });

      const senderIds = Array.from(
        new Set((data || []).map((r: any) => r.sender_id).filter(Boolean))
      );
      let nameMap: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: usersList } = await supabaseAdmin
          .from("users")
          .select("id, name")
          .in("id", senderIds);
        for (const u of usersList || [])
          nameMap[(u as any).id] = (u as any).name || (u as any).id;
      }

      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        chat_id: id,
        body: r.content,
        sender_type: "AGENT",
        sender_id: r.sender_id || null,
        created_at: r.created_at,
        view_status: null,
        type: "PRIVATE",
        is_private: true,
        sender_name: r.sender_id ? nameMap[r.sender_id] || null : null,
        media_url: r.media_url ?? null,
      }));

      return res.json(mapped);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "private list error" });
    }
  });

  // Mensagens privadas - enviar (invalida msgs privadas do chat)
  app.post("/livechat/chats/:id/private/messages", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    const { text } = (req.body || {}) as { text?: string };
    if (!text) return res.status(400).json({ error: "text obrigatorio" });

    try {
      let localUserId: string | null = null;
      try {
        const { data: urow } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("user_id", req.user.id)
          .maybeSingle();
        localUserId = (urow as any)?.id || null;
      } catch { }

      let privateChatId: string | null = null;
      const { data: existing } = await supabaseAdmin
        .from("private_chats")
        .select("id")
        .eq("chat_id", id)
        .maybeSingle();
      if (existing?.id) privateChatId = existing.id;
      else {
        const { data: created, error: errCreate } = await supabaseAdmin
          .from("private_chats")
          .insert([{ chat_id: id, is_active: true }])
          .select("id")
          .single();
        if (errCreate) return res.status(500).json({ error: errCreate.message });
        privateChatId = (created as any)?.id || null;
      }
      if (!privateChatId) return res.status(500).json({ error: "Falha ao criar private_chat" });

      const nowIso = new Date().toISOString();
      const { data: inserted, error } = await supabaseAdmin
        .from("private_messages")
        .insert([{
          content: String(text),
          private_chat_id: privateChatId,
          sender_id: localUserId || req.user.id,
          created_at: nowIso,
        }])
        .select("id, content, sender_id, created_at")
        .single();
      if (error) return res.status(500).json({ error: error.message });

      // limpa caches de mensagens públicas NÃO é necessário; mas se você optar por cachear privadas, limpe aqui
      // await rDelMatch(`lc:privmsgs:${id}:*`) // exemplo se existir

      let senderName: string | null = null;
      if (localUserId) {
        try {
          const { data: u } = await supabaseAdmin
            .from("users")
            .select("name")
            .eq("id", localUserId)
            .maybeSingle();
          senderName = (u as any)?.name || null;
        } catch { }
      }

      const mapped = {
        id: inserted.id,
        chat_id: id,
        body: inserted.content,
        sender_type: "AGENT",
        sender_id: inserted.sender_id || null,
        created_at: inserted.created_at,
        view_status: null,
        type: "PRIVATE",
        is_private: true,
        sender_name: senderName,
      };
      getIO()?.to(`chat:${id}`).emit("message:new", mapped);

      return res.status(201).json(mapped);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "private send error" });
    }
  });

  // Participantes
  app.post("/livechat/chats/:id/participants", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId obrigatorio" });

    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("chat_participants")
      .upsert(
        [{ chat_id: id, user_id: userId, is_active: true, left_at: null, joined_at: nowIso }],
        { onConflict: "chat_id,user_id" }
      )
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  });

  app.delete("/livechat/chats/:id/participants/:userId", requireAuth, async (req, res) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const { error } = await supabaseAdmin
      .from("chat_participants")
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq("chat_id", id)
      .eq("user_id", userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  });

  app.get("/livechat/chats/:id/participants", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("chat_participants")
        .select("user_id, joined_at, left_at, is_active")
        .eq("chat_id", id);
      if (error) return res.status(500).json({ error: error.message });

      const uids = Array.from(
        new Set((rows || []).map((r: any) => r.user_id).filter(Boolean))
      );

      let usersMap: Record<
        string,
        { name: string | null; role: string | null; user_id: string | null }
      > = {};

      if (uids.length > 0) {
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id, user_id, name, role")
          .in("id", uids);

        for (const u of (users || [])) {
          usersMap[(u as any).id] = {
            name: (u as any).name || (u as any).id,
            role: (u as any).role || null,
            user_id: (u as any).user_id || null,
          };
        }
      }

      const list = (rows || []).map((r: any) => ({
        id: r.user_id,
        name: usersMap[r.user_id]?.name || r.user_id,
        role: usersMap[r.user_id]?.role || null,
        is_current: usersMap[r.user_id]?.user_id === req.user.id,
      }));

      return res.json(list);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "participants error" });
    }
  });

  // -------- Mark Chat as Read (Provider-Agnostic) --------
  app.post("/livechat/chats/:id/mark-read", requireAuth, async (req: any, res) => {
    try {
      const { id: chatId } = req.params as { id: string };
      
      // 🔒 SEGURANÇA: Validar company_id do usuário
      const userCompanyId = req.user?.company_id;
      if (!userCompanyId) {
        return res.status(401).json({ ok: false, error: "Empresa não identificada" });
      }
      
      console.log("[READ_RECEIPTS][livechat/mark-read] Marking chat as read (provider-agnostic)", { chatId, userCompanyId });

      // 1. Get chat details to determine provider
      const { data: chat, error: chatError } = await supabaseAdmin
        .from("chats")
        .select("id, inbox_id, company_id, status, department_id, kind")
        .eq("id", chatId)
        .maybeSingle();

      if (chatError) {
        console.error("[READ_RECEIPTS][livechat/mark-read] Chat query error", {
          chatId,
          error: chatError.message,
        });
        return res.status(500).json({ ok: false, error: chatError.message });
      }

      if (!chat) {
        console.warn("[READ_RECEIPTS][livechat/mark-read] Chat not found", { chatId });
        return res.status(404).json({ ok: false, error: "Chat not found" });
      }
      
      // Validar que a inbox pertence à empresa
      const chatInboxId = (chat as any).inbox_id;
      if (chatInboxId) {
        const { data: inboxData } = await supabaseAdmin
          .from("inboxes")
          .select("company_id")
          .eq("id", chatInboxId)
          .eq("company_id", userCompanyId)
          .maybeSingle();
        
        if (!inboxData) {
          console.warn("[READ_RECEIPTS][livechat/mark-read] Chat access denied", { chatId });
          return res.status(404).json({ ok: false, error: "Chat not found" });
        }
      }

      // 2. Get inbox provider
      const { data: inbox, error: inboxError } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider")
        .eq("id", chat.inbox_id)
        .maybeSingle();

      if (inboxError || !inbox) {
        console.error("[READ_RECEIPTS][livechat/mark-read] Inbox query error", {
          inboxId: chat.inbox_id,
          error: inboxError?.message || "Inbox not found",
        });
        return res.status(500).json({ ok: false, error: "Inbox not found" });
      }

      const provider = String(inbox.provider || "").toUpperCase();
      console.log("[READ_RECEIPTS][livechat/mark-read] Provider determined", {
        chatId,
        inboxId: inbox.id,
        provider,
      });

      // 3. Process based on provider
      if (provider === "WAHA") {
        // WAHA provider - mark messages as read in database
        console.log("[READ_RECEIPTS][livechat/mark-read] WAHA provider - processing", { chatId });

        try {
          // Get unread customer messages
          const { data: unreadMessages, error: messagesError } = await supabaseAdmin
            .from("chat_messages")
            .select("id, external_id")
            .eq("chat_id", chatId)
            .eq("is_from_customer", true)
            .or("view_status.is.null,view_status.neq.read");

          if (messagesError) {
            console.error("[READ_RECEIPTS][livechat/mark-read] Messages query error", {
              chatId,
              error: messagesError.message,
            });
            return res.status(500).json({ ok: false, error: messagesError.message });
          }

          const messageIds = (unreadMessages || []).map((m: any) => m.id);
          const nowIso = new Date().toISOString();

          if (messageIds.length === 0) {
            console.log("[READ_RECEIPTS][livechat/mark-read] No unread messages", { chatId });
          } else {
            // Mark messages as read in database
            const { error: updateError } = await supabaseAdmin
              .from("chat_messages")
              .update({ view_status: "read", updated_at: nowIso })
              .in("id", messageIds);

            if (updateError) {
              console.error("[READ_RECEIPTS][livechat/mark-read] Update error", {
                chatId,
                error: updateError.message,
              });
              return res.status(500).json({ ok: false, error: updateError.message });
            }
          }

          // Reset unread_count to 0
          const { error: chatUpdateError } = await supabaseAdmin
            .from("chats")
            .update({ unread_count: 0, updated_at: nowIso })
            .eq("id", chatId);

          if (chatUpdateError) {
            console.warn("[READ_RECEIPTS][livechat/mark-read] Chat unread_count update error", {
              chatId,
              error: chatUpdateError.message,
            });
          }

          // Invalidate cache
          try {
            const chatData = chat as any;
            // Always invalidate PENDING because marking as read affects PENDING view (unread > 0)
            const statuses = Array.from(new Set(["ALL", chatData.status, "PENDING"])).filter(Boolean);
            
            // Normalize kind: null/undefined -> DIRECT
            const normalizedKind = chatData.kind ? chatData.kind.toUpperCase() : "DIRECT";
            const kinds = Array.from(new Set(["ALL", normalizedKind, "DIRECT", "GROUP"])).filter(Boolean);
            
            const inboxes = [chatData.inbox_id, null];
            const departments = [chatData.department_id, null];
            
            const indexKeys: string[] = [];
            for (const inbox of inboxes) {
              for (const s of statuses) {
                for (const k_ of kinds) {
                  for (const d of departments) {
                    indexKeys.push(k.listIndex(chatData.company_id, inbox, s, k_, d));
                  }
                }
              }
            }
            await clearListCacheIndexes(indexKeys);
            await rDel(k.chat(chatId));
            console.log("[READ_RECEIPTS][livechat/mark-read] Cache invalidated", { chatId });
          } catch (cacheErr) {
            console.warn("[READ_RECEIPTS][livechat/mark-read] Cache invalidation failed", cacheErr);
          }

          console.log("[READ_RECEIPTS][livechat/mark-read] WAHA messages marked as read", {
            chatId,
            count: messageIds.length,
          });

          // Emit socket events
          const io = getIO();
          const chatCompanyId = chat.company_id;
          const roomName = chatCompanyId ? `company:${chatCompanyId}` : null;
          
          console.log("[READ_RECEIPTS][WAHA] 🔔 Socket info:", {
            chatId,
            companyId: chatCompanyId,
            roomName,
            totalSockets: io.sockets.sockets.size,
            roomSize: roomName ? (io.sockets.adapter.rooms.get(roomName)?.size || 0) : 0,
            chatRoomSize: io.sockets.adapter.rooms.get(`chat:${chatId}`)?.size || 0
          });
          
          // Emit message status updates
          if (messageIds.length > 0) {
            for (const msg of unreadMessages || []) {
              io.to(`chat:${chatId}`).emit("message:status", {
                kind: "livechat.message.status",
                chatId,
                messageId: msg.id,
                externalId: msg.external_id,
                view_status: "read",
                status: "READ",
              });
            }
          }

          // Emit chat updated with unread_count = 0
          if (roomName) {
            io.to(roomName).emit("chat:updated", {
              chatId,
              unread_count: 0,
            });

            io.to(roomName).emit("chat:read", {
              chatId,
              inboxId: chat.inbox_id,
              timestamp: new Date().toISOString(),
            });
          } else {
            io.emit("chat:updated", {
              chatId,
              unread_count: 0,
            });

            io.emit("chat:read", {
              chatId,
              inboxId: chat.inbox_id,
              timestamp: new Date().toISOString(),
            });
          }

          console.log("[READ_RECEIPTS][WAHA] ✅ Socket events emitted", {
            chatId,
            count: messageIds.length,
          });

          return res.json({ ok: true, markedCount: messageIds.length, messageIds });
        } catch (wahaError) {
          console.error("[READ_RECEIPTS][livechat/mark-read] WAHA processing error", {
            chatId,
            error: wahaError instanceof Error ? wahaError.message : String(wahaError),
          });
          return res.status(500).json({ ok: false, error: "Failed to mark messages as read" });
        }
      } else if (provider === "META" || provider === "META_CLOUD") {
        // META provider - mark messages as read in database only (no API call)
        console.log("[READ_RECEIPTS][livechat/mark-read] META provider - marking as read in DB", {
          chatId,
        });

        try {
          // 1. Get unread customer messages
          const { data: unreadMessages, error: messagesError } = await supabaseAdmin
            .from("chat_messages")
            .select("id, external_id")
            .eq("chat_id", chatId)
            .eq("is_from_customer", true)
            .or("view_status.is.null,view_status.neq.read");

          if (messagesError) {
            console.error("[READ_RECEIPTS][livechat/mark-read] Messages query error", {
              chatId,
              error: messagesError.message,
            });
            return res.status(500).json({ ok: false, error: messagesError.message });
          }

          const messageIds = (unreadMessages || []).map((m: any) => m.id);
          const nowIso = new Date().toISOString();

          if (messageIds.length === 0) {
            console.log("[READ_RECEIPTS][livechat/mark-read] No unread messages", { chatId });
          } else {
            // 2. Mark messages as read in database
            const { error: updateError } = await supabaseAdmin
              .from("chat_messages")
              .update({ view_status: "read", updated_at: nowIso })
              .in("id", messageIds);

            if (updateError) {
              console.error("[READ_RECEIPTS][livechat/mark-read] Update error", {
                chatId,
                error: updateError.message,
              });
              return res.status(500).json({ ok: false, error: updateError.message });
            }
          }

          // 3. Reset unread_count to 0
          const { error: chatUpdateError } = await supabaseAdmin
            .from("chats")
            .update({ unread_count: 0, updated_at: nowIso })
            .eq("id", chatId);

          if (chatUpdateError) {
            console.warn("[READ_RECEIPTS][livechat/mark-read] Chat unread_count update error", {
              chatId,
              error: chatUpdateError.message,
            });
          }

          // Invalidate cache
          try {
            const chatData = chat as any;
            // Always invalidate PENDING because marking as read affects PENDING view (unread > 0)
            const statuses = Array.from(new Set(["ALL", chatData.status, "PENDING"])).filter(Boolean);
            
            // Normalize kind: null/undefined -> DIRECT
            const normalizedKind = chatData.kind ? chatData.kind.toUpperCase() : "DIRECT";
            const kinds = Array.from(new Set(["ALL", normalizedKind, "DIRECT", "GROUP"])).filter(Boolean);
            
            const inboxes = [chatData.inbox_id, null];
            const departments = [chatData.department_id, null];
            
            const indexKeys: string[] = [];
            for (const inbox of inboxes) {
              for (const s of statuses) {
                for (const k_ of kinds) {
                  for (const d of departments) {
                    indexKeys.push(k.listIndex(chatData.company_id, inbox, s, k_, d));
                  }
                }
              }
            }
            await clearListCacheIndexes(indexKeys);
            await rDel(k.chat(chatId));
            console.log("[READ_RECEIPTS][livechat/mark-read] Cache invalidated (META)", { chatId });
          } catch (cacheErr) {
            console.warn("[READ_RECEIPTS][livechat/mark-read] Cache invalidation failed (META)", cacheErr);
          }

          console.log("[READ_RECEIPTS][livechat/mark-read] META messages marked as read", {
            chatId,
            count: messageIds.length,
          });

          // 4. Emit socket events
          const io = getIO();
          const chatCompanyId = chat.company_id;
          const roomName = chatCompanyId ? `company:${chatCompanyId}` : null;
          
          console.log("[READ_RECEIPTS][META] 🔔 Socket info:", {
            chatId,
            companyId: chatCompanyId,
            roomName,
            totalSockets: io.sockets.sockets.size,
            roomSize: roomName ? (io.sockets.adapter.rooms.get(roomName)?.size || 0) : 0,
            chatRoomSize: io.sockets.adapter.rooms.get(`chat:${chatId}`)?.size || 0
          });
          
          // Emit message status updates
          if (messageIds.length > 0) {
            for (const msg of unreadMessages || []) {
              io.to(`chat:${chatId}`).emit("message:status", {
                kind: "livechat.message.status",
                chatId,
                messageId: msg.id,
                externalId: msg.external_id,
                view_status: "read",
                status: "READ",
              });
            }
          }

          // Emit chat updated with unread_count = 0
          if (roomName) {
            io.to(roomName).emit("chat:updated", {
              chatId,
              unread_count: 0,
            });

            io.to(roomName).emit("chat:read", {
              chatId,
              inboxId: chat.inbox_id,
              timestamp: new Date().toISOString(),
            });
          } else {
            io.emit("chat:updated", {
              chatId,
              unread_count: 0,
            });

            io.emit("chat:read", {
              chatId,
              inboxId: chat.inbox_id,
              timestamp: new Date().toISOString(),
            });
          }

          console.log("[READ_RECEIPTS][livechat/mark-read] Socket events emitted", {
            chatId,
            count: messageIds.length,
          });

          return res.json({ ok: true, markedCount: messageIds.length, messageIds });
        } catch (metaError) {
          console.error("[READ_RECEIPTS][livechat/mark-read] META processing error", {
            chatId,
            error: metaError instanceof Error ? metaError.message : String(metaError),
          });
          return res.status(500).json({ ok: false, error: "Failed to mark messages as read" });
        }
      } else {
        console.warn("[READ_RECEIPTS][livechat/mark-read] Unknown provider", {
          chatId,
          provider,
        });
        return res.status(400).json({ ok: false, error: `Unknown provider: ${provider}` });
      }
    } catch (error) {
      console.error("[READ_RECEIPTS][livechat/mark-read] Unexpected error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ ok: false, error: "Internal server error" });
    }
  });
}
