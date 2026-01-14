import { Application } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { listMetaFlows, sendMetaFlow } from "../services/meta/flows.service.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { EX_APP, publish } from "../queue/rabbit.js";

export function registerMetaFlowsRoutes(app: Application) {
  /**
   * GET /api/meta/flows/:inboxId
   * Lista os flows disponíveis em uma inbox Meta
   */
  app.get("/api/meta/flows/:inboxId", requireAuth, async (req, res) => {
    const { inboxId } = req.params;

    if (!inboxId || inboxId === "null" || inboxId === "undefined") {
      return res.status(400).json({ error: "inboxId inválido" });
    }

    try {
      const flows = await listMetaFlows(inboxId);
      return res.json(flows);
    } catch (error: any) {
      console.error("[GET /api/meta/flows] Error:", error);
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
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        inbox_id: inboxId,
        company_id: chat.company_id,
        external_id: wamid,
        content: body,
        body: body,
        type: "INTERACTIVE",
        sender_type: "AGENT",
        sender_id: (req as any).user?.id,
        view_status: "Sent",
        interactive_content: {
          type: "flow",
          flow_id: flowId,
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
          last_message: inserted.body || "Flow Meta",
          last_message_at: inserted.created_at,
          last_message_from: "AGENT",
          last_message_type: "flow"
        }
      });
    }

    return res.json({ ok: true, wamid, data: inserted });
  } catch (error: any) {
    console.error("[POST /api/meta/flows/send] Error:", error);
    return res.status(500).json({ error: error.message });
  }
});

}
