// src/services/meta/graph.ts
import crypto from "node:crypto";
import {
  getDecryptedCredsForInbox,
  getChatWithCustomerPhone,
  insertOutboundMessage,
} from "./store.js";
import { rDel, rGet, rSet } from "../../lib/redis.ts";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TTL_CONTACT_PROFILE = Number(process.env.META_CACHE_TTL_CONTACT ?? 600);

function appsecretProof(token: string, appSecret?: string) {
  if (!appSecret) return undefined;
  return crypto.createHmac("sha256", appSecret).update(token).digest("hex");
}

type GraphCreds = {
  access_token: string;
  app_secret?: string;
  phone_number_id: string;
};

function toGraphCreds(
  creds: { access_token: string; app_secret?: string | null; phone_number_id?: string | null },
): GraphCreds {
  const phoneNumberId = creds.phone_number_id?.trim();
  if (!phoneNumberId) {
    throw new Error("Inbox misconfigured: missing phone_number_id");
  }
  return {
    access_token: creds.access_token,
    app_secret: creds.app_secret || undefined,
    phone_number_id: phoneNumberId,
  };
}

async function graphFetch(
  creds: GraphCreds,
  path: string,
  init: RequestInit & { asJson?: boolean } = {},
) {
  const url = new URL(`${GRAPH}/${path}`);
  const proof = appsecretProof(creds.access_token, creds.app_secret);
  if (proof) url.searchParams.set("appsecret_proof", proof);

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      "Authorization": `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (init?.asJson === false) {
    return response;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as any)?.error?.message || `Meta API error (${response.status})`;
    
    if (message.includes("appsecret_proof")) {
      throw new Error(`Meta API Error: ${message}. Please verify that the 'App Secret' in your Inbox settings matches the App Secret in your Meta App Dashboard.`);
    }

    throw new Error(message);
  }
  return data;
}

export async function sendWhatsAppText({
  inboxId,
  chatId,
  text,
  senderSupabaseId,
}: {
  inboxId: string;
  chatId: string;
  text: string;
  senderSupabaseId?: string | null;
}) {
  const creds = await getDecryptedCredsForInbox(inboxId);
  const graphCreds = toGraphCreds(creds);
  const chat = await getChatWithCustomerPhone(chatId);

  const payload = {
    messaging_product: "whatsapp",
    to: chat.customer_phone,
    type: "text",
    text: { body: text },
  };

  const data = await graphFetch(graphCreds, `${graphCreds.phone_number_id}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const wamid: string | null = (data as any)?.messages?.[0]?.id ?? null;

  await insertOutboundMessage({
    chatId,
    inboxId,
    customerId: "",
    externalId: wamid,
    content: text,
    type: "TEXT",
    senderId: senderSupabaseId ?? null,
    viewStatus: "Sent",
  });

  return { external_id: wamid, response: data };
}

export type ContactProfile = {
  waId: string | null;
  displayName: string | null;
  profilePicUrl: string | null;
};

const contactProfileCacheKey = (inboxId: string, phone: string) =>
  `meta:contact:${inboxId}:${phone}`;

export async function fetchContactProfile({
  inboxId,
  phone,
}: {
  inboxId: string;
  phone: string;
}): Promise<ContactProfile | null> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  const graphCreds = toGraphCreds(creds);
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const input = digits.startsWith("+") ? digits : `+${digits}`;
  const cacheKey = contactProfileCacheKey(inboxId, input);

  const cached = await rGet<{ hit: boolean; value: ContactProfile | null }>(cacheKey);
  if (cached) {
    return cached.hit ? cached.value : null;
  }

  try {
    const data = await graphFetch(graphCreds, `${graphCreds.phone_number_id}/contacts`, {
      method: "POST",
      body: JSON.stringify({
        blocking: "wait",
        contacts: [{ input }],
      }),
    });

    const contact = (data as any)?.contacts?.[0];
    const result = {
      waId: contact?.wa_id ?? null,
      displayName: contact?.profile?.name ?? null,
      profilePicUrl: contact?.profile?.profile_pic_url ?? null,
    };
    await rSet(cacheKey, { hit: true, value: result }, TTL_CONTACT_PROFILE);
    return result;
  } catch (e) {
    console.warn("[META] contact profile lookup failed", {
      phone: input,
      error: (e as any)?.message || e,
    });
    await rSet(cacheKey, { hit: false, value: null }, TTL_CONTACT_PROFILE);
    return null;
  }
}

export async function invalidateContactProfileCache(inboxId: string, phone: string): Promise<void> {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return;
  const normalized = digits.startsWith("+") ? digits : `+${digits}`;
  await rDel(contactProfileCacheKey(inboxId, normalized));
}

// --- ADD: util p/ mídia ---
export async function getMediaInfo(creds: GraphCreds, mediaId: string) {
  // https://graph.facebook.com/v23.0/{media-id}
  const data = await graphFetch(creds, `${mediaId}`, { method: "GET" });
  // Ex.: { id, mime_type, sha256, file_size, url, ... }
  return data as { id: string; mime_type?: string; sha256?: string; file_size?: number; url?: string };
}

export async function downloadMedia(creds: GraphCreds, url: string): Promise<ArrayBuffer> {
  // graphFetch com asJson:false pra pegar binário
  const res = await fetch(url, {
    method: "GET",
    headers: { "Authorization": `Bearer ${creds.access_token}` },
  });
  if (!res.ok) throw new Error(`downloadMedia failed (${res.status})`);
  return await res.arrayBuffer();
}

/**
 * Envia mensagem interativa com botões de resposta rápida (reply buttons)
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#interactive-messages
 */
export async function sendInteractiveButtons({
  inboxId,
  chatId,
  customerPhone,
  message,
  buttons,
  footer,
  senderSupabaseId,
}: {
  inboxId: string;
  chatId: string;
  customerPhone: string;
  message: string;
  buttons: Array<{ id: string; title: string }>;
  footer?: string;
  senderSupabaseId?: string | null;
}): Promise<{ wamid: string; message: any }> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  const graphCreds = toGraphCreds(creds);

  // Validações
  if (!buttons || buttons.length === 0 || buttons.length > 3) {
    throw new Error("Botões interativos devem ter entre 1 e 3 opções");
  }

  for (const btn of buttons) {
    if (!btn.id || !btn.title) {
      throw new Error("Cada botão deve ter 'id' e 'title'");
    }
    if (btn.title.length > 20) {
      throw new Error(`Título do botão muito longo: "${btn.title}" (máx: 20 caracteres)`);
    }
  }

  // Monta payload conforme API da Meta
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: customerPhone,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: message,
      },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: {
            id: btn.id,
            title: btn.title,
          },
        })),
      },
    },
  };

  // Adiciona footer se fornecido
  if (footer && footer.trim()) {
    (payload.interactive as any).footer = {
      text: footer.trim().slice(0, 60), // Máximo 60 caracteres
    };
  }

  console.log("[META][INTERACTIVE] Sending interactive buttons", {
    chatId,
    inboxId,
    customerPhone,
    buttonsCount: buttons.length,
    messageLength: message.length,
    hasFooter: !!footer,
  });

  // Envia para API da Meta
  const data = await graphFetch(graphCreds, `${graphCreds.phone_number_id}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const wamid: string | null = (data as any)?.messages?.[0]?.id ?? null;
  if (!wamid) {
    throw new Error("Meta API não retornou message ID (wamid)");
  }

  // Salva mensagem no banco
  const upsert = await insertOutboundMessage({
    chatId,
    inboxId,
    customerId: "", // Will be set by trigger
    externalId: wamid,
    content: message,
    type: "INTERACTIVE",
    senderId: senderSupabaseId,
    interactiveContent: payload.interactive,
  });

  console.log("[META][INTERACTIVE] ✅ Interactive message sent", {
    chatId,
    wamid,
    buttonsCount: buttons.length,
  });

  return { wamid, message: upsert?.message };
}

/**
 * Envia mensagem interativa com lista de opções (menu)
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#interactive-messages
 */
export async function sendInteractiveList({
  inboxId,
  chatId,
  customerPhone,
  message,
  buttonText,
  sections,
  footer,
  senderSupabaseId,
}: {
  inboxId: string;
  chatId: string;
  customerPhone: string;
  message: string;
  buttonText: string;
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
  footer?: string;
  senderSupabaseId?: string | null;
}): Promise<{ wamid: string; message: any }> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  const graphCreds = toGraphCreds(creds);

  // Validações
  if (!sections || sections.length === 0 || sections.length > 10) {
    throw new Error("Listas devem ter entre 1 e 10 seções");
  }

  let totalRows = 0;
  for (const section of sections) {
    if (!section.rows || section.rows.length === 0) {
      throw new Error(`Seção "${section.title}" deve ter pelo menos 1 opção`);
    }
    totalRows += section.rows.length;
    for (const row of section.rows) {
      if (row.title.length > 24) {
        throw new Error(`Título da opção muito longo: "${row.title}" (máx: 24 caracteres)`);
      }
      if (row.description && row.description.length > 72) {
        throw new Error(`Descrição da opção muito longa: "${row.description}" (máx: 72 caracteres)`);
      }
    }
  }

  if (totalRows > 10) {
    throw new Error(`Total de opções na lista não pode exceder 10 (atual: ${totalRows})`);
  }

  if (buttonText.length > 20) {
    throw new Error(`Texto do botão muito longo: "${buttonText}" (máx: 20 caracteres)`);
  }

  // Monta payload conforme API da Meta
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: customerPhone,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: message,
      },
      action: {
        button: buttonText,
        sections: sections.map((section) => ({
          title: section.title,
          rows: section.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description || undefined,
          })),
        })),
      },
    },
  };

  // Adiciona footer se fornecido
  if (footer && footer.trim()) {
    (payload.interactive as any).footer = {
      text: footer.trim().slice(0, 60), // Máximo 60 caracteres
    };
  }

  console.log("[META][INTERACTIVE] Sending interactive list", {
    chatId,
    inboxId,
    customerPhone,
    sectionsCount: sections.length,
    totalRows,
    messageLength: message.length,
  });

  // Envia para API da Meta
  const data = await graphFetch(graphCreds, `${graphCreds.phone_number_id}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const wamid: string | null = (data as any)?.messages?.[0]?.id ?? null;
  if (!wamid) {
    throw new Error("Meta API não retornou message ID (wamid)");
  }

  // Salva mensagem no banco
  const upsert = await insertOutboundMessage({
    chatId,
    inboxId,
    customerId: "", // Will be set by trigger
    externalId: wamid,
    content: message,
    type: "INTERACTIVE",
    senderId: senderSupabaseId,
    interactiveContent: payload.interactive,
  });

  console.log("[META][INTERACTIVE] ✅ Interactive list sent", {
    chatId,
    wamid,
    totalRows,
  });

  return { wamid, message: upsert?.message };
}

