import express, { Response } from "express";
import crypto from "node:crypto";
import { requireApiKey } from "../middlewares/requireApiKey.js";
import { requireApiFeature, apiRateLimiter } from "../middlewares/api-v1-limits.js";
import { AuthRequest } from "../types/express.js";
import { 
  SendMessageV1Schema, 
  UpsertContactV1Schema, 
  ToggleAiAgentV1Schema, 
  TriggerFlowV1Schema,
  WebhookSubscriptionV1Schema
} from "../schemas/api.v1.schema.ts";
import { normalizeMsisdn } from "../utils/util.util.js";
import { ensureLeadCustomerChat } from "../services/meta/store.service.js";
import { publish, EX_APP } from "../queue/rabbit.js";
import { WAHA_PROVIDER } from "../services/waha/client.service.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { uploadBufferToStorage, buildStoragePath, extFromMime } from "../lib/storage.js";
import db from "../pg.js";
import { triggerManualFlow } from "../services/flow-engine.service.js";
import { validateCampaignSafety } from "../services/campaigns/validation.service.js";
import { bumpScopeVersion } from "../lib/cache.js";
import { rDelMatch } from "../lib/redis.js";
import { WebhookService } from "../services/webhook.service.js";

const router = express.Router();

// Apply global middlewares to all V1 routes
router.use(requireApiKey);
router.use(requireApiFeature);
router.use(apiRateLimiter);

/**
 * @route   GET /api/v1/chats
 * @desc    List active chats
 */
router.get("/chats", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = Number(req.query.offset || 0);

    const { data: chats, error, count } = await supabaseAdmin
      .from("chats")
      .select(`
        id, 
        status, 
        last_message, 
        updated_at, 
        created_at,
        inbox:inboxes(id, name, type),
        contact:customers(id, name, phone, email)
      `, { count: "exact" })
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.json({
      data: chats,
      pagination: {
        total: count,
        limit,
        offset
      }
    });
  } catch (error: any) {
    console.error("[api:v1:chats:list] error:", error);
    return res.status(500).json({ error: error.message || "Erro ao listar chats" });
  }
});

/**
 * @route   GET /api/v1/chats/:id/messages
 * @desc    List messages for a specific chat
 */
router.get("/chats/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Number(req.query.offset || 0);

    // Verify chat ownership
    const { data: chat } = await supabaseAdmin
      .from("chats")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (!chat) return res.status(404).json({ error: "Chat não encontrado" });

    const { data: messages, error, count } = await supabaseAdmin
      .from("messages")
      .select("*", { count: "exact" })
      .eq("chat_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.json({
      data: messages,
      pagination: {
        total: count,
        limit,
        offset
      }
    });
  } catch (error: any) {
    console.error("[api:v1:messages:list] error:", error);
    return res.status(500).json({ error: error.message || "Erro ao listar mensagens" });
  }
});

/**
 * @route   GET /api/v1/health
 * @desc    Check API Key status
 * @access  Public (via API Key)
 */
router.get("/health", (req: AuthRequest, res: Response) => {
  return res.json({
    ok: true,
    company_id: req.user?.company_id,
    authenticated_as: req.user?.name,
    timestamp: new Date().toISOString()
  });
});

// --- LIVECHAT ---

/**
 * @route   GET /api/v1/chats
 * @desc    List active chats
 */
router.get("/chats", async (req: AuthRequest, res: Response) => {
  // TODO: Implement list chats logic
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * @route   POST /api/v1/messages/send
 * @desc    Send a message (Text or Media)
 */
router.post("/messages/send", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: "Contexto de empresa não encontrado" });

    const parsed = SendMessageV1Schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const {
      inbox_id,
      phone,
      text,
      type,
      media_url,
      media_base64,
      filename: filenameHint,
      name,
    } = parsed.data;

    // 1. Validar vinculação da Inbox com a Empresa
    const { data: inbox, error: errInbox } = await supabaseAdmin
      .from("inboxes")
      .select("id, provider, phone_number")
      .eq("id", inbox_id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (errInbox) return res.status(500).json({ error: "Erro ao validar inbox" });
    if (!inbox) return res.status(404).json({ error: "Inbox não encontrada ou não pertence a esta empresa" });

    // 2. Garantir Lead, Customer e Chat
    const { chatId, customerId } = await ensureLeadCustomerChat({
      inboxId: inbox_id,
      companyId,
      phone,
      name: name || null,
      rawPhone: phone,
    });

    if (!chatId) return res.status(500).json({ error: "Falha ao criar ou encontrar chat para o contato" });

    // 3. Processar Mídia (se houver)
    let finalMediaUrl = media_url || null;
    let finalMimeType = null;
    let finalFileName = filenameHint || "file";

    if (media_base64) {
      const b64Regex = /^data:([^;]+);base64,(.*)$/;
      const match = media_base64.match(b64Regex);
      let bData = media_base64;
      if (match) {
        finalMimeType = match[1];
        bData = match[2];
      }
      const buffer = Buffer.from(bData, "base64");
      
      const ext = extFromMime(finalMimeType);
      finalFileName = filenameHint ? (filenameHint.includes(".") ? filenameHint : `${filenameHint}.${ext}`) : `upload_${Date.now()}.${ext}`;
      
      const storagePath = buildStoragePath({
        companyId,
        chatId,
        filename: finalFileName,
        prefix: "api-v1-uploads",
      });

      const up = await uploadBufferToStorage({
        buffer,
        contentType: finalMimeType || undefined,
        path: storagePath,
      });

      finalMediaUrl = up.publicUrl;
    }

    // 4. Inserir mensagem no banco (idempotente se necessário, mas aqui geramos nova)
    const nowIso = new Date().toISOString();
    const isWaha = inbox.provider === WAHA_PROVIDER;
    
    const { data: inserted, error: errIns } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        inbox_id: inbox_id,
        company_id: companyId,
        content: text || (type === "text" ? "" : `[Mídia: ${type}]`),
        type: type.toUpperCase(),
        is_from_customer: false,
        media_url: finalMediaUrl,
        created_at: nowIso,
        sender_id: null, // API Request
        sender_name: "Integração API",
      })
      .select()
      .single();

    if (errIns) throw new Error(errIns.message);

    // 5. Enfileirar para o Worker
    if (isWaha) {
      const normPhone = normalizeMsisdn(phone);
      const wahaRecipient = `${normPhone}@c.us`;

      const payload: any = {
        type: type === "text" ? "text" : "media",
        content: text || "",
        to: wahaRecipient,
        draftId: inserted.id,
      };

      if (type !== "text" && finalMediaUrl) {
        payload.kind = type === "document" ? "document" : type;
        payload.mediaUrl = finalMediaUrl;
        payload.filename = finalFileName;
        payload.mimeType = finalMimeType;
      }

      await publish(EX_APP, "outbound.request", {
        jobType: "outbound.request",
        provider: WAHA_PROVIDER,
        companyId,
        inboxId: inbox_id,
        chatId,
        customerId,
        messageId: inserted.id,
        payload,
        attempt: 0,
        createdAt: nowIso,
      });
    } else {
      // META
      if (type === "text") {
        await publish(EX_APP, "outbound.request", {
          jobType: "message.send",
          kind: "send-text",
          provider: "META",
          chatId,
          inboxId: inbox_id,
          customerId,
          messageId: inserted.id,
          content: text || "",
          attempt: 0,
          createdAt: nowIso,
        });
      } else if (finalMediaUrl) {
        await publish(EX_APP, "outbound.request", {
          jobType: "meta.sendMedia",
          provider: "META",
          inboxId: inbox_id,
          chatId,
          customerId,
          messageId: inserted.id,
          public_url: finalMediaUrl,
          mime_type: finalMimeType,
          filename: finalFileName,
          attempt: 0,
          createdAt: nowIso,
        });
      }
    }

    return res.status(201).json({
      ok: true,
      message_id: inserted.id,
      chat_id: chatId,
      contact_id: customerId,
    });

  } catch (error: any) {
    console.error("[api:v1:send] error:", error);
    return res.status(500).json({ error: error.message || "Erro inesperado ao enviar mensagem" });
  }
});

/**
 * @route   PATCH /api/v1/chats/:id/ai-agent
 * @desc    Toggle AI Agent
 */
router.patch("/chats/:id/ai-agent", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const parsed = ToggleAiAgentV1Schema.safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { enabled } = parsed.data;

    const { data: chat, error: fetchError } = await supabaseAdmin
      .from("chats")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (fetchError || !chat) return res.status(404).json({ error: "Chat não encontrado" });

    const updateData: any = { ai_active: enabled };
    
    // Se desativar o agente, geralmente queremos que o status volte para PENDING para um humano atender
    if (!enabled && chat.status === "BOT") {
      updateData.status = "PENDING";
    }

    const { error: updateError } = await supabaseAdmin
      .from("chats")
      .update(updateData)
      .eq("id", id);

    if (updateError) throw updateError;

    // 🪝 Trigger Webhook
    WebhookService.trigger("chat.status_updated", companyId, {
      chat_id: id,
      ai_active: enabled,
      status: updateData.status || chat.status,
      updated_at: new Date().toISOString()
    }).catch(err => console.error("[WebhookService] Failed to trigger chat.status_updated via API", err));

    return res.json({
      ok: true,
      chat_id: id,
      ai_active: enabled,
      status: updateData.status || chat.status
    });

  } catch (error: any) {
    console.error("[api:v1:ai-agent] error:", error);
    return res.status(500).json({ error: error.message || "Erro ao alternar Agente de IA" });
  }
});

// --- CONTACTS ---

/**
 * @route   POST /api/v1/contacts
 * @desc    Create or update contact (Upsert)
 */
router.post("/contacts", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: "Contexto de empresa não encontrado" });

    const parsed = UpsertContactV1Schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { name, phone, email, tags, notes } = parsed.data;

    // 1. Garantir Lead e Customer (Lógica similar ao que o sistema usa internamente)
    // Usamos a função ensureLeadCustomerChat mas sem necessidade de InboxId imediato se for puramente contato?
    // Na verdade, no sistema, um Customer costuma estar vinculado a um Lead.
    
    // Vamos fazer um manual upsert para garantir o controle total pedido pelo usuário
    const msisdn = normalizeMsisdn(phone);
    if (!msisdn) return res.status(400).json({ error: "Formato de telefone inválido" });

    const result = await db.withTransaction(async (tx) => {
      // a) Upsert Customer
      const customer = await tx.one(
        `INSERT INTO public.customers (company_id, name, phone, email, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (company_id, phone) 
         DO UPDATE SET 
            name = EXCLUDED.name, 
            email = COALESCE(EXCLUDED.email, customers.email),
            notes = COALESCE(EXCLUDED.notes, customers.notes),
            updated_at = now()
         RETURNING id, lead_id`,
        [companyId, name, msisdn, email || null, notes || null]
      );

      // b) Upsert Lead (se não existir um vinculado)
      let leadId = customer.lead_id;
      if (!leadId) {
        const lead = await tx.one(
          `INSERT INTO public.leads (company_id, name, phone, customer_id, created_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (company_id, phone) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [companyId, name, msisdn, customer.id]
        );
        leadId = lead.id;
        
        // Vincular o lead de volta ao customer se estiver solto
        await tx.none(`UPDATE public.customers SET lead_id = $1 WHERE id = $2`, [leadId, customer.id]);
      }

      // c) Tags (opcional)
      if (tags && tags.length > 0) {
        // TODO: Implementar lógica de tags se necessário (tabela customer_tags ou similar)
        // Por hora apenas logamos ou inserimos se a tabela existir
      }

      return { customerId: customer.id, leadId };
    });

    return res.json({
      ok: true,
      contact_id: result.customerId,
      lead_id: result.leadId,
      name,
      phone: msisdn
    });

  } catch (error: any) {
    console.error("[api:v1:contacts] error:", error);
    return res.status(500).json({ error: error.message || "Erro ao processar contato" });
  }
});

// --- CAMPAIGNS ---

/**
 * @route   POST /api/v1/campaigns/:id/start
 * @desc    Start a campaign
 */
router.post("/campaigns/:id/start", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    // 1. Verificar se a campanha existe e pertence à empresa
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from("campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (fetchError || !campaign) return res.status(404).json({ error: "Campanha não encontrada" });

    if (campaign.status === "RUNNING") {
      return res.status(400).json({ error: "Campanha já está em execução" });
    }

    // 2. Validar segurança (mesma lógica do dashboard)
    const validation = await validateCampaignSafety(id);
    if (!validation.safe) {
      return res.status(400).json({
        error: "Campanha não passou na validação de segurança",
        critical_issues: validation.critical_issues,
      });
    }

    // 3. Ativar
    const { error: updateError } = await supabaseAdmin
      .from("campaigns")
      .update({ status: "RUNNING", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) throw updateError;

    // 4. Limpar cache
    await bumpScopeVersion(companyId, "livechat:campaigns");
    await rDelMatch(`livechat:campaigns:${companyId}:*`);

    return res.json({
      ok: true,
      campaign_id: id,
      status: "RUNNING"
    });

  } catch (error: any) {
    console.error("[api:v1:campaigns:start] error:", error);
    return res.status(500).json({ error: error.message || "Erro ao iniciar campanha" });
  }
});

// --- FLOWS ---

/**
 * @route   POST /api/v1/flows/:id/trigger
 * @desc    Trigger a flow for a contact
 */
router.post("/flows/:id/trigger", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const parsed = TriggerFlowV1Schema.safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { contact_id, chat_id, trigger_data } = parsed.data;

    // 1. Verificar se o flow existe
    const { data: flow, error: flowError } = await supabaseAdmin
      .from("automation_flows")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (flowError || !flow) return res.status(404).json({ error: "Fluxo não encontrado" });

    // 2. Disparar via FlowEngine
    await triggerManualFlow({
      companyId,
      flowId: id,
      contactId: contact_id,
      chatId: chat_id,
      variables: trigger_data
    });

    return res.json({
      ok: true,
      message: "Fluxo agendado para disparo"
    });

  } catch (error: any) {
    console.error("[api:v1:flows:trigger] error:", error);
    return res.status(500).json({ error: error.message || "Erro ao disparar fluxo" });
  }
});

// --- WEBHOOKS ---

/**
 * @route   GET /api/v1/webhooks
 * @desc    List webhook subscriptions
 */
router.get("/webhooks", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { data, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .select("*")
      .eq("company_id", companyId);

    if (error) throw error;
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/v1/webhooks
 * @desc    Create a webhook subscription
 */
router.post("/webhooks", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const parsed = WebhookSubscriptionV1Schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { url, events } = parsed.data;
    const secret = crypto.randomBytes(32).toString("hex");

    const { data, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .insert({
        company_id: companyId,
        url,
        events,
        secret,
        is_active: true
      })
      .select("*")
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route   DELETE /api/v1/webhooks/:id
 * @desc    Delete a webhook subscription
 */
router.delete("/webhooks/:id", async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw error;
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const apiV1Router = router;
