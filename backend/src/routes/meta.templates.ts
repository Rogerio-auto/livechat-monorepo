import type { Application } from "express";
import { ZodError, z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { EX_APP, publish } from "../queue/rabbit.js";
import {
  createWhatsAppTemplate,
  listWhatsAppTemplates,
  getWhatsAppTemplate,
  deleteWhatsAppTemplate,
  sendTemplateMessage,
  uploadMediaToMeta,
} from "../services/meta/templates.service.js";
import { sendInteractiveButtons } from "../services/meta/graph.service.js";

async function resolveCompanyId(req: any) {
  const companyId = req.profile?.company_id || req?.user?.company_id || null;
  if (!companyId) throw Object.assign(new Error("Missing company context"), { status: 400 });
  return companyId as string;
}

function ensureRole(role: string | null, allowed: string[]) {
  if (!allowed.includes(String(role || "").toUpperCase())) {
    throw Object.assign(new Error("Sem permissão"), { status: 403 });
  }
}

function formatRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return { status: 400, payload: { error: error.issues.map(i=>i.message).join("; ") } };
  }
  const status = typeof (error as any)?.status === "number" ? Number((error as any).status) : 500;
  const message = error instanceof Error ? error.message : String(error);
  return { status, payload: { error: message } };
}

export function registerMetaTemplatesRoutes(app: Application) {
  /**
   * POST /api/meta/templates/create
   * Cria um template diretamente na plataforma WhatsApp Business da Meta
   */
  app.post("/api/meta/templates/create", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      ensureRole(role, ["ADMIN", "MANAGER", "SUPER_ADMIN", "OWNER"]);
      const companyId = await resolveCompanyId(req);

      const schema = z.object({
        inboxId: z.string().uuid(),
        name: z.string().trim().min(1).regex(/^[a-z0-9_]+$/, "Nome deve conter apenas letras minúsculas, números e underscore"),
        category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
        language: z.string().trim().min(2), // ex: "pt_BR"
        components: z.array(z.object({
          type: z.enum(["header", "body", "footer", "buttons"]),
          format: z.enum(["text", "image", "video", "document"]).optional(),
          text: z.string().optional(),
          example: z.object({
            header_text: z.array(z.string()).optional(),
            header_handle: z.array(z.string()).optional(), // Para mídia (IMAGE/VIDEO/DOCUMENT)
            body_text: z.array(z.array(z.string())).optional(),
          }).optional(),
          buttons: z.array(z.object({
            type: z.enum(["quick_reply", "phone_number", "url", "copy_code"]),
            text: z.string().optional(),
            phone_number: z.string().optional(),
            url: z.string().optional(),
            example: z.array(z.string()).optional(), // Para URL com variáveis
          })).optional(),
        })),
      }).strict();

      const body = schema.parse(req.body || {});

      // Valida se inbox pertence à empresa
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider, waba_id")
        .eq("id", body.inboxId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (inboxErr) throw new Error(inboxErr.message);
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });
      if (inbox.provider !== "META_CLOUD" && inbox.provider !== "META") {
        return res.status(400).json({ error: "Inbox deve ser do tipo META (Official API)" });
      }
      if (!inbox.waba_id) {
        return res.status(400).json({ error: "Inbox não possui waba_id configurado" });
      }

      // Cria template na Meta
      const result = await createWhatsAppTemplate({
        inboxId: body.inboxId,
        name: body.name,
        category: body.category,
        language: body.language,
        components: body.components,
      });

      // Opcional: Salvar referência no banco local
      await supabaseAdmin.from("message_templates").insert({
        company_id: companyId,
        inbox_id: body.inboxId,
        name: body.name,
        kind: "TEMPLATE",
        payload: {
          meta_template_id: result.id,
          meta_template_name: result.name,
          language: result.language,
          category: result.category,
          status: result.status,
          components: body.components,
        },
      });

      return res.status(201).json({
        success: true,
        template: result,
        message: "Template criado na Meta. Status inicial: PENDING. Aguarde aprovação.",
      });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * POST /api/meta/templates/upload-media
   * Faz upload de uma mídia para a Meta e retorna o handle
   */
  app.post("/api/meta/templates/upload-media", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      ensureRole(role, ["ADMIN", "MANAGER", "SUPER_ADMIN", "OWNER"]);
      const companyId = await resolveCompanyId(req);

      const schema = z.object({
        inboxId: z.string().uuid(),
        mediaUrl: z.string().url(),
      }).strict();

      const body = schema.parse(req.body || {});

      // Valida se inbox pertence à empresa
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider")
        .eq("id", body.inboxId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (inboxErr) throw new Error(inboxErr.message);
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });
      if (inbox.provider !== "META_CLOUD" && inbox.provider !== "META") {
        return res.status(400).json({ error: "Inbox deve ser do tipo META (Official API)" });
      }

      // Faz upload da mídia usando Resumable Upload API e retorna o handle
      const handle = await uploadMediaToMeta(body.inboxId, body.mediaUrl);

      return res.status(200).json({
        success: true,
        handle,
      });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * GET /api/meta/templates/list/:inboxId
   * Lista templates da Meta para uma inbox
   */
  app.get("/api/meta/templates/list/:inboxId", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      ensureRole(role, ["ADMIN", "MANAGER", "SUPERVISOR", "AGENT", "SUPER_ADMIN", "OWNER"]);
      const companyId = await resolveCompanyId(req);
      const inboxId = req.params.inboxId;

      // Valida inbox
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider")
        .eq("id", inboxId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (inboxErr) throw new Error(inboxErr.message);
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });
      if (inbox.provider !== "META_CLOUD" && inbox.provider !== "META") {
        return res.status(400).json({ error: "Inbox deve ser do tipo META (Official API)" });
      }

      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const templates = await listWhatsAppTemplates(inboxId, { status, limit });

      return res.json({ templates });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * GET /api/meta/templates/:templateId
   * Busca detalhes de um template específico
   */
  app.get("/api/meta/templates/:templateId", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      ensureRole(role, ["ADMIN", "MANAGER", "SUPERVISOR", "AGENT", "SUPER_ADMIN", "OWNER"]);
      const companyId = await resolveCompanyId(req);
      const templateId = req.params.templateId;
      const inboxId = req.query.inboxId as string;

      if (!inboxId) {
        return res.status(400).json({ error: "inboxId é obrigatório" });
      }

      // Valida inbox
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id")
        .eq("id", inboxId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (inboxErr) throw new Error(inboxErr.message);
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });

      const template = await getWhatsAppTemplate(inboxId, templateId);

      return res.json({ template });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * DELETE /api/meta/templates/:templateName
   * Deleta um template da Meta
   */
  app.delete("/api/meta/templates/:templateName", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      ensureRole(role, ["ADMIN", "MANAGER", "SUPER_ADMIN", "OWNER"]);
      const companyId = await resolveCompanyId(req);
      const templateName = req.params.templateName;
      const inboxId = req.query.inboxId as string;

      if (!inboxId) {
        return res.status(400).json({ error: "inboxId é obrigatório" });
      }

      // Valida inbox
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id")
        .eq("id", inboxId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (inboxErr) throw new Error(inboxErr.message);
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });

      const result = await deleteWhatsAppTemplate(inboxId, templateName);

      // Opcional: Deletar do banco local também
      await supabaseAdmin
        .from("message_templates")
        .delete()
        .eq("company_id", companyId)
        .eq("inbox_id", inboxId)
        .eq("name", templateName);

      return res.json({ success: result.success });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * POST /api/meta/templates/send
   * Envia uma mensagem usando template aprovado da Meta
   */
  app.post("/api/meta/templates/send", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      ensureRole(role, ["ADMIN", "MANAGER", "SUPERVISOR", "AGENT", "SUPER_ADMIN", "OWNER"]);
      const companyId = await resolveCompanyId(req);

      const schema = z.object({
        inboxId: z.string().uuid(),
        chatId: z.string().uuid().optional(),
        customerPhone: z.string().trim().min(1).optional(),
        templateName: z.string().trim().min(1),
        languageCode: z.string().trim().min(2),
        components: z.array(z.object({
          type: z.enum(["header", "body", "button"]),
          parameters: z.array(z.object({
            type: z.enum(["text", "image", "video", "document"]),
            text: z.string().optional(),
            image: z.object({ link: z.string() }).optional(),
            video: z.object({ link: z.string() }).optional(),
            document: z.object({ 
              link: z.string(),
              filename: z.string().optional(),
            }).optional(),
          })),
        })).optional(),
      }).strict();

      const body = schema.parse(req.body || {});

      // Valida inbox
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider")
        .eq("id", body.inboxId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (inboxErr) throw new Error(inboxErr.message);
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });

      let customerPhone = body.customerPhone;
      let chatId = body.chatId;

      if (chatId) {
        const { data: chat } = await supabaseAdmin
          .from("chats")
          .select("*, customer:customers(phone, msisdn)")
          .eq("id", chatId)
          .single();
        
        if (chat) {
          customerPhone = chat.customer?.phone || chat.customer?.msisdn || chat.remote_id;
        }
      }

      if (!customerPhone) {
        return res.status(400).json({ error: "customerPhone ou chatId válido é obrigatório" });
      }

      const result = await sendTemplateMessage({
        inboxId: body.inboxId,
        customerPhone,
        templateName: body.templateName,
        languageCode: body.languageCode,
        components: body.components,
      });

      // Se tiver chatId, salvar no banco e emitir socket
      if (chatId) {
        const { data: chat } = await supabaseAdmin.from("chats").select("company_id").eq("id", chatId).single();
        
        const { data: inserted } = await supabaseAdmin
          .from("chat_messages")
          .insert({
            chat_id: chatId,
            inbox_id: body.inboxId,
            company_id: chat?.company_id || companyId,
            external_id: result.wamid,
            content: `Template: ${body.templateName}`,
            body: `Template: ${body.templateName}`,
            type: "TEMPLATE",
            sender_type: "AGENT",
            sender_id: req.user?.id,
            view_status: "Sent",
            metadata: {
              template_name: body.templateName,
              language_code: body.languageCode,
              components: body.components
            }
          })
          .select()
          .single();

        if (inserted) {
          const senderName = (req as any).profile?.name || (req as any).user?.name || "Agente";
          
          await publish(EX_APP, "socket.livechat.outbound", {
            kind: "livechat.outbound.message",
            chatId,
            companyId: chat?.company_id || companyId,
            inboxId: body.inboxId,
            message: {
              ...inserted,
              sender_name: senderName
            },
            chatUpdate: {
              chatId,
              companyId: chat?.company_id || companyId,
              inboxId: body.inboxId,
              last_message: inserted.body || `Template: ${body.templateName}`,
              last_message_at: inserted.created_at,
              last_message_from: "AGENT",
              last_message_type: "TEMPLATE"
            }
          });
        }
      }

      return res.json({ 
        success: true, 
        wamid: result.wamid,
        message: "Template enviado com sucesso",
        data: inserted
      });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * POST /api/meta/send-interactive-buttons
   * Envia mensagem interativa com botões de resposta rápida
   * Usado pelo agente de IA via ferramenta send_interactive_buttons
   */
  app.post("/api/meta/send-interactive-buttons", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);

      const schema = z.object({
        inboxId: z.string().uuid(),
        chatId: z.string().uuid(),
        customerPhone: z.string().min(10),
        message: z.string().min(1).max(1024),
        buttons: z.array(z.object({
          id: z.string().min(1),
          title: z.string().min(1).max(20),
        })).min(1).max(3),
        footer: z.string().max(60).optional(),
      }).strict();

      const body = schema.parse(req.body || {});

      // Valida se inbox pertence à empresa e é META_CLOUD
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider, company_id")
        .eq("id", body.inboxId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (inboxErr) throw new Error(inboxErr.message);
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });
      if (inbox.provider !== "META_CLOUD" && inbox.provider !== "META") {
        return res.status(400).json({ 
          error: "Botões interativos só funcionam com WhatsApp Business API oficial (Meta)" 
        });
      }

      // Valida se chat pertence à empresa
      const { data: chat, error: chatErr } = await supabaseAdmin
        .from("chats")
        .select("id, company_id, inbox_id")
        .eq("id", body.chatId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (chatErr) throw new Error(chatErr.message);
      if (!chat) return res.status(404).json({ error: "Chat não encontrado" });
      if (chat.inbox_id !== body.inboxId) {
        return res.status(400).json({ error: "Chat não pertence à inbox especificada" });
      }

      // Envia mensagem interativa
      const { wamid } = await sendInteractiveButtons({
        inboxId: body.inboxId,
        chatId: body.chatId,
        customerPhone: body.customerPhone,
        message: body.message,
        buttons: body.buttons,
        footer: body.footer,
        senderSupabaseId: req.user?.id || null,
      });

      return res.json({ 
        success: true, 
        wamid,
        message: "Botões interativos enviados com sucesso",
      });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });
}
