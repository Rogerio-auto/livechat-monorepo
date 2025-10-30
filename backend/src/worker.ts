// backend/src/worker.ts
import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import {
  consume,
  publish,
  publishApp,
  EX_DLX,
  Q_INBOUND,
  Q_OUTBOUND,
  EX_APP,
} from "../src/queue/rabbit.ts";
import db from "../src/pg.ts";
import { normalizeMsisdn } from "../src/util.ts";
import {
  saveWebhookEvent,
  updateMessageStatusByExternalId,
  ensureLeadCustomerChat,
  ensureGroupChat,
  insertInboundMessage,
  getDecryptedCredsForInbox,
  getChatWithCustomerPhone,
  insertOutboundMessage,
  upsertChatMessage,
  touchChatAfterMessage,
  invalidateChatCaches,
  upsertChatRemoteParticipant,
  findChatIdByRemoteId,
  markChatRemoteParticipantLeft,
  findChatMessageIdByExternalId,
} from "../src/services/meta/store.ts";
import { rDelMatch, rSet, k } from "../src/lib/redis.ts";
import { supabaseAdmin } from "./lib/supabase.ts";
import { WAHA_PROVIDER, wahaFetch, fetchWahaChatDetails } from "../src/services/waha/client.ts";

const TTL_AVATAR = Number(process.env.CACHE_TTL_AVATAR || 300);

function rememberAvatar(
  companyId: string | null | undefined,
  remoteId: string | null | undefined,
  url: string | null | undefined,
): void {
  if (!companyId) return;
  if (typeof remoteId !== "string" || !remoteId.trim()) return;
  if (typeof url !== "string" || !url.trim()) return;
  rSet(k.avatar(companyId, remoteId.trim()), url.trim(), TTL_AVATAR).catch((error) => {
    console.warn("[worker] avatar cache set failed", { companyId, remoteId, error });
  });
}

type MetaInboundPayload = {
  inboxId: string;
  companyId: string;
  provider: "META";
  value: any;
  receivedAt: string;
};
type WahaInboundPayload = {
  inboxId: string;
  companyId: string;
  provider: "WAHA";
  event: string;
  session?: string | null;
  payload: any;
  receivedAt: string;
  raw?: any;
};
type InboundJobPayload = MetaInboundPayload | WahaInboundPayload;

const CACHE_TTL_MSGS = Number(process.env.CACHE_TTL_MSGS ?? 180);
const PAGE_LIMIT_PREWARM = 20;
const MAX_ATTEMPTS = Number(process.env.JOB_MAX_ATTEMPTS || 3);

// === Mídia local / Graph ===
const MEDIA_DIR =
  process.env.MEDIA_DIR || path.resolve(process.cwd(), "media");
const MEDIA_PUBLIC_BASE =
  (process.env.MEDIA_PUBLIC_BASE || "").replace(/\/+$/, "");
const FILES_PUBLIC_BASE = (
  process.env.FILES_PUBLIC_BASE || "http://localhost:5000"
).replace(/\/+$/, "");
const META_GRAPH_VERSION = (process.env.META_GRAPH_VERSION || "v20.0").replace(
  /^v?/,
  "v",
);

let chatAttachmentsSupportsChatId = true;
let wahaGroupSyncRunning = false;

async function fetchChatUpdateForSocket(chatId: string): Promise<{
  chatId: string;
  inboxId: string | null;
  status: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_from?: "CUSTOMER" | "AGENT" | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  kind?: string | null;
  group_name?: string | null;
  group_avatar_url?: string | null;
  remote_id?: string | null;
} | null> {
  const row = await db.oneOrNone<{
    chat_id: string;
    inbox_id: string | null;
    status: string | null;
    last_message: string | null;
    last_message_at: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_id: string | null;
    kind: string | null;
    group_name: string | null;
    group_avatar_url: string | null;
    remote_id: string | null;
  }>(
    `select ch.id as chat_id,
            ch.inbox_id,
            ch.status,
            ch.last_message,
            ch.last_message_at,
            ch.kind,
            ch.group_name,
            ch.group_avatar_url,
            ch.remote_id,
            cust.name as customer_name,
            cust.phone as customer_phone,
            cust.id as customer_id
       from public.chats ch
  left join public.customers cust on cust.id = ch.customer_id
      where ch.id = $1`,
    [chatId],
  );
  if (!row) return null;
  return {
    chatId: row.chat_id,
    inboxId: row.inbox_id,
    status: row.status,
    last_message: row.last_message,
    last_message_at: row.last_message_at,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_id: row.customer_id,
    kind: row.kind,
    group_name: row.group_name,
    group_avatar_url: row.group_avatar_url,
    remote_id: row.remote_id,
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}
function extFromMime(mime?: string): string | null {
  if (!mime) return null;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "pptx",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/opus": "opus",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "video/quicktime": "mov",
  };
  return map[mime] || null;
}
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

type GraphCreds = { access_token: string; phone_number_id?: string };
async function getMediaInfo(
  creds: GraphCreds,
  mediaId: string,
): Promise<{
  id: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
  url?: string;
}> {
  const u = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${mediaId}`);
  u.searchParams.set("access_token", creds.access_token);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`getMediaInfo ${res.status}: ${await res.text()}`);
  return (await res.json()) as any;
}
async function downloadMedia(
  creds: GraphCreds,
  url: string,
): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });
  if (!res.ok) throw new Error(`downloadMedia ${res.status}: ${await res.text()}`);
  return await res.arrayBuffer();
}

async function getWahaInboxConfig(inboxId: string): Promise<{ session: string; apiKey: string }> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  if ((creds.provider || "").toUpperCase() !== WAHA_PROVIDER) {
    throw new Error("Inbox nao eh WAHA");
  }

  const row = await db.oneOrNone<{ instance_id: string | null; phone_number_id: string | null }>(
    `select instance_id, phone_number_id from public.inboxes where id = $1`,
    [inboxId],
  );
  if (!row) throw new Error("Inbox WAHA nao encontrada");

  const session = String(row.instance_id || row.phone_number_id || creds.phone_number_id || "").trim();
  if (!session) {
    throw new Error("Inbox WAHA sem instance_id configurado");
  }

  const apiKey = String(creds.access_token || "").trim();
  if (!apiKey) {
    throw new Error("Inbox WAHA sem API key configurado");
  }

  return { session, apiKey };
}

function ensureWahaChatId(to?: string | null, fallbackPhone?: string | null): string | null {
  const candidate = typeof to === "string" ? to.trim() : "";
  if (candidate) {
    if (candidate.includes("@")) return candidate;
    const digits = normalizeMsisdn(candidate);
    if (digits) return `${digits}@c.us`;
  }
  if (fallbackPhone) {
    const digits = normalizeMsisdn(fallbackPhone);
    if (digits) return `${digits}@c.us`;
  }
  return null;
}

function extractWahaMessageId(response: any): string | null {
  if (!response) return null;
  if (typeof response === "string" && response.trim()) return response.trim();

  const candidates: Array<string | null | undefined> = [
    response.id,
    response.Id,
    response.ID,
    response.messageId,
    response.messageID,
    response.message_id,
    response?.result?.id,
    response?.data?.id,
    Array.isArray(response?.messages) ? response.messages[0]?.id : undefined,
  ];

  if (response?.message && typeof response.message === "object") {
    candidates.push(
      response.message.id,
      response.message.messageId,
      response.message.messageID,
    );
  }

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

async function graphUploadMedia(
  creds: { access_token: string; phone_number_id: string },
  absPath: string,
  mime: string,
  filename: string,
): Promise<string> {
  const fd = new FormData();
  const data = await fs.readFile(absPath);
  const arrayBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mime });
  fd.append("file", blob, filename);
  fd.append("messaging_product", "whatsapp");

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${creds.phone_number_id}/media`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.access_token}` },
    body: fd,
  });
  if (!res.ok) {
    throw new Error(`graphUploadMedia ${res.status}: ${await res.text()}`);
  }
  const payload = (await res.json()) as any;
  const mediaId = payload?.id;
  if (!mediaId) {
    throw new Error("graphUploadMedia missing media id");
  }
  return mediaId;
}

async function graphSendMedia(
  creds: { access_token: string; phone_number_id: string },
  to: string,
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT",
  mediaId: string,
  caption?: string | null,
  filename?: string | null,
): Promise<string | undefined> {
  const payload: any = {
    messaging_product: "whatsapp",
    to,
    type: kind.toLowerCase(),
  };

  if (kind === "DOCUMENT") {
    payload.document = {
      id: mediaId,
      caption: caption ?? undefined,
      filename: filename ?? undefined,
    };
  } else if (kind === "IMAGE") {
    payload.image = { id: mediaId, caption: caption ?? undefined };
  } else if (kind === "VIDEO") {
    payload.video = { id: mediaId, caption: caption ?? undefined };
  } else if (kind === "AUDIO") {
    payload.audio = { id: mediaId };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${creds.phone_number_id}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`graphSendMedia ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as any;
  return json?.messages?.[0]?.id || null;
}

function getPushName(value: any): string | null {
  return (
    value?.contacts?.[0]?.profile?.name ??
    value?.contacts?.[0]?.name ??
    null
  );
}

function extractContentAndType(m: any): { content: string; type: string } {
  const t = String(m?.type || "text").toLowerCase();

  switch (t) {
    case "text":
      return { content: String(m?.text?.body ?? ""), type: "TEXT" };
    case "image":
      return {
        content: m?.image?.caption ? `[IMAGE] ${m.image.caption}` : "[IMAGE]",
        type: "IMAGE",
      };
    case "audio":
      return { content: "[AUDIO]", type: "AUDIO" };
    case "video":
      return {
        content: m?.video?.caption ? `[VIDEO] ${m.video.caption}` : "[VIDEO]",
        type: "VIDEO",
      };
    case "document":
      return {
        content: m?.document?.filename
          ? `[DOCUMENT] ${m.document.filename}`
          : "[DOCUMENT]",
        type: "DOCUMENT",
      };
    case "sticker":
      return { content: "[STICKER]", type: "STICKER" };
    case "location":
      return {
        content: `[LOCATION] ${m?.location?.latitude},${m?.location?.longitude}`,
        type: "LOCATION",
      };
    case "contacts":
      return { content: "[CONTACTS]", type: "CONTACTS" };
    default:
      return { content: `[${t.toUpperCase()}]`, type: t.toUpperCase() };
  }
}

function mapMetaStatusToViewStatus(status: string): string {
  const key = (status || "").toLowerCase();
  if (key === "read") return "read";
  if (key === "delivered") return "Received";
  if (key === "sent") return "Sent";
  return "Pending";
}

function normalizeWahaJid(jid?: string | null): string | null {
  if (!jid) return null;
  return String(jid).replace("@s.whatsapp.net", "@c.us");
}

function extractWahaChatId(payload: any): string | null {
  const primary = payload?.fromMe ? payload?.to : payload?.from;
  const normalized = normalizeWahaJid(primary);
  if (normalized) return normalized;
  const messageId = typeof payload?.id === "string" ? payload.id : "";
  const parts = messageId.split("_");
  if (parts.length >= 3) {
    return normalizeWahaJid(parts[1]);
  }
  return null;
}

function isWahaStatusBroadcast(jid: string | null | undefined): boolean {
  if (!jid) return false;
  const normalized = jid.toLowerCase();
  return normalized === "status@broadcast" || normalized.endsWith(":status@broadcast");
}

function extractWahaContactName(payload: any): string | null {
  return (
    payload?.pushName ||
    payload?.senderName ||
    payload?._data?.notifyName ||
    payload?.notifyName ||
    null
  );
}

function mapWahaAckToViewStatus(ack: unknown): string | null {
  const numeric =
    typeof ack === "number"
      ? ack
      : typeof ack === "string"
        ? Number.parseInt(ack, 10)
        : Number.NaN;
  if (Number.isNaN(numeric)) return null;
  switch (numeric) {
    case 0:
      return "Pending";
    case 1:
      return "Sent";
    case 2:
      return "Received";
    case 3:
    case 4:
    case 5:
      return "read";
    default:
      return null;
  }
}

function deriveWahaMessageType(payload: any): string {
  const mime = payload?.media?.mimetype;
  if (typeof mime === "string") {
    if (mime.startsWith("image/")) return "IMAGE";
    if (mime.startsWith("video/")) return "VIDEO";
    if (mime.startsWith("audio/")) return "AUDIO";
    if (mime.includes("application/pdf") || mime.includes("application/")) return "DOCUMENT";
  }
  const hinted = String(payload?.type || "").toUpperCase();
  if (hinted) return hinted;
  return payload?.hasMedia ? "DOCUMENT" : "TEXT";
}

function isWahaGroupJid(jid?: string | null): boolean {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

function extractWahaGroupMetadata(payload: any): { name: string | null; avatarUrl: string | null } {
  const chat = payload?.chat || payload?._data?.chat || {};
  const name =
    payload?.chatName ||
    payload?.groupSubject ||
    chat?.name ||
    chat?.subject ||
    payload?.notifyName ||
    payload?.senderName ||
    null;
  const avatar =
    chat?.imgUrl ||
    chat?.img ||
    payload?.chatPicUrl ||
    payload?.groupPictureUrl ||
    payload?.groupPic ||
    null;
  return { name: name ?? null, avatarUrl: avatar ?? null };
}

function extractWahaRemoteParticipant(payload: any): {
  remoteId: string | null;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isAdmin: boolean | null;
} {
  const raw =
    payload?.author ||
    payload?.participant ||
    payload?.key?.participant ||
    payload?.id?.participant ||
    payload?.from ||
    null;
  const normalized = normalizeWahaJid(raw);
  const digits = normalized ? normalizeMsisdn(normalized) : null;
  const participantInfo =
    payload?.participant ||
    payload?.chat?.participants?.find((p: any) => normalizeWahaJid(p?.id) === normalized) ||
    null;
  const avatar =
    participantInfo?.imgUrl ||
    participantInfo?.img ||
    payload?.participantProfilePic ||
    payload?.authorAvatar ||
    null;
  const isAdmin =
    typeof participantInfo?.isAdmin === "boolean"
      ? participantInfo.isAdmin
      : typeof payload?.isParticipantAdmin === "boolean"
        ? payload.isParticipantAdmin
        : typeof payload?.participantIsAdmin === "boolean"
          ? payload.participantIsAdmin
          : null;

  const name =
    payload?.senderName ||
    payload?.authorName ||
    participantInfo?.name ||
    participantInfo?.notifyName ||
    payload?.pushName ||
    null;

  return {
    remoteId: normalized,
    name: name ?? null,
    phone: digits || null,
    avatarUrl: avatar ?? null,
    isAdmin,
  };
}

function extractWahaQuotedMessageId(payload: any): string | null {
  if (typeof payload?.quotedMsgId === "string") return payload.quotedMsgId;
  if (payload?.quotedMessage && typeof payload.quotedMessage.id === "string") {
    return payload.quotedMessage.id;
  }
  if (payload?.contextInfo && typeof payload.contextInfo.stanzaId === "string") {
    return payload.contextInfo.stanzaId;
  }
  return null;
}

function buildMetaContactsIndex(value: any): Map<string, any> {
  const map = new Map<string, any>();
  if (Array.isArray(value?.contacts)) {
    for (const contact of value.contacts) {
      const waId = typeof contact?.wa_id === "string" ? contact.wa_id : null;
      if (waId) map.set(waId, contact);
    }
  }
  return map;
}

function metaContactName(contact: any): string | null {
  if (!contact) return null;
  return (
    contact?.profile?.name ??
    contact?.name ??
    contact?.profile?.first_name ??
    contact?.pushname ??
    null
  );
}

function metaContactAvatar(contact: any): string | null {
  if (!contact) return null;
  return (
    contact?.profile?.profile_pic ??
    contact?.profile?.profile_picture_url ??
    contact?.profile_pic ??
    contact?.profile_pic_url ??
    contact?.avatar ??
    null
  );
}

function extractMetaMessageContext(
  value: any,
  message: any,
): {
  groupId: string | null;
  groupName: string | null;
  groupAvatarUrl: string | null;
  participantId: string | null;
  participantName: string | null;
  participantAvatarUrl: string | null;
  contactsIndex: Map<string, any>;
} {
  const contactsIndex = buildMetaContactsIndex(value);

  const candidateGroupIds = [
    message?.group_id,
    message?.groupId,
    message?.context?.group_id,
    message?.context?.group?.id,
    message?.context?.id,
    message?.from,
    message?.to,
  ];

  let groupId: string | null = null;
  for (const candidate of candidateGroupIds) {
    if (typeof candidate === "string" && candidate.endsWith("@g.us")) {
      groupId = candidate;
      break;
    }
  }

  if (!groupId) {
    for (const key of contactsIndex.keys()) {
      if (key.endsWith("@g.us")) {
        groupId = key;
        break;
      }
    }
  }

  const participantId =
    (typeof message?.author === "string" && message.author) ||
    (typeof message?.participant === "string" && message.participant) ||
    (groupId ? (typeof message?.from === "string" && !message.from.endsWith("@g.us") ? message.from : null) : message?.from) ||
    null;

  const groupContact = groupId ? contactsIndex.get(groupId) : undefined;
  const participantContact = participantId ? contactsIndex.get(participantId) : undefined;

  const groupName =
    metaContactName(groupContact) ??
    message?.group_name ??
    message?.context?.group?.name ??
    null;
  const groupAvatarUrl = metaContactAvatar(groupContact) ?? null;

  const participantName = metaContactName(participantContact) ?? null;
  const participantAvatarUrl = metaContactAvatar(participantContact) ?? null;

  return {
    groupId,
    groupName,
    groupAvatarUrl,
    participantId,
    participantName,
    participantAvatarUrl,
    contactsIndex,
  };
}

async function upsertWahaAttachment(args: {
  messageId: string;
  chatId: string;
  inboxId: string;
  companyId: string;
  url: string;
  mimeType?: string | null;
  filename?: string | null;
}) {
  if (!chatAttachmentsSupportsChatId) return;
  try {
    await db.none(
      `insert into public.chat_attachments
         (message_id, chat_id, inbox_id, provider, storage_bucket, storage_key, public_url, mime_type, filename, bytes)
       values ($1, $2, $3, 'WAHA', null, null, $4, $5, $6, null)
       on conflict (message_id) do update
         set public_url = excluded.public_url,
             mime_type  = coalesce(excluded.mime_type,  public.chat_attachments.mime_type),
             filename   = coalesce(excluded.filename,   public.chat_attachments.filename),
             updated_at = now()`,
      [args.messageId, args.chatId, args.inboxId, args.url, args.mimeType ?? null, args.filename ?? null],
    );
  } catch (error) {
    const code = (error as any)?.code;
    if (code === "42703") {
      chatAttachmentsSupportsChatId = false;
      console.warn("[WAHA][attachments] chat_attachments schema missing chat metadata. Skipping WAHA attachments from now on.");
    } else {
      console.warn("[WAHA][attachments] failed to upsert attachment", {
        messageId: args.messageId,
        error,
      });
    }
  }
}

async function handleInboundChange(job: InboundJobPayload) {
  if (job.provider === "WAHA") {
    await handleWahaInbound(job);
    return;
  }

  const { inboxId, companyId, value } = job;
  const pushname = getPushName(value);

  if (Array.isArray(value?.statuses)) {
    for (const s of value.statuses) {
      const wamid = String(s?.id || "");
      const status = String(s?.status || "");
      if (!wamid || !status) continue;

      const eventUid = `statuses:${wamid}:${status}`;
      const isNew = await saveWebhookEvent(inboxId, "META", eventUid, value);
      if (!isNew) continue;

      const mappedStatus = mapMetaStatusToViewStatus(status);
      const statusUpdate = await updateMessageStatusByExternalId({
        inboxId,
        externalId: wamid,
        viewStatus: mappedStatus,
      });
      if (statusUpdate) {
        try {
          await publishApp("socket.livechat.status", {
            kind: "livechat.message.status",
            chatId: statusUpdate.chatId,
            messageId: statusUpdate.messageId,
            externalId: wamid,
            view_status: statusUpdate.viewStatus,
            raw_status: status,
          });
        } catch (err) {
          console.warn(
            "[inbound] failed to publish status event:",
            (err as any)?.message || err,
          );
        }
      }
    }
  }

  if (Array.isArray(value?.messages)) {
    for (const m of value.messages) {
      const wamid = String(m?.id || "");
      if (!wamid) continue;

      const eventUid = `messages:${wamid}`;
      const isNew = await saveWebhookEvent(inboxId, "META", eventUid, value);
      if (!isNew) continue;

      const metaContext = extractMetaMessageContext(value, m);
      const isGroupMessage = typeof metaContext.groupId === "string" && metaContext.groupId.endsWith("@g.us");
      const participantWaId =
        (typeof m?.from === "string" && m.from) ||
        metaContext.participantId ||
        null;
      const remotePhone = participantWaId ? normalizeMsisdn(participantWaId) : null;

      if (!remotePhone && !isGroupMessage) {
        console.warn("[inbound] message without valid 'from'", m);
        continue;
      }

      let chatId: string;
      if (isGroupMessage && metaContext.groupId) {
        const ensured = await ensureGroupChat({
          inboxId,
          companyId,
          remoteId: metaContext.groupId,
          groupName: metaContext.groupName ?? null,
          groupAvatarUrl: metaContext.groupAvatarUrl ?? null,
        });
        chatId = ensured.chatId;
      } else {
        const ensured = await ensureLeadCustomerChat({
          inboxId,
          companyId,
          phone: remotePhone || normalizeMsisdn(participantWaId || ""),
          name: metaContext.participantName ?? pushname ?? remotePhone ?? participantWaId ?? null,
          rawPhone: participantWaId || metaContext.participantId || remotePhone || null,
        });
        chatId = ensured.chatId;
      }

      const { content, type } = extractContentAndType(m);
      const createdAt =
        typeof m?.timestamp === "number"
          ? new Date(m.timestamp * 1000)
          : m?.timestamp
            ? new Date(m.timestamp)
            : null;

      let remoteParticipantId: string | null = null;
      if (isGroupMessage && metaContext.participantId) {
        const participant = await upsertChatRemoteParticipant({
          chatId,
          remoteId: metaContext.participantId,
          name: metaContext.participantName ?? pushname ?? null,
          phone: remotePhone ?? null,
          avatarUrl: metaContext.participantAvatarUrl ?? null,
          joinedAt: createdAt ?? undefined,
        });
        remoteParticipantId = participant?.id ?? null;
      }

      const quotedExternalId =
        typeof m?.context?.id === "string"
          ? m.context.id
          : typeof m?.context?.quoted_message_id === "string"
            ? m.context.quoted_message_id
            : null;
      const repliedMessageId =
        quotedExternalId && chatId
          ? await findChatMessageIdByExternalId(chatId, quotedExternalId)
          : null;

      const inserted = await insertInboundMessage({
        chatId,
        externalId: wamid,
        content,
        type,
        remoteParticipantId,
        remoteSenderId: metaContext.participantId ?? participantWaId ?? null,
        remoteSenderName: metaContext.participantName ?? pushname ?? null,
        remoteSenderPhone: remotePhone ?? null,
        remoteSenderAvatarUrl: metaContext.participantAvatarUrl ?? null,
        remoteSenderIsAdmin: null,
        repliedMessageId,
        createdAt,
      });
      if (!inserted) {
        continue;
      }

      // ====== MÍDIA (document|image|audio|video|sticker) ======
      const msgType = String(m?.type || "").toLowerCase();
      if (["document", "image", "audio", "video", "sticker"].includes(msgType)) {
        try {
          const media = m?.[msgType];
          const mediaId: string | undefined = media?.id;
          const origFilename: string | undefined = media?.filename;

          if (mediaId) {
            const creds = await getDecryptedCredsForInbox(inboxId);
            const graphCreds: GraphCreds = {
              access_token: creds.access_token,
              phone_number_id: creds.phone_number_id ?? undefined,
            };
            const info = await getMediaInfo(graphCreds, mediaId);
            if (!info?.url) throw new Error("Meta não retornou URL da mídia");

            const bin = await downloadMedia(graphCreds, info.url);
            const buf = Buffer.from(bin);

            const ymd = new Date().toISOString().slice(0, 10);
            const safeBase = origFilename
              ? sanitizeFilename(origFilename)
              : `${mediaId}.${extFromMime(info.mime_type) || "bin"}`;
            const relativeKey = `${companyId}/${chatId}/${ymd}/${(inserted as any).external_id || inserted.id
              }-${safeBase}`;
            const absFilePath = path.join(MEDIA_DIR, relativeKey);

            await ensureDir(path.dirname(absFilePath));
            await fs.writeFile(absFilePath, buf);

            const publicUrl = MEDIA_PUBLIC_BASE
              ? `${MEDIA_PUBLIC_BASE}/${relativeKey}`
              : `${FILES_PUBLIC_BASE}/files/${inserted.id}`;

            await db.none(
              `insert into public.chat_attachments
                (message_id, provider, provider_media_id, kind, mime_type, filename, bytes, sha256, storage_bucket, storage_key, public_url)
               values ($1,'META',$2,$3,$4,$5,$6,$7,'local',$8,$9)`,
              [
                inserted.id,
                mediaId,
                msgType.toUpperCase(),
                info.mime_type ?? null,
                origFilename ?? null,
                buf.length,
                info.sha256 ?? null,
                relativeKey,
                publicUrl,
              ],
            );

            await db.none(
              `update public.chat_messages set media_url = $2 where id = $1`,
              [inserted.id, publicUrl],
            );
          }
        } catch (err) {
          console.error(
            "[inbound] media handling error:",
            (err as any)?.message || err,
          );
        }
      }
      // ====== FIM MÍDIA ======

      const msgRow = await db.one<{
        id: string;
        chat_id: string;
        content: string | null;
        is_from_customer: boolean;
        sender_id: string | null;
        created_at: string;
        type: string | null;
        view_status: string | null;
        media_url: string | null;
        remote_participant_id: string | null;
        remote_sender_id: string | null;
        remote_sender_name: string | null;
        remote_sender_phone: string | null;
        remote_sender_avatar_url: string | null;
        remote_sender_is_admin: boolean | null;
        replied_message_id: string | null;
      }>(
        `select id,
                chat_id,
                content,
                is_from_customer,
                sender_id,
                created_at,
                type,
                view_status,
                media_url,
                remote_participant_id,
                remote_sender_id,
                remote_sender_name,
                remote_sender_phone,
                remote_sender_avatar_url,
                remote_sender_is_admin,
                replied_message_id
           from public.chat_messages where id = $1`,
        [inserted.id],
      );

      const mappedMessage = {
        id: msgRow.id,
        chat_id: msgRow.chat_id,
        body: msgRow.content,
        sender_type: msgRow.is_from_customer ? ("CUSTOMER" as const) : ("AGENT" as const),
        sender_id: msgRow.sender_id,
        created_at: msgRow.created_at,
        view_status: msgRow.view_status,
        type: msgRow.type ?? "TEXT",
        is_private: false,
        media_url: msgRow.media_url ?? null,
        remote_participant_id: msgRow.remote_participant_id ?? null,
        remote_sender_id: msgRow.remote_sender_id ?? null,
        remote_sender_name: msgRow.remote_sender_name ?? null,
        remote_sender_phone: msgRow.remote_sender_phone ?? null,
        remote_sender_avatar_url: msgRow.remote_sender_avatar_url ?? null,
        remote_sender_is_admin: msgRow.remote_sender_is_admin ?? null,
        replied_message_id: msgRow.replied_message_id ?? null,
      };

      let inboxIdForSocket: string | null = null;
      try {
        const chatRow = await db.oneOrNone<{ inbox_id: string | null }>(
          `select inbox_id from public.chats where id = $1`,
          [chatId],
        );
        inboxIdForSocket = chatRow?.inbox_id ?? null;
      } catch (e) {
        console.warn(
          "[inbound] failed to load chat inbox for socket broadcast:",
          (e as any)?.message || e,
        );
      }

      try {
        const chatSummary = await fetchChatUpdateForSocket(chatId);
        await publishApp("socket.livechat.inbound", {
          kind: "livechat.inbound.message",
          chatId,
          inboxId: inboxIdForSocket,
          message: mappedMessage,
          chatUpdate: chatSummary
            ? {
                ...chatSummary,
                last_message_from: mappedMessage.sender_type,
              }
            : {
                chatId,
                inboxId: inboxIdForSocket,
                last_message: mappedMessage.body,
                last_message_at: mappedMessage.created_at,
                last_message_from: mappedMessage.sender_type,
                customer_name: isGroupMessage ? null : metaContext.participantName ?? pushname ?? null,
                customer_phone: isGroupMessage ? null : remotePhone ?? null,
                kind: isGroupMessage ? "GROUP" : null,
                group_name: isGroupMessage ? metaContext.groupName ?? null : null,
                group_avatar_url: isGroupMessage ? metaContext.groupAvatarUrl ?? null : null,
                remote_id: isGroupMessage ? metaContext.groupId ?? null : participantWaId ?? null,
              },
        });
      } catch (e) {
        console.warn(
          "[inbound] failed to publish socket event:",
          (e as any)?.message || e,
        );
      }

      try {
        await db.none(
          `update public.chats
             set last_message = $1,
                 last_message_at = now()
           where id = $2`,
          [content, chatId],
        );
      } catch (e) {
        console.warn(
          "[inbound] failed to update chat last_message:",
          (e as any)?.message || e,
        );
      }

      try {
        const companyId = String(job.companyId || "");
        if (companyId) {
          if (typeof (k as any)?.listPrefixCompany === "function") {
            await rDelMatch((k as any).listPrefixCompany(companyId));
          } else {
            await rDelMatch(`livechat:chats:list:${companyId}:*`);
          }
        }
      } catch { }

      try {
        type Row = {
          id: string;
          chat_id: string;
          content: string | null;
          is_from_customer: boolean;
          sender_id: string | null;
          created_at: string;
          type: string | null;
          view_status: string | null;
          media_url: string | null;
          remote_participant_id: string | null;
          remote_sender_id: string | null;
          remote_sender_name: string | null;
          remote_sender_phone: string | null;
          remote_sender_avatar_url: string | null;
          remote_sender_is_admin: boolean | null;
          replied_message_id: string | null;
        };

        const { rows } = await db.query(
          `
    select id,
           chat_id,
           content,
           is_from_customer,
           sender_id,
           created_at,
           type,
           view_status,
           media_url,
           remote_participant_id,
           remote_sender_id,
           remote_sender_name,
           remote_sender_phone,
           remote_sender_avatar_url,
           remote_sender_is_admin,
           replied_message_id
      from public.chat_messages
     where chat_id = $1
     order by created_at desc
     limit $2
    `,
          [chatId, PAGE_LIMIT_PREWARM],
        );

        const mappedDesc = (rows || []).map((r) => ({
          id: r.id,
          chat_id: r.chat_id,
          body: r.content,
          sender_type: r.is_from_customer ? "CUSTOMER" : "AGENT",
          sender_id: r.sender_id,
          created_at: r.created_at,
          view_status: r.view_status,
          type: r.type ?? "TEXT",
          is_private: false,
          media_url: r.media_url ?? null,
          remote_participant_id: r.remote_participant_id ?? null,
          remote_sender_id: r.remote_sender_id ?? null,
          remote_sender_name: r.remote_sender_name ?? null,
          remote_sender_phone: r.remote_sender_phone ?? null,
          remote_sender_avatar_url: r.remote_sender_avatar_url ?? null,
          remote_sender_is_admin: r.remote_sender_is_admin ?? null,
          replied_message_id: r.replied_message_id ?? null,
        }));

        const pubAsc = [...mappedDesc].sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime(),
        );

        const key = k.msgsKey(chatId, undefined, PAGE_LIMIT_PREWARM);
        await rSet(key, pubAsc, CACHE_TTL_MSGS);
      } catch (e) {
        console.warn(
          "[inbound] cache prewarm error:",
          (e as any)?.message || e,
        );
      }
    }
  }
}

async function handleWahaInbound(job: WahaInboundPayload) {
  const eventKey = (job.event || "").toLowerCase();
  const payload = job.payload ?? {};
  try {
    switch (eventKey) {
      case "message":
      case "message.any":
        await handleWahaMessage(job, payload);
        break;
      case "participants.update":
      case "group.participants":
      case "group.participants.update":
      case "group.participants.add":
      case "group.participants.remove":
      case "group.participants.left":
      case "group.participants.leave":
      case "group.participants.promote":
      case "group.participants.demote":
      case "chat.participant.add":
      case "chat.participant.remove":
      case "chat.participant.join":
      case "chat.participant.leave":
      case "chat.participants.update":
        await handleWahaParticipantEvent(job, payload);
        break;
      case "message.ack":
        await handleWahaAck(job, payload);
        break;
      case "message.revoked":
        console.log("[WAHA][worker] message.revoked received", { inboxId: job.inboxId, messageId: payload?.id });
        await handleWahaAck(job, { ...payload, ack: -1 });
        break;
      case "message.reaction":
        console.log("[WAHA][worker] message.reaction received", {
          inboxId: job.inboxId,
          messageId: payload?.reaction?.messageId,
          reaction: payload?.reaction?.text,
        });
        break;
      default:
        console.log("[WAHA][worker] unhandled event", { event: job.event, inboxId: job.inboxId });
    }
  } catch (error) {
    console.error("[WAHA][worker] failed to process event", {
      event: job.event,
      inboxId: job.inboxId,
      error,
    });
  }
}

async function handleWahaMessage(job: WahaInboundPayload, payload: any) {
  const messageId = String(payload?.id || "");
  if (messageId) {
    try {
      await saveWebhookEvent(job.inboxId, "WAHA", `waha:message:${messageId}`, job.raw ?? payload);
    } catch (error) {
      console.warn("[WAHA][worker] saveWebhookEvent failed", { inboxId: job.inboxId, messageId, error });
    }
  }

  const chatJid = extractWahaChatId(payload);
  if (!chatJid) {
    console.warn("[WAHA][worker] message without chat id", { payload });
    return;
  }
  if (isWahaStatusBroadcast(chatJid) || isWahaStatusBroadcast(payload?.from) || isWahaStatusBroadcast(payload?.to)) {
    console.debug("[WAHA][worker] skipping status broadcast message", {
      inboxId: job.inboxId,
      chatJid,
      messageId,
    });
    return;
  }

  const name = extractWahaContactName(payload);
  const basePhone =
    normalizeMsisdn(chatJid) ||
    normalizeMsisdn(payload?.from) ||
    normalizeMsisdn(payload?.to);
  const isGroupChat = isWahaGroupJid(chatJid);

  let chatId: string;
  let phoneForLead = basePhone && basePhone.trim() ? basePhone : chatJid;

  let groupMeta: { name: string | null; avatarUrl: string | null } | null = null;

  if (isGroupChat) {
    groupMeta = extractWahaGroupMetadata(payload);
    rememberAvatar(job.companyId, chatJid, groupMeta?.avatarUrl ?? null);
    const ensured = await ensureGroupChat({
      inboxId: job.inboxId,
      companyId: job.companyId,
      remoteId: chatJid,
      groupName: groupMeta?.name ?? name ?? chatJid,
      groupAvatarUrl: groupMeta?.avatarUrl ?? null,
    });
    chatId = ensured.chatId;
  } else {
    const ensured = await ensureLeadCustomerChat({
      inboxId: job.inboxId,
      companyId: job.companyId,
      phone: phoneForLead,
      name: name ?? phoneForLead,
      rawPhone: chatJid,
    });
    chatId = ensured.chatId;
  }

  const isFromCustomer = !payload?.fromMe;
  const ackStatus = mapWahaAckToViewStatus(payload?.ack) ?? (isFromCustomer ? "Pending" : "Sent");
  const mediaUrl = payload?.hasMedia ? payload?.media?.url ?? null : null;
  const messageType = deriveWahaMessageType(payload);
  const body =
    typeof payload?.body === "string" && payload.body.trim()
      ? payload.body
      : mediaUrl
        ? `[${messageType}]`
        : "";
  const createdAt =
    typeof payload?.timestamp === "number"
      ? new Date(payload.timestamp * 1000)
      : payload?.timestamp
        ? new Date(payload.timestamp)
        : null;

  let remoteMeta:
    | {
        remoteId: string | null;
        name: string | null;
        phone: string | null;
        avatarUrl: string | null;
        isAdmin: boolean | null;
      }
    | null = null;

  if (isFromCustomer) {
    if (isGroupChat) {
      remoteMeta = extractWahaRemoteParticipant(payload);
    } else {
      const directRemoteId = normalizeWahaJid(payload?.from) || chatJid;
      remoteMeta = {
        remoteId: directRemoteId,
        name: name ?? null,
        phone: normalizeMsisdn(directRemoteId ?? "") || phoneForLead || null,
        avatarUrl:
          payload?.senderProfilePic ||
          payload?.authorAvatar ||
          payload?.contactAvatar ||
          null,
        isAdmin: null,
      };
      rememberAvatar(job.companyId, directRemoteId, remoteMeta.avatarUrl ?? null);
    }
  }

  let remoteParticipantId: string | null = null;
  if (isGroupChat && remoteMeta?.remoteId && isFromCustomer) {
    rememberAvatar(job.companyId, remoteMeta.remoteId, remoteMeta.avatarUrl ?? null);
    const participant = await upsertChatRemoteParticipant({
      chatId,
      remoteId: remoteMeta.remoteId,
      name: remoteMeta.name ?? null,
      phone: remoteMeta.phone ?? null,
      avatarUrl: remoteMeta.avatarUrl ?? null,
      isAdmin: remoteMeta.isAdmin ?? null,
      joinedAt: createdAt ?? undefined,
    });
    remoteParticipantId = participant?.id ?? null;
  }

  const quotedExternalId = extractWahaQuotedMessageId(payload);
  const repliedMessageId =
    quotedExternalId && chatId
      ? await findChatMessageIdByExternalId(chatId, quotedExternalId)
      : null;

  const upsertResult = await upsertChatMessage({
    chatId,
    externalId: messageId || `${chatId}:${Date.now()}`,
    isFromCustomer,
    content: body,
    type: messageType,
    viewStatus: ackStatus ?? null,
    mediaUrl,
    createdAt,
    remoteParticipantId,
    remoteSenderId: remoteMeta?.remoteId ?? null,
    remoteSenderName: remoteMeta
      ? remoteMeta.name ?? (isGroupChat ? remoteMeta.phone ?? null : name ?? phoneForLead ?? null)
      : null,
    remoteSenderPhone: remoteMeta
      ? remoteMeta.phone ?? (isGroupChat ? null : phoneForLead ?? null)
      : null,
    remoteSenderAvatarUrl: remoteMeta?.avatarUrl ?? null,
    remoteSenderIsAdmin: remoteMeta?.isAdmin ?? null,
    repliedMessageId,
  });

  if (!upsertResult) return;

  await touchChatAfterMessage({
    chatId,
    content: body,
    lastMessageFrom: isFromCustomer ? "CUSTOMER" : "AGENT",
  });

  if (mediaUrl) {
    await upsertWahaAttachment({
      messageId: upsertResult.message.id,
      chatId,
      inboxId: job.inboxId,
      companyId: job.companyId,
      url: mediaUrl,
      mimeType: payload?.media?.mimetype ?? null,
      filename: payload?.media?.filename ?? null,
    });
  }

  if (!upsertResult.inserted) {
    if (ackStatus && !isFromCustomer) {
      await publishApp("socket.livechat.status", {
        kind: "livechat.message.status",
        chatId,
        messageId: upsertResult.message.id,
        externalId: messageId,
        view_status: ackStatus,
        raw_status: ackStatus,
      });
    }
    return;
  }

  const mappedMessage = {
    id: upsertResult.message.id,
    chat_id: chatId,
    body,
    sender_type: isFromCustomer ? ("CUSTOMER" as const) : ("AGENT" as const),
    sender_id: upsertResult.message.sender_id ?? null,
    created_at: upsertResult.message.created_at,
    view_status: upsertResult.message.view_status ?? ackStatus ?? "Pending",
    type: upsertResult.message.type ?? messageType,
    is_private: false,
    media_url: upsertResult.message.media_url ?? mediaUrl ?? null,
    remote_sender_id: upsertResult.message.remote_sender_id ?? null,
    remote_sender_name: upsertResult.message.remote_sender_name ?? null,
    remote_sender_phone: upsertResult.message.remote_sender_phone ?? null,
    remote_sender_avatar_url: upsertResult.message.remote_sender_avatar_url ?? null,
    remote_sender_is_admin: upsertResult.message.remote_sender_is_admin ?? null,
    remote_participant_id: upsertResult.message.remote_participant_id ?? null,
    replied_message_id: upsertResult.message.replied_message_id ?? null,
  };

  try {
    const chatSummary = await fetchChatUpdateForSocket(chatId);
    await publishApp("socket.livechat.inbound", {
      kind: "livechat.inbound.message",
      chatId,
      inboxId: job.inboxId,
      message: mappedMessage,
      chatUpdate: chatSummary
        ? {
            ...chatSummary,
            last_message_from: mappedMessage.sender_type,
          }
        : {
            chatId,
            inboxId: job.inboxId,
            last_message: mappedMessage.body,
            last_message_at: mappedMessage.created_at,
            last_message_from: mappedMessage.sender_type,
            customer_name: isGroupChat ? null : name ?? null,
            customer_phone: isGroupChat ? null : phoneForLead ?? null,
            kind: isGroupChat ? "GROUP" : null,
            group_name: isGroupChat ? groupMeta?.name ?? name ?? chatJid : null,
            group_avatar_url: isGroupChat ? groupMeta?.avatarUrl ?? null : null,
            remote_id: isGroupChat ? chatJid : normalizeWahaJid(chatJid),
          },
    });
  } catch (error) {
    console.warn("[WAHA][worker] failed to publish socket inbound message", error);
  }

  if (ackStatus && !isFromCustomer) {
    await publishApp("socket.livechat.status", {
      kind: "livechat.message.status",
      chatId,
      messageId: mappedMessage.id,
      externalId: messageId,
      view_status: ackStatus,
      raw_status: ackStatus,
    });
  }

  try {
    await invalidateChatCaches(chatId, job.companyId);
  } catch (error) {
    console.warn("[WAHA][worker] failed to invalidate caches after inbound", {
      chatId,
      error,
    });
  }
}

async function handleWahaParticipantEvent(job: WahaInboundPayload, payload: any) {
  const rawGroup =
    payload?.id ||
    payload?.chatId ||
    payload?.jid ||
    payload?.groupId ||
    payload?.group?.id ||
    payload?.chat?.id ||
    null;
  const groupJid = normalizeWahaJid(rawGroup);
  if (!groupJid || !isWahaGroupJid(groupJid)) {
    return;
  }

  const groupMeta = extractWahaGroupMetadata(payload);
  const ensured = await ensureGroupChat({
    inboxId: job.inboxId,
    companyId: job.companyId,
    remoteId: groupJid,
    groupName: groupMeta.name ?? null,
    groupAvatarUrl: groupMeta.avatarUrl ?? null,
  });
  const chatId = ensured.chatId;

  const participantSources: any[] = [];
  const push = (value: any) => {
    if (Array.isArray(value)) {
      for (const item of value) participantSources.push(item);
    } else if (value) {
      participantSources.push(value);
    }
  };

  push(payload?.participants);
  push(payload?.participantIds);
  push(payload?.participant_id);
  push(payload?.participant);
  push(payload?.user);
  push(payload?.users);

  const participants = participantSources
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return item.id || item.jid || item.user || item.number || item;
      }
      return null;
    })
    .map((value) => normalizeWahaJid(value))
    .filter(Boolean) as string[];

  if (!participants.length) {
    return;
  }

  const infoMap = new Map<
    string,
    {
      name?: string | null;
      avatarUrl?: string | null;
      isAdmin?: boolean | null;
    }
  >();

  const collectInfo = (source: any) => {
    if (!Array.isArray(source)) return;
    for (const entry of source) {
      const normalized = normalizeWahaJid(entry?.id || entry?.jid || entry?.user || entry);
      if (!normalized) continue;
      infoMap.set(normalized, {
        name:
          entry?.name ||
          entry?.notifyName ||
          entry?.pushName ||
          entry?.displayName ||
          null,
        avatarUrl: entry?.imgUrl || entry?.img || entry?.avatarUrl || entry?.profilePicUrl || null,
        isAdmin:
          typeof entry?.isAdmin === "boolean"
            ? entry.isAdmin
            : typeof entry?.admin === "boolean"
              ? entry.admin
              : undefined,
      });
    }
  };

  collectInfo(payload?.participantsInfo);
  collectInfo(payload?.participants_details);
  collectInfo(payload?.participantsData);
  collectInfo(payload?.participants_metadata);

  const admins = Array.isArray(payload?.admins)
    ? (payload.admins as any[]).map((adm) => normalizeWahaJid(adm)).filter(Boolean)
    : [];

  const action = String(
    payload?.action ||
      payload?.type ||
      payload?.event ||
      payload?.status ||
      payload?.change ||
      "",
  ).toLowerCase();

  const timestampIso =
    typeof payload?.timestamp === "number"
      ? new Date(payload.timestamp * 1000).toISOString()
      : payload?.timestamp
        ? new Date(payload.timestamp).toISOString()
        : null;

  for (const remoteId of participants) {
    const info = infoMap.get(remoteId) || {};
    const normalizedAdmin =
      typeof info.isAdmin === "boolean"
        ? info.isAdmin
        : admins.includes(remoteId)
          ? true
          : null;

    if (
      action.includes("remove") ||
      action.includes("leave") ||
      action.includes("left") ||
      action.includes("kick") ||
      action.includes("delete")
    ) {
      await markChatRemoteParticipantLeft({
        chatId,
        remoteId,
        leftAt: timestampIso ?? undefined,
      }).catch((error) => {
        console.warn("[WAHA][worker] markChatRemoteParticipantLeft failed", {
          chatId,
          remoteId,
          error,
        });
      });
    } else {
      await upsertChatRemoteParticipant({
        chatId,
        remoteId,
        name: info.name ?? null,
        phone: normalizeMsisdn(remoteId),
        avatarUrl: info.avatarUrl ?? null,
        isAdmin: normalizedAdmin,
        joinedAt: timestampIso ?? undefined,
      }).catch((error) => {
        console.warn("[WAHA][worker] upsertChatRemoteParticipant (event) failed", {
          chatId,
          remoteId,
          error,
        });
      });
    }
  }
}

async function handleWahaAck(job: WahaInboundPayload, payload: any) {
  const messageId = String(payload?.id || payload?.messageId || "");
  if (!messageId) return;
  const chatCandidate =
    normalizeWahaJid(payload?.chatId) ||
    normalizeWahaJid(payload?.from) ||
    normalizeWahaJid(payload?.to) ||
    null;
  if (isWahaStatusBroadcast(chatCandidate)) {
    console.debug("[WAHA][worker] skipping status broadcast ack", {
      inboxId: job.inboxId,
      messageId,
    });
    return;
  }
  const status = mapWahaAckToViewStatus(payload?.ack);
  if (!status) return;
  const statusUpdate = await updateMessageStatusByExternalId({
    inboxId: job.inboxId,
    externalId: messageId,
    viewStatus: status,
  });
  if (statusUpdate) {
    await publishApp("socket.livechat.status", {
      kind: "livechat.message.status",
      chatId: statusUpdate.chatId,
      messageId: statusUpdate.messageId,
      externalId: messageId,
      view_status: statusUpdate.viewStatus,
      raw_status: status,
    });
  }
}

async function handleWahaOutboundRequest(job: any): Promise<void> {
  const inboxId = String(job?.inboxId || "");
  if (!inboxId) throw new Error("WAHA outbound sem inboxId");

  const payload = job?.payload ?? {};
  const internalChatId = job?.chatId
    ? String(job.chatId)
    : payload?.chatId
      ? String(payload.chatId)
      : null;

  const toCandidate = payload?.chatId ?? payload?.to ?? null;
  let remoteChatId = ensureWahaChatId(typeof toCandidate === "string" ? toCandidate : null);

  if (!remoteChatId && internalChatId) {
    try {
      const chatInfo = await getChatWithCustomerPhone(internalChatId);
      remoteChatId = ensureWahaChatId(null, chatInfo.customer_phone);
    } catch (error) {
      console.warn("[worker][WAHA] nao foi possivel resolver o chatId remoto", {
        chatId: internalChatId,
        error,
      });
    }
  }

  if (!remoteChatId) {
    throw new Error("WAHA outbound sem chatId/to valido");
  }

  const { session, apiKey } = await getWahaInboxConfig(inboxId);
  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  };

  const messageType = String(payload?.type || "text").toLowerCase();
  let response: any;

  if (messageType === "media") {
    const kind = String(payload?.kind || "document").toLowerCase();
    if (!payload?.mediaUrl) {
      throw new Error("WAHA media requer mediaUrl");
    }

    const endpoint =
      kind === "image"
        ? "/api/sendImage"
        : kind === "video"
          ? "/api/sendVideo"
          : kind === "audio"
            ? "/api/sendVoice"
            : "/api/sendFile";

    const body: any = {
      session,
      chatId: remoteChatId,
      caption: payload?.caption ?? undefined,
      quotedMessageId: payload?.quotedMessageId ?? undefined,
      file: {
        url: payload.mediaUrl,
        filename: payload?.filename ?? undefined,
        mimetype: payload?.mimeType ?? undefined,
      },
    };

    response = await wahaFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } else {
    const content = String(payload?.content || "").trim();
    if (!content) throw new Error("WAHA text requer content");

    const body: any = {
      session,
      chatId: remoteChatId,
      text: content,
    };
    if (Array.isArray(payload?.mentions) && payload.mentions.length > 0) {
      body.mentions = payload.mentions;
    }
    if (payload?.quotedMessageId) {
      body.quotedMessageId = payload.quotedMessageId;
    }

    response = await wahaFetch("/api/sendText", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  const externalId = extractWahaMessageId(response);
  const contentForChat =
    messageType === "media"
      ? payload?.caption || `[${String(payload?.kind || "MEDIA").toUpperCase()}]`
      : String(payload?.content || "");

  let messageRow: any | null = null;
  let messageOperation: "insert" | "update" | null = null;
  if (internalChatId) {
    const upsert = await insertOutboundMessage({
      chatId: internalChatId,
      inboxId,
      customerId: String(job?.customerId || ""),
      externalId: externalId ?? null,
      content: contentForChat,
      type:
        messageType === "media"
          ? String(payload?.kind || "DOCUMENT").toUpperCase()
          : "TEXT",
      senderId: job?.senderId || job?.senderUserSupabaseId || null,
      messageId: payload?.draftId || job?.messageId || null,
      viewStatus: externalId ? "Sent" : "Pending",
    });
    messageRow = upsert?.message ?? null;
    messageOperation = upsert?.operation ?? null;

    if (messageRow && messageType === "media" && payload?.mediaUrl) {
      await db.none(
        `update public.chat_messages
            set media_url = $2,
                updated_at = now()
          where id = $1`,
        [messageRow.id, payload.mediaUrl],
      );
      messageRow.media_url = payload.mediaUrl;
    }

    if (messageRow) {
      try {
        await touchChatAfterMessage({
          chatId: messageRow.chat_id,
          content: messageRow.content,
          lastMessageFrom: "AGENT",
        });
      } catch (error) {
        console.warn("[worker][WAHA] touchChatAfterMessage failed", {
          chatId: messageRow.chat_id,
          error,
        });
      }
    } else if (!messageRow && internalChatId) {
      try {
        await touchChatAfterMessage({
          chatId: internalChatId,
          content: contentForChat,
          lastMessageFrom: "AGENT",
        });
      } catch (error) {
        console.warn("[worker][WAHA] touchChatAfterMessage failed (no message row)", {
          chatId: internalChatId,
          error,
        });
      }
    }
  }

  const chatIdForStatus = messageRow?.chat_id || internalChatId || null;
  const messageIdForStatus = messageRow?.id || payload?.draftId || job?.messageId || null;
  const viewStatus = externalId ? "Sent" : "Pending";

  const chatSummary =
    chatIdForStatus && messageOperation === "insert"
      ? await fetchChatUpdateForSocket(chatIdForStatus)
      : null;

  if (messageRow && messageOperation === "insert") {
    const mapped = {
      id: messageRow.id,
      chat_id: messageRow.chat_id,
      body: messageRow.content,
      sender_type: "AGENT" as const,
      sender_id: messageRow.sender_id,
      created_at: messageRow.created_at,
      view_status: messageRow.view_status ?? viewStatus,
      type: messageRow.type ?? (messageType === "media" ? "DOCUMENT" : "TEXT"),
      is_private: false,
      media_url: messageRow.media_url ?? null,
    };

    await publishApp("socket.livechat.outbound", {
      kind: "livechat.outbound.message",
      chatId: mapped.chat_id,
      inboxId,
      message: mapped,
      chatUpdate: chatSummary
        ? {
            ...chatSummary,
            last_message_from: mapped.sender_type,
          }
        : undefined,
    });
  }

  if (chatIdForStatus && messageIdForStatus) {
    const rawStatus = viewStatus.toLowerCase();
    await publishApp("socket.livechat.status", {
      kind: "livechat.message.status",
      chatId: chatIdForStatus,
      messageId: messageIdForStatus,
      externalId: externalId || null,
      view_status: viewStatus,
      raw_status: rawStatus,
    });
  }

  console.log("[worker][outbound][WAHA] message sent", {
    inboxId,
    chatId: chatIdForStatus,
    externalId: externalId || null,
    remoteChatId,
  });

  if (chatIdForStatus) {
    try {
      await invalidateChatCaches(chatIdForStatus, job.companyId);
    } catch (error) {
      console.warn("[worker][WAHA] failed to invalidate caches after outbound", {
        chatId: chatIdForStatus,
        error,
      });
    }
  }
}

async function startInboundWorker(): Promise<void> {
  console.log("[worker] inbound starting…");
  await consume(Q_INBOUND, async (msg, ch) => {
    if (!msg) return;
    try {
      const job = JSON.parse(msg.content.toString()) as InboundJobPayload;
      await handleInboundChange(job);
      ch.ack(msg);
    } catch (e: any) {
      console.error("[inbound.worker] error:", e?.message || e);
      ch.nack(msg, false, false);
    }
  });
  console.log("[worker] inbound listening on:", Q_INBOUND);
}

async function sendMetaText(args: {
  inboxId: string;
  customerPhone: string;
  content: string;
}) {
  const creds = await getDecryptedCredsForInbox(args.inboxId);
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${creds.phone_number_id}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: args.customerPhone,
    type: "text",
    text: { body: args.content },
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = (json as any)?.error?.code || response.status;
    const type = (json as any)?.error?.type || "MetaError";
    const message = (json as any)?.error?.message || response.statusText;
    const err = new Error(`[${code}] ${type}: ${message}`);
    (err as any).retryable =
      response.status >= 500 || response.status === 429;
    throw err;
  }
  const wamid = (json as any)?.messages?.[0]?.id || null;
  return { wamid };
}

async function startOutboundWorker(): Promise<void> {
  console.log("[worker] outbound starting…");
  await consume(Q_OUTBOUND, async (msg, ch) => {
    if (!msg) return;

    let job: any;
    try {
      job = JSON.parse(msg.content.toString());
    } catch {
      await publish(EX_DLX, "outbound.dlq", {
        raw: msg.content.toString(),
        error: "invalid_json",
      });
      ch.ack(msg);
      return;
    }

    const headerAttempt = Number((msg.properties.headers as any)?.attempt ?? 0) || 0;
    const attempt = Math.max(
      headerAttempt,
      Number(job?.attempt ?? 0) || 0,
    );

    try {
      let jobKind = String(job?.jobType || job?.kind || "");
      const jobKindLower = jobKind.toLowerCase();
      const provider = String(job?.provider || "").toUpperCase();

      if (jobKindLower === "outbound.request") {
        if (provider === WAHA_PROVIDER) {
          await handleWahaOutboundRequest(job);
          ch.ack(msg);
          return;
        }
        if (!provider || provider === "META" || provider === "META_CLOUD") {
          jobKind = "message.send";
        } else {
          throw new Error(`unknown provider ${provider} for outbound.request`);
        }
      }

      if (provider === WAHA_PROVIDER && jobKind === "message.send") {
        await handleWahaOutboundRequest(job);
        ch.ack(msg);
        return;
      }

      if (jobKind === "livechat.startChat") {
        ch.ack(msg);
        return;
      }

      if (jobKind === "meta.sendMedia") {
        const chatId = String(job.chatId || "");
        const messageId = String(job.messageId || "");
        const storageKey = String(job.storage_key || "");
        const mimeType = String(job.mime_type || "");
        if (!chatId || !messageId || !storageKey || !mimeType) {
          throw new Error("meta.sendMedia missing fields");
        }

        const { chat_id, customer_phone, inbox_id } =
          await getChatWithCustomerPhone(chatId);

        const inboxId = String(job.inboxId || inbox_id || "");
        if (!inboxId) throw new Error("inboxId missing");

        const creds = await getDecryptedCredsForInbox(inboxId);
        if (!creds?.access_token || !creds?.phone_number_id) {
          throw new Error("missing_meta_credentials");
        }

        const abs = path.join(MEDIA_DIR, storageKey);
        try {
          await fs.access(abs);
        } catch {
          throw new Error("media_file_missing");
        }

        const filename = String(job.filename || path.basename(abs));
        const mediaType = mimeType.startsWith("image/")
          ? "IMAGE"
          : mimeType.startsWith("video/")
            ? "VIDEO"
            : mimeType.startsWith("audio/")
              ? "AUDIO"
              : "DOCUMENT";

        // upload
        const mediaId = await graphUploadMedia(
          { access_token: creds.access_token, phone_number_id: creds.phone_number_id },
          abs,
          mimeType,
          filename,
        );
        console.log("[outbound] graphUploadMedia ok", { mediaId, mimeType });

        // normaliza número para E.164 sem '+'
        function toE164(n: string): string {
          const only = String(n || "").replace(/\D+/g, "");
          return only.replace(/^00/, ""); // ex: 0055... -> 55...
        }
        const to = toE164(customer_phone);

        // envia mídia
        const wamid = await graphSendMedia(
          { access_token: creds.access_token, phone_number_id: creds.phone_number_id },
          to,                   // <<< usa o número normalizado
          mediaType,
          mediaId,
          job.caption ?? null,
          filename,
        );
        console.log("[outbound] graphSendMedia ok", { wamid });

        // garante persistência do status, com ou sem wamid
        if (!wamid) {
          console.error("[outbound] graphSendMedia retornou 200 mas sem wamid");
          await db.none(
            `update public.chat_messages
       set view_status = 'Sent'
     where id = $1`,
            [messageId]
          );
        } else {
          await db.none(
            `update public.chat_messages
       set external_id = $2,
           view_status = 'Sent'
     where id = $1`,
            [messageId, wamid]
          );
        }

        // (opcional) se ainda quiser manter seu helper que upserta logs/etc:
        await insertOutboundMessage({
          chatId: chat_id,
          inboxId,
          customerId: String(job.customerId || ""),
          externalId: wamid || null,
          content: job.caption || filename,
          type: mediaType,
          senderId: job.senderId || job.senderUserSupabaseId || null,
          messageId,
          viewStatus: "Sent",
        });

        // avisa o front SEMPRE
        await publishApp("socket.livechat.status", {
          kind: "livechat.message.status",
          chatId,
          messageId,
          externalId: wamid || null,
          view_status: "Sent",
          raw_status: "sent",
        });

        console.log("[worker][outbound] media sent", { chatId, inboxId, messageId, wamid });


        ch.ack(msg);
        return;
      }

      if (jobKind !== "message.send" && jobKind !== "send-text") {
        throw new Error(`unknown jobType: ${jobKind}`);
      }

      const chatId = String(job.chatId || "");
      const content = String(job.content || "");
      if (!chatId || !content) throw new Error("chatId/content missing");

      const { chat_id, customer_phone, inbox_id } =
        await getChatWithCustomerPhone(chatId);

      const inboxId = String(job.inboxId || inbox_id || "");
      if (!inboxId) throw new Error("inboxId missing");

      const { wamid } = await sendMetaText({
        inboxId,
        customerPhone: customer_phone,
        content,
      });

      const upsert = await insertOutboundMessage({
        chatId: chat_id,
        inboxId,
        customerId: String(job.customerId || ""),
        externalId: wamid,
        content,
        type: "TEXT",
        senderId: job.senderId || job.senderUserSupabaseId || null,
        messageId: job.messageId || null,
        viewStatus: "Sent",
      });

      try {
        await publishApp("socket.livechat.status", {
          kind: "livechat.message.status",
          chatId,
          messageId: job.messageId || upsert?.message?.id || null,
          externalId: wamid || null,
          view_status: "Sent",
          raw_status: "sent",
        });
      } catch (err) {
        console.warn(
          "[worker][outbound] failed to publish status event:",
          (err as any)?.message || err,
        );
      }

      if (upsert?.message && upsert.operation === "insert") {
        const mapped = {
          id: upsert.message.id,
          chat_id: upsert.message.chat_id,
          body: upsert.message.content,
          sender_type: "AGENT" as const,
          sender_id: upsert.message.sender_id,
          created_at: upsert.message.created_at,
          view_status: upsert.message.view_status ?? "Sent",
          type: upsert.message.type ?? "TEXT",
          is_private: false,
          media_url: upsert.message.media_url ?? null,
        };
        try {
          await publishApp("socket.livechat.outbound", {
            kind: "livechat.outbound.message",
            chatId: mapped.chat_id,
            inboxId,
            message: mapped,
            chatUpdate: {
              chatId: mapped.chat_id,
              inboxId,
              last_message: mapped.body,
              last_message_at: mapped.created_at,
              last_message_from: mapped.sender_type,
              last_message_type: mapped.type,
              last_message_media_url: mapped.media_url,
            },
          });
        } catch (err) {
          console.warn(
            "[worker][outbound] failed to publish outbound message event:",
            (err as any)?.message || err,
          );
        }
      }

      console.log("[worker][outbound] message sent", {
        chatId,
        inboxId,
        wamid,
      });

      ch.ack(msg);
    } catch (e: any) {
      console.error("[worker][outbound] error", {
        message: e?.message || e,
        job,
        attempt,
      });
      const retryable = !!e?.retryable;
      const next = attempt + 1;
      if (retryable && next <= MAX_ATTEMPTS) {
        await publish(
          EX_DLX,
          "outbound.retry",
          { ...job, attempt: next },
          { headers: { attempt: next } },
        );
      } else {
        await publish(EX_DLX, "outbound.dlq", {
          ...job,
          attempt,
          error: e?.message || String(e),
        });
      }
      ch.ack(msg);
    }
  });
  console.log("[worker] outbound listening on:", Q_OUTBOUND);
}

async function main(): Promise<void> {
  const target = (process.argv[2] ?? "all").toLowerCase();

  switch (target) {
    case "inbound":
      await startInboundWorker();
      break;
    case "outbound":
      await startOutboundWorker();
      break;
    case "all":
    default:
      await startInboundWorker();
      await startOutboundWorker();
      console.log("[worker] inbound & outbound running.");
      break;
  }
}


async function syncWahaGroupMetadata(): Promise<void> {
  if (wahaGroupSyncRunning) return;
  wahaGroupSyncRunning = true;
  try {
    const groupsRaw = await db.any(
      `select ch.id as chat_id,
              ch.inbox_id,
              ch.remote_id,
              ib.company_id
         from public.chats ch
         join public.inboxes ib on ib.id = ch.inbox_id
        where (ch.kind = 'GROUP' or ch.remote_id like '%@g.us')
          and ib.provider = $1
          and ch.remote_id is not null
        order by ch.updated_at desc
        limit 10`,
      [WAHA_PROVIDER],
    ) as Array<{
      chat_id: string;
      inbox_id: string;
      remote_id: string | null;
      company_id: string;
    }> | null;

    for (const group of groupsRaw ?? []) {
      const remoteId = group.remote_id;
      if (!remoteId) continue;

      let config: { session: string; apiKey: string };
      try {
        config = await getWahaInboxConfig(group.inbox_id);
      } catch (error) {
        console.warn("[WAHA][sync] skipped inbox config", {
          inboxId: group.inbox_id,
          error,
        });
        continue;
      }

      try {
        const details = await fetchWahaChatDetails(config.session, remoteId, config.apiKey);
        const groupName =
          details?.subject ?? details?.name ?? details?.title ?? details?.topic ?? null;
        const groupAvatar =
          details?.pictureUrl ??
          details?.picture ??
          details?.pic ??
          details?.img ??
          details?.avatar ??
          null;

        rememberAvatar(group.company_id, remoteId, groupAvatar ?? null);

        await ensureGroupChat({
          inboxId: group.inbox_id,
          companyId: group.company_id,
          remoteId,
          groupName: groupName ?? null,
          groupAvatarUrl: groupAvatar ?? null,
        });

        const participants = Array.isArray(details?.participants)
          ? details.participants
          : Array.isArray(details?.participantsInfo)
            ? details.participantsInfo
            : [];

        for (const entry of participants) {
          const participantRemote = normalizeWahaJid(
            entry?.id || entry?.jid || entry?.user || entry,
          );
          if (!participantRemote) continue;
          rememberAvatar(
            group.company_id,
            participantRemote,
            entry?.profilePicUrl || entry?.imgUrl || entry?.profile_pic || entry?.avatar || null,
          );
          await upsertChatRemoteParticipant({
            chatId: group.chat_id,
            remoteId: participantRemote,
            name:
              entry?.name ||
              entry?.notifyName ||
              entry?.pushName ||
              entry?.displayName ||
              null,
            phone: normalizeMsisdn(participantRemote),
            avatarUrl:
              entry?.profilePicUrl ||
              entry?.imgUrl ||
              entry?.profile_pic ||
              entry?.avatar ||
              null,
            isAdmin:
              typeof entry?.isAdmin === "boolean"
                ? entry.isAdmin
                : typeof entry?.admin === "boolean"
                  ? entry.admin
                  : null,
            joinedAt:
              typeof entry?.joinTimestamp === "number"
                ? new Date(entry.joinTimestamp * 1000)
                : undefined,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.warn("[WAHA][sync] failed to refresh group metadata", {
          inboxId: group.inbox_id,
          remoteId,
          error,
        });
      }
    }
  } catch (error) {
    console.warn("[WAHA][sync] metadata job error", error);
  } finally {
    wahaGroupSyncRunning = false;
  }
}

async function tickCampaigns() {
  try {
    const now = new Date().toISOString();
    // campanhas ativas
    const { data: camps } = await supabaseAdmin
      .from("campaigns")
      .select("id, inbox_id, rate_limit_per_minute, start_at, end_at, status")
      .in("status", ["SCHEDULED","RUNNING"]);

    for (const c of camps || []) {
      if (!c.inbox_id) continue;

      // pega até N recipients ainda sem envio (last_step_sent is null)
      const limit = Math.max(1, Number(c.rate_limit_per_minute || 30));
      const { data: step } = await supabaseAdmin
        .from("campaign_steps").select("id, template_id, delay_sec")
        .eq("campaign_id", c.id).order("position", { ascending: true }).limit(1).maybeSingle();
      if (!step?.id) continue;

      const { data: tpl } = await supabaseAdmin
        .from("message_templates").select("id, kind, payload")
        .eq("id", step.template_id).maybeSingle();
      if (!tpl?.id) continue;

      const { data: recipients } = await supabaseAdmin
        .from("campaign_recipients")
        .select("id, phone, last_step_sent")
        .eq("campaign_id", c.id)
        .is("last_step_sent", null)
        .limit(limit);

      for (const r of recipients || []) {
        if ((tpl.kind || "").toUpperCase() === "TEXT") {
          const content = String((tpl.payload as any)?.text || "");
          if (!content) continue;
          await publish(EX_APP, "outbound", {
            jobType: "message.send",
            inboxId: c.inbox_id,
            content,
            customerPhone: r.phone,
          });
        } else {
          await publish(EX_APP, "outbound", {
            jobType: "meta.sendMedia",
            inboxId: c.inbox_id,
            media: (tpl.payload as any),
            customerPhone: r.phone,
          });
        }

        // opcional: já marca progresso local (o evento real pode atualizar depois)
        await supabaseAdmin
          .from("campaign_recipients")
          .update({ last_step_sent: 1, last_sent_at: new Date().toISOString() })
          .eq("id", r.id);
      }
    }
  } catch (err) {
    console.error("[campaigns] tick error:", (err as any)?.message || err);
  }
}

// roda a cada 60s
setInterval(tickCampaigns, 60_000);
setInterval(syncWahaGroupMetadata, 300_000);


main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
