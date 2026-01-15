import { Application } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { listMetaFlows, sendMetaFlow, syncMetaFlows, createMetaFlow } from "../services/meta/flows.service.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { EX_APP, publish } from "../queue/rabbit.js";
import { clearMessageCache } from "../lib/redis.js";

export function registerMetaFlowsRoutes(app: Application) {
  /**
   * GET /api/meta/flows/:inboxId
   * Lista os flows disponíveis. Por padrão tenta o banco local, com ?refresh=true busca na API Meta.
   */
  app.get("/api/meta/flows/:inboxId", requireAuth, async (req, res) => {
    const { inboxId } = req.params;
    const { refresh } = req.query;

    if (!inboxId || inboxId === "null" || inboxId === "undefined") {
      return res.status(400).json({ error: "inboxId inválido" });
    }

    try {
      const companyId = (req as any).user?.company_id;

      if (refresh === 'true' && companyId) {
        await syncMetaFlows(inboxId, companyId);
      }

      // Buscar do banco local
      const { data: flows, error } = await supabaseAdmin
        .from("meta_flows")
        .select("*")
        .eq("inbox_id", inboxId)
        .eq("status", "PUBLISHED"); // Sugestão: Apenas os publicados? Ou remover filtro.

      // Se não houver nada no banco e não pediram refresh, tentar buscar direto uma vez
      if ((!flows || flows.length === 0) && refresh !== 'true' && companyId) {
        const directFlows = await listMetaFlows(inboxId);
        return res.json({ data: directFlows });
      }

      return res.json({ data: flows || [] });
    } catch (error: any) {
      console.error("[GET /api/meta/flows] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/meta/flows/:inboxId/sync
   * Força a sincronização dos fluxos da Meta para o banco local
   */
  app.post("/api/meta/flows/:inboxId/sync", requireAuth, async (req, res) => {
    const { inboxId } = req.params;
    const companyId = (req as any).user?.company_id;
    
    if (!inboxId || !companyId) return res.status(400).json({ error: "Parâmetros inválidos" });

    try {
      const count = await syncMetaFlows(inboxId, companyId);
      return res.json({ success: true, count });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/meta/flows/:inboxId/create
   * Cria um novos formulário (Flow) na Meta
   */
  app.post("/api/meta/flows/:inboxId/create", requireAuth, async (req, res) => {
    const { inboxId } = req.params;
    const { name, categories } = req.body;
    const companyId = (req as any).user?.company_id;

    if (!inboxId || !name || !categories) return res.status(400).json({ error: "Parâmetros faltando" });

    try {
      const result = await createMetaFlow(inboxId, name, categories);
      
      // Auto-sync after creation
      if (companyId) await syncMetaFlows(inboxId, companyId);
      
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/meta/flows/send
   * Envia um flow para um chat específico
   */
  app.post("/api/meta/flows/send", requireAuth, async (req, res) => {
    const { inboxId, chatId, flowId, ctaText, headerText, bodyText } = req.body;

  if (!inboxId || !chatId || !flowId) {
    return res.status(400).json({ error: "Missing required fields: inboxId, chatId, flowId" });
  }

  try {
    // Buscar informações do chat para pegar o telefone do cliente
    const { data: chat, error: chatError } = await supabaseAdmin
      .from("chats")
      .select("*, customer:customers(phone, msisdn)")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const customerPhone = chat.customer?.phone || chat.customer?.msisdn;
    if (!customerPhone) {
      return res.status(400).json({ error: "Customer phone not found" });
    }

    // Enviar o flow via Graph API (diretamente por enquanto, ou via worker se preferir)
    // Para manter consistência com o histórico, vamos criar um registro de mensagem
    const { wamid } = await sendMetaFlow({
      inboxId,
      chatId,
      customerPhone,
      flowId,
      ctaText,
      headerText,
      bodyText
    });

    const body = bodyText || "Formulário enviado";

    // Inserir no banco como uma mensagem interativa
    const senderName = (req as any).user?.name || (req as any).profile?.full_name || "Agente";
    const senderAvatar = (req as any).user?.avatar_url || (req as any).profile?.avatar_url || null;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        inbox_id: inboxId,
        company_id: chat.company_id,
        external_id: wamid,
        content: body,
        type: "INTERACTIVE",
        is_from_customer: false,
        sender_id: (req as any).user?.id || (req as any).profile?.id || null,
        sender_name: senderName,
        sender_avatar_url: senderAvatar,
        view_status: "Sent",
        interactive_content: {
          type: "flow",
          flow_id: flowId,
          body: { text: body },
          header: headerText ? { type: "text", text: headerText } : undefined,
          action: {
            parameters: {
              flow_cta: ctaText || "Preencher"
            }
          }
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error("[POST /meta/flows/send] Error inserting message:", insertError);
    } else if (inserted) {
      // Limpar cache do redis para que a mensagem apareça no frontend
      await clearMessageCache(chatId);

      // Publicar evento de nova mensagem
      await publish(EX_APP, "im.message.created", {
        messageId: inserted.id,
        chatId: chatId,
        companyId: chat.company_id
      });
    }

    // Emitir via socket para o front atualizar
    if (inserted) {
      const senderName = (req as any).profile?.name || (req as any).user?.name || "Agente";

      await publish(EX_APP, "socket.livechat.outbound", {
        kind: "livechat.outbound.message",
        chatId,
        companyId: chat.company_id,
        inboxId,
        message: {
          ...inserted,
          sender_name: senderName
        },
        chatUpdate: {
          chatId,
          companyId: chat.company_id,
          inboxId,
          last_message: inserted.content || "Flow Meta",
          last_message_at: inserted.created_at,
          last_message_from: "AGENT",
          last_message_type: "flow"
        }
      });
    }

    return res.json({ ok: true, wamid, data: inserted });
  } catch (error: any) {
    console.error("[POST /api/meta/flows/send] Fatal Error:", error);
    return res.status(500).json({ 
      error: error.message || "Internal Server Error",
      details: error.response?.data || error.data || null
    });
  }
});

}
