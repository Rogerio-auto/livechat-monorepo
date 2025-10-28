// src/services/meta/handlers.ts
import crypto from "node:crypto";
import { getInboxByPhoneNumberId } from "./store.ts";
import { EX_META, publish } from "../../queue/rabbit.ts"; // <- PLURAL "queues"

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";
const APP_SECRET   = process.env.META_APP_SECRET   || "";

/** GET /integrations/meta/webhook (verificação de callback na Meta) */
export async function verifyMetaWebhook(query: any) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return { status: 200, body: String(challenge ?? "") };
  }
  return { status: 403, body: "forbidden" };
}

/** Validação de assinatura (x-hub-signature-256) */
function isValidSignature(rawBody: Buffer | string, signatureHeader?: string) {
  if (!APP_SECRET) return true; // em dev, pode pular
  if (!signatureHeader) return false;
  const [scheme, hash] = signatureHeader.split("=");
  if (scheme !== "sha256" || !hash) return false;
  const expected = crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function validateSignatureOrThrow(rawBody: Buffer | string, signatureHeader?: string) {
  if (!isValidSignature(rawBody, signatureHeader)) {
    const err: any = new Error("Invalid webhook signature");
    err.status = 403;
    throw err;
  }
}

/** POST /integrations/meta/webhook (processa entradas -> publica no Rabbit) */
export async function handleMetaWebhook(body: any) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  console.log("[META] webhook received", { entries: entries.length });

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    console.log("[META] entry", { id: entry?.id, time: entry?.time, changes: changes.length });

    for (const ch of changes) {
      const value = ch?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      const displayPhoneNumber = value?.metadata?.display_phone_number || value?.metadata?.phone_number || null;

      // Resolve inbox (precisamos do company_id pra worker)
      const inbox = await getInboxByPhoneNumberId(phoneNumberId, displayPhoneNumber);
      if (!inbox?.id) {
        console.warn("[META] inbox not found", { phoneNumberId, displayPhoneNumber });
        continue;
      }

      // Publica UM job por "change" (valor completo: pode conter messages e/ou statuses)
      const payload = {
        inboxId: inbox.id,
        companyId: inbox.company_id,
        provider: "META" as const,
        value,                               // conteúdo bruto deste change
        receivedAt: new Date().toISOString()
      };

      // Uma única routing key para tudo do WhatsApp → worker INBOUND decide o que fazer
      await publish(EX_META, "inbound.message", payload);

      console.log("[META] published to Rabbit", {
        inboxId: inbox.id,
        hasMessages: Array.isArray(value?.messages),
        hasStatuses: Array.isArray(value?.statuses),
      });
    }
  }

  // O worker trata e persiste — aqui só ACK HTTP
  return { status: 200, body: "ok" };
}
