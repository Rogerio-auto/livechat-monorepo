import "dotenv/config";
import express from "express";
import session from "express-session";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "node:path";

// Core setup & Utils
import { setIO } from "./lib/io.js";
import { logger } from "./lib/logger.js";
import { supabaseAdmin } from "./lib/supabase.js";
import { getRedis, rGet, rSet } from "./lib/redis.js";
import { syncGlobalWahaApiKey } from "./services/waha/sync-global-api-key.service.js";
import { registerCampaignWorker } from "./worker.campaigns.js";
import { startScheduler } from "./jobs/scheduler.js";
import { errorHandler } from "./middlewares/errorHandler.js";

// Socket logic
import { setupSocketHandlers } from "./socket/index.js";
import { startLivechatSocketBridge } from "./socket/bridge.livechat.js";
import { startSocketRelay } from "./socket.relay.js";

// Controllers (Internal modularization)
import { QueueController } from "./controllers/queue.controller.js";
import { SystemController } from "./controllers/system.controller.js";
import { LivechatController } from "./controllers/livechat.controller.js";
import { CompanyController } from "./controllers/company.controller.js";
import { ProposalController } from "./controllers/proposal.controller.js";
import { DocumentController } from "./controllers/document.controller.js";

// Middleware & Base Routes
import { requireAuth } from "./middlewares/requireAuth.js";
import { 
  requireActiveSubscription, 
  requireLimit, 
  requireFeature 
} from "./middlewares/checkSubscription.js";
import { webhookRouter } from "./routes/webhooks.js";
import { apiV1Router } from "./routes/api.v1.js";
import filesRoute from "./server/files.route.js";
import mediaProxyRouter from "./routes/media.proxy.js";
import uploadRouter from "./routes/upload.js";
import mediaRouter from "./routes/media.js";
import { checkoutRouter } from "./routes/checkout.js";

// External Route Modules
import { metaWebhookGet, metaWebhookPost } from "./routes/metawebhook.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerWAHARoutes } from "./routes/waha.js";
import { registerCadastroRoutes } from "./routes/cadastro.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAdminStatsRoutes } from "./routes/admin.stats.js";
import { registerSubscriptionRoutes } from "./routes/subscriptions.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerCalendarRoutes } from "./routes/calendar.js";
import { registerCampaignRoutes } from "./routes/livechat.campaigns.js";
import { registerCampaignSegmentsRoutes } from "./routes/livechat.campaigns.segments.js";
import { registerCampaignFollowupsRoutes } from "./routes/livechat.campaigns.followups.js";
import { registerCampaignUploadsRoutes } from "./routes/livechat.campaigns.uploads.js";
import { registerMediaLibraryRoutes } from "./routes/livechat.mediaLibrary.js";
import { registerKnowledgeBaseRoutes } from "./routes/knowledge.base.js";
import { registerDepartmentsRoutes } from "./routes/departments.js";
import { registerTeamsRoutes } from "./routes/teams.js";
import { registerLivechatChatRoutes } from "./routes/livechat.chats.js";
import { registerLivechatContactsRoutes } from "./routes/livechat.contacts.js";
import { registerLivechatInboxesRoutes } from "./routes/livechat.inboxes.js";
import { registerKanbanRoutes } from "./routes/kanban.js";
import { registerSettingsUsersRoutes } from "./routes/settings.users.js";
import { registerSettingsInboxesRoutes } from "./routes/settings.inboxes.js";
import { registerOpenAIIntegrationRoutes } from "./routes/integrations.openai.js";
import { registerAgentsRoutes } from "./routes/agents.js";
import { registerAgentsMonitoringRoutes } from "./routes/agents.monitoring.js";
import { registerAgentTemplatesRoutes } from "./routes/agents.templates.js";
import { registerAgentTemplatesAdminRoutes } from "./routes/agents.templates.admin.js";
import { registerCompanyRoutes } from "./routes/companies.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerMetaTemplatesRoutes } from "./routes/meta.templates.js";
import { registerMetaFlowsRoutes } from "./routes/meta.flows.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerDocumentTemplateRoutes } from "./routes/document-templates.js";
import { registerProjectTemplateRoutes } from "./routes/project-templates.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerLivechatTagsRoutes } from "./routes/livechat.tags.js";
import { registerFlowRoutes } from "./routes/livechat.flows.js";
import { registerMetaHealthRoutes } from "./routes/meta.health.js";
import { registerCustomerOptInRoutes } from "./routes/customers.optin.js";
import { registerSendMessageRoutes } from "./routes/sendMessage.js";
import { settingsApiRouter } from "./routes/settings.api.js";

// Specific Routers
import adminAgentsRouter from "./routes/admin/agents.js";
import adminTemplatesRouter from "./routes/admin/templates.js";
import adminToolsRouter from "./routes/admin/tools.js";
import adminInfrastructureRouter from "./routes/admin/infrastructure.js";
import adminCompaniesRouter from "./routes/admin/companies.js";
import templateToolsRouter from "./routes/agents.templates.tools.js";
import toolsAdminRouter from "./routes/tools.admin.js";

const FRONTEND_ORIGINS = Array.from(
  new Set([
    ...(process.env.FRONTEND_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "https://app.7sion.com",
    "https://7sion.com",
  ])
);

const corsOptions = {
  origin: (origin: any, callback: any) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const isAllowed =
      FRONTEND_ORIGINS.includes(origin) ||
      origin.endsWith(".7sion.com") ||
      origin.endsWith("7sion.com") ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:");
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Bloqueado para origem: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With", 
    "Accept", 
    "Origin", 
    "token",
    "Cache-Control",
    "Pragma",
    "Expires",
    "If-Modified-Since"
  ],
  exposedHeaders: ["set-cookie"]
};

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with correct CORS
const io = new SocketIOServer(server, { cors: corsOptions });

setIO(io);
startSocketRelay(io);

// ===== CONFIG & MIDDLEWARES =====
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Muitas requisições vindas deste IP, tente novamente mais tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

app.use(cookieParser());
app.use(express.json({
  limit: "2mb",
  verify: (req: any, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Webhooks
app.use("/api/webhooks", webhookRouter);

// Public API V1
app.use("/api/v1", apiV1Router);

app.use(session({
  secret: process.env.SESSION_SECRET || "cadastro-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  }
}));

// Static files
const MEDIA_DIR = process.env.MEDIA_DIR || path.resolve(process.cwd(), "media");
app.use("/media", express.static(MEDIA_DIR));
app.use(filesRoute);

// ===== SOCKET SETUP =====
setupSocketHandlers(io);
startLivechatSocketBridge();

// ===== MODULE REGISTRATION =====

// Public & Admin
registerCadastroRoutes(app);
registerAdminRoutes(app);
registerAdminStatsRoutes(app);
app.use("/api/admin", adminAgentsRouter);
app.use("/api/admin/templates", adminTemplatesRouter);
app.use("/api/admin/tools", adminToolsRouter);
app.use("/api/admin/infrastructure", adminInfrastructureRouter);
registerSubscriptionRoutes(app);
app.use("/api/checkout", checkoutRouter);

// Authenticated - Routes that require active subscription
// Rotas críticas que exigem assinatura ativa
app.use("/api/livechat", requireAuth, requireActiveSubscription); // Bloquear livechat
app.use("/api/agents", requireAuth, requireActiveSubscription); // Bloquear agentes IA
app.use("/api/campaigns", requireAuth, requireActiveSubscription); // Bloquear campanhas

// Authenticated - Routes with subscription warning only (não bloqueiam)
registerAuthRoutes(app);
registerLivechatContactsRoutes(app);
registerLivechatInboxesRoutes(app);
registerOpenAIIntegrationRoutes(app);
registerBillingRoutes(app);
registerAgentsRoutes(app);
registerAgentsMonitoringRoutes(app);
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
registerMetaFlowsRoutes(app);
registerDocumentRoutes(app);
registerDocumentTemplateRoutes(app);
registerProjectTemplateRoutes(app);
registerProjectRoutes(app);
registerNotificationRoutes(app);
app.use("/api/admin/companies", adminCompaniesRouter);
app.use("/api", templateToolsRouter);
app.use("/api", toolsAdminRouter);
app.use("/api", settingsApiRouter);
registerSettingsInboxesRoutes(app);
registerSettingsUsersRoutes(app);
app.use("/api", settingsApiRouter);
registerSendMessageRoutes(app);
registerCampaignRoutes(app);
registerCampaignSegmentsRoutes(app);
registerCampaignFollowupsRoutes(app);
registerCampaignUploadsRoutes(app);
registerMediaLibraryRoutes(app);
registerWAHARoutes(app);
registerDashboardRoutes(app);
registerTaskRoutes(app);
registerMetaHealthRoutes(app);
registerCustomerOptInRoutes(app);
registerLivechatChatRoutes(app);
registerLivechatTagsRoutes(app);
registerFlowRoutes(app);
registerKanbanRoutes(app, { requireAuth, supabaseAdmin, io });

app.use("/media", mediaProxyRouter);

// Refactored Handlers (Moved from index.ts to Controllers)
app.get("/health", SystemController.healthCheck);
app.get("/_debug/redis/ping", SystemController.redisPing);
app.get("/_debug/redis/setget", SystemController.redisSetGet);

app.post("/queue/livechat/start-chat", requireAuth, QueueController.startChat);

app.get("/companies/me", requireAuth, CompanyController.getMyCompany);
app.put("/companies/me", requireAuth, CompanyController.updateMyCompany);

app.get("/proposals", requireAuth, ProposalController.listProposals);
app.post("/proposals", requireAuth, ProposalController.createProposal);
app.get("/proposals/stats", requireAuth, ProposalController.stats);
app.get("/proposals/:id", requireAuth, ProposalController.getById);
app.post("/proposals/:id/duplicate", requireAuth, ProposalController.duplicateProposal);
app.put("/proposals/:id/status", requireAuth, ProposalController.updateStatus);
app.delete("/proposals/:id", requireAuth, ProposalController.deleteProposal);

app.get("/documents", requireAuth, DocumentController.listDocuments);
app.post("/documents", requireAuth, requireFeature("document_generation"), DocumentController.createDocument);
app.get("/documents/:id", requireAuth, DocumentController.getById);
app.get("/documents/:id/download", requireAuth, DocumentController.downloadDocument);

// Missing Livechat/Inboxes/Kanban Handlers
app.get("/livechat/inboxes/my", requireAuth, LivechatController.getMyInboxes);
app.get("/livechat/inboxes/stats", requireAuth, LivechatController.getInboxesStats);
app.get("/livechat/inboxes", requireAuth, LivechatController.listInboxes);
app.post("/livechat/inboxes", requireAuth, requireLimit("inboxes"), LivechatController.createInbox);
app.put("/livechat/inboxes/:id", requireAuth, LivechatController.updateInbox);
app.delete("/livechat/inboxes/:id", requireAuth, LivechatController.deleteInbox);
app.get("/livechat/inboxes/:id/agents", requireAuth, LivechatController.getInboxAgents);
app.post("/livechat/inboxes/:id/users", requireAuth, LivechatController.addInboxAgent);
app.delete("/livechat/inboxes/:id/users/:userId", requireAuth, LivechatController.removeInboxAgent);
app.put("/livechat/chats/:id/assignee", requireAuth, LivechatController.assignChat);
app.get("/livechat/chats/:id/kanban", requireAuth, LivechatController.getChatKanban);

// Meta Integrations
app.get("/integrations/meta/webhook", metaWebhookGet);
app.post("/integrations/meta/webhook", metaWebhookPost);

// Global Error Handler
app.use(errorHandler);

const PORT = Number(process.env.PORT_BACKEND || 5000);

if (process.env.NODE_ENV !== "test") {
  void (async () => {
    try { await syncGlobalWahaApiKey(); } catch (e) { console.error("[WAHA] API Key sync failed", e); }
    try { await registerCampaignWorker(); } catch (e) { console.error("[Campaign] Worker failed", e); }
    try { startScheduler(); } catch (e) { console.error("[Scheduler] Start failed", e); }

    server.listen(PORT, () => {
      console.log(`🚀 [BACKEND] Server listening on port ${PORT}`);
      LivechatController.startListeners();
    });
  })();
}

export { app, server };



