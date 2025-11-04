import "dotenv/config";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";                 // ✅ use node:path
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { EX_APP, publish, consume, Q_SOCKET_LIVECHAT } from "./queue/rabbit.ts";
import { metaWebhookGet, metaWebhookPost } from "./routes/metawebhook.ts";
import { registerSendMessageRoutes } from "./routes/sendMessage.ts";
import { listWebhookEvents } from "./routes/adminwebhooks.ts";
import {
  getBoardIdForCompany,
  ensureLeadCustomerChat,
  ensureGroupChat,
  insertInboundMessage,
} from "./services/meta/store.ts";
import { setIO, getIO } from "./lib/io.ts";
import { registerLivechatChatRoutes } from "./routes/livechat.chats.ts";
import { getRedis, rGet, rSet, redis, k } from "./lib/redis.ts";
import { registerLivechatContactsRoutes } from "./routes/livechat.contacts.ts";
import { registerKanbanRoutes } from "./routes/kanban.ts";
import { registerSettingsUsersRoutes } from "./routes/settings.users.ts";
import { registerSettingsInboxesRoutes } from "./routes/settings.inboxes.ts";
import { registerOpenAIIntegrationRoutes } from "./routes/integrations.openai.ts";
import { registerAgentsRoutes } from "./routes/agents.ts";
import filesRoute from "./server/files.route.ts";
import { startSocketRelay } from "./socket.relay.ts";
import { startLivechatSocketBridge } from "./socket/bridge.livechat.ts";
import { registerCampaignRoutes } from "./routes/livechat.campaigns.ts";
import { registerCampaignSegmentsRoutes } from "./routes/livechat.campaigns.segments.ts";
import { registerCampaignFollowupsRoutes } from "./routes/livechat.campaigns.followups.ts";
import { registerCampaignUploadsRoutes } from "./routes/livechat.campaigns.uploads.ts";
import { registerCampaignWorker } from "./worker.campaigns.ts";
import { registerWAHARoutes } from "./routes/waha.ts";
import mediaProxyRouter from "./routes/media.proxy.ts";
import { syncGlobalWahaApiKey } from "./services/waha/syncGlobalApiKey.ts";
import { WAHA_PROVIDER, wahaFetch, fetchWahaChatPicture, fetchWahaContactPicture } from "./services/waha/client.ts";
import { normalizeMsisdn } from "./util.ts";

// Feature flag para (des)ativar a sincronização automática com WAHA
// Ativado somente quando WAHA_SYNC_ENABLED=true no ambiente
const WAHA_SYNC_ENABLED = String(process.env.WAHA_SYNC_ENABLED || "false").toLowerCase() === "true";

process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});

const app = express();
const server = http.createServer(app);

// (opcional, mas recomendado se estiver atrás de proxy)
app.set("trust proxy", 1);

// CORS primeiro (antes de qualquer rota/estático)
app.use(cors({
  origin: (origin, cb) => cb(null, true),  // libera tudo (ajuste se precisar)
  credentials: true,
}));
app.use(cookieParser());

// body parsers genéricos (suas rotas de upload usam multer, então ok)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// === Arquivos locais ===
const MEDIA_DIR = process.env.MEDIA_DIR || path.resolve(process.cwd(), "media");

const TTL_AVATAR = Number(process.env.CACHE_TTL_AVATAR || 300);

async function getCachedAvatar(companyId: string | null | undefined, remoteId: string | null | undefined): Promise<string | null> {
  if (!companyId) return null;
  if (!remoteId) return null;
  try {
    return await rGet<string>(k.avatar(companyId, remoteId));
  } catch {
    return null;
  }
}

// Servir direto: GET http://host:5000/media/<storage_key>
app.use(
  "/media",
  express.static(MEDIA_DIR, {
    fallthrough: true,
    maxAge: "7d",
    index: false,
    setHeaders(res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // content-disposition fica "inline" por padrão — bom para <img>/<video>/<audio>
    },
  }),
);

// Rota que serve por messageId (já existente)
app.use(filesRoute);



async function handleSocketBroadcast(event: any) {
  const io = getIO();
  if (!io) return;

  if (event?.kind === "livechat.inbound.message") {
    const { chatId, message, chatUpdate } = event;
    if (chatId && message) {
      io.to(`chat:${chatId}`).emit("message:new", message);
    }
    if (chatUpdate) {
      io.emit("chat:updated", chatUpdate);
    }
    return;
  }

  if (event?.kind === "livechat.outbound.message") {
    const { chatId, message, chatUpdate } = event;
    if (chatId && message) {
      io.to(`chat:${chatId}`).emit("message:new", message);
    }
    if (chatUpdate) {
      io.emit("chat:updated", chatUpdate);
    }
    return;
  }

  if (event?.kind === "livechat.message.status") {
    const payload = {
      chatId: event.chatId ?? null,
      messageId: event.messageId ?? null,
      externalId: event.externalId ?? null,
      view_status: event.view_status ?? null,
      raw_status: event.raw_status ?? null,
    };
    if (payload.chatId && (payload.messageId || payload.externalId)) {
      io.to(`chat:${payload.chatId}`).emit("message:status", payload);
    }
  }
}

async function startSocketQueueListener() {
  try {
    await consume(Q_SOCKET_LIVECHAT, async (msg, ch) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await handleSocketBroadcast(payload);
        ch.ack(msg);
      } catch (err) {
        console.error("[socket.queue] handler error:", (err as any)?.message || err);
        ch.nack(msg, false, false);
      }
    });
    console.log("[socket.queue] listening on:", Q_SOCKET_LIVECHAT);
  } catch (err) {
    console.error("[socket.queue] setup failed:", (err as any)?.message || err);
  }
}

function getColIdFromTagRow(row: Record<string, unknown> | null | undefined): string | null {
  if (!row || typeof row !== "object") return null;
  const candidates = ["kanban_column_id", "kanban_colum_id", "column_id", "kanban_column", "kanban_col_id"];
  for (const key of candidates) {
    const value = (row as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  const nested = (row as Record<string, any>).metadata ?? (row as Record<string, any>).meta ?? null;
  if (nested && typeof nested === "object") {
    for (const key of candidates) {
      const value = nested[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  }

  return null;
}


// ===== Config =====
const PORT = Number(process.env.PORT_BACKEND || 5000);
const FRONTEND_ORIGINS = Array.from(
  new Set([
    ...(process.env.FRONTEND_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]),
);
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "sb_access_token";
const JWT_COOKIE_SECURE = String(process.env.JWT_COOKIE_SECURE) === "true";
const AVATAR_CACHE_TTL = Number(process.env.CACHE_TTL_AVATAR ?? 24 * 60 * 60);

// ===== Middlewares =====
app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// (opcional) assets est?ticos se precisar
// app.use(express.static("assets"));

// ===== Supabase clients =====
// Para login/fluxos p?blicos
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Para CRUD no servidor (NUNCA exponha essa chave no front)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type WahaInboxRecord = {
  id: string;
  company_id: string;
  instance_id: string | null;
};

function mapWahaMessageType(message: any): string {
  const rawType = (message?.type || message?.messageType || message?.mediaType || "")
    .toString()
    .trim()
    .toUpperCase();
  if (rawType === "CHAT" || rawType === "TEXT" || rawType === "MESSAGE") return "TEXT";
  if (["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER", "VOICE"].includes(rawType)) return rawType;

  const mimetype = (message?.media?.mimetype || message?.mimetype || "").toString().toLowerCase();
  if (mimetype.includes("image")) return "IMAGE";
  if (mimetype.includes("video")) return "VIDEO";
  if (mimetype.includes("audio")) return "AUDIO";
  if (mimetype.includes("pdf") || mimetype.includes("application")) return "DOCUMENT";
  if (message?.hasMedia) return "DOCUMENT";
  return "TEXT";
}

function extractRemoteIdFromChat(chat: any): string | null {
  const candidates = [
    chat?.id,
    chat?.chatId,
    chat?.jid,
    chat?.remoteJid,
    chat?.phone,
    chat?.number,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function deriveChatName(chat: any): string | null {
  const candidates = [
    chat?.name,
    chat?.pushName,
    chat?.formattedName,
    chat?.displayName,
    chat?.subject,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function deriveChatAvatar(chat: any): string | null {
  const candidates = [chat?.pictureUrl, chat?.avatar, chat?.photoURL, chat?.picture];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

async function fetchWahaMessages(session: string, remoteId: string) {
  const encodedSession = encodeURIComponent(session);
  const encodedChat = encodeURIComponent(remoteId);
  try {
    const messages = await wahaFetch<any[]>(
      `/api/${encodedSession}/chats/${encodedChat}/messages?limit=50&downloadMedia=false`,
    );
    return Array.isArray(messages) ? messages : [];
  } catch (error) {
    console.warn("[WAHA][sync] failed to fetch chat messages", { session, remoteId, error });
    return [];
  }
}

async function syncWahaChatsForInboxes(inboxes: WahaInboxRecord[]): Promise<void> {
  for (const inbox of inboxes) {
    const avatarTasks: Promise<unknown>[] = [];
    const session = typeof inbox.instance_id === "string" ? inbox.instance_id.trim() : "";
    if (!session) continue;

    let chatList: any[] = [];
    try {
      const result = await wahaFetch<any[]>(
        `/api/${encodeURIComponent(session)}/chats?limit=200&sortBy=conversationTimestamp&sortOrder=desc`,
      );
      chatList = Array.isArray(result) ? result : [];
    } catch (error) {
      console.warn("[WAHA][sync] failed to fetch chats", { inboxId: inbox.id, session, error });
      continue;
    }

    for (const chat of chatList) {
      const remoteId = extractRemoteIdFromChat(chat);
      if (!remoteId) continue;
      const remoteLower = remoteId.toLowerCase();
      if (remoteLower === "status@broadcast" || remoteLower.endsWith(":status@broadcast")) {
        continue;
      }

      const isGroup = remoteId.toLowerCase().endsWith("@g.us");
      const chatName = deriveChatName(chat);
      const rawAvatar = deriveChatAvatar(chat);
      let resolvedAvatar: string | null = rawAvatar ?? null;

      const cachedAvatar = await getCachedAvatar(inbox.company_id, remoteId);
      if (cachedAvatar) {
        resolvedAvatar = resolvedAvatar || cachedAvatar;
      }

      if (!resolvedAvatar) {
        try {
          if (isGroup) {
            const picResp = await fetchWahaChatPicture(session, remoteId);
            if (picResp?.url) {
              resolvedAvatar = picResp.url;
              console.debug("[WAHA][sync] fetched group picture", { inboxId: inbox.id, remoteId });
            }
          } else {
            const picResp = await fetchWahaContactPicture(session, remoteId, { refresh: false });
            if (picResp?.url) {
              resolvedAvatar = picResp.url;
              console.debug("[WAHA][sync] fetched contact picture", { inboxId: inbox.id, remoteId });
            }
          }
        } catch (error) {
          console.warn("[WAHA][sync] avatar fetch failed", {
            inboxId: inbox.id,
            remoteId,
            error,
          });
        }
      }

      if (resolvedAvatar) {
        avatarTasks.push(
          rSet(k.avatar(inbox.company_id, remoteId), resolvedAvatar, TTL_AVATAR).catch((error) => {
            console.warn("[WAHA][sync] avatar cache set failed", {
              inboxId: inbox.id,
              remoteId,
              error,
            });
          }),
        );
      }

      let ensuredChatId: string | null = null;

      try {
        if (isGroup) {
          const ensured = await ensureGroupChat({
            inboxId: inbox.id,
            companyId: inbox.company_id,
            remoteId,
            groupName: chatName,
            groupAvatarUrl: resolvedAvatar ?? undefined,
          });
          ensuredChatId = ensured.chatId;
        } else {
          const numeric = remoteId.replace(/@.*/, "");
          const normalizedPhone = normalizeMsisdn(numeric) || numeric;
          const ensured = await ensureLeadCustomerChat({
            inboxId: inbox.id,
            companyId: inbox.company_id,
            phone: normalizedPhone,
            name: chatName,
            rawPhone: remoteId,
          });
          ensuredChatId = ensured.chatId;
        }
      } catch (error) {
        console.warn("[WAHA][sync] ensure chat failed", { inboxId: inbox.id, remoteId, error });
        continue;
      }

      if (!ensuredChatId) continue;

      const messages = await fetchWahaMessages(session, remoteId);
      if (!messages.length) continue;

      for (const msg of messages) {
        const externalId = typeof msg?.id === "string" && msg.id.trim() ? msg.id.trim() : null;
        if (!externalId) continue;
        if (msg?.fromMe) continue; // sincroniza apenas mensagens recebidas

        const remoteParticipantId =
          (typeof msg?.participant === "string" && msg.participant.trim()) ||
          (typeof msg?.author === "string" && msg.author.trim()) ||
          null;
        const remoteSenderId =
          (typeof msg?.from === "string" && msg.from.trim()) ||
          remoteParticipantId ||
          null;
        const senderPhoneRaw = remoteSenderId ? remoteSenderId.replace(/@.*/, "") : null;
        const remoteSenderPhone =
          senderPhoneRaw && senderPhoneRaw.trim()
            ? normalizeMsisdn(senderPhoneRaw) || senderPhoneRaw
            : null;

        const messageType = mapWahaMessageType(msg);
        const body =
          typeof msg?.body === "string" && msg.body.trim()
            ? msg.body
            : msg?.hasMedia
              ? `[${messageType}]`
              : "";

        const timestamp = Number(msg?.timestamp);
        const createdAtIso =
          Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null;

        try {
          await insertInboundMessage({
            chatId: ensuredChatId,
            externalId,
            content: body,
            type: messageType,
            remoteParticipantId,
            remoteSenderId,
            remoteSenderName:
              (typeof msg?.senderName === "string" && msg.senderName.trim()) ||
              (typeof msg?.pushName === "string" && msg.pushName.trim()) ||
              null,
            remoteSenderPhone,
            remoteSenderAvatarUrl:
              (typeof msg?.senderProfilePic === "string" && msg.senderProfilePic.trim()) || null,
            remoteSenderIsAdmin: null,
            repliedMessageId: null,
            createdAt: createdAtIso,
          });
        } catch (error) {
          console.warn("[WAHA][sync] insert message failed", {
            chatId: ensuredChatId,
            externalId,
            error,
          });
        }
      }
    }

    if (avatarTasks.length) {
      await Promise.allSettled(avatarTasks);
    }
  }
}

async function syncWahaAfterLogin(authUserId: string): Promise<void> {
  if (!WAHA_SYNC_ENABLED) {
    console.warn("[WAHA][sync] disabled by config (WAHA_SYNC_ENABLED=false)");
    return;
  }
  try {
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (userErr) {
      console.warn("[WAHA][sync] failed to resolve company for user", { authUserId, error: userErr });
      return;
    }
    const companyId = userRow?.company_id;
    if (!companyId) return;

    const { data: inboxRows, error: inboxErr } = await supabaseAdmin
      .from("inboxes")
      .select("id, company_id, instance_id")
      .eq("company_id", companyId)
      .eq("provider", WAHA_PROVIDER);
    if (inboxErr) {
      console.warn("[WAHA][sync] failed to load inboxes for company", { companyId, error: inboxErr });
      return;
    }
    const validInboxes = (inboxRows || []).filter(
      (inbox): inbox is WahaInboxRecord =>
        typeof inbox.instance_id === "string" && inbox.instance_id.trim().length > 0,
    );
    if (!validInboxes.length) return;

    await syncWahaChatsForInboxes(validInboxes);
  } catch (error) {
    console.warn("[WAHA][sync] unexpected failure during login sync", { authUserId, error });
  }
}

// ===== Auth middleware =====
async function requireAuth(req: any, res: any, next: any) {
  // pega token do cookie httpOnly ou do header Authorization
  const bearer = (req.headers.authorization ?? "") as string;
  let token = bearer.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  if (!token) token = req.cookies[JWT_COOKIE_NAME];

  if (!token) return res.status(401).json({ error: "Not authenticated" });

  // valida token com Supabase
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user)
    return res.status(401).json({ error: "Invalid token" });

  req.user = data.user;
  next();
}

// ===== Rotas de Auth =====
app.post("/signup", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password)
    return res.status(400).json({ error: "Email e senha s o obrigatórios" });

  const { data, error } = await supabaseAnon.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json({ ok: true, user: data.user });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password)
    return res.status(400).json({ error: "Email e senha s o obrigatórios" });

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data?.session)
    return res.status(401).json({ error: "Credenciais inv lidas" });

  const accessToken = data.session.access_token;

  // seta cookie httpOnly para requests subsequentes
  res.cookie(JWT_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: JWT_COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  });

  if (data.user?.id) {
    if (WAHA_SYNC_ENABLED) {
      void syncWahaAfterLogin(data.user.id).catch((error) =>
        console.error("[WAHA][sync] login trigger failed", error),
      );
    }
  }

  return res.json({ ok: true, user: data.user });
});

app.post("/logout", (_req, res) => {
  res.clearCookie(JWT_COOKIE_NAME, { path: "/" });
  return res.json({ ok: true });
});

app.get("/auth/me", requireAuth, (req: any, res) => {
  // devolve o que as rotas /agents e /integrations usam: company_id no user
  res.json({ user: { id: req.user.id, email: req.user.email, company_id: req.user.company_id } });
});

// ===== Queue test/example routes =====
// Enfileira abertura de chat (worker processa)
app.post("/queue/livechat/start-chat", requireAuth, async (req: any, res) => {
  try {
    const { leadId, inboxId } = req.body ?? {};
    if (!leadId || !inboxId) {
      return res.status(400).json({ error: "leadId e inboxId obrigatórios" });
    }

    // Publica no exchange do app usando a routing key já bindada
    await publish(EX_APP, "outbound.request", {
      leadId,
      inboxId,
      jobType: "livechat.startChat",
      attempt: 0,
    });

    return res.status(202).json({ queued: true });
  } catch (e: any) {
    console.error("[queue] publish error:", e);
    return res.status(500).json({ error: e?.message || "queue publish error" });
  }
});

// ===== Calend?rio (calendars/events) =====
const VIEW_USER_AGENDA = process.env.VIEW_USER_AGENDA || "user_agenda";
const VIEW_EVENTS_WITH_PARTICIPANTS =
  process.env.VIEW_EVENTS_WITH_PARTICIPANTS || "events_with_participants";
const TABLE_CALENDARS = process.env.TABLE_CALENDARS || "calendars";
const TABLE_EVENTS = process.env.TABLE_EVENTS || "events";
const TABLE_EVENT_PARTICIPANTS =
  process.env.TABLE_EVENT_PARTICIPANTS || "event_participants";

// GET calendars do usu?rio (owner)
app.get("/calendar/calendars", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    // Map auth user -> local users.id
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const ownerId = (urow as any)?.id || null;
    if (!ownerId) return res.json([]);

    const { data, error } = await supabaseAdmin
      .from(TABLE_CALENDARS)
      .select("*")
      .eq("owner_id", ownerId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Calendars list error" });
  }
});

// GET eventos pela janela de datas (interse??o)
// Query params: start, end (ISO strings)
app.get("/calendar/events", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const start = String(req.query.start || "").trim();
    const end = String(req.query.end || "").trim();
    if (!start || !end)
      return res.status(400).json({ error: "start e end obrigat?rios (ISO)" });

    let items: any[] = [];
    let viewFailed = false;
    try {
      const { data, error } = await supabaseAdmin
        .from(VIEW_USER_AGENDA)
        .select("*")
        .eq("user_id", userId)
        .lt("start_time", end)
        .gt("end_time", start)
        .order("start_time", { ascending: true });
      if (error) throw error;
      items = (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        start: e.start_time,
        end: e.end_time,
        backgroundColor: e.calendar_color || undefined,
        extendedProps: {
          description: e.description,
          event_type: e.event_type,
          status: e.status,
          location: e.location,
          calendar_name: e.calendar_name,
          calendar_color: e.calendar_color,
          user_id: e.user_id,
          is_organizer: e.is_organizer,
          customer_name: e.customer_name,
          lead_name: e.lead_name,
        },
        raw: e,
      }));
    } catch (e) {
      viewFailed = true;
    }

    if (viewFailed) {
      const { data: evs, error: errEv } = await supabaseAdmin
        .from(TABLE_EVENTS)
        .select(
          "id, title, description, location, event_type, status, start_time, end_time, calendar_id, customer_id",
        )
        .lt("start_time", end)
        .gt("end_time", start)
        .eq("created_by_id", userId)
        .order("start_time", { ascending: true });
      if (errEv) return res.status(500).json({ error: errEv.message });
      const cids = Array.from(
        new Set(
          ((evs as any[]) || [])
            .map((r) => (r as any).calendar_id)
            .filter(Boolean),
        ),
      );
      let cmap: Record<string, { name: string | null; color: string | null }> =
        {};
      if (cids.length > 0) {
        const { data: cals } = await supabaseAdmin
          .from(TABLE_CALENDARS)
          .select("id, name, color")
          .in("id", cids);
        cmap = Object.fromEntries(
          ((cals as any[]) || []).map((c) => [
            (c as any).id,
            { name: (c as any).name || null, color: (c as any).color || null },
          ]),
        );
      }
      items = ((evs as any[]) || []).map((e: any) => {
        const cal = cmap[(e as any).calendar_id] || {};
        return {
          id: e.id,
          title: e.title,
          start: e.start_time,
          end: e.end_time,
          backgroundColor: (cal as any).color || undefined,
          extendedProps: {
            description: e.description,
            event_type: e.event_type,
            status: e.status,
            location: e.location,
            calendar_name: (cal as any).name || null,
            calendar_color: (cal as any).color || null,
            user_id: userId,
            is_organizer: true,
          },
          raw: e,
        };
      });
    }

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Events list error" });
  }
});

// Valida disponibilidade simples chamando fun??o RPC is_user_available_simple
async function checkAvailability(
  userId: string,
  startISO: string,
  endISO: string,
) {
  const { data, error } = await (supabaseAdmin as any).rpc(
    "is_user_available_simple",
    {
      p_user_id: userId,
      p_start_time: startISO,
      p_end_time: endISO,
    },
  );
  if (error) throw new Error(error.message);
  return Boolean(data);
}

// POST criar evento + participantes
app.post("/calendar/events", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      event_type: z
        .enum(["MEETING", "CALL", "TECHNICAL_VISIT", "FOLLOW_UP", "OTHER"])
        .optional(),
      status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
      start_time: z.string().min(1), // ISO
      end_time: z.string().min(1), // ISO
      calendar_id: z.string().uuid(),
      participant_ids: z.array(z.string().uuid()).optional().default([]),
      customer_id: z.string().uuid().optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.message });
    const payload = parsed.data;

    if (new Date(payload.end_time) <= new Date(payload.start_time)) {
      return res
        .status(400)
        .json({ error: "end_time deve ser maior que start_time" });
    }

    // checa disponibilidade do criador e participantes
    const participantsAll = Array.from(
      new Set([userId, ...payload.participant_ids]),
    );
    const availabilityResults: Record<string, boolean> = {};
    for (const uid of participantsAll) {
      availabilityResults[uid] = await checkAvailability(
        uid,
        payload.start_time,
        payload.end_time,
      );
    }
    const busy = Object.entries(availabilityResults)
      .filter(([, ok]) => !ok)
      .map(([uid]) => uid);
    if (busy.length > 0) {
      return res.status(409).json({
        error: "Usu?rios indispon?veis para o intervalo",
        busy_user_ids: busy,
      });
    }

    // cria evento
    const eventInsert: any = {
      title: payload.title,
      description: payload.description ?? null,
      location: payload.location ?? null,
      event_type: payload.event_type ?? "OTHER",
      status: payload.status ?? "SCHEDULED",
      start_time: payload.start_time,
      end_time: payload.end_time,
      is_all_day: false,
      calendar_id: payload.calendar_id,
      created_by_id: userId,
      customer_id: payload.customer_id ?? null,
    };
    const { data: ev, error: evErr } = await supabaseAdmin
      .from(TABLE_EVENTS)
      .insert(eventInsert)
      .select("*")
      .single();
    if (evErr) return res.status(500).json({ error: evErr.message });

    // participantes: criador como organizer + demais
    const rows = [
      { event_id: ev.id, user_id: userId, is_organizer: true },
      ...payload.participant_ids
        .filter((uid) => uid !== userId)
        .map((uid) => ({ event_id: ev.id, user_id: uid, is_organizer: false })),
    ];
    if (rows.length > 0) {
      const { error: pErr } = await supabaseAdmin
        .from(TABLE_EVENT_PARTICIPANTS)
        .insert(rows);
      if (pErr) return res.status(500).json({ error: pErr.message });
    }

    return res.status(201).json(ev);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Create event error" });
  }
});

// PUT atualizar evento
app.put("/calendar/events/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params as { id: string };
    const schema = z.object({
      title: z.string().optional(),
      description: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      event_type: z
        .enum(["MEETING", "CALL", "TECHNICAL_VISIT", "FOLLOW_UP", "OTHER"])
        .optional(),
      status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      is_all_day: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.message });

    const patch = parsed.data as any;
    if (patch.start_time && patch.end_time) {
      if (new Date(patch.end_time) <= new Date(patch.start_time)) {
        return res
          .status(400)
          .json({ error: "end_time deve ser maior que start_time" });
      }
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE_EVENTS)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Update event error" });
  }
});

// DELETE evento
app.delete("/calendar/events/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params as { id: string };
    const { error } = await supabaseAdmin
      .from(TABLE_EVENTS)
      .delete()
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Delete event error" });
  }
});

// GET disponibilidade simples
app.get("/calendar/availability", requireAuth, async (req: any, res) => {
  try {
    const userId = (req.query.user_id as string) || req.user.id;
    const start = String(req.query.start || "").trim();
    const end = String(req.query.end || "").trim();
    if (!userId || !start || !end)
      return res
        .status(400)
        .json({ error: "user_id, start, end obrigat?rios" });
    const available = await checkAvailability(userId, start, end);
    return res.json({ user_id: userId, available });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Availability error" });
  }
});

// ===== Produtos =====
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || "products";

// GET listar produtos (suporta pagina??o e filtros)
app.get("/products", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const status = (req.query.status as string | undefined)?.trim();
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    let query = supabaseAdmin
      .from(PRODUCTS_TABLE)
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false });

    if (q) {
      // filtro por nome (ilike)
      query = query.ilike("name", `%${q}%`);
    }
    if (status && status.toLowerCase() !== "all") {
      query = query.eq("status", status);
    }

    if (typeof limit === "number" && typeof offset === "number") {
      // Supabase usa range inclusivo
      query = query.range(offset, offset + Math.max(0, limit - 1));
    }

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [], total: count ?? (data?.length || 0) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Products list error" });
  }
});

// POST criar produto
app.post("/products", requireAuth, async (req, res) => {
  try {
    const schema = z
      .object({
        external_id: z.string().optional(),
        name: z.string().min(1),
        unit: z.string().nullable().optional(),
        cost_price: z.union([z.number(), z.string()]).nullable().optional(),
        sale_price: z.union([z.number(), z.string()]).nullable().optional(),
        brand: z.string().nullable().optional(),
        grouping: z.string().nullable().optional(),
        power: z.string().nullable().optional(),
        size: z.string().nullable().optional(),
        supplier: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        specs: z.string().nullable().optional(),
      })
      .passthrough();

    const parseMoney = (v: any): number | null => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "number") return v;
      if (typeof v !== "string") return null;
      const s = v
        .replace(/./g, "")
        .replace(/,/, ".")
        .replace(/[^0-9.-]/g, "");
      const n = Number(s);
      return isNaN(n) ? null : n;
    };

    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.message });

    const payload: any = { ...parsed.data };
    if (payload.cost_price !== undefined)
      payload.cost_price = parseMoney(payload.cost_price);
    if (payload.sale_price !== undefined)
      payload.sale_price = parseMoney(payload.sale_price);

    const { data, error } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .insert([payload])
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Create product error" });
  }
});

// PUT atualizar produto por id
app.put("/products/:id", requireAuth, async (req, res) => {
  const { id } = req.params as { id: string };

  const schema = z
    .object({
      external_id: z.string().optional(),
      name: z.string().optional(),
      unit: z.string().nullable().optional(),
      cost_price: z.union([z.number(), z.string()]).nullable().optional(),
      sale_price: z.union([z.number(), z.string()]).nullable().optional(),
      brand: z.string().nullable().optional(),
      grouping: z.string().nullable().optional(),
      power: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      supplier: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      specs: z.string().nullable().optional(),
    })
    .passthrough();

  const parseMoney = (v: any): number | null => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    if (typeof v !== "string") return null;
    const s = v
      .replace(/./g, "")
      .replace(/,/, ".")
      .replace(/[^0-9.-]/g, "");
    const n = Number(s);
    return isNaN(n) ? null : n;
  };

  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.message });

  const payload: any = { ...parsed.data };
  if (payload.cost_price !== undefined)
    payload.cost_price = parseMoney(payload.cost_price);
  if (payload.sale_price !== undefined)
    payload.sale_price = parseMoney(payload.sale_price);
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// DELETE produto por id
app.delete("/products/:id", requireAuth, async (req, res) => {
  const { id } = req.params as { id: string };
  const { error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .delete()
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});

// POST upsert em massa de produtos
app.post("/products/bulk-upsert", requireAuth, async (req, res) => {
  const items = (req.body || []) as any[];
  if (!Array.isArray(items))
    return res.status(400).json({ error: "Body deve ser array" });

  const schema = z.object({
    external_id: z.string().min(1),
    name: z.string().min(1),
    unit: z.string().optional().nullable(),
    cost_price: z.union([z.number(), z.string()]).optional().nullable(),
    sale_price: z.union([z.number(), z.string()]).optional().nullable(),
    brand: z.string().optional().nullable(),
    grouping: z.string().optional().nullable(),
    power: z.string().optional().nullable(),
    size: z.string().optional().nullable(),
    supplier: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    specs: z.string().optional().nullable(),
  });

  const parseMoney = (v: any): number | null => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    if (typeof v !== "string") return null;
    const s = v
      .replace(/./g, "")
      .replace(/,/, ".")
      .replace(/[^0-9.-]/g, "");
    const n = Number(s);
    return isNaN(n) ? null : n;
  };

  const toUpsert = [] as any[];
  for (const raw of items) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Item inválido", details: parsed.error.format() });
    }
    const r = parsed.data as any;
    toUpsert.push({
      external_id: String(r.external_id),
      name: r.name,
      unit: r.unit ?? null,
      cost_price: parseMoney(r.cost_price),
      sale_price: parseMoney(r.sale_price),
      brand: r.brand ?? null,
      grouping: r.grouping ?? null,
      power: r.power ?? null,
      size: r.size ?? null,
      supplier: r.supplier ?? null,
      status: r.status ?? null,
      specs: r.specs ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  const { data, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .upsert(toUpsert, { onConflict: "external_id" })
    .select("*");

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ upserted: data?.length || 0 });
});


const io = new SocketIOServer(server, {
  cors: {
    origin: FRONTEND_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,              // <- importante para withCredentials
  }
});

app.locals.io = io;
setIO(io);
startSocketRelay(io);

io.on("connection", (socket) => {
  console.log("[RT] client connected:", socket.id);

  socket.on("join", (payload: { chatId?: string }) => {
    const chatId = payload?.chatId;
    if (chatId) {
      socket.join(`chat:${chatId}`);
      console.log("[RT] socket joined chat", { socketId: socket.id, chatId });
    }
  });

  socket.on("leave", (payload: { chatId?: string }) => {
    const chatId = payload?.chatId;
    if (chatId) {
      socket.leave(`chat:${chatId}`);
      console.log("[RT] socket left chat", { socketId: socket.id, chatId });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("[RT] client disconnected:", socket.id, reason);
  });
});

// Perfil do Usuário autenticado + dados b?sicos da empresa
app.get("/me/profile", requireAuth, async (req: any, res) => {
  const userId = req.user.id;
  // Tenta obter linha em public.users
  const { data: urow, error: uerr } = await supabaseAdmin
    .from("users")
    .select("user_id, name, role, avatar, company_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (uerr) return res.status(500).json({ error: uerr.message });

  let companyName: string | null = null;
  // Opcional: tenta buscar nome da empresa, ignora se a tabela n?o existir
  try {
    if (urow?.company_id) {
      const { data: comp, error: cerr } = await supabaseAdmin
        .from("companies")
        .select("id, name, avatar")
        .eq("id", urow.company_id)
        .maybeSingle();
      if (!cerr) companyName = (comp as any)?.name ?? null;
    }
  } catch (_) {
    // ignora
  }

  return res.json({
    id: req.user.id,
    email: req.user.email,
    name: urow?.name || req.user.email,
    role: urow?.role || null,
    avatarUrl: urow?.avatar || null,
    companyId: urow?.company_id || null,
    companyName,
  });
});

// Update authenticated user's profile (name/avatar/password)
app.put("/me/profile", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    const authEmail = req.user.email as string;
    const schema = z
      .object({
        name: z.string().min(1).optional(),
        avatarUrl: z.string().url().optional(),
        currentPassword: z.string().optional(),
        newPassword: z.string().optional(),
        confirmPassword: z.string().optional(),
      })
      .passthrough();
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Dados inv?lidos", details: parsed.error.format() });
    const body = parsed.data as any;

    const nowIso = new Date().toISOString();
    let updatedRow: any = null;
    const toUpdate: Record<string, any> = {};
    if (typeof body.name === "string") toUpdate.name = body.name;
    if (typeof body.avatarUrl === "string") toUpdate.avatar = body.avatarUrl;
    if (Object.keys(toUpdate).length > 0) {
      toUpdate.updated_at = nowIso;
      const { data, error } = await supabaseAdmin
        .from("users")
        .update(toUpdate)
        .eq("user_id", authUserId)
        .select("user_id, name, role, avatar, company_id")
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      updatedRow = data;
    }

    let passwordChanged = false;
    const hasPwChange =
      typeof body.newPassword === "string" && body.newPassword.length > 0;
    if (hasPwChange) {
      if (!body.currentPassword)
        return res.status(400).json({ error: "Senha atual ? obrigat?ria" });
      if (body.newPassword !== body.confirmPassword)
        return res
          .status(400)
          .json({ error: "Confirma??o de senha n?o confere" });
      // Validate current password by trying to sign in
      const { data: login, error: loginErr } =
        await supabaseAnon.auth.signInWithPassword({
          email: authEmail,
          password: String(body.currentPassword),
        });
      if (loginErr || !login?.session)
        return res.status(400).json({ error: "Senha atual inv?lida" });
      // Update password using admin
      const { error: upwErr } = await (
        supabaseAdmin as any
      ).auth.admin.updateUserById(authUserId, {
        password: String(body.newPassword),
      });
      if (upwErr) return res.status(500).json({ error: upwErr.message });
      passwordChanged = true;
    }

    const resp = {
      id: authUserId,
      email: authEmail,
      name: updatedRow?.name ?? req.user.email,
      role: updatedRow?.role ?? null,
      avatarUrl: updatedRow?.avatar ?? null,
      companyId: updatedRow?.company_id ?? null,
      passwordChanged,
    };

    try {
      io.emit("profile:updated", {
        userId: authUserId,
        changes: { name: toUpdate.name, avatarUrl: toUpdate.avatar },
        profile: resp,
      });
    } catch { }
    return res.json(resp);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "profile update error" });
  }
});

// ===== Rotas de Leads (exemplo CRUD) =====
// Ajuste nomes de colunas conforme sua tabela "Lead"

type LeadForm = {
  tipoPessoa?: string;
  cpf?: string;
  nome?: string;
  rg?: string;
  orgao?: string;
  dataNascimento?: string;
  mae?: string;
  pai?: string;
  sexo?: string;
  naturalidade?: string;
  estadoCivil?: string;
  conjuge?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  uf?: string;
  cidade?: string;
  celular?: string;
  celularAlternativo?: string;
  telefone?: string;
  telefoneAlternativo?: string;
  email?: string;
  site?: string;
  observacoes?: string;
  status?: string;
  // suporte para etapa/coluna do kanban
  etapa?: string; // alias amig?vel no front
  kanban_column_id?: string; // id da coluna do kanban
};

export function mapLead(form: LeadForm) {
  return {
    personType: form.tipoPessoa ?? null,
    phone: form.telefone,
    cpf: form.cpf ?? null,
    name: form.nome,
    rg: form.rg ?? null,
    rgOrgao: form.orgao ?? null,
    birthDate: form.dataNascimento
      ? new Date(form.dataNascimento).toISOString()
      : null,
    mother: form.mae ?? null,
    father: form.pai ?? null,
    gender: form.sexo ?? null,
    birthPlace: form.naturalidade ?? null,
    maritalStatus: form.estadoCivil ?? null,
    spouse: form.conjuge ?? null,
    cep: form.cep ?? null,
    street: form.rua ?? null,
    number: form.numero ?? null,
    complement: form.complemento ?? null,
    neighborhood: form.bairro ?? null,
    state: form.uf ?? null,
    city: form.cidade ?? null,
    cellphone: form.celular ?? null,
    altCellphone: form.celularAlternativo ?? null,
    telephone: form.telefone ?? null,
    altTelephone: form.telefoneAlternativo ?? null,
    email: form.email ?? null,
    site: form.site ?? null,
    notes: form.observacoes ?? null,
    statusClient: form.status ?? "Ativo",
    // persiste a etapa do kanban quando enviado pelo front (coluna ?nica)
    kanban_column_id: (form.kanban_column_id || form.etapa) ?? null,
  };
}

// LISTAR
app.get("/leads", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const mapped = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    cpf: r.cpf,
    email: r.email,
    status: r.status_client ?? r.status,
    // exp?e a coluna/etapa do kanban para o front
    kanban_column_id: r.kanban_column_id,

    tipoPessoa: r.person_type,
    rg: r.rg,
    orgao: r.rg_orgao,
    dataNascimento: r.birth_date,
    mae: r.mother,
    pai: r.father,
    sexo: r.gender,
    naturalidade: r.birth_place,
    estadoCivil: r.marital_status,
    conjuge: r.spouse,

    cep: r.cep,
    rua: r.street,
    numero: r.number,
    complemento: r.complement,
    bairro: r.neighborhood,
    uf: r.state,
    cidade: r.city,

    celular: r.cellphone,
    celularAlternativo: r.alt_cellphone,
    telefone: r.telephone,
    telefoneAlternativo: r.alt_telephone,

    site: r.site,
    observacoes: r.notes,

    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return res.json(mapped);
});

// Get lead by id (minimal fields needed for receipts)
app.get("/leads/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params as { id: string };
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, name, email, phone, cpf, rg, city, state")
      .eq("id", id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Lead n o encontrado" });
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "leads get error" });
  }
});

// Get minimal lead by customer_id (useful when proposal doesn't store lead_id)
app.get(
  "/leads/by-customer/:customerId",
  requireAuth,
  async (req: any, res) => {
    try {
      const { customerId } = req.params as { customerId: string };

      const selectColumns =
        "id, name, email, phone, cpf, rg, city, state, customer_id, kanban_column_id";

      const { data: leadByCustomer, error: leadByCustomerErr } =
        await supabaseAdmin
          .from("leads")
          .select(selectColumns)
          .eq("customer_id", customerId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (leadByCustomerErr) {
        return res.status(500).json({ error: leadByCustomerErr.message });
      }
      if (leadByCustomer) {
        return res.json(leadByCustomer);
      }

      const { data: leadById, error: leadByIdErr } = await supabaseAdmin
        .from("leads")
        .select(selectColumns)
        .eq("id", customerId)
        .maybeSingle();

      if (leadByIdErr) {
        return res.status(500).json({ error: leadByIdErr.message });
      }
      if (leadById) {
        return res.json(leadById);
      }

      const { data: customer, error: customerErr } = await supabaseAdmin
        .from("customers")
        .select("id, name, email, phone")
        .eq("id", customerId)
        .maybeSingle();

      if (customerErr) {
        return res.status(500).json({ error: customerErr.message });
      }
      if (customer) {
        return res.json({
          id: customer.id,
          customer_id: customer.id,
          name: customer.name,
          email: (customer as any).email || null,
          phone: (customer as any).phone || null,
        });
      }

      return res.json(null);
    } catch (e: any) {
      return res
        .status(500)
        .json({ error: e?.message || "leads by customer error" });
    }
  },
);

// CRIAR
app.post("/leads", requireAuth, async (req, res) => {
  const payload = mapLead(req.body);
  if (!payload.name)
    return res.status(400).json({ error: "Campo 'nome'   obrigatório" });

  const leadSchema = z
    .object({
      nome: z.string().min(1),
      cpf: z
        .string()
        .regex(/^d{11}$/, "CPF inválido")
        .optional(),
      cep: z
        .string()
        .regex(/^d{8}$/, "CEP inválido")
        .optional(),
      uf: z.string().max(2).optional(),
      email: z.string().email().optional(),
      telefone: z.string().max(11).optional(),
      celular: z.string().max(11).optional(),
      numero: z.string().max(10).optional(),
      dataNascimento: z.string().optional(), // voc? pode validar ISO aqui tamb?m
    })
    .passthrough();

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert([payload])
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// ATUALIZAR
app.put("/leads/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const payload = mapLead(req.body);
  const { data, error } = await supabaseAdmin
    .from("leads")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  const leadSchema = z
    .object({
      nome: z.string().min(1),
      cpf: z
        .string()
        .regex(/^d{11}$/, "CPF inválido")
        .optional(),
      cep: z
        .string()
        .regex(/^d{8}$/, "CEP inválido")
        .optional(),
      uf: z.string().max(2).optional(),
      email: z.string().email().optional(),
      telefone: z.string().max(11).optional(),
      celular: z.string().max(11).optional(),
      numero: z.string().max(10).optional(),
      dataNascimento: z.string().optional(), // voc? pode validar ISO aqui tamb?m
    })
    .passthrough();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// APAGAR
app.delete("/leads/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("leads").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});


// GET /livechat/inboxes/:id/agents (revisado)
app.get("/livechat/inboxes/:id/agents", requireAuth, async (req: any, res) => {
  try {
    const inboxId = String(req.params?.id || "").trim();
    console.log("[INBOX/AGENTS] params.id =", inboxId);

    // 0) valida param
    if (!inboxId) return res.status(400).json({ error: "inboxId ausente" });
    // (opcional) valida formato UUID v4
    if (!/^[0-9a-f-]{32,36}$/i.test(inboxId)) {
      return res.status(400).json({ error: "inboxId inválido" });
    }

    // 1) garante que a inbox existe e pega company_id
    const { data: inboxRow, error: errInbox } = await supabaseAdmin
      .from("inboxes")
      .select("id, company_id, is_active, name")
      .eq("id", inboxId)
      .maybeSingle();
    if (errInbox) return res.status(500).json({ error: errInbox.message });
    if (!inboxRow) return res.status(404).json({ error: "Inbox não encontrada" });
    if (inboxRow.is_active === false) {
      return res.status(403).json({ error: "Inbox inativa" });
    }

    const authUserId = req.user?.id;
    console.log("[INBOX/AGENTS] auth user =", authUserId);

    // 2) resolve usuário local
    let localUserId: string | null = null;
    let userCompanyId: string | null = null;

    // tenta por users.user_id (id externo do auth)
    const { data: uByExt } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (uByExt?.id) {
      localUserId = uByExt.id;
      userCompanyId = uByExt.company_id || null;
    } else {
      // tenta se req.user.id já for o UUID local
      const { data: uByLocal } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("id", authUserId)
        .maybeSingle();
      if (uByLocal?.id) {
        localUserId = uByLocal.id;
        userCompanyId = uByLocal.company_id || null;
      }
    }

    console.log("[INBOX/AGENTS] localUserId =", localUserId, "userCompanyId =", userCompanyId);

    // 3) autorização:
    // 3a) se conhecer o localUserId, checa link direto na inbox
    let allowed = false;
    if (localUserId) {
      const { data: myLink } = await supabaseAdmin
        .from("inbox_users")
        .select("id")
        .eq("inbox_id", inboxId)
        .eq("user_id", localUserId)
        .maybeSingle();
      allowed = !!myLink;
      console.log("[INBOX/AGENTS] allowed by link? ", allowed);
    }

    // 3b) se não tiver link, mas a company do user bater com a da inbox, permite (fallback)
    if (!allowed && userCompanyId && userCompanyId === inboxRow.company_id) {
      allowed = true;
      console.log("[INBOX/AGENTS] allowed by company");
    }

    if (!allowed) {
      return res.status(403).json({ error: "Sem acesso a esta inbox" });
    }

    // 4) carrega agentes vinculados à inbox
    const { data: links, error: errLinks } = await supabaseAdmin
      .from("inbox_users")
      .select("id, user_id")
      .eq("inbox_id", inboxId);
    if (errLinks) return res.status(500).json({ error: errLinks.message });

    const userIds = Array.from(new Set((links || []).map((r: any) => r.user_id).filter(Boolean)));
    let users: any[] = [];
    if (userIds.length > 0) {
      const { data: rows, error: errUsers } = await supabaseAdmin
        .from("users")
        .select("id, user_id, name, role, avatar")
        .in("id", userIds)
        .order("name", { ascending: true });
      if (errUsers) return res.status(500).json({ error: errUsers.message });
      users = rows || [];
    }

    const byId: Record<string, any> = Object.fromEntries(users.map((u: any) => [u.id, u]));
    const result = (links || []).map((link: any) => {
      const u = byId[link.user_id] || {};
      return {
        id: link.id,                // inbox_users.id
        user_id: u.id || link.user_id,
        name: u.name || u.id || null,
        role: u.role || null,
        avatar: u.avatar || null,
      };
    });

    return res.json({ ok: true, inbox: { id: inboxRow.id, name: inboxRow.name }, data: result });
  } catch (e: any) {
    console.error("[GET /livechat/inboxes/:id/agents] error:", e);
    return res.status(500).json({ error: e?.message || "agents error" });
  }
});

app.put("/livechat/chats/:id/assignee", requireAuth, async (req: any, res) => {
  try {
    const chatId = String(req.params.id);
    const { linkId: linkIdParam, userId: userIdParam, unassign } = req.body || {};
    const io = req.app?.locals?.io;

    // 1) Carrega o chat e inbox
    const { data: chat, error: errChat } = await supabaseAdmin
      .from("chats")
      .select("id, inbox_id")
      .eq("id", chatId)
      .maybeSingle();
    if (errChat) return res.status(500).json({ error: errChat.message });
    if (!chat) return res.status(404).json({ error: "Chat não encontrado" });

    // 2) Resolve usuário atuante (local users.id) e checa permissão na inbox
    const authUserId = req.user?.id;
    let actingLocalUserId: string | null = null;

    // tenta mapear por users.user_id (id externo)
    const { data: uExt } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uExt?.id) actingLocalUserId = uExt.id;

    // fallback: talvez req.user.id já seja users.id
    if (!actingLocalUserId) {
      const { data: uLoc } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", authUserId)
        .maybeSingle();
      if (uLoc?.id) actingLocalUserId = uLoc.id;
    }

    if (actingLocalUserId) {
      const { data: linkAct } = await supabaseAdmin
        .from("inbox_users")
        .select("can_write, can_manage")
        .eq("inbox_id", (chat as any).inbox_id)
        .eq("user_id", actingLocalUserId)
        .maybeSingle();
      if (!linkAct || (!linkAct.can_write && !linkAct.can_manage)) {
        return res.status(403).json({ error: "Sem permissão para atribuir nesta inbox" });
      }
    }

    // 3) Remover atribuição
    if (unassign === true) {
      const { error: errUpd } = await supabaseAdmin
        .from("chats")
        .update({ assignee_agent: null })
        .eq("id", chatId);
      if (errUpd) return res.status(500).json({ error: errUpd.message });

      try {
        io?.emit("chat:updated", {
          chatId,
          assigned_agent_id: null,
          assigned_agent_name: null,
        });
      } catch {}
      return res.json({ ok: true, assigned_agent_id: null, assigned_agent_name: null });
    }

    // 4) Resolver o link alvo (inbox_users.id) a partir de linkId ou userId
    let targetLinkId: string | null = null;

    if (linkIdParam) {
      // valida se pertence à mesma inbox
      const { data: linkRow } = await supabaseAdmin
        .from("inbox_users")
        .select("id, user_id, inbox_id")
        .eq("id", String(linkIdParam))
        .maybeSingle();
      if (!linkRow) return res.status(404).json({ error: "Link não encontrado" });
      if (linkRow.inbox_id !== (chat as any).inbox_id)
        return res.status(400).json({ error: "Link não pertence à inbox do chat" });

      targetLinkId = linkRow.id;
    } else if (userIdParam) {
      // aceita tanto users.id quanto users.user_id
      let localUserId: string | null = null;
      const { data: u1 } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", String(userIdParam))
        .maybeSingle();
      if (u1?.id) localUserId = u1.id;

      if (!localUserId) {
        const { data: u2 } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("user_id", String(userIdParam))
          .maybeSingle();
        if (u2?.id) localUserId = u2.id;
      }

      if (!localUserId) return res.status(404).json({ error: "Usuário alvo não encontrado" });

      const { data: linkRow } = await supabaseAdmin
        .from("inbox_users")
        .select("id, user_id, inbox_id")
        .eq("inbox_id", (chat as any).inbox_id)
        .eq("user_id", localUserId)
        .maybeSingle();
      if (!linkRow) return res.status(400).json({ error: "Usuário não vinculado a esta inbox" });

      targetLinkId = linkRow.id;
    } else {
      return res.status(400).json({ error: "linkId ou userId é obrigatório" });
    }

    // 5) Atualiza o chat
    const { error: errUpdate } = await supabaseAdmin
      .from("chats")
      .update({ assignee_agent: targetLinkId })
      .eq("id", chatId);
    if (errUpdate) return res.status(500).json({ error: errUpdate.message });

    // 6) Retorna nome do agente
    let assignedName: string | null = null;
    try {
      const { data: linkRow } = await supabaseAdmin
        .from("inbox_users")
        .select("user_id")
        .eq("id", targetLinkId!)
        .maybeSingle();
      if (linkRow?.user_id) {
        const { data: u } = await supabaseAdmin
          .from("users")
          .select("name")
          .eq("id", linkRow.user_id)
          .maybeSingle();
        assignedName = (u as any)?.name || null;
      }
    } catch {}

    try {
      io?.emit("chat:updated", {
        chatId,
        assigned_agent_id: targetLinkId,
        assigned_agent_name: assignedName,
      });
    } catch {}

    return res.json({
      ok: true,
      assigned_agent_id: targetLinkId,
      assigned_agent_name: assignedName,
    });
  } catch (e: any) {
    console.error("[PUT /livechat/chats/:id/assignee] error:", e);
    return res.status(500).json({ error: e?.message || "assignee error" });
  }
});



// ===== Live Chat =====
// Inboxes do usu?rio autenticado
app.get("/livechat/inboxes/my", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;

    // Primeiro tenta direto com auth.user.id (caso inbox_users.user_id armazene o auth id)
    let { data: links, error: errLinks } = await supabaseAdmin
      .from("inbox_users")
      .select("inbox_id")
      .eq("user_id", authUserId);
    if (errLinks) return res.status(500).json({ error: errLinks.message });

    // Fallback: alguns esquemas armazenam o id local de public.users (PK) em inbox_users.user_id
    if (!links || links.length === 0) {
      try {
        const { data: urow } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("user_id", authUserId)
          .maybeSingle();
        if (urow?.id) {
          const resp2 = await supabaseAdmin
            .from("inbox_users")
            .select("inbox_id")
            .eq("user_id", urow.id);
          if (!resp2.error) links = resp2.data as any[];
        }
      } catch { }
    }

    const ids = Array.from(
      new Set((links || []).map((r: any) => r.inbox_id)),
    ).filter(Boolean);
    if (ids.length === 0) return res.json([]);

    const { data, error } = await supabaseAdmin
      .from("inboxes")
      .select("id, name, phone_number, is_active, channel, provider, base_url, instance_id, waha_db_name")
      .in("id", ids)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    const rows = (data || []).map((row: any) => ({
      ...row,
      provider: row?.provider ?? "META_CLOUD",
      channel: row?.channel ?? null,
    }));
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "inboxes fetch error" });
  }
});

// List all inboxes of current user's company
app.get("/livechat/inboxes", requireAuth, async (req: any, res) => {
  try {
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("company_id, role")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id;
    if (!companyId)
      return res.status(404).json({ error: "Usu?rio sem company_id" });
    const { data, error } = await supabaseAdmin
      .from("inboxes")
      .select(
        "id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, waha_db_name",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "inboxes list error" });
  }
});

// Create a new inbox in current company
app.post("/livechat/inboxes", requireAuth, async (req: any, res) => {
  try {
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("company_id, role, id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id as string | null;
    if (!companyId)
      return res.status(404).json({ error: "Usu?rio sem company_id" });
    const actorLocalUserId = (urow as any)?.id || null;

    const schema = z.object({
      name: z.string().min(1),
      phone_number: z.string().min(5),
      webhook_url: z.string().url().optional().nullable(),
      channel: z.string().optional().default("WHATSAPP"),
      provider: z.string().optional().default("META_CLOUD"),
      base_url: z.string().url().optional().nullable(),
      api_version: z.string().optional().nullable(),
      phone_number_id: z.string().optional().nullable(),
      waba_id: z.string().optional().nullable(),
      instance_id: z.string().optional().nullable(),
      webhook_verify_token: z.string().optional().nullable(),
      app_secret: z.string().optional().nullable(),
      add_current_as_manager: z.boolean().optional().default(true),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Dados inv?lidos", details: parsed.error.format() });
    const b = parsed.data as any;

    const nowIso = new Date().toISOString();
    const insert = {
      name: b.name,
      phone_number: b.phone_number,
      webhook_url: b.webhook_url ?? null,
      channel: b.channel || "WHATSAPP",
      provider: b.provider || "META_CLOUD",
      base_url: b.base_url ?? null,
      api_version: b.api_version ?? null,
      phone_number_id: b.phone_number_id ?? null,
      waba_id: b.waba_id ?? null,
      instance_id: b.instance_id ?? null,
      company_id: companyId,
      created_at: nowIso,
      updated_at: nowIso,
    } as any;

    const { data: inbox, error } = await supabaseAdmin
      .from("inboxes")
      .insert([insert])
      .select(
        "id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, company_id, waha_db_name",
      )
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // secrets
    if (b.webhook_verify_token || b.app_secret) {
      await supabaseAdmin
        .from("inbox_secrets")
        .upsert(
          [
            {
              inbox_id: (inbox as any).id,
              access_token: null,
              refresh_token: null,
              provider_api_key: null,
              updated_at: nowIso,
            },
          ],
          { onConflict: "inbox_id" },
        );
      const patch: any = {};
      if (b.webhook_verify_token !== undefined)
        patch.webhook_verify_token = b.webhook_verify_token;
      if (b.app_secret !== undefined) patch.app_secret = b.app_secret;
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin
          .from("inboxes")
          .update(patch)
          .eq("id", (inbox as any).id);
      }
    }

    // link actor as manager
    try {
      if (b.add_current_as_manager && actorLocalUserId) {
        await supabaseAdmin
          .from("inbox_users")
          .upsert(
            [
              {
                user_id: actorLocalUserId,
                inbox_id: (inbox as any).id,
                can_read: true,
                can_write: true,
                can_manage: true,
              },
            ],
            { onConflict: "user_id,inbox_id" },
          );
      }
    } catch { }

    try {
      io.emit("inbox:created", { companyId, inbox });
    } catch { }
    return res.status(201).json(inbox);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "inbox create error" });
  }
});

// Update inbox settings (non-secret and selected secret-like fields stored on inbox)
app.put("/livechat/inboxes/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params as { id: string };
    // Load inbox and user for permission
    const { data: inbox, error: iErr } = await supabaseAdmin
      .from("inboxes")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();
    if (iErr) return res.status(500).json({ error: iErr.message });
    if (!inbox) return res.status(404).json({ error: "Inbox n?o encontrada" });
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("company_id, role, id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const sameCompany = (urow as any)?.company_id === (inbox as any).company_id;
    if (!sameCompany) return res.status(403).json({ error: "Proibido" });
    let allowed = false;
    const role = ((urow as any)?.role || "").toString().toUpperCase();
    if (role && role !== "AGENT") allowed = true;
    if (!allowed) {
      const { data: link } = await supabaseAdmin
        .from("inbox_users")
        .select("can_manage")
        .eq("inbox_id", id)
        .eq("user_id", (urow as any)?.id)
        .maybeSingle();
      if (link?.can_manage) allowed = true;
    }
    if (!allowed)
      return res
        .status(403)
        .json({ error: "Sem permiss?o para editar esta inbox" });

    const schema = z
      .object({
        name: z.string().min(1).optional(),
        phone_number: z.string().min(5).optional(),
        is_active: z.boolean().optional(),
        webhook_url: z.string().url().optional().nullable(),
        channel: z.string().optional(),
        provider: z.string().optional(),
        base_url: z.string().optional().nullable(),
        api_version: z.string().optional().nullable(),
        phone_number_id: z.string().optional().nullable(),
        waba_id: z.string().optional().nullable(),
        instance_id: z.string().optional().nullable(),
        webhook_verify_token: z.string().optional().nullable(),
        app_secret: z.string().optional().nullable(),
      })
      .passthrough();
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Dados inv?lidos", details: parsed.error.format() });
    const b = parsed.data as any;
    const update: any = {};
    const fields = [
      "name",
      "phone_number",
      "is_active",
      "webhook_url",
      "channel",
      "provider",
      "base_url",
      "api_version",
      "phone_number_id",
      "waba_id",
      "instance_id",
      "webhook_verify_token",
      "app_secret",
    ];
    for (const k of fields)
      if (Object.prototype.hasOwnProperty.call(b, k)) update[k] = b[k];
    update.updated_at = new Date().toISOString();
    if (Object.keys(update).length === 1)
      return res.status(400).json({ error: "Nada para atualizar" });
    const { data: updated, error } = await supabaseAdmin
      .from("inboxes")
      .update(update)
      .eq("id", id)
      .select(
        "id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, company_id, waha_db_name",
      )
      .single();
    if (error) return res.status(500).json({ error: error.message });
    try {
      io.emit("inbox:updated", {
        inboxId: id,
        companyId: (updated as any).company_id,
        changes: update,
        inbox: updated,
      });
    } catch { }
    return res.json(updated);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "inbox update error" });
  }
});

// Delete inbox
app.delete("/livechat/inboxes/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params as { id: string };
    const { data: inbox, error: inboxErr } = await supabaseAdmin
      .from("inboxes")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();
    if (inboxErr) return res.status(500).json({ error: inboxErr.message });
    if (!inbox) return res.status(404).json({ error: "Inbox nao encontrada" });

    const { data: actor, error: actorErr } = await supabaseAdmin
      .from("users")
      .select("id, role, company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (actorErr) return res.status(500).json({ error: actorErr.message });
    if (!actor || (actor as any).company_id !== (inbox as any).company_id)
      return res.status(403).json({ error: "Proibido" });

    let allowed = false;
    const role = ((actor as any).role || "").toString().toUpperCase();
    if (role && role !== "AGENT") allowed = true;
    if (!allowed) {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("inbox_users")
        .select("can_manage")
        .eq("inbox_id", id)
        .eq("user_id", (actor as any).id)
        .maybeSingle();
      if (linkErr) return res.status(500).json({ error: linkErr.message });
      if (link?.can_manage) allowed = true;
    }
    if (!allowed)
      return res
        .status(403)
        .json({ error: "Sem permissao para excluir inbox" });

    const { data: chats } = await supabaseAdmin
      .from("chats")
      .select("id")
      .eq("inbox_id", id);
    const chatIds = (chats || []).map((row: any) => row.id).filter(Boolean);
    if (chatIds.length > 0) {
      const chunk = (arr: any[], size = 100) => {
        const parts: any[][] = [];
        for (let i = 0; i < arr.length; i += size)
          parts.push(arr.slice(i, i + size));
        return parts;
      };
      for (const part of chunk(chatIds, 100)) {
        try {
          await supabaseAdmin
            .from("chat_messages")
            .delete()
            .in("chat_id", part);
        } catch { }
        try {
          await supabaseAdmin
            .from("chat_participants")
            .delete()
            .in("chat_id", part);
        } catch { }
        try {
          await supabaseAdmin.from("chat_tags").delete().in("chat_id", part);
        } catch { }
      }
      try {
        await supabaseAdmin.from("chats").delete().in("id", chatIds);
      } catch { }
    }

    try {
      await supabaseAdmin.from("inbox_users").delete().eq("inbox_id", id);
    } catch { }
    try {
      await supabaseAdmin.from("inbox_secrets").delete().eq("inbox_id", id);
    } catch { }

    const { error: delErr } = await supabaseAdmin
      .from("inboxes")
      .delete()
      .eq("id", id);
    if (delErr) {
      console.error("Delete inbox error", delErr);
      return res
        .status(500)
        .json({
          error: delErr.message,
          details: (delErr as any)?.details || null,
          hint: (delErr as any)?.hint || null,
        });
    }

    try {
      io.emit("inbox:deleted", {
        inboxId: id,
        companyId: (inbox as any).company_id,
      });
    } catch { }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "inbox delete error" });
  }
});

// Manage inbox users: add/update permissions
app.post("/livechat/inboxes/:id/users", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params as { id: string };
    const schema = z.object({
      userId: z.string().min(1),
      can_read: z.boolean().optional().default(true),
      can_write: z.boolean().optional().default(true),
      can_manage: z.boolean().optional().default(false),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Dados inv?lidos", details: parsed.error.format() });
    const b = parsed.data as any;
    const { data: inbox } = await supabaseAdmin
      .from("inboxes")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();
    if (!inbox) return res.status(404).json({ error: "Inbox n?o encontrada" });
    const { data: actor } = await supabaseAdmin
      .from("users")
      .select("id, role, company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (!actor || (actor as any).company_id !== (inbox as any).company_id)
      return res.status(403).json({ error: "Proibido" });
    const role = ((actor as any).role || "").toString().toUpperCase();
    if (role === "AGENT") {
      const { data: link } = await supabaseAdmin
        .from("inbox_users")
        .select("can_manage")
        .eq("inbox_id", id)
        .eq("user_id", (actor as any).id)
        .maybeSingle();
      if (!link?.can_manage)
        return res
          .status(403)
          .json({ error: "Sem permiss?o para gerenciar usu?rios da inbox" });
    }
    // Ensure target user belongs to same company
    const { data: target } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("id", b.userId)
      .maybeSingle();
    if (!target || (target as any).company_id !== (inbox as any).company_id)
      return res
        .status(400)
        .json({ error: "Usu?rio inv?lido para esta empresa" });
    const { data, error } = await supabaseAdmin
      .from("inbox_users")
      .upsert(
        [
          {
            user_id: b.userId,
            inbox_id: id,
            can_read: b.can_read,
            can_write: b.can_write,
            can_manage: b.can_manage,
          },
        ],
        { onConflict: "user_id,inbox_id" },
      )
      .select("user_id, inbox_id, can_read, can_write, can_manage")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    try {
      io.emit("inbox:users:updated", {
        inboxId: id,
        companyId: (inbox as any).company_id,
      });
    } catch { }
    return res.json(data);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "inbox users add error" });
  }
});

// Remove user from inbox
app.delete(
  "/livechat/inboxes/:id/users/:userId",
  requireAuth,
  async (req: any, res) => {
    try {
      const { id, userId } = req.params as { id: string; userId: string };
      const { data: inbox } = await supabaseAdmin
        .from("inboxes")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();
      if (!inbox)
        return res.status(404).json({ error: "Inbox n?o encontrada" });
      const { data: actor } = await supabaseAdmin
        .from("users")
        .select("id, role, company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (!actor || (actor as any).company_id !== (inbox as any).company_id)
        return res.status(403).json({ error: "Proibido" });
      const role = ((actor as any).role || "").toString().toUpperCase();
      if (role === "AGENT") {
        const { data: link } = await supabaseAdmin
          .from("inbox_users")
          .select("can_manage")
          .eq("inbox_id", id)
          .eq("user_id", (actor as any).id)
          .maybeSingle();
        if (!link?.can_manage)
          return res
            .status(403)
            .json({ error: "Sem permiss?o para gerenciar usu?rios da inbox" });
      }
      const { error } = await supabaseAdmin
        .from("inbox_users")
        .delete()
        .eq("inbox_id", id)
        .eq("user_id", userId);
      if (error) return res.status(500).json({ error: error.message });
      try {
        io.emit("inbox:users:updated", {
          inboxId: id,
          companyId: (inbox as any).company_id,
        });
      } catch { }
      return res.status(204).send();
    } catch (e: any) {
      return res
        .status(500)
        .json({ error: e?.message || "inbox users remove error" });
    }
  },
);
// Listar chats por inbox, status e busca
app.get("/livechat/chats/:id/kanban", requireAuth, async (req: any, res) => {
  try {
    const chatId = String(req.params.id);

    // 1) Chat
    const { data: chat, error: errChat } = await supabaseAdmin
      .from("chats")
      .select("id, inbox_id, customer_id, last_message_at")
      .eq("id", chatId)
      .maybeSingle();
    if (errChat) return res.status(500).json({ error: errChat.message });
    if (!chat) return res.status(404).json({ error: "Chat não encontrado" });

    // 2) Customer -> Lead -> Board
    const { data: customer, error: errCust } = await supabaseAdmin
      .from("customers")
      .select("id, company_id, lead_id, name")
      .eq("id", chat.customer_id)
      .maybeSingle();
    if (errCust) return res.status(500).json({ error: errCust.message });
    if (!customer) return res.status(404).json({ error: "Cliente não encontrado" });

    let boardId: string | null = null;
    if (customer.lead_id) {
      const { data: lead, error: errLead } = await supabaseAdmin
        .from("leads")
        .select("id, kanban_board_id")
        .eq("id", customer.lead_id)
        .maybeSingle();
      if (errLead) return res.status(500).json({ error: errLead.message });
      boardId = (lead as any)?.kanban_board_id || null;
    }

    if (!boardId) {
      boardId = await getBoardIdForCompany(customer.company_id);
    }

    // 3) Colunas do board
    const { data: columns, error: errCols } = await supabaseAdmin
      .from("kanban_columns")
      .select("id, name, color, position")
      .eq("kanban_board_id", boardId)
      .order("position", { ascending: true });
    if (errCols) return res.status(500).json({ error: errCols.message });

    // 4) Coluna atual (via chat_tags, mais recente)
    let currentColumnId: string | null = null;
    try {
      const { data: tagsRows } = await supabaseAdmin
        .from("chat_tags")
        .select("*")
        .eq("chat_id", chatId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      currentColumnId = getColIdFromTagRow((tagsRows || [])[0]);
    } catch (e) {
      // ignora
    }

    return res.json({
      ok: true,
      board: { id: boardId },
      columns: columns || [],
      current: { column_id: currentColumnId },
      chat: {
        id: chatId,
        customer_id: chat.customer_id,
        last_message_at: chat.last_message_at,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        company_id: customer.company_id,
      },
    });
  } catch (e: any) {
    console.error("[KANBAN/chat] error:", e);
    return res.status(500).json({ error: e?.message || "kanban chat error" });
  }
});


// ===== Tags (labels) management =====
// List tags of current user's company
app.get("/livechat/tags", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    const { data: urow, error: errU } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (errU) return res.status(500).json({ error: errU.message });
    if (!urow?.company_id)
      return res.status(404).json({ error: "Usu?rio sem company_id" });
    const { data, error } = await supabaseAdmin
      .from("tags")
      .select("id, name, color, created_at, updated_at")
      .eq("company_id", urow.company_id)
      .order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "tags list error" });
  }
});

// Create tag; optionally also create a kanban column in the company's default board
app.post("/livechat/tags", requireAuth, async (req: any, res) => {
  const authUserId = req.user.id as string;
  const schema = z.object({
    name: z.string().min(1),
    color: z.string().min(1).optional(),
    createColumn: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.message });
  const { name, color, createColumn = false } = parsed.data;

  // Load current user company and role
  const { data: urow, error: errU } = await supabaseAdmin
    .from("users")
    .select("company_id, role")
    .eq("user_id", authUserId)
    .maybeSingle();
  if (errU) return res.status(500).json({ error: errU.message });
  if (!urow?.company_id)
    return res.status(404).json({ error: "Usu?rio sem company_id" });
  const role = (urow as any).role as string | null;
  const allowed =
    role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";
  if (!allowed)
    return res.status(403).json({ error: "Sem permiss?o para criar labels" });

  // Create tag
  const { data: tag, error: errTag } = await supabaseAdmin
    .from("tags")
    .insert([
      { name, color: color || null, company_id: (urow as any).company_id },
    ])
    .select("id, name, color")
    .single();
  if (errTag) return res.status(400).json({ error: errTag.message });

  let createdColumn: any = null;
  if (createColumn) {
    // Find default board for company
    const { data: board } = await supabaseAdmin
      .from("kanban_boards")
      .select("id, is_default, created_at")
      .eq("company_id", (urow as any).company_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (board?.id) {
      // Determine next position
      const { data: last } = await supabaseAdmin
        .from("kanban_columns")
        .select("position")
        .eq("kanban_board_id", (board as any).id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPos = ((last as any)?.position || 0) + 1;
      const { data: col } = await supabaseAdmin
        .from("kanban_columns")
        .insert([
          {
            name,
            color: color || null,
            position: nextPos,
            kanban_board_id: (board as any).id,
          },
        ])
        .select("id, name, color, position")
        .single();
      createdColumn = col || null;
    }
  }

  return res.status(201).json({ tag, column: createdColumn });
});


// --------- REGISTRO DAS ROTAS DO KANBAN ----------
registerKanbanRoutes(app, { requireAuth, supabaseAdmin, io });


registerLivechatChatRoutes(app);

async function socketAuthUserId(socket: any): Promise<string | null> {
  try {
    const headers = (socket.request?.headers || {}) as any;
    let token: string | undefined;
    const auth =
      (headers["authorization"] as string | undefined) ||
      (headers["Authorization"] as string | undefined);
    if (auth && auth.startsWith("Bearer ")) token = auth.slice(7);
    if (!token) {
      const rawCookie = (headers["cookie"] as string | undefined) || "";
      const parts = rawCookie.split(/;s*/).map((p) => p.split("="));
      for (const [k, v] of parts) {
        if (k === JWT_COOKIE_NAME && v) {
          token = decodeURIComponent(v);
          break;
        }
      }
    }
    if (!token) return null;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id as string;
  } catch {
    return null;
  }
}

// ===== Company profile (current user's company) =====
// GET current user's company data
app.get("/companies/me", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id as string | null;
    if (!companyId)
      return res.status(404).json({ error: "Usu?rio sem company_id" });

    const { data: comp, error: cerr } = await supabaseAdmin
      .from("companies")
      .select(
        "id, name, cnpj, email, phone, address, city, state, zip_code, logo, plan, is_active, created_at, updated_at",
      )
      .eq("id", companyId)
      .maybeSingle();
    if (cerr) return res.status(500).json({ error: cerr.message });
    if (!comp) return res.status(404).json({ error: "Empresa n?o encontrada" });
    return res.json(comp);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "company get error" });
  }
});

// PUT update current user's company data (partial)
app.put("/companies/me", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id as string | null;
    if (!companyId)
      return res.status(404).json({ error: "Usu?rio sem company_id" });

    // Validate and pick only allowed fields
    const schema = z
      .object({
        name: z.string().min(1).optional(),
        cnpj: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().min(3).optional(),
        address: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
        zip_code: z.string().optional().nullable(),
        logo: z.string().url().optional().nullable(),
        // plan/is_active are intentionally not exposed here
      })
      .passthrough();
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Dados inv?lidos", details: parsed.error.format() });
    }
    const body = parsed.data as any;
    const update: Record<string, any> = {};
    const fields = [
      "name",
      "cnpj",
      "email",
      "phone",
      "address",
      "city",
      "state",
      "zip_code",
      "logo",
    ] as const;
    for (const k of fields)
      if (Object.prototype.hasOwnProperty.call(body, k)) update[k] = body[k];
    update.updated_at = new Date().toISOString();
    if (Object.keys(update).length === 1 && update.updated_at) {
      return res.status(400).json({ error: "Nada para atualizar" });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("companies")
      .update(update)
      .eq("id", companyId)
      .select(
        "id, name, cnpj, email, phone, address, city, state, zip_code, logo, plan, is_active, created_at, updated_at",
      )
      .single();
    if (error) return res.status(500).json({ error: error.message });

    try {
      io.emit("company:updated", {
        companyId,
        changes: update,
        company: updated,
      });
    } catch { }

    return res.json(updated);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "company update error" });
  }
});

// ===== Proposals =====
app.get("/proposals", requireAuth, async (req: any, res) => {
  try {
    // Load local user row to get company
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id || null;

    if (!companyId) return res.json([]);

    const leadFilter = (req.query.leadId as string | undefined)?.trim();

    let query = supabaseAdmin
      .from("proposals")
      .select(
        "id, number, title, description, total_value, status, valid_until, created_at, customer_id, ai_generated, lead_id",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (leadFilter) query = query.eq("lead_id", leadFilter);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Proposals list error" });
  }
});

// Create proposal
app.post("/proposals", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    if (!urow?.company_id)
      return res.status(404).json({ error: "Usuário sem company_id" });

    const body = req.body || {};
    let customerId: string | null = body.customer_id || null;
    const leadId: string | null = body.lead_id || null;

    if (!customerId && leadId) {
      try {
        const { data: cust } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("lead_id", leadId)
          .maybeSingle();
        customerId = (cust as any)?.id || null;
      } catch { }
      if (!customerId) {
        const { data: l } = await supabaseAdmin
          .from("leads")
          .select("id, name, email")
          .eq("id", leadId)
          .maybeSingle();
        const payload: any = {
          company_id: (urow as any).company_id,
          name: (l as any)?.name || "Cliente",
          email: (l as any)?.email || null,
        };
        try {
          payload.lead_id = leadId;
          const { data: created } = await supabaseAdmin
            .from("customers")
            .insert([payload])
            .select("id")
            .single();
          customerId = (created as any)?.id || null;
        } catch {
          delete payload.lead_id;
          const { data: created2 } = await supabaseAdmin
            .from("customers")
            .insert([payload])
            .select("id")
            .single();
          customerId = (created2 as any)?.id || null;
        }
      }
    }

    if (!customerId)
      return res
        .status(400)
        .json({ error: "customer_id ou lead_id obrigatório" });

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const num =
      "P-" +
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      "-" +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds());

    const sysPower = Number(body.system_power ?? 0) || 0;
    const panelQty = Number(body.panel_quantity ?? 1) || 1;
    const totalValue = Number(body.total_value ?? 0) || 0;
    const title = String(body.title || "Proposta");
    const description = body.description ?? null;
    const installments = body.installments ?? 1;
    const installmentValue = body.installment_value ?? null;
    const validDays = Number(body.valid_days ?? 30) || 30;
    const validUntil = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const insert: any = {
      number: num,
      title,
      description,
      system_power: sysPower,
      panel_quantity: panelQty,
      total_value: totalValue,
      installments,
      installment_value: installmentValue,
      valid_until: validUntil,
      status: body.status || "DRAFT",
      ai_generated: !!body.ai_generated,
      company_id: (urow as any).company_id,
      customer_id: customerId,
      lead_id: leadId,
      created_by_id: (urow as any).id,
    };

    const { data, error } = await supabaseAdmin
      .from("proposals")
      .insert([insert])
      .select("id")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    try {
      io.emit("proposals:changed", { type: "created", id: (data as any).id });
    } catch { }
    return res.status(201).json({ id: (data as any).id, number: num });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Create proposal error" });
  }
});

// Edit proposal (partial update)
app.patch("/proposals/:id", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id || null;
    if (!companyId)
      return res.status(404).json({ error: "Usuário sem company_id" });

    const { id } = req.params as { id: string };
    const { data: prop, error: perr } = await supabaseAdmin
      .from("proposals")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();
    if (perr) return res.status(500).json({ error: perr.message });
    if (!prop || (prop as any).company_id !== companyId)
      return res.status(404).json({ error: "Proposta n o encontrada" });

    const body = req.body || {};
    const up: Record<string, any> = {};
    const fields = [
      "title",
      "description",
      "system_power",
      "panel_quantity",
      "total_value",
      "installments",
      "installment_value",
      "valid_until",
      "status",
    ] as const;
    for (const k of fields)
      if (Object.prototype.hasOwnProperty.call(body, k))
        up[k] = (body as any)[k];
    if (Object.keys(up).length === 0)
      return res.status(400).json({ error: "Nada para atualizar" });

    const { error } = await supabaseAdmin
      .from("proposals")
      .update(up)
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    try {
      io.emit("proposals:changed", { type: "updated", id });
    } catch { }
    return res.status(204).send();
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Update proposal error" });
  }
});

// Update proposal status
app.patch("/proposals/:id/status", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    // Resolve local user row to get company
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id || null;
    if (!companyId)
      return res.status(404).json({ error: "Usuário sem company_id" });

    const { id } = req.params as { id: string };
    const status = String(req.body?.status ?? "").trim();
    if (!status) return res.status(400).json({ error: "status obrigatório" });

    // Optional: restrict to known statuses
    const allowed = new Set([
      "DRAFT",
      "SENT",
      "ACCEPTED",
      "REJECTED",
      "CANCELLED",
      "APPROVED",
    ]);
    if (!allowed.has(status.toUpperCase())) {
      return res.status(400).json({ error: "status inválido" });
    }

    // Ensure proposal belongs to same company
    const { data: prop, error: perr } = await supabaseAdmin
      .from("proposals")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();
    if (perr) return res.status(500).json({ error: perr.message });
    if (!prop || (prop as any).company_id !== companyId) {
      return res.status(404).json({ error: "Proposta n o encontrada" });
    }

    const { error } = await supabaseAdmin
      .from("proposals")
      .update({ status })
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    try {
      io.emit("proposals:changed", { type: "updated", id });
    } catch { }
    return res.status(204).send();
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Update proposal status error" });
  }
});

// Duplicate proposal
app.post("/proposals/:id/duplicate", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id || null;
    if (!companyId)
      return res.status(404).json({ error: "Usuário sem company_id" });

    const { id } = req.params as { id: string };
    const { data: src, error: serr } = await supabaseAdmin
      .from("proposals")
      .select(
        "id, number, title, description, system_power, panel_quantity, total_value, installments, installment_value, valid_until, status, customer_id, lead_id, ai_generated, company_id",
      )
      .eq("id", id)
      .maybeSingle();
    if (serr) return res.status(500).json({ error: serr.message });
    if (!src || (src as any).company_id !== companyId)
      return res.status(404).json({ error: "Proposta n o encontrada" });

    // Generate new sequential-like number (YYYYMM-####)
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const ym = `${now.getFullYear()}${pad(now.getMonth() + 1)}`;
    const { data: last } = await supabaseAdmin
      .from("proposals")
      .select("number")
      .like("number", `${ym}-%`)
      .order("number", { ascending: false })
      .limit(1);
    let seq = 1;
    const lastNum =
      Array.isArray(last) && (last as any)[0]?.number
        ? String((last as any)[0].number)
        : null;
    if (lastNum && /^d{6}-d{4}$/.test(lastNum)) {
      seq = (parseInt(lastNum.slice(-4)) || 0) + 1;
    }
    const newNumber = `${ym}-${seq.toString().padStart(4, "0")}`;

    // Calculate new valid_until: keep same days delta if possible (default +30d)
    const baseValidDays = (() => {
      try {
        const srcDate = (src as any).valid_until
          ? new Date((src as any).valid_until)
          : null;
        if (srcDate && !isNaN(srcDate.getTime())) {
          const diffMs = srcDate.getTime() - now.getTime();
          const days = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
          return days;
        }
      } catch { }
      return 30;
    })();
    const newValidUntil = new Date(
      now.getTime() + baseValidDays * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    const insert: any = {
      number: newNumber,
      title: `${(src as any).title || "Proposta"} (Cópia)`,
      description: (src as any).description ?? null,
      system_power: (src as any).system_power ?? null,
      panel_quantity: (src as any).panel_quantity ?? 1,
      total_value: (src as any).total_value ?? 0,
      installments: (src as any).installments ?? 1,
      installment_value: (src as any).installment_value ?? null,
      valid_until: newValidUntil,
      status: "DRAFT",
      ai_generated: false,
      company_id: companyId,
      customer_id: (src as any).customer_id ?? null,
      lead_id: (src as any).lead_id ?? null,
      created_by_id: (urow as any).id,
    };

    const { data: created, error: cerr } = await supabaseAdmin
      .from("proposals")
      .insert([insert])
      .select("id, number")
      .single();
    if (cerr) return res.status(500).json({ error: cerr.message });
    try {
      io.emit("proposals:changed", {
        type: "created",
        id: (created as any).id,
      });
    } catch { }
    return res
      .status(201)
      .json({ id: (created as any).id, number: (created as any).number });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Duplicate proposal error" });
  }
});

// Delete proposal
app.delete("/proposals/:id", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id || null;
    if (!companyId)
      return res.status(404).json({ error: "Usuário sem company_id" });

    const { id } = req.params as { id: string };
    const { data: prop, error: perr } = await supabaseAdmin
      .from("proposals")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();
    if (perr) return res.status(500).json({ error: perr.message });
    if (!prop || (prop as any).company_id !== companyId)
      return res.status(404).json({ error: "Proposta n o encontrada" });

    // Delete linked documents (by metadata.proposal_id) first
    try {
      await supabaseAdmin
        .from("documents")
        .delete()
        .eq("company_id", companyId)
        .eq("proposta_id", id);
    } catch { }
    const { error } = await supabaseAdmin
      .from("proposals")
      .delete()
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    try {
      io.emit("proposals:changed", { type: "deleted", id });
    } catch { }
    return res.status(204).send();
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Delete proposal error" });
  }
});
// ===== Documents =====
const DOCS_BUCKET = process.env.DOCS_BUCKET || "documents";

// List documents for current user's company
app.get("/documents", requireAuth, async (req: any, res) => {
  try {
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id || null;
    if (!companyId) return res.json([]);

    const customerId = (req.query.customer_id as string | undefined)?.trim();
    const docType = (req.query.doc_type as string | undefined)?.trim();

    let query = supabaseAdmin
      .from("documents")
      .select(
        "id, customer_id, proposta_id, doc_type, status, number, series, full_number, total, issued_at, due_at, created_at, pdf_path",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (customerId) query = query.eq("customer_id", customerId);
    if (docType) query = query.eq("doc_type", docType);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const items = (data || []).map((d: any) => ({
      id: d.id,
      customer_id: d.customer_id,
      proposta_id: d.proposta_id || null,
      doc_type: d.doc_type,
      status: d.status,
      number: d.number,
      series: d.series,
      full_number:
        d.full_number ||
        (d.series
          ? String(d.series) + "-" + String(d.number)
          : (d.number ?? "")),
      total: d.total,
      issued_at: d.issued_at,
      due_at: d.due_at,
      created_at: d.created_at,
      has_pdf: !!d.pdf_path,
    }));
    return res.json(items);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Documents list error" });
  }
});
// Download document PDF (redirect to signed URL)
app.get("/documents/:id/download", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params as { id: string };
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("pdf_path")
      .eq("id", id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    const pdfPath = (data as any)?.pdf_path as string | null;
    if (!pdfPath) return res.status(404).json({ error: "PDF n�o dispon�vel" });
    const { data: signed, error: sErr } = await (supabaseAdmin as any).storage
      .from(DOCS_BUCKET)
      .createSignedUrl(pdfPath, 60);
    if (sErr) return res.status(500).json({ error: sErr.message });
    if (!signed?.signedUrl)
      return res.status(500).json({ error: "Falha ao assinar URL" });
    return res.redirect(signed.signedUrl);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Download error" });
  }
});

// Create basic CONTRACT document draft from simple payload
app.post("/documents", requireAuth, async (req: any, res) => {
  try {
    const authUserId = req.user.id as string;
    // Resolve local user row
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    if (!urow?.company_id)
      return res.status(404).json({ error: "Usu?rio sem company_id" });

    const body = req.body || {};
    let customerId: string | null = body.customer_id || null;
    const leadId: string | null = body.lead_id || null;

    // If no customer_id, attempt to create from lead
    if (!customerId && leadId) {
      try {
        const { data: cust } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("lead_id", leadId)
          .maybeSingle();
        customerId = (cust as any)?.id || null;
      } catch { }
      if (!customerId) {
        // fetch lead minimal
        const { data: l } = await supabaseAdmin
          .from("leads")
          .select("id, name, email")
          .eq("id", leadId)
          .maybeSingle();
        const payload: any = {
          company_id: (urow as any).company_id,
          name: (l as any)?.name || "Cliente",
          email: (l as any)?.email || null,
        };
        try {
          // try with lead_id if column exists
          payload.lead_id = leadId;
          const { data: created } = await supabaseAdmin
            .from("customers")
            .insert([payload])
            .select("id")
            .single();
          customerId = (created as any)?.id || null;
        } catch {
          // retry without lead_id
          delete payload.lead_id;
          const { data: created2 } = await supabaseAdmin
            .from("customers")
            .insert([payload])
            .select("id")
            .single();
          customerId = (created2 as any)?.id || null;
        }
      }
    }

    if (!customerId)
      return res
        .status(400)
        .json({ error: "customer_id ou lead_id obrigat?rio" });

    const discountPct = Number(body.discountPct || 0);
    const itemDesc = String(body.item_description || "Item");
    const qty = Number(body.quantity || 1);
    const unitPrice = Number(body.unit_price || 0);
    const subtotal = qty * unitPrice;
    const discount = (Math.max(0, Math.min(100, discountPct)) / 100) * subtotal;
    const total = Math.max(0, subtotal - discount);

    const propId: string | null =
      (body.proposal_id ||
        body.proposta_id ||
        body?.metadata?.proposal_id ||
        null) ??
      null;

    const meta: any = { ...(body.metadata ?? {}) };
    meta.payload = {
      item_description: itemDesc,
      quantity: qty,
      unit_price: unitPrice,
      discountPct,
    };

    const docInsert: any = {
      company_id: (urow as any).company_id,
      doc_type: String(body.doc_type || "CONTRACT"),
      status: "DRAFT",
      customer_id: customerId,
      currency: "BRL",
      metadata: meta,
      proposta_id: propId,
      subtotal,
      discount,
      total,
      created_by: (urow as any).id,
      updated_by: (urow as any).id,
    };

    const { data: doc, error: dErr } = await supabaseAdmin
      .from("documents")
      .insert([docInsert])
      .select("id")
      .single();
    if (dErr) return res.status(500).json({ error: dErr.message });

    const docId = (doc as any).id as string;
    const item = {
      document_id: docId,
      position: 1,
      description: itemDesc,
      quantity: qty,
      unit: body.unit || null,
      unit_price: unitPrice,
      total: total,
    } as any;
    try {
      await supabaseAdmin.from("document_items").insert([item]);
    } catch { }

    return res.status(201).json({ id: docId });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "Create document error" });
  }
});

// públicos (exigem validação própria do provedor)
app.get("/integrations/meta/webhook", metaWebhookGet);
app.post("/integrations/meta/webhook", metaWebhookPost);

// autenticados
startLivechatSocketBridge();
registerLivechatContactsRoutes(app);
registerOpenAIIntegrationRoutes(app);
registerAgentsRoutes(app);
registerSettingsInboxesRoutes(app);
registerSettingsUsersRoutes(app);
registerSendMessageRoutes(app); // ajuste a assinatura p/ injetar o guard
registerCampaignRoutes(app);

registerCampaignSegmentsRoutes(app);
registerCampaignFollowupsRoutes(app);
registerCampaignUploadsRoutes(app);

registerWAHARoutes(app);

// Media proxy for encrypted URLs (CORS-safe)
app.use("/media", mediaProxyRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});
app.get("/_debug/redis/ping", async (req, res) => {
  try { const pong = await getRedis().ping(); res.json({ ok:true, pong }); }
  catch (e:any) { res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});

// GET /_debug/redis/setget
app.get("/_debug/redis/setget", async (req, res) => {
  await rSet("test:hello", { ok:true, t:new Date().toISOString() }, 300);
  const got = await rGet("test:hello");
  res.json({ got });
});

 
void (async () => {
  try {
    await syncGlobalWahaApiKey();
  } catch (error: any) {
    console.error("[WAHA] syncGlobalWahaApiKey failed", error?.message || error);
  }

  try {
    await registerCampaignWorker();
  } catch (error: any) {
    console.error("[campaign.worker] failed to start", error?.message || error);
  }

  server.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
  });
})();
