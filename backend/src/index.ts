import "dotenv/config";
import express from "express";
import session from "express-session";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";                 // ✅ use node:path
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { EX_APP, publish, consume, Q_SOCKET_LIVECHAT } from "./queue/rabbit.js";
import db from "./pg.js";
import { metaWebhookGet, metaWebhookPost } from "./routes/metawebhook.js";
import { registerSendMessageRoutes } from "./routes/sendMessage.js";
import { listWebhookEvents } from "./routes/adminwebhooks.js";
import {
  getBoardIdForCompany,
  ensureLeadCustomerChat,
  ensureGroupChat,
  insertInboundMessage,
} from "./services/meta/store.js";
import { setIO, getIO } from "./lib/io.js";
import { registerLivechatChatRoutes } from "./routes/livechat.chats.js";
import { getRedis, rGet, rSet, redis, k, clearMessageCache, rDel } from "./lib/redis.js";
import { registerLivechatContactsRoutes } from "./routes/livechat.contacts.js";
import { registerLivechatInboxesRoutes } from "./routes/livechat.inboxes.js";
import { registerKanbanRoutes } from "./routes/kanban.js";
import { registerSettingsUsersRoutes } from "./routes/settings.users.js";
import { registerSettingsInboxesRoutes } from "./routes/settings.inboxes.js";
import { registerOpenAIIntegrationRoutes } from "./routes/integrations.openai.js";
import { registerAgentsRoutes } from "./routes/agents.js";
import { registerAgentTemplatesRoutes } from "./routes/agents.templates.js";
import { registerAgentTemplatesAdminRoutes } from "./routes/agents.templates.admin.js";
import { registerCompanyRoutes } from "./routes/companies.js";
import { registerKnowledgeBaseRoutes } from "./routes/knowledge.base.js";
import templateToolsRouter from "./routes/agents.templates.tools.js";
import toolsAdminRouter from "./routes/tools.admin.js";
import uploadRouter from "./routes/upload.js";
import mediaRouter from "./routes/media.js";
import { registerMetaTemplatesRoutes } from "./routes/meta.templates.js";
import filesRoute from "./server/files.route.js";
import { startSocketRelay } from "./socket.relay.js";
import { startLivechatSocketBridge } from "./socket/bridge.livechat.js";
import { registerCampaignRoutes } from "./routes/livechat.campaigns.js";
import { registerCampaignSegmentsRoutes } from "./routes/livechat.campaigns.segments.js";
import { registerCampaignFollowupsRoutes } from "./routes/livechat.campaigns.followups.js";
import { registerCampaignUploadsRoutes } from "./routes/livechat.campaigns.uploads.js";
import { registerMediaLibraryRoutes } from "./routes/livechat.mediaLibrary.js";
import { registerCampaignWorker } from "./worker.campaigns.js";
import { registerWAHARoutes } from "./routes/waha.js";
import mediaProxyRouter from "./routes/media.proxy.js";
import { registerDepartmentsRoutes } from "./routes/departments.js";
import { registerTeamsRoutes } from "./routes/teams.js";
import { syncGlobalWahaApiKey } from "./services/waha/syncGlobalApiKey.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { WAHA_PROVIDER, wahaFetch, fetchWahaChatPicture, fetchWahaContactPicture } from "./services/waha/client.js";
import { normalizeMsisdn } from "./util.js";
import { registerCalendarRoutes } from "./routes/calendar.js";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerLivechatTagsRoutes } from "./routes/livechat.tags.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAdminStatsRoutes } from "./routes/admin.stats.js";
import adminAgentsRouter from "./routes/admin/agents.js";
import { registerSubscriptionRoutes } from "./routes/subscriptions.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerAutomationRulesRoutes } from "./routes/automationRules.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerDocumentTemplateRoutes } from "./routes/document-templates.js";
import { registerMetaHealthRoutes } from "./routes/meta.health.js";
import { registerCustomerOptInRoutes } from "./routes/customers.optin.js";
import { webhookRouter } from "./routes/webhooks.js";
import { checkoutRouter } from "./routes/checkout.js";

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

// ===== CONFIGURAÇÃO DE CORS (ANTES DE TUDO) =====
const FRONTEND_ORIGINS = Array.from(
  new Set([
    ...(process.env.FRONTEND_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3002", // onboarding dev
    "http://127.0.0.1:3002",
  ]),
);

console.log("[CORS] Allowed origins:", FRONTEND_ORIGINS);

app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    credentials: true,
  }),
);

// ===== WEBHOOKS (RAW BODY) =====
// Must be before express.json() to preserve signature
app.use("/api/webhooks", webhookRouter);

// ===== PARSERS =====
app.use(cookieParser());
app.use(express.json({
  limit: "100mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Configurar express-session para onboarding
app.use(session({
  secret: process.env.SESSION_SECRET || "onboarding-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
  }
}));

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
    const { chatId, message, chatUpdate, companyId } = event;
    if (chatId && message) {
      io.to(`chat:${chatId}`).emit("message:new", message);
    }
    if (chatUpdate) {
      // Emit to company room if companyId provided, otherwise fallback to global (legacy)
      if (companyId) {
        io.to(`company:${companyId}`).emit("chat:updated", chatUpdate);
      } else {
        // Legacy fallback - try to extract from chatUpdate or fall back to global
        console.warn("[SOCKET] chat:updated without companyId - using global broadcast (unsafe)", { chatId });
        io.emit("chat:updated", chatUpdate);
      }
    }
    return;
  }

  if (event?.kind === "livechat.outbound.message") {
    const { chatId, message, chatUpdate, companyId } = event;
    if (chatId && message) {
      io.to(`chat:${chatId}`).emit("message:new", message);
    }
    if (chatUpdate) {
      // Emit to company room if companyId provided, otherwise fallback to global (legacy)
      if (companyId) {
        io.to(`company:${companyId}`).emit("chat:updated", chatUpdate);
      } else {
        // Legacy fallback
        console.warn("[SOCKET] chat:updated without companyId - using global broadcast (unsafe)", { chatId });
        io.emit("chat:updated", chatUpdate);
      }
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
    return;
  }

  if (event?.kind === "livechat.media.ready") {
    const { chatId, messageId, media_url, media_public_url, media_storage_path, caption, chatUpdate, companyId } = event;
    if (chatId) {
      io.to(`chat:${chatId}`).emit("message:media-ready", {
        messageId,
        media_url,
        media_public_url,
        media_storage_path,
        caption
      });
    }
    if (chatUpdate) {
      if (companyId) {
        io.to(`company:${companyId}`).emit("chat:updated", chatUpdate);
      } else {
        io.emit("chat:updated", chatUpdate);
      }
    }
    return;
  }

  if (event?.kind === "notification") {
    const { userId, notification } = event;
    if (userId && notification) {
      io.to(`user:${userId}`).emit("notification", notification);
    }
    return;
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
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "sb_access_token";
const JWT_COOKIE_SECURE = String(process.env.JWT_COOKIE_SECURE) === "true";
const AVATAR_CACHE_TTL = Number(process.env.CACHE_TTL_AVATAR ?? 24 * 60 * 60);

// (opcional) assets estáticos se precisar
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

  if (!token) {
    console.log("[requireAuth] No token found - cookie:", !!req.cookies[JWT_COOKIE_NAME], "bearer:", !!bearer);
    return res.status(401).json({ error: "Not authenticated" });
  }

  // valida token com Supabase
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    console.log("[requireAuth] Token validation failed:", error?.message);
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = data.user;
  next();
}

// ===== Rotas de Auth =====
// NOTA: Rotas antigas comentadas - usando registerAuthRoutes() de ./routes/auth.ts
/*
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
*/

// ✅ Register auth routes from modular file (VERSION 2.0 with role support)
registerAuthRoutes(app);

// ===== Notification routes =====
import { registerNotificationRoutes } from "./routes/notifications.js";
registerNotificationRoutes(app);

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

function respondWithProductsError(res: any, error: unknown, fallback: string) {
  const status = typeof (error as any)?.status === "number" ? Number((error as any).status) : 500;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  return res.status(status).json({ error: message || fallback });
}

async function resolveProductsCompanyId(req: any): Promise<string> {
  const cached = typeof req?.user?.company_id === "string" ? req.user.company_id.trim() : "";
  if (cached) return cached;

  const authUserId = typeof req?.user?.id === "string" ? req.user.id : "";
  if (!authUserId) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("company_id")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  const companyId = typeof (data as any)?.company_id === "string" ? (data as any).company_id : null;
  if (!companyId) {
    throw Object.assign(new Error("Usuário sem empresa associada"), { status: 403 });
  }

  if (req?.user) {
    req.user.company_id = companyId;
  }

  return companyId;
}

// ===== Produtos =====
const PRODUCTS_TABLE = "catalog_items";

// GET listar produtos (suporta paginação e filtros)
app.get("/products", requireAuth, async (req, res) => {
  try {
    const companyId = await resolveProductsCompanyId(req);
    const q = (req.query.q as string | undefined)?.trim();
    const status = (req.query.status as string | undefined)?.trim();
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    let query = supabaseAdmin
      .from(PRODUCTS_TABLE)
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
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
    if (error) return respondWithProductsError(res, error, "Products list error");
    return res.json({ items: data || [], total: count ?? (data?.length || 0) });
  } catch (e: any) {
    return respondWithProductsError(res, e, "Products list error");
  }
});

// POST criar produto
app.post("/products", requireAuth, async (req, res) => {
  try {
    const companyId = await resolveProductsCompanyId(req);
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
    payload.company_id = companyId;

    const { data, error } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .insert([payload])
      .select("*")
      .single();
    if (error) return respondWithProductsError(res, error, "Create product error");
    return res.status(201).json(data);
  } catch (e: any) {
    return respondWithProductsError(res, e, "Create product error");
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

  try {
    const companyId = await resolveProductsCompanyId(req);
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
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (error) return respondWithProductsError(res, error, "Update product error");
    if (!data) return res.status(404).json({ error: "Product not found" });
    return res.json(data);
  } catch (e: any) {
    return respondWithProductsError(res, e, "Update product error");
  }
});

// DELETE produto por id
app.delete("/products/:id", requireAuth, async (req, res) => {
  const { id } = req.params as { id: string };
  try {
    const companyId = await resolveProductsCompanyId(req);
    const { data, error } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .delete()
      .eq("id", id)
      .eq("company_id", companyId)
      .select("id")
      .maybeSingle();
    if (error) return respondWithProductsError(res, error, "Delete product error");
    if (!data) return res.status(404).json({ error: "Product not found" });
    return res.status(204).send();
  } catch (e: any) {
    return respondWithProductsError(res, e, "Delete product error");
  }
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

  const nowIso = new Date().toISOString();
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
      updated_at: nowIso,
    });
  }

  try {
    const companyId = await resolveProductsCompanyId(req);
    const payload = toUpsert.map((item) => ({ ...item, company_id: companyId }));

    const { data, error } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .upsert(payload, { onConflict: "external_id" })
      .select("*");

    if (error) return respondWithProductsError(res, error, "Bulk upsert error");
    const affected = (data || []).filter((row: any) => row?.company_id === companyId).length;
    return res.json({ upserted: affected });
  } catch (e: any) {
    return respondWithProductsError(res, e, "Bulk upsert error");
  }
});


const io = new SocketIOServer(server, {
  cors: {
    origin: FRONTEND_ORIGINS, // Usa a constante definida no início
    methods: ["GET", "POST"],
    credentials: true,              // <- importante para withCredentials
  }
});

app.locals.io = io;
setIO(io);
startSocketRelay(io);

// Track which users are viewing which chats (for smart notifications)
const chatViewers = new Map<string, Set<string>>(); // chatId -> Set<userId>
(io as any)._chatViewers = chatViewers; // expose to routes

io.on("connection", async (socket) => {
  // Automatically join user to their personal notification room
  const userId = await socketAuthUserId(socket);
  if (userId) {
    socket.join(`user:${userId}`);
    console.log(`[Socket] 🔌 User connected and joined room user:${userId}`, { socketId: socket.id });
    
    // Join company room for multi-tenancy isolation
    try {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (user?.company_id) {
        socket.join(`company:${user.company_id}`);
        console.log(`[Socket] ✅ User joined company room: company:${user.company_id}`, { 
          socketId: socket.id, 
          userId 
        });
      } else {
        console.warn("[Socket] ⚠️  User has no company_id in profile", { socketId: socket.id, userId });
      }
    } catch (error) {
      console.error("[RT] ❌ failed to join company room", { socketId: socket.id, userId, error });
    }
  } else {
    console.warn("[Socket] ⚠️  Connection without valid userId", { socketId: socket.id });
  }

  socket.on("join", async (payload: { chatId?: string; companyId?: string }) => {
    const chatId = payload?.chatId;
    const companyId = payload?.companyId;
    
    // ✅ JOIN company room (global events for entire company)
    if (companyId) {
      // Security: verify user belongs to this company
      const userId = await socketAuthUserId(socket);
      if (userId) {
        try {
          const userCompany = await db.oneOrNone<{ company_id: string }>(
            `SELECT company_id FROM public.users WHERE id = $1`,
            [userId]
          );
          
          if (userCompany?.company_id === companyId) {
            socket.join(`company:${companyId}`);
            console.log("[RT] ✅ User explicitly joined company room", { 
              socketId: socket.id,
              userId, 
              companyId 
            });
          } else {
            console.warn("[RT] ⚠️  user tried to join wrong company room", { 
              userId, 
              requestedCompany: companyId,
              actualCompany: userCompany?.company_id 
            });
          }
        } catch (error) {
          console.error("[RT] ❌ failed to verify company access:", error);
        }
      }
    }
    
    // ✅ JOIN specific chat room (messages for specific chat)
    if (chatId) {
      socket.join(`chat:${chatId}`);
      
      // Track user presence for smart notifications
      const userId = await socketAuthUserId(socket);
      if (userId) {
        if (!chatViewers.has(chatId)) {
          chatViewers.set(chatId, new Set());
        }
        chatViewers.get(chatId)!.add(userId);
      }
    }
  });

  socket.on("leave", async (payload: { chatId?: string; companyId?: string }) => {
    const chatId = payload?.chatId;
    const companyId = payload?.companyId;
    
    // ✅ LEAVE company room
    if (companyId) {
      socket.leave(`company:${companyId}`);
    }
    
    // ✅ LEAVE specific chat room
    if (chatId) {
      socket.leave(`chat:${chatId}`);
      
      // Remove from presence tracking
      const userId = await socketAuthUserId(socket);
      if (userId && chatViewers.has(chatId)) {
        chatViewers.get(chatId)!.delete(userId);
        if (chatViewers.get(chatId)!.size === 0) {
          chatViewers.delete(chatId); // cleanup empty sets
        }
      }
    }
  });

  socket.on("disconnect", async (reason) => {
    console.log("[RT] client disconnected:", socket.id, reason);
    
    // Cleanup user from all chat rooms on disconnect
    const userId = await socketAuthUserId(socket);
    if (userId) {
      for (const [chatId, viewers] of chatViewers.entries()) {
        if (viewers.has(userId)) {
          viewers.delete(userId);
          if (viewers.size === 0) {
            chatViewers.delete(chatId);
          }
        }
      }
    }
  });

  // Load tags for a chat
  socket.on("livechat:chats:tags:get", async (payload: { chatId?: string }, callback) => {
    try {
      const chatId = payload?.chatId;
      if (!chatId) {
        return callback?.({ ok: false, error: 'chatId required' });
      }

      const { data, error } = await supabaseAdmin
        .from('chat_tags')
        .select('tag_id')
        .eq('chat_id', chatId);

      if (error) {
        return callback?.({ ok: false, error: error.message });
      }

      const tagIds = ((data as any[]) || []).map((r) => (r as any).tag_id);
      callback?.({ ok: true, data: tagIds });
    } catch (error: any) {
      callback?.({ ok: false, error: error?.message || 'Unknown error' });
    }
  });

  // List user's inboxes
  socket.on("livechat:inboxes:my", async (ack?: (resp: any) => void) => {
    try {
      const authUserId = await socketAuthUserId(socket);
      if (!authUserId) return ack?.({ ok: false, error: "Not authenticated" });

      const { data: links } = await supabaseAdmin
        .from("inbox_users")
        .select("inbox_id")
        .eq("user_id", authUserId);

      const ids = Array.from(new Set((links || []).map((r: any) => r.inbox_id))).filter(Boolean);
      if (ids.length === 0) return ack?.({ ok: true, data: [] });

      const { data, error } = await supabaseAdmin
        .from("inboxes")
        .select("id, name, phone_number, is_active, provider, channel, waha_db_name")
        .in("id", ids)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) return ack?.({ ok: false, error: error.message });
      const rows = (data || []).map((row: any) => ({
        ...row,
        provider: row?.provider ?? "META_CLOUD",
        channel: row?.channel ?? null,
      }));
      return ack?.({ ok: true, data: rows });
    } catch (e: any) {
      return ack?.({ ok: false, error: e?.message || "inboxes fetch error" });
    }
  });

  // List chats
  socket.on("livechat:chats:list", async (params: any, ack?: (resp: any) => void) => {
    try {
      const authUserId = await socketAuthUserId(socket);
      if (!authUserId) return ack?.({ ok: false, error: "Not authenticated" });

      // Get user company_id
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      
      if (!user?.company_id) return ack?.({ ok: false, error: "User has no company" });

      const inboxId = (params?.inboxId as string) || undefined;
      const status = (params?.status as string) || undefined;
      const kind = (params?.kind as string) || undefined;
      const departmentId = (params?.department_id as string) || undefined;
      const q = (params?.q as string) || undefined;
      const limit = params?.limit ? Number(params.limit) : 20;
      const offset = params?.offset ? Number(params.offset) : 0;

      let query = supabaseAdmin
        .from("chats")
        .select("id, external_id, status, last_message, last_message_at, inbox_id, customer_id, assignee_agent, kind, chat_type, remote_id, group_name, group_avatar_url, unread_count, inbox:inboxes!inner(company_id)", { count: "exact" })
        .eq("inbox.company_id", user.company_id)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (inboxId) query = query.eq("inbox_id", inboxId);
      if (departmentId) query = query.eq("department_id", departmentId);
      if (status && String(status).toUpperCase() !== "ALL") {
        query = query.eq("status", status);
        if (status === "PENDING") {
          query = query.gt("unread_count", 0);
        }
      }
      if (q) query = query.ilike("last_message", `%${q}%`);

      if (kind === "GROUP") {
        query = query.or(
          [
            "kind.eq.GROUP",
            "remote_id.ilike.%@g.us",
            "chat_type.eq.GROUP",
          ].join(","),
        );
      } else if (kind === "DIRECT") {
        query = query.or("kind.eq.DIRECT,kind.is.null");
        query = query.or("remote_id.is.null,remote_id.not.ilike.%@g.us");
        query = query.or(
          [
            "chat_type.eq.CONTACT",
            "chat_type.is.null",
          ].join(","),
        );
      }

      const { data, error, count } = await query.range(offset, offset + Math.max(0, limit - 1));
      if (error) return ack?.({ ok: false, error: error.message });
      const items = data || [];

      // Enrich from chats.assignee_agent (stores inbox_users.id)
      try {
        const linkIds = Array.from(new Set((items as any[]).map((c) => (c as any).assignee_agent).filter(Boolean)));
        let userIdByLink: Record<string, string> = {};
        if (linkIds.length > 0) {
          const { data: links } = await supabaseAdmin.from('inbox_users').select('id, user_id').in('id', linkIds);
          for (const r of (links as any[]) || []) userIdByLink[(r as any).id] = (r as any).user_id;
          const userIds = Array.from(new Set(Object.values(userIdByLink).filter(Boolean)));
          let usersById: Record<string, string> = {};
          if (userIds.length > 0) {
            const { data: u } = await supabaseAdmin.from('users').select('id, name').in('id', userIds);
            usersById = Object.fromEntries(((u as any[]) || []).map((x) => [x.id, x.name || x.id]));
          }
          for (const it of (items as any[])) {
            const linkId = (it as any).assignee_agent || null;
            const uid = linkId ? userIdByLink[linkId] : null;
            (it as any).assigned_agent_id = linkId;
            (it as any).assigned_agent_name = uid ? usersById[uid] || null : null;
          }
        }
      } catch {}

      // Enrich customer display
      try {
        const cids = Array.from(new Set((items as any[]).map((c) => (c as any).customer_id).filter(Boolean)));
        if (cids.length > 0) {
          const displayById: Record<string, { name: string | null; phone: string | null }> = {};
          async function loadDisplay(table: string, cols: string[]) {
            const sel = ["id", ...cols].join(",");
            const { data: rows } = await supabaseAdmin.from(table).select(sel).in("id", cids);
            for (const r of ((rows as any[]) || [])) {
              const name = (r as any).name || (r as any).title || null;
              const phone = (r as any).phone || (r as any).cellphone || (r as any).celular || (r as any).telefone || (r as any).contact || null;
              displayById[(r as any).id] = { name, phone };
            }
          }
          await loadDisplay("customers", ["name", "phone", "cellphone", "contact"]).catch(() => {});
          await loadDisplay("customers", ["name", "celular", "telefone", "contact"]).catch(() => {});
          await loadDisplay("leads", ["name", "phone", "cellphone"]).catch(() => {});
          for (const it of (items as any[])) {
            const d = displayById[(it as any).customer_id];
            (it as any).customer_name = d?.name || null;
            (it as any).customer_phone = d?.phone || null;
          }
        }
      } catch {}

      // Enrich avatars from Redis
      try {
        const remoteIds = (items as any[]).map(c => c.remote_id || c.external_id).filter(Boolean);
        if (remoteIds.length > 0) {
          const avatarPromises = remoteIds.map(rid => rGet(k.avatar(user.company_id, rid)));
          const avatars = await Promise.all(avatarPromises);
          const avatarMap: Record<string, string> = {};
          remoteIds.forEach((rid, i) => {
            if (avatars[i]) avatarMap[rid] = avatars[i] as string;
          });
          
          for (const chat of (items as any[])) {
            const rid = chat.remote_id || chat.external_id;
            const cached = rid ? avatarMap[rid] : null;
            
            const isGroup = chat.kind === 'GROUP' || chat.chat_type === 'GROUP' || (chat.remote_id && chat.remote_id.endsWith('@g.us'));
            
            if (isGroup) {
               if (!chat.group_avatar_url && cached) chat.group_avatar_url = cached;
               chat.customer_avatar_url = chat.group_avatar_url || cached || null;
            } else {
               chat.customer_avatar_url = cached || null;
            }
          }
        }
      } catch (e) {
        console.error("Failed to enrich avatars", e);
      }

      // last sender of last message enrichment (best-effort)
      try {
        const ids = (items as any[]).map((c) => (c as any).id);
        if (ids.length > 0) {
          const { data: msgs } = await supabaseAdmin
            .from("chat_messages")
            .select("chat_id, is_from_customer, sender_type, created_at")
            .in("chat_id", ids)
            .order("created_at", { ascending: false });
          const lastByChat: Record<string, string> = {};
          for (const r of ((msgs as any[]) || [])) {
            const cid = (r as any).chat_id as string;
            if (lastByChat[cid]) continue;
            const from = (r as any).is_from_customer ? "CUSTOMER" : ((r as any).sender_type || "AGENT");
            lastByChat[cid] = from;
          }
          for (const it of (items as any[])) {
            const cid = (it as any).id as string;
            if (lastByChat[cid]) (it as any).last_message_from = lastByChat[cid];
          }
        }
      } catch {}

      return ack?.({ ok: true, items, total: count ?? (items?.length || 0) });
    } catch (e: any) {
      return ack?.({ ok: false, error: e?.message || "chats list error" });
    }
  });

  // Send private message
  socket.on("message:private:send", async (params: any, ack?: (resp: any) => void) => {
    try {
      const authUserId = await socketAuthUserId(socket);
      if (!authUserId) {
        console.error("[socket] message:private:send - not authenticated");
        return ack?.({ ok: false, error: "Not authenticated" });
      }

      const chatId = params?.chatId as string;
      const text = (params?.text as string) || "";
      const mentions = (params?.mentions as string[]) || [];
      
      if (!chatId || !text.trim()) {
        console.error("[socket] message:private:send - missing chatId or text", { chatId, hasText: !!text });
        return ack?.({ ok: false, error: "chatId and text required" });
      }

      console.log("[socket] message:private:send - processing", { 
        chatId, 
        authUserId, 
        textLength: text.length,
        mentionsCount: mentions.length 
      });

      // Resolve local users.id from auth userId
      let localUserId: string | null = null;
      try {
        const { data: urow } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("user_id", authUserId)
          .maybeSingle();
        localUserId = (urow as any)?.id || null;
      } catch (err) {
        console.error("[socket] message:private:send - failed to resolve user", err);
      }

      // Get or create private_chat
      let privateChatId: string | null = null;
      const { data: existing } = await supabaseAdmin
        .from("private_chats")
        .select("id")
        .eq("chat_id", chatId)
        .maybeSingle();
      
      if (existing?.id) {
        privateChatId = existing.id;
      } else {
        const { data: created, error: errCreate } = await supabaseAdmin
          .from("private_chats")
          .insert([{ chat_id: chatId, is_active: true }])
          .select("id")
          .single();
        if (errCreate) {
          console.error("[socket] message:private:send - failed to create private_chat", errCreate);
          return ack?.({ ok: false, error: errCreate.message });
        }
        privateChatId = (created as any)?.id || null;
      }

      if (!privateChatId) {
        console.error("[socket] message:private:send - no private_chat_id");
        return ack?.({ ok: false, error: "Failed to create private_chat" });
      }

      // Insert message
      const nowIso = new Date().toISOString();
      const { data: inserted, error } = await supabaseAdmin
        .from("private_messages")
        .insert([{
          content: String(text).trim(),
          private_chat_id: privateChatId,
          sender_id: localUserId || authUserId,
          created_at: nowIso,
        }])
        .select("id, content, sender_id, created_at")
        .single();

      if (error) {
        console.error("[socket] message:private:send - insert failed", error);
        return ack?.({ ok: false, error: error.message });
      }

      console.log("[socket] message:private:send - message inserted", { messageId: inserted.id });

      // Save mentions if any
      if (mentions.length > 0 && localUserId) {
        const mentionRows = mentions.map((mentionedUserId) => ({
          message_id: inserted.id,
          message_type: "PRIVATE",
          mentioned_user_id: mentionedUserId,
          mentioned_by_user_id: localUserId,
        }));
        
        const { error: mentionError } = await supabaseAdmin
          .from("message_mentions")
          .insert(mentionRows);
        
        if (mentionError) {
          console.warn("[socket] message:private:send - failed to save mentions", mentionError);
        } else {
          console.log("[socket] message:private:send - mentions saved", { count: mentions.length });
          
          // Emit notification to mentioned users
          for (const mentionedUserId of mentions) {
            io.to(`user:${mentionedUserId}`).emit("user:mentioned", {
              messageId: inserted.id,
              chatId: chatId,
              mentionedBy: localUserId,
              messageType: "PRIVATE",
              timestamp: nowIso,
            });
            console.log("[socket] Notified user about mention", { mentionedUserId });
          }
        }
      }

      // Get sender name
      let senderName: string | null = null;
      if (localUserId) {
        try {
          const { data: u } = await supabaseAdmin
            .from("users")
            .select("name")
            .eq("id", localUserId)
            .maybeSingle();
          senderName = (u as any)?.name || null;
        } catch {}
      }

      // Format response
      const mapped = {
        id: inserted.id,
        chat_id: chatId,
        body: inserted.content,
        sender_type: "AGENT",
        sender_id: inserted.sender_id || null,
        created_at: inserted.created_at,
        view_status: null,
        type: "PRIVATE",
        is_private: true,
        sender_name: senderName,
      };

      // Emit to room
      io.to(`chat:${chatId}`).emit("message:new", mapped);
      
      console.log("[socket] message:private:send - success, emitted to room", { chatId, messageId: mapped.id });

      return ack?.({ ok: true, data: mapped });
    } catch (e: any) {
      console.error("[socket] message:private:send - error", e);
      return ack?.({ ok: false, error: e?.message || "private send error" });
    }
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

// ===== ROTAS DE LEADS MOVIDAS PARA routes/leads.ts =====
// As rotas abaixo foram movidas para o arquivo routes/leads.ts com isolamento por company_id
// Mantidas aqui comentadas para referência histórica

/*
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

// Statistics endpoint
app.get("/api/leads/stats", requireAuth, async (_req, res) => {
  try {
    // Get all leads
    const { data: allLeads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("id, status_client, created_at, kanban_column_id, customer_id");
    
    if (leadsError) throw leadsError;

    const leads = allLeads || [];
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calculate basic metrics
    const total = leads.length;
    const active = leads.filter((l: any) => 
      (l.status_client || "").toLowerCase() === "ativo"
    ).length;
    const inactive = total - active;

    const newThisMonth = leads.filter((l: any) => 
      new Date(l.created_at) >= firstDayThisMonth
    ).length;
    const newLastMonth = leads.filter((l: any) => {
      const created = new Date(l.created_at);
      return created >= firstDayLastMonth && created <= lastDayLastMonth;
    }).length;

    // Distribution by kanban stage
    const byStage: Record<string, number> = {};
    const stageIds = [...new Set(leads.map((l: any) => l.kanban_column_id).filter(Boolean))];
    
    // Get stage names
    const { data: columns } = await supabaseAdmin
      .from("kanban_columns")
      .select("id, name, title")
      .in("id", stageIds);

    const stageMap = new Map((columns || []).map((c: any) => [c.id, c.name || c.title || "Sem título"]));

    for (const lead of leads) {
      if (lead.kanban_column_id) {
        const stageName = stageMap.get(lead.kanban_column_id) || "Outros";
        byStage[stageName] = (byStage[stageName] || 0) + 1;
      } else {
        byStage["Sem etapa"] = (byStage["Sem etapa"] || 0) + 1;
      }
    }

    // Count leads with proposals
    const leadIds = leads.map((l: any) => l.id);
    const { data: proposals } = await supabaseAdmin
      .from("proposals")
      .select("lead_id, total_value")
      .in("lead_id", leadIds);

    const leadsWithProposals = new Set((proposals || []).map((p: any) => p.lead_id)).size;
    const conversionRate = total > 0 ? leadsWithProposals / total : 0;
    
    const totalValue = (proposals || []).reduce((sum: number, p: any) => sum + (Number(p.total_value) || 0), 0);
    const avgTicket = leadsWithProposals > 0 ? totalValue / leadsWithProposals : 0;

    return res.json({
      total,
      active,
      inactive,
      newThisMonth,
      newLastMonth,
      byStage,
      withProposals: leadsWithProposals,
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgTicket: Math.round(avgTicket * 100) / 100,
    });
  } catch (error: any) {
    console.error("[leads/stats] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to get stats" });
  }
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
*/

// ===== FIM DAS ROTAS DE LEADS ANTIGAS =====


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

    console.log(`[PUT /assignee] Request for chat ${chatId}`, { linkIdParam, userIdParam, unassign });

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

    // Helper to get actor name
    const getActorName = async () => {
      if (!actingLocalUserId) return "Alguém";
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("id", actingLocalUserId)
        .maybeSingle();
      return u?.name || "Alguém";
    };

    // 3) Remover atribuição
    if (unassign === true) {
      const { error: errUpd } = await supabaseAdmin
        .from("chats")
        .update({ assignee_agent: null })
        .eq("id", chatId);
      if (errUpd) return res.status(500).json({ error: errUpd.message });

      // System message
      const actorName = await getActorName();
      const { data: insertedMsg, error: insertError } = await supabaseAdmin.from("chat_messages").insert({
        chat_id: chatId,
        content: `${actorName} removeu a atribuição`,
        type: "SYSTEM",
        is_from_customer: false,
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertError) {
        console.error("[PUT /assignee] Failed to insert unassign system message:", insertError);
      }

      try {
        io?.emit("chat:updated", {
          chatId,
          assigned_agent_id: null,
          assigned_agent_name: null,
        });
        // Emit new message event to update UI immediately
        if (insertedMsg) {
          io?.to(`chat:${chatId}`).emit("message:new", {
              id: insertedMsg.id,
              chat_id: chatId,
              content: `${actorName} removeu a atribuição`,
              type: "SYSTEM",
              sender_type: "SYSTEM",
              created_at: insertedMsg.created_at,
          });
        }
      } catch (e) {
        console.error("[PUT /assignee] Socket emit error:", e);
      }

      // Invalidate cache
      try {
        await rDel(k.chat(chatId));
        await clearMessageCache(chatId);
        // Clear list caches for this company
        const companyId = req.user?.company_id;
        if (companyId) {
          const pattern = k.listPrefixCompany(companyId);
          const keys = await redis.keys(pattern);
          if (keys.length > 0) await redis.del(...keys);
        }
      } catch (cacheErr) {
        console.error("[PUT /assignee] Cache invalidation error:", cacheErr);
      }

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
    console.log(`[PUT /assignee] Updating chat ${chatId} with assignee_agent=${targetLinkId}`);
    const { error: errUpdate } = await supabaseAdmin
      .from("chats")
      .update({ assignee_agent: targetLinkId })
      .eq("id", chatId);
    if (errUpdate) {
      console.error(`[PUT /assignee] Update failed:`, errUpdate);
      return res.status(500).json({ error: errUpdate.message });
    }

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

      // System message
      const actorName = await getActorName();
      const msgContent = `${actorName} atribuiu a ${assignedName || "um agente"}`;
      
      const { data: insertedMsg, error: insertError } = await supabaseAdmin.from("chat_messages").insert({
        chat_id: chatId,
        content: msgContent,
        type: "SYSTEM",
        is_from_customer: false,
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertError) {
        console.error("[PUT /assignee] Failed to insert system message:", insertError);
      } else if (insertedMsg) {
        io?.to(`chat:${chatId}`).emit("message:new", {
          id: insertedMsg.id,
          chat_id: chatId,
          content: msgContent,
          type: "SYSTEM",
          sender_type: "SYSTEM",
          created_at: insertedMsg.created_at,
        });
      }

    } catch (e) {
      console.error("[PUT /assignee] System message error:", e);
    }

    // Invalidate cache
    try {
      await rDel(k.chat(chatId));
      await clearMessageCache(chatId);
      // Clear list caches for this company
      const companyId = req.user?.company_id;
      if (companyId) {
        const pattern = k.listPrefixCompany(companyId);
        const keys = await redis.keys(pattern);
        if (keys.length > 0) await redis.del(...keys);
      }
    } catch (cacheErr) {
      console.error("[PUT /assignee] Cache invalidation error:", cacheErr);
    }

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

// List all inboxes with stats
app.get("/livechat/inboxes/stats", requireAuth, async (req: any, res) => {
  try {
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("company_id, role")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id;
    if (!companyId)
      return res.status(404).json({ error: "Usuário sem company_id" });
    
    const { data: inboxes, error } = await supabaseAdmin
      .from("inboxes")
      .select(
        "id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, waha_db_name",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    
    // For each inbox, get contact stats
    const inboxesWithStats = await Promise.all((inboxes || []).map(async (inbox: any) => {
      // Count total unique customers linked to this inbox via chats
      const { count: totalContacts } = await supabaseAdmin
        .from("chats")
        .select("customer_id", { count: "exact", head: true })
        .eq("inbox_id", inbox.id)
        .not("customer_id", "is", null);
      
      // Count active chats (status OPEN or null)
      const { count: activeContacts } = await supabaseAdmin
        .from("chats")
        .select("customer_id", { count: "exact", head: true })
        .eq("inbox_id", inbox.id)
        .not("customer_id", "is", null)
        .or("status.eq.OPEN,status.is.null");
      
      return {
        ...inbox,
        stats: {
          total_contacts: totalContacts || 0,
          active_contacts: activeContacts || 0,
        }
      };
    }));
    
    return res.json(inboxesWithStats);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "inboxes stats error" });
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


// ===== Tags (labels) management moved to livechat.tags.ts =====


// --------- REGISTRO DAS ROTAS DO KANBAN ----------
registerKanbanRoutes(app, { requireAuth, supabaseAdmin, io });

registerLivechatChatRoutes(app);
registerLivechatTagsRoutes(app);

async function socketAuthUserId(socket: any): Promise<string | null> {
  try {
    let token: string | undefined = socket.handshake?.auth?.token;

    const headers = (socket.request?.headers || {}) as any;
    
    if (!token) {
      const auth =
        (headers["authorization"] as string | undefined) ||
        (headers["Authorization"] as string | undefined);
      if (auth && auth.startsWith("Bearer ")) token = auth.slice(7);
    }

    if (!token) {
      const rawCookie = (headers["cookie"] as string | undefined) || "";
      const parts = rawCookie.split(/;\s*/).map((p) => p.trim().split("="));
      for (const [k, v] of parts) {
        if (k && k.trim() === JWT_COOKIE_NAME && v) {
          token = decodeURIComponent(v);
          break;
        }
      }
    }
    if (!token) {
      console.warn("[socketAuthUserId] No token found", {
        hasAuthToken: !!socket.handshake?.auth?.token,
        hasAuthHeader: !!headers["authorization"],
        hasCookie: !!headers["cookie"],
        cookieKeys: headers["cookie"]?.split(/;\s*/).map((p: string) => p.split("=")[0]),
        JWT_COOKIE_NAME,
      });
      return null;
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user?.id) {
      console.warn("[socketAuthUserId] Auth failed", { error: error?.message });
      return null;
    }
    return data.user.id as string;
  } catch (err) {
    console.error("[socketAuthUserId] Exception", err);
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
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (leadFilter) {
      query = query.eq("lead_id", leadFilter);
    }

    const { data: src, error: serr } = await query;
    if (serr) return res.status(500).json({ error: serr.message });

    return res.json(src || []);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "proposals list error" });
  }
});

// POST /proposals (create)
app.post("/proposals", requireAuth, async (req: any, res) => {
  try {
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id || null;

    if (!companyId) return res.status(403).json({ error: "No company" });

    // Gerar número sequencial YYYYMM-####
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
    if (lastNum && /^\d{6}-\d{4}$/.test(lastNum)) {
      seq = (parseInt(lastNum.slice(-4)) || 0) + 1;
    }
    const newNumber = `${ym}-${seq.toString().padStart(4, "0")}`;

    const insert: any = { ...req.body, company_id: companyId, number: newNumber, created_by_id: (urow as any).id };

    const { data: created, error: cerr } = await supabaseAdmin
      .from("proposals")
      .insert([insert])
      .select("*")
      .single();

    if (cerr) return res.status(500).json({ error: cerr.message });
    return res.status(201).json(created);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "proposal create error" });
  }
});

// POST /proposals/:id/duplicate
app.post("/proposals/:id/duplicate", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });
    const companyId = (urow as any)?.company_id || null;

    if (!companyId) return res.json([]);

    // Buscar proposta original
    const { data: src, error: serr } = await supabaseAdmin
      .from("proposals")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (serr) return res.status(500).json({ error: serr.message });
    if (!src || (src as any).company_id !== companyId)
      return res.status(404).json({ error: "Proposta não encontrada" });

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

// ONBOARDING (precisa vir ANTES dos routers globais /api que tem requireAuth)
registerOnboardingRoutes(app);
registerAdminRoutes(app);
registerAdminStatsRoutes(app);
app.use("/api/admin", adminAgentsRouter);
registerSubscriptionRoutes(app);
app.use("/api/checkout", checkoutRouter);

// autenticados
startLivechatSocketBridge();
registerLivechatContactsRoutes(app);
registerLivechatInboxesRoutes(app);
registerOpenAIIntegrationRoutes(app);
registerAgentsRoutes(app);
registerAgentTemplatesRoutes(app);
registerAgentTemplatesAdminRoutes(app);
registerCompanyRoutes(app);
registerDepartmentsRoutes(app);
registerTeamsRoutes(app);
registerKnowledgeBaseRoutes(app);
registerCalendarRoutes(app);
registerLeadRoutes(app);
app.use("/api/upload", uploadRouter);
app.use("/api/media", mediaRouter);
registerProductRoutes(app);
registerMetaTemplatesRoutes(app);
registerDocumentRoutes(app);
registerDocumentTemplateRoutes(app);
// ATENÇÃO: Esses routers aplicam requireAuth globalmente em /api/*
// Por isso o onboarding precisa estar registrado ANTES
app.use("/api", templateToolsRouter);
app.use("/api", toolsAdminRouter);
registerSettingsInboxesRoutes(app);
registerSettingsUsersRoutes(app);
registerSendMessageRoutes(app); // ajuste a assinatura p/ injetar o guard
registerCampaignRoutes(app);

registerCampaignSegmentsRoutes(app);
registerCampaignFollowupsRoutes(app);
registerCampaignUploadsRoutes(app);
registerMediaLibraryRoutes(app);

registerWAHARoutes(app);
registerDashboardRoutes(app);
registerTaskRoutes(app);
registerAutomationRulesRoutes(app);
registerMetaHealthRoutes(app);
registerCustomerOptInRoutes(app);

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
