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
