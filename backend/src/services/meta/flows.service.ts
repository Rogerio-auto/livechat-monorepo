import { getDecryptedCredsForInbox } from "./store.service.js";
// @ts-ignore - graph.service.js will exist after build
import { graphFetch } from "./graph.service.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { logger } from "../../lib/logger.js";

export interface MetaFlow {
  id: string;
  name: string;
  status: string;
  categories: string[];
  validation_errors?: any[];
  last_updated_time: string;
}

/**
 * Envia um flow para o contato via Meta Graph API
 */
export async function sendMetaFlow(params: {
  inboxId: string;
  chatId: string;
  customerPhone: string;
  flowId: string;       // ID do flow na Meta
  ctaText?: string;     // Texto do botão (default: "Preencher")
  headerText?: string;
  bodyText?: string;
}): Promise<{ wamid: string; message: any }> {
  const { inboxId, customerPhone, flowId, ctaText = "Preencher", headerText, bodyText } = params;
  
  const creds = await getDecryptedCredsForInbox(inboxId);
  const phoneNumberId = creds.phone_number_id?.trim();
  
  if (!phoneNumberId) {
    throw new Error("Inbox misconfigured: missing phone_number_id");
  }

  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: customerPhone.replace(/\D/g, ""), // Limpar telefone
    type: "interactive",
    interactive: {
      type: "flow",
      header: headerText ? { type: "text", text: headerText } : undefined,
      body: { text: bodyText || "Por favor, preencha as informações no formulário abaixo." },
      footer: { text: "WhatsApp Flow" },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: `token_${Date.now()}`,
          flow_id: flowId,
          flow_cta: ctaText,
          // Removido flow_action: "navigate" para usar a tela padrão do flow
          // Isso evita erro #131009 se a tela "START" ou "QUESTIONNAIRE" não existir
        },
      },
    },
  };

  const data = await graphFetch(
    {
      access_token: creds.access_token,
      app_secret: creds.app_secret || undefined,
      phone_number_id: phoneNumberId,
    },
    `${phoneNumberId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return {
    wamid: data.messages?.[0]?.id,
    message: data,
  };
}

/**
 * Parseia a resposta de um flow enviada pelo contato
 */
export function parseFlowResponse(nfmReply: any): Record<string, any> {
  if (!nfmReply?.response_json) {
    return {};
  }
  try {
    return JSON.parse(nfmReply.response_json);
  } catch (e) {
    console.error("[META][FLOWS] Error parsing flow response JSON", e);
    return {};
  }
}

/**
 * Lista os flows disponíveis na conta Meta associada à Inbox
 */
export async function listMetaFlows(inboxId: string): Promise<MetaFlow[]> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  
  // Para listar flows, precisamos do Business Account ID ou usar o endpoint de flows do WABA
  // Geralmente é GET /<WABA_ID>/flows
  const wabaId = creds.waba_id?.trim();
  if (!wabaId) {
    throw new Error("Inbox misconfigured: missing waba_id");
  }

  const data = await graphFetch(
    {
      access_token: creds.access_token,
      app_secret: creds.app_secret || undefined,
      phone_number_id: creds.phone_number_id || "",
    },
    `${wabaId}/flows?fields=id,name,status,categories,last_updated_time`,
    { method: "GET" }
  );

  return (data.data || []) as MetaFlow[];
}

/**
 * Sincroniza formulários da Meta para o banco de dados local
 */
export async function syncMetaFlows(inboxId: string, companyId: string): Promise<number> {
  try {
    const flows = await listMetaFlows(inboxId);
    
    if (flows.length === 0) return 0;

    const upserts = flows.map(flow => ({
      company_id: companyId,
      inbox_id: inboxId,
      meta_flow_id: flow.id,
      name: flow.name,
      status: flow.status,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabaseAdmin
      .from("meta_flows")
      .upsert(upserts, {
        onConflict: "inbox_id, meta_flow_id",
        ignoreDuplicates: false
      });

    if (error) {
      logger.error(`[META][FLOWS] Sync error for inbox ${inboxId}:`, error);
      throw error;
    }

    return flows.length;
  } catch (error) {
    logger.error(`[META][FLOWS] Sync error in search for inbox ${inboxId}:`, error);
    throw error;
  }
}

/**
 * Cria um formulário (Flow) na Meta
 */
export async function createMetaFlow(inboxId: string, name: string, categories: string[]): Promise<any> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  const wabaId = creds.waba_id?.trim();
  
  if (!wabaId) {
    throw new Error("Inbox misconfigured: missing waba_id");
  }

  const data = await graphFetch(
    {
      access_token: creds.access_token,
      app_secret: creds.app_secret || undefined,
      phone_number_id: creds.phone_number_id || "",
    },
    `${wabaId}/flows`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        categories
      })
    }
  );

  return data;
}
