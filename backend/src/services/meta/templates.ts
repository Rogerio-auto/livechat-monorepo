// src/services/meta/templates.ts
import { getDecryptedCredsForInbox } from "./store.js";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Faz upload de uma mídia para a Meta usando Resumable Upload API e retorna o handle
 * Documentação: https://developers.facebook.com/docs/graph-api/guides/upload
 */
export async function uploadMediaToMeta(
  inboxId: string,
  mediaUrl: string
): Promise<string> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  
  // Usa app_secret como App ID (você configurou o App ID neste campo)
  const appId = creds.app_secret || creds.waba_id;
  if (!appId) {
    throw new Error("Inbox não possui app_secret (App ID) configurado.");
  }

  // Faz download da mídia do Supabase
  console.log('[Upload Media] Downloading from:', mediaUrl);
  const mediaResponse = await fetch(mediaUrl);
  if (!mediaResponse.ok) {
    throw new Error(`Falha ao baixar mídia: ${mediaResponse.statusText}`);
  }

  const mediaBlob = await mediaResponse.blob();
  const contentType = mediaResponse.headers.get('content-type') || 'image/jpeg';
  const filename = mediaUrl.split('/').pop() || 'media';
  const fileLength = mediaBlob.size;
  
  console.log('[Upload Media] File info:', { filename, contentType, fileLength });
  console.log('[Upload Media] App ID:', appId);
  
  // Etapa 1: Iniciar sessão de upload
  const startUrl = `${GRAPH}/${appId}/uploads?file_name=${encodeURIComponent(filename)}&file_length=${fileLength}&file_type=${encodeURIComponent(contentType)}&access_token=${creds.access_token}`;
  
  console.log('[Upload Media] Starting upload session...');
  
  const startResponse = await fetch(startUrl, {
    method: "POST",
  });

  const startJson = await startResponse.json();
  console.log('[Upload Media] Start session response:', JSON.stringify(startJson, null, 2));

  if (!startResponse.ok) {
    const code = (startJson as any)?.error?.code || startResponse.status;
    const type = (startJson as any)?.error?.type || "MetaError";
    const message = (startJson as any)?.error?.message || startResponse.statusText;
    throw new Error(`[${code}] ${type}: ${message}`);
  }

  const uploadSessionId = (startJson as any).id; // Formato: "upload:<UPLOAD_SESSION_ID>"
  console.log('[Upload Media] Upload session ID:', uploadSessionId);
  
  // Etapa 2: Fazer upload do arquivo
  const uploadUrl = `${GRAPH}/${uploadSessionId}`;
  
  console.log('[Upload Media] Uploading file to:', uploadUrl);
  
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `OAuth ${creds.access_token}`,
      "file_offset": "0",
    },
    body: mediaBlob,
  });

  const uploadJson = await uploadResponse.json();
  console.log('[Upload Media] Upload response:', JSON.stringify(uploadJson, null, 2));

  if (!uploadResponse.ok) {
    const code = (uploadJson as any)?.error?.code || uploadResponse.status;
    const type = (uploadJson as any)?.error?.type || "MetaError";
    const message = (uploadJson as any)?.error?.message || uploadResponse.statusText;
    throw new Error(`[${code}] ${type}: ${message}`);
  }

  // Retorna o handle no formato "h": "2:c2FtcGxl..."
  const handle = (uploadJson as any).h;
  console.log('[Upload Media] Upload successful, handle:', handle);
  
  return handle;
}

interface CreateTemplateParams {
  inboxId: string;
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string; // ex: "pt_BR", "en_US"
  components: Array<{
    type: "header" | "body" | "footer" | "buttons";
    format?: "text" | "image" | "video" | "document";
    text?: string;
    example?: { 
      header_text?: string[]; 
      header_handle?: string[];
      body_text?: string[][]; 
    };
    examples?: string[][];
    buttons?: Array<{
      type: "quick_reply" | "phone_number" | "url" | "copy_code";
      text?: string;
      phone_number?: string;
      url?: string;
      example?: string[];
    }>;
  }>;
}

interface TemplateResponse {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED";
  category: string;
  name: string;
  language: string;
}

/**
 * Cria um template de mensagem no WhatsApp Business Account da Meta
 * Documentação: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 * 
 * IMPORTANTE: Templates precisam ser aprovados pela Meta antes de usar.
 * O status inicial é "PENDING" e pode levar de algumas horas a dias para aprovação.
 */
export async function createWhatsAppTemplate(
  params: CreateTemplateParams
): Promise<TemplateResponse> {
  // Busca credenciais e waba_id da inbox
  const creds = await getDecryptedCredsForInbox(params.inboxId);
  
  if (!creds.waba_id) {
    throw new Error("Inbox não possui waba_id configurado. Configure o WhatsApp Business Account ID primeiro.");
  }

  // Monta o payload para a API da Meta
  const body = {
    name: params.name,
    category: params.category,
    language: params.language,
    components: params.components,
  };

  const url = `${GRAPH}/${creds.waba_id}/message_templates`;
  
  console.log('[Meta Template] Sending to Meta API:', JSON.stringify(body, null, 2));
  console.log('[Meta Template] URL:', url);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  
  console.log('[Meta Template] Response status:', response.status);
  console.log('[Meta Template] Response body:', JSON.stringify(json, null, 2));

  if (!response.ok) {
    const code = (json as any)?.error?.code || response.status;
    const type = (json as any)?.error?.type || "MetaError";
    const message = (json as any)?.error?.message || response.statusText;
    const details = (json as any)?.error?.error_data?.details || '';
    console.error('[Meta Template] Error:', { code, type, message, details });
    throw new Error(`[${code}] ${type}: ${message}${details ? ` - ${details}` : ''}`);
  }

  return {
    id: (json as any).id,
    status: (json as any).status || "PENDING",
    category: params.category,
    name: params.name,
    language: params.language,
  };
}

/**
 * Lista todos os templates do WhatsApp Business Account
 */
export async function listWhatsAppTemplates(
  inboxId: string,
  filters?: { status?: string; limit?: number }
): Promise<TemplateResponse[]> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  
  if (!creds.waba_id) {
    throw new Error("Inbox não possui waba_id configurado.");
  }

  const url = new URL(`${GRAPH}/${creds.waba_id}/message_templates`);
  url.searchParams.set("fields", "id,name,status,category,language,components");
  
  if (filters?.limit) {
    url.searchParams.set("limit", String(filters.limit));
  }
  if (filters?.status) {
    url.searchParams.set("status", filters.status);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    const code = (json as any)?.error?.code || response.status;
    const type = (json as any)?.error?.type || "MetaError";
    const message = (json as any)?.error?.message || response.statusText;
    throw new Error(`[${code}] ${type}: ${message}`);
  }

  return (json as any).data || [];
}

/**
 * Busca detalhes de um template específico
 */
export async function getWhatsAppTemplate(
  inboxId: string,
  templateId: string
): Promise<TemplateResponse> {
  const creds = await getDecryptedCredsForInbox(inboxId);

  const url = `${GRAPH}/${templateId}?fields=id,name,status,category,language,components`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    const code = (json as any)?.error?.code || response.status;
    const type = (json as any)?.error?.type || "MetaError";
    const message = (json as any)?.error?.message || response.statusText;
    throw new Error(`[${code}] ${type}: ${message}`);
  }

  return json as TemplateResponse;
}

/**
 * Deleta um template do WhatsApp Business Account
 */
export async function deleteWhatsAppTemplate(
  inboxId: string,
  templateName: string
): Promise<{ success: boolean }> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  
  if (!creds.waba_id) {
    throw new Error("Inbox não possui waba_id configurado.");
  }

  const url = `${GRAPH}/${creds.waba_id}/message_templates?name=${templateName}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    const code = (json as any)?.error?.code || response.status;
    const type = (json as any)?.error?.type || "MetaError";
    const message = (json as any)?.error?.message || response.statusText;
    throw new Error(`[${code}] ${type}: ${message}`);
  }

  return { success: (json as any).success === true };
}

/**
 * Envia uma mensagem usando um template aprovado
 */
export async function sendTemplateMessage(params: {
  inboxId: string;
  customerPhone: string;
  templateName: string;
  languageCode: string;
  components?: Array<{
    type: "header" | "body" | "button";
    parameters: Array<{
      type: "text" | "image" | "video" | "document";
      text?: string;
      image?: { link: string };
      video?: { link: string };
      document?: { link: string; filename?: string };
    }>;
  }>;
}): Promise<{ wamid: string }> {
  const creds = await getDecryptedCredsForInbox(params.inboxId);

  const body: any = {
    messaging_product: "whatsapp",
    to: params.customerPhone,
    type: "template",
    template: {
      name: params.templateName,
      language: {
        code: params.languageCode,
      },
    },
  };

  if (params.components && params.components.length > 0) {
    body.template.components = params.components;
  }

  const url = `${GRAPH}/${creds.phone_number_id}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    const code = (json as any)?.error?.code || response.status;
    const type = (json as any)?.error?.type || "MetaError";
    const message = (json as any)?.error?.message || response.statusText;
    throw new Error(`[${code}] ${type}: ${message}`);
  }

  const wamid = (json as any)?.messages?.[0]?.id || null;
  return { wamid };
}
