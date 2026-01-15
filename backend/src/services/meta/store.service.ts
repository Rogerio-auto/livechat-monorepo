// src/services/meta/store.ts
import db from "../../pg.js";
import { triggerFlow, resumeFlowWithResponse } from "../flow-engine.service.js";
import { normalizeMsisdn } from "../../utils/util.util.js";

import { supabaseAdmin } from "../../lib/supabase.js";
import { clearMessageCache, clearListCacheIndexes, rDel, rGet, rSet, k } from "../../lib/redis.js";
import { decryptSecret, encryptMediaUrl } from "../../lib/crypto.js";
import { WAHA_PROVIDER } from "../waha/client.service.js";
import { notifyNewMessage } from "../../utils/notification-helpers.util.js";
import { WebhookService } from "../webhook.service.js";

let customerAvatarColumnMissing = false;
let chatLastMessageFromColumnMissing = false;
let chatLastMessageTypeColumnMissing = false;
let chatLastMessageMediaUrlColumnMissing = false;
let chatMessagesSupportsRemoteSenderColumns = true;
let chatsSupportsGroupMetadata = true;
let chatRemoteParticipantsTableMissing = false;

const TTL_INBOX_LOOKUP = Number(process.env.META_CACHE_TTL_INBOX ?? 120);
const TTL_BOARD_LOOKUP = Number(process.env.META_CACHE_TTL_BOARD ?? 300);
const TTL_CREDS_LOOKUP = Number(process.env.META_CACHE_TTL_CREDS ?? 300);
const TTL_CHAT_PHONE_LOOKUP = Number(process.env.META_CACHE_TTL_CHAT_PHONE ?? 300);

function isMeaningfulName(value?: string | null): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === "-") return false;
  if (/\d/.test(trimmed)) return false;
  if (/^contato\s*\d*$/i.test(trimmed)) return false;
  return true;
}

type NullableCache<T> = { hit: boolean; value: T | null };

async function cacheReadNullable<T>(key: string): Promise<NullableCache<T> | null> {
  const cached = await rGet<NullableCache<T>>(key);
  if (!cached) return null;
  return cached;
}

async function cacheWriteNullable<T>(key: string, value: T | null, ttlSec: number): Promise<void> {
  await rSet(key, { hit: value !== null, value }, ttlSec);
}

const inboxCacheKey = {
  byPhoneId: (phoneNumberId: string) => `meta:inbox:phoneid:${phoneNumberId}`,
  byPhone: (phone: string) => `meta:inbox:phone:${phone}`,
};
const boardCacheKey = (companyId: string) => `meta:board:${companyId}`;
const credsCacheKey = (inboxId: string) => `meta:inbox:creds:${inboxId}`;
const chatPhoneCacheKey = (chatId: string) => `meta:chat:phone:${chatId}`;

type ChatListContext =
  | string
  | null
  | {
      companyId?: string | null;
      inboxId?: string | null;
      status?: string | null;
      kind?: string | null;
      chatType?: string | null;
      remoteId?: string | null;
      departmentId?: string | null;
    };

function normalizeChatKind(
  kind?: string | null,
  chatType?: string | null,
  remoteId?: string | null,
): "GROUP" | "DIRECT" | null {
  const primary = kind ?? null;
  if (typeof primary === "string" && primary.trim()) {
    const upper = primary.trim().toUpperCase();
    if (upper === "GROUP" || upper === "DIRECT") return upper;
  }
  if (typeof chatType === "string" && chatType.trim()) {
    const upper = chatType.trim().toUpperCase();
    if (upper === "GROUP" || upper === "DIRECT") return upper === "GROUP" ? "GROUP" : "DIRECT";
  }
  if (typeof remoteId === "string" && remoteId.trim()) {
    return remoteId.includes("@g.us") ? "GROUP" : "DIRECT";
  }
  return null;
}

export async function invalidateChatCaches(chatId: string, context?: ChatListContext) {
  await rDel(k.chat(chatId));
  await clearMessageCache(chatId, (key) => key.includes(":nil:"));

  let companyId: string | null | undefined;
  let inboxId: string | null | undefined;
  let status: string | null | undefined;
  let kind: string | null | undefined;
  let chatType: string | null | undefined;
  let remoteId: string | null | undefined;
  let departmentId: string | null | undefined;

  if (typeof context === "string" || context === null) {
    companyId = context ?? null;
  } else if (context) {
    companyId = context.companyId ?? null;
    inboxId = context.inboxId ?? null;
    status = context.status ?? null;
    kind = context.kind ?? null;
    chatType = context.chatType ?? null;
    remoteId = context.remoteId ?? null;
    departmentId = context.departmentId ?? null;
  }

  const needsLookup =
    !companyId ||
    inboxId === undefined ||
    status === undefined ||
    kind === undefined ||
    chatType === undefined ||
    departmentId === undefined;

  if (needsLookup) {
    try {
      const row = await db.oneOrNone<{
        company_id: string | null;
        inbox_id: string | null;
        status: string | null;
        kind: string | null;
        chat_type: string | null;
        remote_id: string | null;
        department_id: string | null;
      }>(
        `select company_id, inbox_id, status, kind, chat_type, remote_id, department_id
           from public.chats
          where id = $1
          limit 1`,
        [chatId],
      );
      if (row) {
        companyId = companyId ?? row.company_id ?? null;
        inboxId = inboxId ?? row.inbox_id ?? null;
        status = status ?? row.status ?? null;
        kind = kind ?? row.kind ?? null;
        chatType = chatType ?? row.chat_type ?? null;
        remoteId = remoteId ?? row.remote_id ?? null;
        departmentId = departmentId ?? row.department_id ?? null;
      }
    } catch (err) {
      console.warn("[META][store] invalidateChatCaches lookup failed", {
        chatId,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  if (!companyId) return;

  const statuses = new Set<string>(["ALL"]);
  if (typeof status === "string" && status.trim()) {
    statuses.add(status.trim().toUpperCase());
  }
  // Se o status atual não for OPEN nem PENDING, mas o chat pode aparecer nelas via unread_count,
  // idealmente invalidaríamos elas também. Por segurança, invalidamos as principais.
  statuses.add("OPEN");
  statuses.add("PENDING");

  const resolvedKind = normalizeChatKind(kind, chatType, remoteId);
  const kinds = new Set<string>(["ALL"]);
  if (resolvedKind) kinds.add(resolvedKind);

  const inboxes = new Set<string | null>([inboxId ?? null, null]);
  const depts = new Set<string | null>([departmentId ?? null, null]);

  const indexKeys: string[] = [];
  for (const inboxCandidate of inboxes) {
    for (const statusCandidate of statuses) {
      for (const kindCandidate of kinds) {
        for (const deptCandidate of depts) {
          indexKeys.push(k.listIndex(companyId, inboxCandidate, statusCandidate, kindCandidate, deptCandidate));
        }
      }
    }
  }

  await clearListCacheIndexes(indexKeys);
}

type ChatRemoteParticipant = {
  id: string;
  chat_id: string;
  remote_id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  joined_at: string | null;
  left_at: string | null;
};

export async function ensureGroupChat(args: {
  inboxId: string;
  companyId: string;
  remoteId: string;
  groupName?: string | null;
  groupAvatarUrl?: string | null;
}): Promise<{ chatId: string; created: boolean }> {
  const trimmedRemote = args.remoteId.trim();
  if (!trimmedRemote) {
    throw new Error("ensureGroupChat requires remoteId");
  }

  if (!chatsSupportsGroupMetadata) {
    const fallbackPhone = normalizeMsisdn(trimmedRemote) || trimmedRemote;
    const { chatId } = await ensureLeadCustomerChat({
      inboxId: args.inboxId,
      companyId: args.companyId,
      phone: fallbackPhone,
      name: args.groupName ?? trimmedRemote,
      rawPhone: trimmedRemote,
    });
    return { chatId, created: false };
  }

  try {
    return await db.withTransaction(async (tx) => {
      type GroupChatRow = { id: string; group_name: string | null; group_avatar_url: string | null };

      const existing = await tx.oneOrNone<GroupChatRow>(
        `select id, group_name, group_avatar_url
           from public.chats
          where inbox_id = $1
            and remote_id = $2
          limit 1`,
        [args.inboxId, trimmedRemote],
      );

      if (!existing) {
        const inserted = await tx.one<GroupChatRow>(
          `insert into public.chats
             (inbox_id, company_id, customer_id, remote_id, kind, chat_type, status, group_name, group_avatar_url, last_message_at)
           values ($1, $2, null, $3, 'GROUP', 'GROUP', 'AI', $4, $5, now())
            returning id, group_name, group_avatar_url`,
          [
            args.inboxId,
            args.companyId,
            trimmedRemote,
            args.groupName ?? null,
            args.groupAvatarUrl ?? null,
          ],
        );
        console.log("[META][store] Group chat created:", {
          chatId: inserted.id,
          remoteId: trimmedRemote,
          groupName: args.groupName,
        });
        return { chatId: inserted.id, created: true };
      }

      const nextName = args.groupName?.trim() || null;
      const nextAvatar = args.groupAvatarUrl?.trim() || null;
      
      const nameChanged = nextName && nextName !== existing.group_name;
      const avatarChanged = nextAvatar && nextAvatar !== existing.group_avatar_url;

      if (nameChanged || avatarChanged) {
        await tx.none(
          `update public.chats
              set group_name = coalesce($2, group_name),
                  group_avatar_url = coalesce($3, group_avatar_url),
                  updated_at = now()
            where id = $1`,
          [existing.id, nextName, nextAvatar],
        );
      }

      return { chatId: existing.id, created: false };
    });
  } catch (error: any) {
    const code = String(error?.code || "");
    if (code === "42703" || code === "42P01") {
      chatsSupportsGroupMetadata = false;
      console.warn("[META][store] group metadata columns missing. Falling back to legacy chat flow.");
      const fallbackPhone = normalizeMsisdn(trimmedRemote) || trimmedRemote;
      const { chatId } = await ensureLeadCustomerChat({
        inboxId: args.inboxId,
        companyId: args.companyId,
        phone: fallbackPhone,
        name: args.groupName ?? trimmedRemote,
        rawPhone: trimmedRemote,
      });
      return { chatId, created: false };
    }
    throw error;
  }
}

export async function findChatIdByRemoteId(args: { inboxId: string; remoteId: string }): Promise<string | null> {
  if (!chatsSupportsGroupMetadata) return null;
  try {
    const row = await db.oneOrNone<{ id: string }>(
      `select id
         from public.chats
        where inbox_id = $1
          and remote_id = $2
        limit 1`,
      [args.inboxId, args.remoteId],
    );
    return row?.id ?? null;
  } catch (error: any) {
    const code = String(error?.code || "");
    if (code === "42703" || code === "42P01") {
      chatsSupportsGroupMetadata = false;
      return null;
    }
    throw error;
  }
}

export async function upsertChatRemoteParticipant(args: {
  chatId: string;
  remoteId: string;
  name?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  isAdmin?: boolean | null;
  joinedAt?: string | Date | null;
  leftAt?: string | Date | null;
}): Promise<ChatRemoteParticipant | null> {
  if (chatRemoteParticipantsTableMissing) return null;

  const joinedAtIso =
    args.joinedAt instanceof Date
      ? args.joinedAt.toISOString()
      : typeof args.joinedAt === "string" && args.joinedAt
        ? new Date(args.joinedAt).toISOString()
        : null;
  const leftAtIso =
    args.leftAt instanceof Date
      ? args.leftAt.toISOString()
      : typeof args.leftAt === "string" && args.leftAt
        ? new Date(args.leftAt).toISOString()
        : null;

  try {
    const row = await db.one<ChatRemoteParticipant>(
      `insert into public.chat_remote_participants
         (chat_id, remote_id, name, phone, avatar_url, is_admin, joined_at, left_at)
       values ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now()), $8::timestamptz)
       on conflict (chat_id, remote_id) do update
         set name = coalesce(excluded.name, public.chat_remote_participants.name),
             phone = coalesce(excluded.phone, public.chat_remote_participants.phone),
             avatar_url = coalesce(excluded.avatar_url, public.chat_remote_participants.avatar_url),
             is_admin = coalesce(excluded.is_admin, public.chat_remote_participants.is_admin),
             joined_at = coalesce(public.chat_remote_participants.joined_at, excluded.joined_at),
             left_at = case
               when excluded.left_at is null then public.chat_remote_participants.left_at
               else excluded.left_at
             end,
             updated_at = now()
       returning id, chat_id, remote_id, name, phone, avatar_url, is_admin, joined_at, left_at`,
      [
        args.chatId,
        args.remoteId,
        args.name ?? null,
        args.phone ?? null,
        args.avatarUrl ?? null,
        typeof args.isAdmin === "boolean" ? args.isAdmin : false,
        joinedAtIso,
        leftAtIso,
      ],
    );
    return row;
  } catch (error: any) {
    const code = String(error?.code || "");
    if (code === "42703" || code === "42P01") {
      chatRemoteParticipantsTableMissing = true;
      console.warn("[META][store] chat_remote_participants table missing. Skipping remote participant tracking.");
      return null;
    }
    console.warn("[META][store] upsertChatRemoteParticipant failed", error);
    return null;
  }
}

export async function markChatRemoteParticipantLeft(args: {
  chatId: string;
  remoteId: string;
  leftAt?: string | Date | null;
}): Promise<void> {
  if (chatRemoteParticipantsTableMissing) return;
  const leftAtIso =
    args.leftAt instanceof Date
      ? args.leftAt.toISOString()
      : typeof args.leftAt === "string" && args.leftAt
        ? new Date(args.leftAt).toISOString()
        : new Date().toISOString();

  try {
    await db.none(
      `update public.chat_remote_participants
          set left_at = $3,
              updated_at = now()
        where chat_id = $1
          and remote_id = $2`,
      [args.chatId, args.remoteId, leftAtIso],
    );
  } catch (error: any) {
    const code = String(error?.code || "");
    if (code === "42703" || code === "42P01") {
      chatRemoteParticipantsTableMissing = true;
    } else {
      console.warn("[META][store] markChatRemoteParticipantLeft failed", error);
    }
  }
}

export async function findChatMessageIdByExternalId(
  chatId: string,
  externalId: string,
): Promise<string | null> {
  if (!externalId.trim()) return null;
  try {
    const row = await db.oneOrNone<{ id: string }>(
      `select id
         from public.chat_messages
        where chat_id = $1
          and external_id = $2
        limit 1`,
      [chatId, externalId],
    );
    return row?.id ?? null;
  } catch (error) {
    console.warn("[META][store] findChatMessageIdByExternalId failed", error);
    return null;
  }
}

type InsertedInboundMessage = {
  id: string;
  chat_id: string;
  content: string;
  type: string | null;
  caption?: string | null;
  view_status: string | null;
  created_at: string;
  remote_participant_id?: string | null;
  remote_sender_id?: string | null;
  remote_sender_name?: string | null;
  remote_sender_phone?: string | null;
  remote_sender_avatar_url?: string | null;
  remote_sender_is_admin?: boolean | null;
  replied_message_id?: string | null;
  // ✅ Campos de mídia
  media_url?: string | null;
  media_public_url?: string | null;
  media_storage_path?: string | null;
  interactive_content?: any | null;
};

type InsertedOutboundMessage = {
  id: string;
  chat_id: string;
  content: string;
  type: string | null;
  view_status: string | null;
  created_at: string;
  external_id: string | null;
  sender_id: string | null;
  sender_name?: string | null;
  sender_avatar_url?: string | null;
  media_url: string | null;
};

type UpsertOutboundMessageResult = {
  message: InsertedOutboundMessage;
  operation: "insert" | "update";
};

type UpsertChatMessageArgs = {
  id?: string | null;
  chatId: string;
  externalId: string;
  isFromCustomer: boolean;
  content: string | null;
  type?: string | null;
  senderId?: string | null;
  viewStatus?: string | null;
  
  // ✅ New storage-first fields
  mediaStoragePath?: string | null;
  mediaPublicUrl?: string | null;
  mediaSource?: string | null;
  isMediaSensitive?: boolean;
  
  // ⚠️ Legacy fields (keep for backward compatibility)
  mediaUrl?: string | null;
  mediaSha256?: string | null;
  
    // 🔄 Device tracking
    sentFromDevice?: 'web' | 'whatsapp' | null;
  
  // 📝 Caption for media messages
  caption?: string | null;

  // 🧩 Interactive content (buttons, lists)
  interactiveContent?: any | null;
  
  createdAt?: string | Date | null;
  remoteParticipantId?: string | null;
  remoteSenderId?: string | null;
  remoteSenderName?: string | null;
  remoteSenderPhone?: string | null;
  remoteSenderAvatarUrl?: string | null;
  remoteSenderIsAdmin?: boolean | null;
  repliedMessageId?: string | null;
};

type UpsertChatMessageRow = InsertedInboundMessage & {
  sender_id: string | null;
  is_from_customer: boolean;
  media_url: string | null;
  inserted: boolean;
};

export type UpsertChatMessageResult = {
  message: UpsertChatMessageRow;
  inserted: boolean;
};

type InboxCredentials = {
  provider: "META" | "WAHA";
  access_token: string;
  app_secret?: string;
  verify_token?: string;
  phone_number_id?: string | null;
  waba_id?: string | null;
  company_id?: string;
};
export async function getInboxByVerifyToken(token: string) {
  if (!token) return null;
  const row = await db.oneOrNone<{ id: string }>(
    "SELECT id FROM public.inboxes WHERE webhook_verify_token = $1 LIMIT 1",
    [token]
  );
  return row;
}

export async function getInboxByPhoneNumberId(
  phoneNumberId?: string | null,
  displayPhoneNumber?: string | null,
) {
  console.log("[META][store] getInboxByPhoneNumberId", { phoneNumberId, displayPhoneNumber });
  const selectColumns = "id, company_id, is_active, provider, phone_number_id, phone_number";

  const lookups: Array<{ field: "phone_number_id" | "phone_number"; value: string; cacheKey: string }> = [];
  const seen = new Set<string>();

  if (phoneNumberId) {
    const normalized = String(phoneNumberId).trim();
    if (normalized) {
      const cacheKey = inboxCacheKey.byPhoneId(normalized);
      if (!seen.has(cacheKey)) {
        seen.add(cacheKey);
        lookups.push({ field: "phone_number_id", value: normalized, cacheKey });
      }
    }
  }

  if (displayPhoneNumber) {
    const candidates = new Set<string>();
    const trimmed = displayPhoneNumber.trim();
    if (trimmed) {
      candidates.add(trimmed);
      const compact = trimmed.replace(/\s+/g, "");
      if (compact && compact !== trimmed) {
        candidates.add(compact);
      }
      const digitsOnly = normalizeMsisdn(trimmed);
      if (digitsOnly) {
        candidates.add(digitsOnly);
        candidates.add(`+${digitsOnly}`);
        if (!digitsOnly.startsWith("00")) {
          candidates.add(`00${digitsOnly}`);
        }
      }
    }

    console.log("[META][store] phone candidates", Array.from(candidates));
    for (const candidate of candidates) {
      const cacheKey = inboxCacheKey.byPhone(candidate);
      if (!seen.has(cacheKey)) {
        seen.add(cacheKey);
        lookups.push({ field: "phone_number", value: candidate, cacheKey });
      }
    }
  }

  if (lookups.length === 0) return null;

  const keysForWarmup = lookups.map((l) => l.cacheKey);
  let cachedResult: any | null = null;
  const toQuery: typeof lookups = [];

  for (const lookup of lookups) {
    const cached = await cacheReadNullable<any>(lookup.cacheKey);
    if (!cached) {
      toQuery.push(lookup);
      continue;
    }
    if (!cached.hit) {
      continue; // cached miss
    }
    cachedResult = cached.value;
    if (cachedResult) {
      // warm other aliases asynchronously
      await Promise.all(
        keysForWarmup
          .filter((key) => key !== lookup.cacheKey)
          .map((key) => cacheWriteNullable(key, cachedResult, TTL_INBOX_LOOKUP)),
      );
      return cachedResult;
    }
  }

  if (cachedResult) return cachedResult;
  if (toQuery.length === 0) {
    // tudo estava em cache (como miss)
    return null;
  }

  const fetchBy = async (field: "phone_number_id" | "phone_number", value: string) => {
    console.log("[META][store] lookup inbox", { field, value });
    const { data, error } = await supabaseAdmin
      .from("inboxes")
      .select(selectColumns)
      .eq(field, value)
      .maybeSingle();
    if (error) {
      console.error("[META][store] lookup error", { field, value, error: error.message });
      throw error;
    }
    if (!data) {
      console.log("[META][store] lookup miss", { field, value });
      return null;
    }
    if (data.is_active === false) {
      console.warn("[META][store] inactive inbox", { field, value, inboxId: data.id });
      return null;
    }
    console.log("[META][store] lookup hit", { field, value, inboxId: data.id });
    return data;
  };

  for (const lookup of toQuery) {
    const data = await fetchBy(lookup.field, lookup.value);
    await cacheWriteNullable(lookup.cacheKey, data, TTL_INBOX_LOOKUP);
    if (data) {
      await Promise.all(
        keysForWarmup
          .filter((key) => key !== lookup.cacheKey)
          .map((key) => cacheWriteNullable(key, data, TTL_INBOX_LOOKUP)),
      );
      return data;
    }
  }

  await Promise.all(
    toQuery.map((lookup) => cacheWriteNullable(lookup.cacheKey, null, TTL_INBOX_LOOKUP)),
  );
  return null;
}

export async function saveWebhookEvent(
  inboxId: string,
  provider: "META" | "WAHA",
  eventUid: string,
  raw: any,
) {
  const row = await db.oneOrNone<{ id: string }>(
    `insert into public.webhook_events (inbox_id, provider, event_uid, raw)
     values ($1, $2, $3, $4)
     on conflict (inbox_id, event_uid) do nothing
     returning id`,
    [inboxId, provider, eventUid, raw],
  );
  return !!row?.id;
}

// --- ADD: cria/garante Lead, Customer, Chat e insere a mensagem inbound (idempotente) ---
export async function createLeadCustomerChatAndMessageTx(args: {
  inboxId: string;
  companyId: string;
  phone: string;
  name?: string | null;
  externalId: string;            // wamid vindo da Meta
  content: string;
  type?: "TEXT" | string;
}) {
  // 1) Garante LEAD -> CUSTOMER -> CHAT (usa seu orquestrador existente)
  const { chatId, leadId, customerId } = await ensureLeadCustomerChat({
    inboxId: args.inboxId,
    companyId: args.companyId,
    phone: args.phone,
    name: args.name ?? null,
    rawPhone: args.phone,
  });

  // 2) Insere mensagem (idempotente por (chat_id, external_id))
  const inserted = await db.oneOrNone<{
    id: string;
    chat_id: string;
    content: string;
    type: string;
    is_from_customer: boolean;
    created_at: string;
    view_status: string | null;
  }>(
    `insert into public.chat_messages
       (chat_id, sender_id, is_from_customer, external_id, content, type)
     values ($1, null, true, $2, $3, $4)
     on conflict (chat_id, external_id) do nothing
     returning id, chat_id, content, type, is_from_customer, created_at, view_status`,
    [chatId, args.externalId, args.content, args.type ?? "TEXT"]
  );

  // 3) Atualiza "touch" do chat (best effort)
  await db.none(
    `update public.chats
        set last_message = $2,
            last_message_at = now()
      where id = $1`,
    [chatId, args.content]
  );

  await invalidateChatCaches(chatId, {
    companyId: args.companyId,
    inboxId: args.inboxId,
  });

  return {
    leadId,
    customerId,
    
    chatId,
    message: inserted,          // null se era duplicado (já existia)
    createdNewMessage: !!inserted,
  };
}


export async function getBoardIdForCompany(companyId: string): Promise<string> {
  const cacheKey = boardCacheKey(companyId);
  const cached = await cacheReadNullable<string>(cacheKey);
  if (cached?.hit && cached.value) {
    return cached.value;
  }

  let row = await db.oneOrNone<{ id: string }>(
    `select id
       from public.kanban_boards
      where company_id = $1
        and is_default = true
      limit 1`,
    [companyId],
  );

  if (!row) {
    row = await db.oneOrNone<{ id: string }>(
      `select id
         from public.kanban_boards
        where company_id = $1
        order by created_at asc nulls last
        limit 1`,
      [companyId],
    );
  }

  if (row?.id) {
    await cacheWriteNullable(cacheKey, row.id, TTL_BOARD_LOOKUP);
    return row.id;
  }

  // Fallback: search for ANY board for this company
  const anyBoard = await db.oneOrNone<{ id: string }>(
    `select id from public.kanban_boards where company_id = $1 limit 1`,
    [companyId]
  );
  if (anyBoard?.id) {
    return anyBoard.id;
  }

  throw new Error(`Nenhum Funil (Kanban Board) encontrado para a empresa ${companyId}. Crie um funil primeiro.`);
}

export async function upsertLeadByPhone(args: {
  companyId: string;
  phone: string;
  name?: string | null;
}) {
  console.log("[META][store] ensureLeadCustomerChat start", args);
  const msisdn = normalizeMsisdn(args.phone);

  let lead = await db.oneOrNone<{ id: string; name: string; customer_id: string | null }>(
    `select id, name, customer_id
       from public.leads
      where company_id = $1
        and phone = $2
      limit 1`,
    [args.companyId, msisdn],
  );

  if (!lead) {
    const boardId = await getBoardIdForCompany(args.companyId);
    lead = await db.one<{ id: string; name: string; customer_id: string | null }>(
      `insert into public.leads (company_id, phone, name, kanban_board_id)
       values ($1, $2, $3, $4)
       returning id, name, customer_id`,
      [args.companyId, msisdn, args.name?.trim() || msisdn, boardId],
    );
  } else if (isMeaningfulName(args.name) && !isMeaningfulName(lead.name)) {
    lead = await db.one<{ id: string; name: string; customer_id: string | null }>(
      `update public.leads
          set name = $1
        where id = $2
        returning id, name, customer_id`,
      [args.name!.trim(), lead.id],
    );
  }

  return lead;
}

export async function upsertCustomerByPhone(args: {
  companyId: string;
  phone: string;
  name?: string | null;
}) {
  const msisdn = normalizeMsisdn(args.phone);
  const incomingName = args.name?.trim();
  const incomingMeaningful = isMeaningfulName(incomingName);

  let customer = await db.oneOrNone<{ id: string; name: string }>(
    `select id, name
       from public.customers
      where phone = $1
      limit 1`,
    [msisdn],
  );

  if (!customer) {
    const nameToStore = incomingMeaningful ? incomingName! : msisdn;
    customer = await db.one<{ id: string; name: string }>(
      `insert into public.customers (company_id, phone, name)
       values ($1, $2, $3)
       returning id, name`,
      [args.companyId, msisdn, nameToStore],
    );
  } else if (
    incomingMeaningful &&
    (!isMeaningfulName(customer.name) || incomingName !== customer.name)
  ) {
    customer = await db.one<{ id: string; name: string }>(
      `update public.customers
          set name = $1
        where id = $2
        returning id, name`,
      [incomingName!, customer.id],
    );
  }

  return customer;
}

export async function updateCustomerAvatar(customerId: string, avatarUrl: string | null) {
  if (!avatarUrl || customerAvatarColumnMissing) return false;
  try {
    const result = await db.query(
      `update public.customers
          set avatar = $1,
              updated_at = now()
        where id = $2
          and (avatar is distinct from $1)`,
      [avatarUrl, customerId],
    );
    return (result as any)?.rowCount > 0;
  } catch (e: any) {
    const message = String(e?.message || "");
    if (e?.code === "42703" || message.includes("avatar")) {
      customerAvatarColumnMissing = true;
      console.warn("[DB] customers.avatar column missing. Avatar updates disabled.");
      return false;
    }
    console.error("[DB] updateCustomerAvatar error", e);
    return false;
  }
}

function extractExternalId(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.replace(/@.*/, "");
}

export async function ensureLeadCustomerChat(args: {
  inboxId: string;
  companyId: string;
  phone: string;
  name?: string | null;
  rawPhone?: string | null;
  lid?: string | null;
  avatarUrl?: string | null;
}) {
  const msisdn = /[a-zA-Z]/.test(args.phone) ? args.phone : normalizeMsisdn(args.phone);
  const externalIdCandidate = extractExternalId(args.rawPhone ?? null) ?? extractExternalId(args.phone);
  const rawName = typeof args.name === "string" ? args.name.trim() : "";
  const avatarUrl = args.avatarUrl && typeof args.avatarUrl === "string" && args.avatarUrl.trim() ? args.avatarUrl.trim() : null;
  const fallbackName =
    (isMeaningfulName(rawName) ? rawName : null) ||
    msisdn ||
    extractExternalId(args.phone) ||
    "-";
  const lid = args.lid && typeof args.lid === "string" && args.lid.trim() ? args.lid.trim() : null;

  return db.withTransaction(async (tx) => {
    // ========== OPTIMIZATION: Buscar lead e customer EM PARALELO ==========
    const [leadResult, customerResult] = await Promise.all([
      // Lead lookup (lid -> phone)
      (async () => {
        if (lid) {
          const byLid = await tx.oneOrNone<{ id: string; name: string; customer_id: string | null; lid: string | null }>(
            `select id, name, customer_id, lid from public.leads where company_id = $1 and lid = $2 limit 1`,
            [args.companyId, lid],
          );
          if (byLid) {
            console.log("[META][store] lead lookup by lid", { companyId: args.companyId, lid, found: true });
            return byLid;
          }
        }
        
        const byPhone = await tx.oneOrNone<{ id: string; name: string; customer_id: string | null; lid: string | null }>(
          `select id, name, customer_id, lid from public.leads where company_id = $1 and phone = $2 limit 1`,
          [args.companyId, msisdn],
        );
        console.log("[META][store] lead lookup by phone", { companyId: args.companyId, msisdn, found: !!byPhone });
        return byPhone;
      })(),
      
      // Customer lookup (lid -> phone)
      (async () => {
        if (lid) {
          console.log("[META][store] 🔍 customer lookup by LID with company_id", { companyId: args.companyId, lid });
          const byLid = await tx.oneOrNone<{ id: string; name: string }>(
            `select id, name from public.customers where company_id = $1 and lid = $2 limit 1`,
            [args.companyId, lid],
          );
          if (byLid) {
            console.log("[META][store] ✅ customer found by lid", { companyId: args.companyId, lid, customerId: byLid.id, found: true });
            return byLid;
          }
          console.log("[META][store] ⚠️ customer NOT found by lid", { companyId: args.companyId, lid });
        }
        
        console.log("[META][store] 🔍 customer lookup by phone with company_id", { companyId: args.companyId, msisdn });
        const byPhone = await tx.oneOrNone<{ id: string; name: string }>(
          `select id, name from public.customers where company_id = $1 and phone = $2 limit 1`,
          [args.companyId, msisdn],
        );
        if (byPhone) {
          console.log("[META][store] ✅ customer found by phone", { companyId: args.companyId, msisdn, customerId: byPhone.id, found: true });
        } else {
          console.log("[META][store] ⚠️ customer NOT found by phone", { companyId: args.companyId, msisdn });
        }
        return byPhone;
      })(),
    ]);

    let lead = leadResult;
    let customer = customerResult;
    const isNewLead = !lead;

    // ========== OPTIMIZATION: Criar lead e customer EM PARALELO se necessário ==========
    if (!lead || !customer) {
      const boardId = !lead ? await getBoardIdForCompany(args.companyId) : null;
      
      console.log("[META][store] 🔧 VERSÃO ATUALIZADA: Using ON CONFLICT DO UPDATE RETURNING");
      
      const [createdLead, createdCustomer] = await Promise.all([
        // Create lead if needed
        !lead ? (async () => {
          console.log("[META][store] 💾 Creating lead", { companyId: args.companyId, msisdn, lid, boardId });
          // Use INSERT ... ON CONFLICT DO UPDATE to ensure we get the lead even if it exists
          const insertedLead = await tx.oneOrNone<{ id: string; name: string; customer_id: string | null; lid: string | null }>(
            `insert into public.leads (company_id, phone, name, kanban_board_id, lid)
             values ($1, $2, $3, $4, $5)
             on conflict (company_id, phone) 
             do update set lid = coalesce(excluded.lid, leads.lid), name = excluded.name
             returning id, name, customer_id, lid`,
            [args.companyId, msisdn, fallbackName, boardId, lid],
          );
          
          if (insertedLead) {
            console.log("[META][store] ✅ lead created/updated (by conflict)", { leadId: insertedLead.id, companyId: args.companyId, msisdn, lid });
            return insertedLead;
          }
          
          // Fallback: fetch the lead (in case ON CONFLICT didn't return anything)
          if (lid) {
            const byLid = await tx.oneOrNone<{ id: string; name: string; customer_id: string | null; lid: string | null }>(
              `select id, name, customer_id, lid from public.leads where company_id = $1 and lid = $2 limit 1`,
              [args.companyId, lid],
            );
            if (byLid) {
              console.log("[META][store] ✅ lead ensured (by LID)", { leadId: byLid.id, companyId: args.companyId, msisdn, lid });
              return byLid;
            }
          }
          const byPhone = await tx.one<{ id: string; name: string; customer_id: string | null; lid: string | null }>(
            `select id, name, customer_id, lid from public.leads where company_id = $1 and phone = $2 limit 1`,
            [args.companyId, msisdn],
          );
          console.log("[META][store] ✅ lead ensured (by phone)", { leadId: byPhone.id, companyId: args.companyId, msisdn, lid });
          return byPhone;
        })() : Promise.resolve(lead),
        
        // Create customer if needed (but need lead.id, so wait if lead was just created)
        Promise.resolve(customer),
      ]);
      
      lead = createdLead;
      
      // Now create customer with lead.id if needed
      if (!createdCustomer) {
        console.log("[META][store] 💾 Creating customer", { companyId: args.companyId, msisdn, lid, leadId: lead!.id, avatarUrl });
        // Use INSERT ... ON CONFLICT DO UPDATE to ensure we get the customer even if it exists
        const insertedCustomer = await tx.oneOrNone<{ id: string; name: string }>(
          `insert into public.customers (company_id, phone, name, lead_id, lid, avatar)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (company_id, phone) 
           do update set 
              lid = coalesce(excluded.lid, customers.lid), 
              lead_id = excluded.lead_id, 
              name = excluded.name,
              avatar = coalesce(excluded.avatar, customers.avatar)
           returning id, name`,
          [args.companyId, msisdn, fallbackName, lead!.id, lid, avatarUrl],
        );
        
        if (insertedCustomer) {
          customer = insertedCustomer;
          console.log("[META][store] ✅ customer created/updated (by conflict)", { customerId: customer.id, companyId: args.companyId, msisdn, leadId: lead!.id, lid });
        } else {
          // Fallback: fetch the customer (in case ON CONFLICT didn't return anything)
          if (lid) {
            customer = await tx.oneOrNone<{ id: string; name: string }>(
              `select id, name from public.customers where company_id = $1 and lid = $2 limit 1`,
              [args.companyId, lid],
            );
          }
          if (!customer) {
            customer = await tx.one<{ id: string; name: string }>(
              `select id, name from public.customers where company_id = $1 and phone = $2 limit 1`,
              [args.companyId, msisdn],
            );
          }
          console.log("[META][store] ✅ customer ensured", { customerId: customer.id, companyId: args.companyId, msisdn, leadId: lead!.id, lid });
        }
      }
    }

    // Update names if needed
    if (lead && !isMeaningfulName(lead.name)) {
      lead = await tx.one<{ id: string; name: string; customer_id: string | null; lid: string | null }>(
        `update public.leads set name = $1, lid = coalesce(lid, $3) where id = $2 returning id, name, customer_id, lid`,
        [fallbackName, lead.id, lid],
      );
    } else if (lead && lid && !lead.lid) {
      await tx.none(`update public.leads set lid = $2 where id = $1`, [lead.id, lid]);
    }

    if (customer && !isMeaningfulName(customer.name)) {
      customer = await tx.one<{ id: string; name: string }>(
        `update public.customers set name = $1, lid = coalesce($3, lid), avatar = coalesce($4, avatar) where id = $2 returning id, name`,
        [fallbackName, customer.id, lid, avatarUrl],
      );
    } else if (customer && (lid || avatarUrl)) {
      await tx.none(
        `update public.customers set lid = coalesce($2, lid), avatar = coalesce($3, avatar) where id = $1`, 
        [customer.id, lid, avatarUrl]
      );
    }

    // ========== OPTIMIZATION: Link lead<->customer EM PARALELO ==========
    await Promise.all([
      // Ensure customer.lead_id links to lead
      (async () => {
        const needsLink = await tx.oneOrNone<{ lead_id: string | null }>(
          `select lead_id from public.customers where id = $1`,
          [customer!.id],
        );
        if (!needsLink?.lead_id || needsLink.lead_id !== lead!.id) {
          await tx.none(`update public.customers set lead_id = $2 where id = $1`, [customer!.id, lead!.id]);
          console.log("[META][store] customer linked to lead", { customerId: customer!.id, leadId: lead!.id });
        }
      })(),
      
      // Ensure lead.customer_id links to customer
      (async () => {
        if (!lead?.customer_id || lead.customer_id !== customer!.id) {
          await tx.none(`update public.leads set customer_id = $2 where id = $1`, [lead!.id, customer!.id]);
          console.log("[META][store] lead linked to customer", { leadId: lead!.id, customerId: customer!.id });
        }
      })(),
    ]);

    // ========== FIX: Buscar chat usando external_id, remote_id OU LID para evitar chat duplicado ==========
    // Se customer tem múltiplos chats, precisamos filtrar pelo identificador único
    // Tentar buscar usando externalIdCandidate OU LID (se fornecido)
    let chat = await tx.oneOrNone<{ id: string; external_id: string | null; chat_type: string | null; remote_id: string | null }>(
      `select id, external_id, chat_type, remote_id
         from public.chats
        where inbox_id = $1
          and customer_id = $2
          and (
            ($3::text is not null and (external_id = $3 or remote_id = $3))
            or ($4::text is not null and (external_id = $4 or remote_id = $4))
            or ($3::text is null and $4::text is null and (external_id is null or external_id = ''))
          )
        limit 1`,
      [args.inboxId, customer!.id, externalIdCandidate, lid],
    );

    // Se não encontrou com filtro, tenta sem (compatibilidade com chats antigos)
    if (!chat) {
      console.log("[META][store] Chat not found with external_id/lid filter, trying fallback by customer_id only", {
        inboxId: args.inboxId,
        customerId: customer!.id,
        externalIdCandidate,
        lid,
      });
      chat = await tx.oneOrNone<{ id: string; external_id: string | null; chat_type: string | null; remote_id: string | null }>(
        `select id, external_id, chat_type, remote_id
           from public.chats
          where inbox_id = $1
            and customer_id = $2
          limit 1`,
        [args.inboxId, customer!.id],
      );
    }

    console.log("[META][store] Chat lookup result", {
      inboxId: args.inboxId,
      customerId: customer!.id,
      customerPhone: msisdn,
      customerLid: lid,
      chatFound: !!chat,
      chatId: chat?.id,
      externalId: chat?.external_id,
      remoteId: chat?.remote_id,
      externalIdCandidate,
      usedFallback: !chat,
    });

    if (!chat) {
      try {
        chat = await tx.one<{ id: string; external_id: string | null; chat_type: string | null; remote_id: string | null }>(
            `insert into public.chats (inbox_id, customer_id, company_id, status, last_message_at, external_id, chat_type)
           values ($1, $2, (select company_id from public.inboxes where id = $1 limit 1), 'AI', now(), $3, coalesce($4::public.chat_type, 'CONTACT'))
           returning id, external_id, chat_type, remote_id`,
          [args.inboxId, customer!.id, externalIdCandidate ?? null, "CONTACT"],
        );
        console.log("[META][store] chat created", { chatId: chat.id, inboxId: args.inboxId, customerId: customer!.id, externalId: externalIdCandidate });
      } catch (error: any) {
        if (String(error?.code) === "23505") {
          // Conflict: retry with external_id filter
          chat = await tx.oneOrNone<{ id: string; external_id: string | null; chat_type: string | null; remote_id: string | null }>(
            `select id, external_id, chat_type, remote_id
               from public.chats
              where inbox_id = $1
                and customer_id = $2
                and (
                  ($3::text is not null and (external_id = $3 or remote_id = $3))
                  or ($3::text is null and (external_id is null or external_id = ''))
                )
              limit 1`,
            [args.inboxId, customer!.id, externalIdCandidate],
          );
          if (!chat) {
            // Fallback without filter
            chat = await tx.one<{ id: string; external_id: string | null; chat_type: string | null; remote_id: string | null }>(
              `select id, external_id, chat_type, remote_id
                 from public.chats
                where inbox_id = $1
                  and customer_id = $2
                limit 1`,
              [args.inboxId, customer!.id],
            );
          }
          console.log("[META][store] chat fetched after conflict", { chatId: chat.id, inboxId: args.inboxId, customerId: customer!.id });
        } else {
          throw error;
        }
      }
    } else {
      let updated = false;
      if (externalIdCandidate && (!chat.external_id || String(chat.external_id).trim() === "")) {
        await tx.none(
          `update public.chats
              set external_id = $2,
                  updated_at = now()
            where id = $1`,
          [chat.id, externalIdCandidate],
        );
        chat.external_id = externalIdCandidate;
        updated = true;
        console.log("[META][store] chat external_id backfilled", { chatId: chat.id, externalId: externalIdCandidate });
      }
      const chatTypeUpper = chat.chat_type ? String(chat.chat_type).toUpperCase() : null;
      if (!chatTypeUpper) {
        await tx.none(
          `update public.chats
              set chat_type = 'CONTACT',
                  updated_at = now()
            where id = $1
              and chat_type is distinct from 'CONTACT'`,
          [chat.id],
        );
        chat.chat_type = "CONTACT";
        updated = true;
      }
      if (!updated) {
        console.log("[META][store] chat reused", { chatId: chat.id, inboxId: args.inboxId, customerId: customer!.id });
      }
    }

    console.log("[META][store] ensureLeadCustomerChat result", {
      leadId: lead!.id,
      customerId: customer!.id,
      chatId: chat!.id,
      externalId: chat.external_id ?? null,
      chatType: chat.chat_type ?? null,
    });

    if (isNewLead) {
      triggerFlow({
        companyId: args.companyId,
        contactId: customer!.id,
        chatId: chat!.id,
        triggerType: 'LEAD_CREATED',
        triggerData: { 
          phone: args.phone,
          name: args.name || lead!.name,
          inbox_id: args.inboxId
        }
      }).catch(err => console.error("[FlowEngine] Failed to trigger LEAD_CREATED flow", err));

      WebhookService.trigger("contact.created", args.companyId, {
        id: customer!.id,
        name: customer!.name,
        phone: msisdn,
        lead_id: lead!.id,
        inbox_id: args.inboxId,
        created_at: new Date().toISOString()
      }).catch(err => console.error("[WebhookService] Failed to trigger contact.created", err));
    } else {
      WebhookService.trigger("contact.updated", args.companyId, {
        id: customer!.id,
        name: customer!.name,
        phone: msisdn,
        lead_id: lead!.id,
        updated_at: new Date().toISOString()
      }).catch(err => console.error("[WebhookService] Failed to trigger contact.updated", err));
    }

    return { leadId: lead!.id, customerId: customer!.id, chatId: chat!.id, externalId: chat.external_id ?? null };
  });
}


export async function upsertChatMessage(args: UpsertChatMessageArgs): Promise<UpsertChatMessageResult | null> {
  const createdAtIso =
    args.createdAt instanceof Date
      ? args.createdAt.toISOString()
      : typeof args.createdAt === "string" && args.createdAt
        ? new Date(args.createdAt).toISOString()
        : null;

  // Encrypt media URL before storing (legacy field)
  const encryptedMediaUrl = encryptMediaUrl(args.mediaUrl);

  let finalRow: UpsertChatMessageRow | null = null;

  if (chatMessagesSupportsRemoteSenderColumns) {
    try {
      const row = await db.oneOrNone<UpsertChatMessageRow>(
        `
          insert into public.chat_messages
            (id, chat_id, sender_id, is_from_customer, external_id, content, type, view_status,
             media_storage_path, media_public_url, media_source, is_media_sensitive,
             media_url, media_sha256,
               sent_from_device,
             remote_participant_id, remote_sender_id, remote_sender_name, remote_sender_phone,
             remote_sender_avatar_url, remote_sender_is_admin, replied_message_id, caption, interactive_content, created_at,
             company_id, inbox_id)
          values
            (coalesce($25, gen_random_uuid()), $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11,
             $12, $13,
               $14,
               $15, $16, $17, $18, $19, $20, $21, $22, $24, coalesce($23::timestamptz, now()),
               (select company_id from public.chats where id = $1 limit 1),
               (select inbox_id from public.chats where id = $1 limit 1))
          on conflict (chat_id, external_id) do update
            set content     = coalesce(excluded.content,     public.chat_messages.content),
                type        = coalesce(excluded.type,        public.chat_messages.type),
                sender_id   = coalesce(excluded.sender_id,   public.chat_messages.sender_id),
                view_status = coalesce(excluded.view_status, public.chat_messages.view_status),
                media_storage_path = coalesce(excluded.media_storage_path, public.chat_messages.media_storage_path),
                media_public_url   = coalesce(excluded.media_public_url,   public.chat_messages.media_public_url),
                media_source       = coalesce(excluded.media_source,       public.chat_messages.media_source),
                is_media_sensitive = coalesce(excluded.is_media_sensitive, public.chat_messages.is_media_sensitive),
                media_url   = coalesce(excluded.media_url,   public.chat_messages.media_url),
                media_sha256 = coalesce(excluded.media_sha256, public.chat_messages.media_sha256),
                  sent_from_device = coalesce(excluded.sent_from_device, public.chat_messages.sent_from_device),
                remote_participant_id      = coalesce(excluded.remote_participant_id,      public.chat_messages.remote_participant_id),
                remote_sender_id           = coalesce(excluded.remote_sender_id,           public.chat_messages.remote_sender_id),
                remote_sender_name         = coalesce(excluded.remote_sender_name,         public.chat_messages.remote_sender_name),
                remote_sender_phone        = coalesce(excluded.remote_sender_phone,        public.chat_messages.remote_sender_phone),
                remote_sender_avatar_url   = coalesce(excluded.remote_sender_avatar_url,   public.chat_messages.remote_sender_avatar_url),
                remote_sender_is_admin     = coalesce(excluded.remote_sender_is_admin,     public.chat_messages.remote_sender_is_admin),
                replied_message_id         = coalesce(excluded.replied_message_id,         public.chat_messages.replied_message_id),
                caption                    = coalesce(excluded.caption,                    public.chat_messages.caption),
                interactive_content        = coalesce(excluded.interactive_content,        public.chat_messages.interactive_content),
                updated_at  = now()
          returning id,
                    chat_id,
                    sender_id,
                    content,
                    type,
                    view_status,
                    created_at,
                    is_from_customer,
                    media_url,
                    media_public_url,
                    media_storage_path,
                    media_source,
                    remote_participant_id,
                    remote_sender_id,
                    remote_sender_name,
                    remote_sender_phone,
                    remote_sender_avatar_url,
                    remote_sender_is_admin,
                    replied_message_id,
                    interactive_content,
                    (xmax = 0) as inserted
        `,
        [
          args.chatId,
          args.senderId ?? null,
          args.isFromCustomer,
          args.externalId,
          args.content,
          args.type ?? "TEXT",
          args.viewStatus ?? null,
          // ✅ New storage fields
          args.mediaStoragePath ?? null,
          args.mediaPublicUrl ?? null,
          args.mediaSource ?? null,
          args.isMediaSensitive ?? false,
          // ⚠️ Legacy fields
          encryptedMediaUrl ?? null,
          args.mediaSha256 ?? null,
            // Device tracking
            args.sentFromDevice ?? null,
          // Remote sender fields
          args.remoteParticipantId ?? null,
          args.remoteSenderId ?? null,
          args.remoteSenderName ?? null,
          args.remoteSenderPhone ?? null,
          args.remoteSenderAvatarUrl ?? null,
          typeof args.remoteSenderIsAdmin === "boolean" ? args.remoteSenderIsAdmin : null,
          args.repliedMessageId ?? null,
          args.caption ?? null,
          createdAtIso,
          args.interactiveContent ?? null,
          args.id ?? null,
        ],
      );
      if (row) {
        finalRow = row;
      }
    } catch (error: any) {
      const code = String(error?.code || "");
      if (code === "42703" || code === "42P01") {
        chatMessagesSupportsRemoteSenderColumns = false;
        console.warn("[META][store] chat_messages remote sender columns missing. Falling back to legacy schema.");
      } else {
        throw error;
      }
    }
  }

  if (!finalRow) {
    finalRow = await db.oneOrNone<UpsertChatMessageRow>(
      `
        insert into public.chat_messages
          (chat_id, sender_id, is_from_customer, external_id, content, type, view_status, media_url, created_at,
           company_id, inbox_id)
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::timestamptz, now()),
           (select company_id from public.chats where id = $1 limit 1),
           (select inbox_id from public.chats where id = $1 limit 1))
        on conflict (chat_id, external_id) do update
          set content     = coalesce(excluded.content,     public.chat_messages.content),
              type        = coalesce(excluded.type,        public.chat_messages.type),
              sender_id   = coalesce(excluded.sender_id,   public.chat_messages.sender_id),
              view_status = coalesce(excluded.view_status, public.chat_messages.view_status),
              media_url   = coalesce(excluded.media_url,   public.chat_messages.media_url),
              updated_at  = now()
        returning id,
                  chat_id,
                  sender_id,
                  content,
                  type,
                  view_status,
                  created_at,
                  is_from_customer,
                  media_url,
                  null::uuid    as remote_participant_id,
                  null::text    as remote_sender_id,
                  null::text    as remote_sender_name,
                  null::text    as remote_sender_phone,
                  null::text    as remote_sender_avatar_url,
                  null::boolean as remote_sender_is_admin,
                  null::uuid    as replied_message_id,
                  (xmax = 0) as inserted
      `,
      [
        args.chatId,
        args.senderId ?? null,
        args.isFromCustomer,
        args.externalId,
        args.content,
        args.type ?? "TEXT",
        args.viewStatus ?? null,
        encryptedMediaUrl ?? null,
        createdAtIso,
      ],
    );
  }

  if (!finalRow) return null;

  // 🤖 Trigger Flow Builder for Inbound Messages
  if (finalRow.inserted && args.isFromCustomer) {
    try {
      const chat = await db.oneOrNone<{ customer_id: string, company_id: string, inbox_id: string }>(
        `SELECT customer_id, company_id, inbox_id FROM public.chats WHERE id = $1`,
        [args.chatId]
      );
      if (chat?.customer_id && chat?.company_id) {
        // 1. Resume flows waiting for response
        const resumed = await resumeFlowWithResponse(args.chatId, { content: args.content, type: args.type })
          .catch(err => { console.error("[FlowEngine] Failed to resume flow", err); return false; });

        // 2. Trigger Keyword (Keywords always trigger, even if resumed)
        triggerFlow({
          companyId: chat.company_id,
          contactId: chat.customer_id,
          chatId: args.chatId,
          triggerType: 'KEYWORD',
          triggerData: { text: args.content }
        }).catch(err => console.error("[FlowEngine] Failed to trigger keyword flow", err));

        // 3. Trigger New Message (Only if not resumed by an existing flow)
        if (!resumed) {
          triggerFlow({
            companyId: chat.company_id,
            contactId: chat.customer_id,
            chatId: args.chatId,
            triggerType: 'NEW_MESSAGE',
            triggerData: { 
              text: args.content, 
              type: args.type || 'TEXT',
              inbox_id: chat.inbox_id
            }
          }).catch(err => console.error("[FlowEngine] Failed to trigger new message flow", err));
        }
      }
    } catch (err) {
      console.error("[FlowEngine] Error fetching chat for flow trigger", err);
    }
  }

  return { message: finalRow, inserted: finalRow.inserted };
}

export async function touchChatAfterMessage(args: {
  chatId: string;
  content: string | null;
  lastMessageFrom?: "CUSTOMER" | "AGENT" | null;
  lastMessageType?: string | null;
  lastMessageMediaUrl?: string | null;
  listContext?: {
    companyId?: string | null;
    inboxId?: string | null;
    status?: string | null;
    kind?: string | null;
    chatType?: string | null;
    remoteId?: string | null;
  };
}): Promise<void> {
  const sanitizedContent = args.content ?? null;
  const messageFrom =
    typeof args.lastMessageFrom === "string"
      ? (args.lastMessageFrom || "").trim().toUpperCase() || null
      : null;
  const messageType =
    typeof args.lastMessageType === "string"
      ? (args.lastMessageType || "").trim().toUpperCase() || null
      : null;
  const mediaUrl =
    typeof args.lastMessageMediaUrl === "string"
      ? (args.lastMessageMediaUrl || "").trim() || null
      : null;

  let attempts = 0;
  while (attempts < 4) {
    attempts += 1;
    const updateFragments = ["last_message = $2", "last_message_at = now()", "updated_at = now()"];
    const values: Array<string | null> = [args.chatId, sanitizedContent];
    let paramIndex = values.length + 1;

    if (!chatLastMessageFromColumnMissing) {
      updateFragments.push(`last_message_from = $${paramIndex++}`);
      values.push(messageFrom);
    }
    if (!chatLastMessageTypeColumnMissing) {
      updateFragments.push(`last_message_type = $${paramIndex++}`);
      values.push(messageType);
    }
    if (!chatLastMessageMediaUrlColumnMissing) {
      updateFragments.push(`last_message_media_url = $${paramIndex++}`);
      values.push(mediaUrl);
    }

    try {
      await db.none(
        `update public.chats
            set ${updateFragments.join(", ")}
          where id = $1`,
        values,
      );
      break;
    } catch (err) {
      const error = err as any;
      const message = String(error?.message || "");
      let handledMissingColumn = false;
      if (error?.code === "42703" || message.includes("column")) {
        if (!chatLastMessageFromColumnMissing && message.includes("last_message_from")) {
          chatLastMessageFromColumnMissing = true;
          handledMissingColumn = true;
          console.warn("[META][store] chats.last_message_from column missing. Retrying without it.");
        }
        if (!chatLastMessageTypeColumnMissing && message.includes("last_message_type")) {
          chatLastMessageTypeColumnMissing = true;
          handledMissingColumn = true;
          console.warn("[META][store] chats.last_message_type column missing. Retrying without it.");
        }
        if (!chatLastMessageMediaUrlColumnMissing && message.includes("last_message_media_url")) {
          chatLastMessageMediaUrlColumnMissing = true;
          handledMissingColumn = true;
          console.warn("[META][store] chats.last_message_media_url column missing. Retrying without it.");
        }
      }
      if (!handledMissingColumn) {
        console.warn("[META][store] failed to update chat last_message", {
          chatId: args.chatId,
          error,
        });
        break;
      }
    }
  }

  await invalidateChatCaches(args.chatId, args.listContext);
}

export async function insertInboundMessage(args: {
  id?: string | null;
  chatId: string;
  externalId: string;
  inboxId?: string;
  companyId?: string;
  content: string;
  type?: "TEXT" | string;
  caption?: string | null;
  remoteParticipantId?: string | null;
  remoteSenderId?: string | null;
  remoteSenderName?: string | null;
  remoteSenderPhone?: string | null;
  remoteSenderAvatarUrl?: string | null;
  remoteSenderIsAdmin?: boolean | null;
  repliedMessageId?: string | null;
  interactiveContent?: any | null;
  createdAt?: string | Date | null;
}): Promise<InsertedInboundMessage | null> {
  console.log("[META][store] insertInboundMessage payload", args);
  const result = await upsertChatMessage({
    id: args.id,
    chatId: args.chatId,
    externalId: args.externalId,
    isFromCustomer: true,
    content: args.content,
    type: args.type ?? "TEXT",
    viewStatus: "Pending",
    caption: args.caption ?? null,
    interactiveContent: args.interactiveContent ?? null,
    remoteParticipantId: args.remoteParticipantId ?? null,
    remoteSenderId: args.remoteSenderId ?? null,
    remoteSenderName: args.remoteSenderName ?? null,
    remoteSenderPhone: args.remoteSenderPhone ?? null,
    remoteSenderAvatarUrl: args.remoteSenderAvatarUrl ?? null,
    remoteSenderIsAdmin: args.remoteSenderIsAdmin ?? null,
    repliedMessageId: args.repliedMessageId ?? null,
    createdAt: args.createdAt ?? null,
  });
  if (!result || !result.inserted) {
    console.log("[META][store] insertInboundMessage skipped (duplicate)", { externalId: args.externalId });
    return null;
  }

  await touchChatAfterMessage({
    chatId: args.chatId,
    content: args.content,
    lastMessageFrom: "CUSTOMER",
    lastMessageType: args.type ?? result.message.type ?? "TEXT",
    lastMessageMediaUrl: result.message.media_url ?? null,
    listContext: {
      companyId: args.companyId,
      inboxId: args.inboxId,
      kind: args.remoteParticipantId ? "GROUP" : "DIRECT", // Infer kind from participant presence
      chatType: args.remoteParticipantId ? "GROUP" : "CONTACT",
      remoteId: null, // We don't have remoteId here easily, but invalidateChatCaches might fetch it if missing
    },
  });

  // 🔔 Notificar usuário sobre nova mensagem
  notifyNewMessage({
    chatId: args.chatId,
    messageBody: args.content,
    senderName: args.remoteSenderName ?? undefined,
    senderPhone: args.remoteSenderPhone ?? undefined,
  }).catch(err => console.error("[META][store] Failed to notify new message", err));

  // 🪝 Trigger Webhook
  if (args.companyId) {
    WebhookService.trigger("message.created", args.companyId, {
      id: result.message.id,
      chat_id: args.chatId,
      content: args.content,
      type: args.type ?? "TEXT",
      from_me: false,
      external_id: args.externalId,
      created_at: result.message.created_at
    }).catch(err => console.error("[META][store] Failed to trigger webhook (inbound)", err));
  }

  return {
    id: result.message.id,
    chat_id: result.message.chat_id,
    content: result.message.content,
    type: result.message.type,
    caption: result.message.caption ?? null,
    view_status: result.message.view_status,
    created_at: result.message.created_at,
    remote_participant_id: result.message.remote_participant_id ?? null,
    remote_sender_id: result.message.remote_sender_id ?? null,
    remote_sender_name: result.message.remote_sender_name ?? null,
    remote_sender_phone: result.message.remote_sender_phone ?? null,
    remote_sender_avatar_url: result.message.remote_sender_avatar_url ?? null,
    remote_sender_is_admin: result.message.remote_sender_is_admin ?? null,
    replied_message_id: result.message.replied_message_id ?? null,
    // ✅ Campos de mídia (inicialmente null, preenchidos por worker-media depois)
    media_url: result.message.media_url ?? null,
    media_public_url: result.message.media_public_url ?? null,
    media_storage_path: result.message.media_storage_path ?? null,
    interactive_content: result.message.interactive_content ?? null,
  };
}

export async function updateMessageStatusByExternalId(args: {
  inboxId: string;
  externalId: string;
  viewStatus: string;
}): Promise<{ messageId: string; chatId: string; viewStatus: string } | null> {
  try {
    const updated = await db.oneOrNone<{
      id: string;
      chat_id: string;
      view_status: string | null;
    }>(
      `update public.chat_messages
          set view_status = $2,
              updated_at = now()
        where external_id = $1
        returning id, chat_id, view_status`,
      [args.externalId, args.viewStatus],
    );
    if (updated?.chat_id) {
      await invalidateChatCaches(updated.chat_id, { inboxId: args.inboxId });
    }
    return updated
      ? {
          messageId: updated.id,
          chatId: updated.chat_id,
          viewStatus: updated.view_status ?? args.viewStatus,
        }
      : null;
  } catch (e) {
    console.error("[DB] updateMessageStatusByExternalId error", e);
    return null;
  }
}

export async function getDecryptedCredsForInbox(inboxId: string): Promise<InboxCredentials> {
  const cacheKey = credsCacheKey(inboxId);
  const cached = await cacheReadNullable<InboxCredentials>(cacheKey);
  if (cached?.hit && cached.value) {
    return cached.value;
  }

  const row = await db.oneOrNone<{
    provider: "META" | "WAHA";
    access_token: string | null;
    refresh_token: string | null;
    provider_api_key: string | null;
    app_secret: string | null;
    webhook_verify_token: string | null;
    phone_number_id: string | null;
    waba_id: string | null;
    company_id: string;
  }>(
    `select i.provider,
            s.access_token,
            s.refresh_token,
            s.provider_api_key,
            i.app_secret,
            i.webhook_verify_token,
            i.phone_number_id,
            i.waba_id,
            i.company_id
       from public.inboxes i
  left join public.inbox_secrets s on s.inbox_id = i.id
      where i.id = $1
      limit 1`,
    [inboxId],
  );

  if (!row) {
    throw new Error("Inbox nao encontrada");
  }

  const provider = (row.provider || "META").toUpperCase();
  const decryptedAccessToken = decryptSecret(row.access_token);
  const decryptedApiKey = decryptSecret(row.provider_api_key);

  let payload: InboxCredentials;

  if (provider === WAHA_PROVIDER) {
    const apiKey = decryptedApiKey || decryptedAccessToken;
    if (!apiKey) throw new Error("Inbox WAHA sem API key configurado");
    payload = {
      provider: "WAHA",
      access_token: apiKey,
      app_secret: row.app_secret ?? undefined,
      verify_token: row.webhook_verify_token ?? undefined,
      phone_number_id: row.phone_number_id ?? undefined,
      waba_id: row.waba_id ?? undefined,
      company_id: row.company_id,
    };
  } else {
    if (!row.phone_number_id) {
      throw new Error("Inbox sem phone_number_id configurado");
    }
    const accessToken = decryptedAccessToken || decryptedApiKey;
    if (!accessToken) throw new Error("Inbox sem access_token configurado");
    payload = {
      provider: "META",
      access_token: accessToken,
      app_secret: row.app_secret ?? undefined,
      verify_token: row.webhook_verify_token ?? undefined,
      phone_number_id: row.phone_number_id,
      waba_id: row.waba_id ?? undefined,
      company_id: row.company_id,
    };
  }

  await cacheWriteNullable(cacheKey, payload, TTL_CREDS_LOOKUP);
  return payload;
}

export async function getChatWithCustomerPhone(chatId: string, inboxId?: string | null, companyId?: string | null): Promise<{
  chat_id: string;
  customer_phone: string;
  inbox_id: string;
}> {
  const cacheKey = chatPhoneCacheKey(chatId);
  const cached = await cacheReadNullable<{ chat_id: string; customer_phone: string; inbox_id: string }>(cacheKey);
  if (cached?.hit && cached.value) {
    console.log("[META][getChatWithCustomerPhone] cache hit", { chatId, customerPhone: cached.value.customer_phone });
    return cached.value;
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);

  if (isUuid) {
    const row = await db.one<{ phone: string; inbox_id: string | null; external_id: string | null; remote_id: string | null }>(
      `select c.phone, ch.inbox_id, ch.external_id, ch.remote_id
         from public.chats ch
         join public.customers c on c.id = ch.customer_id
        where ch.id = $1`,
      [chatId],
    );

    const phone = normalizeMsisdn(row.phone || "");
    if (!phone) throw new Error("Telefone do cliente não encontrado");
    const resolvedInboxId = row.inbox_id;
    if (!resolvedInboxId) throw new Error("Inbox não encontrada para o chat");
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    const result = { chat_id: chatId, customer_phone: normalizedPhone, inbox_id: resolvedInboxId };
    
    console.log("[META][getChatWithCustomerPhone] resolved by UUID", { 
      chatId, 
      customerPhone: normalizedPhone,
      inboxId: resolvedInboxId,
    });
    
    await cacheWriteNullable(cacheKey, result, TTL_CHAT_PHONE_LOOKUP);
    return result;
  } else {
    // Not a UUID, treat as phone number
    if (!inboxId) throw new Error("getChatWithCustomerPhone: inboxId required for phone-based lookup");
    
    let effectiveCompanyId = companyId;
    if (!effectiveCompanyId) {
      const inbox = await db.oneOrNone<{ company_id: string }>(
        "select company_id from public.inboxes where id = $1",
        [inboxId]
      );
      effectiveCompanyId = inbox?.company_id;
    }
    
    if (!effectiveCompanyId) throw new Error("getChatWithCustomerPhone: companyId not found");

    // Ensure lead/customer/chat exists
    const chatInfo = await ensureLeadCustomerChat({
      inboxId,
      companyId: effectiveCompanyId,
      phone: chatId, // chatId is the phone
    });

    const result = { 
      chat_id: chatInfo.id, 
      customer_phone: normalizeMsisdn(chatId).startsWith("+") ? normalizeMsisdn(chatId) : `+${normalizeMsisdn(chatId)}`,
      inbox_id: inboxId 
    };

    console.log("[META][getChatWithCustomerPhone] resolved by Phone", { 
      phone: chatId, 
      chatId: chatInfo.id,
      inboxId,
    });

    await cacheWriteNullable(cacheKey, result, TTL_CHAT_PHONE_LOOKUP);
    return result;
  }
}

export async function invalidateInboxCredsCache(inboxId: string): Promise<void> {
  await rDel(credsCacheKey(inboxId));
}

export async function invalidateChatPhoneCache(chatId: string): Promise<void> {
  await rDel(chatPhoneCacheKey(chatId));
}

export async function invalidateInboxLookupCache(args: {
  phoneNumberId?: string | null;
  phones?: Array<string | null | undefined>;
}): Promise<void> {
  const keys = new Set<string>();
  if (args.phoneNumberId) {
    const normalized = String(args.phoneNumberId).trim();
    if (normalized) keys.add(inboxCacheKey.byPhoneId(normalized));
  }
  for (const phone of args.phones || []) {
    if (!phone) continue;
    const normalized = String(phone).trim();
    if (normalized) keys.add(inboxCacheKey.byPhone(normalized));
  }
  if (keys.size === 0) return;
  await Promise.all(Array.from(keys).map((key) => rDel(key)));
}

export async function insertOutboundMessage(args: {
  chatId: string;
  inboxId: string;
  customerId: string;
  externalId: string | null;
  content: string;
  type?: "TEXT" | string;
  senderId?: string | null;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  messageId?: string | null;
  viewStatus?: string;
  interactiveContent?: any | null;
  mediaUrl?: string | null;
  mediaStoragePath?: string | null;
  mediaPublicUrl?: string | null;
  mediaSource?: string | null;
}): Promise<UpsertOutboundMessageResult | null> {
  try {
    const viewStatus = args.viewStatus ?? "Sent";
    const type = args.type ?? "TEXT";
    const senderId = args.senderId ?? null;
    const senderName = args.senderName ?? null;
    const senderAvatarUrl = args.senderAvatarUrl ?? null;

    let operation: "insert" | "update" | null = null;
    let row: InsertedOutboundMessage | null = null;

    if (args.messageId) {
      row = await db.oneOrNone<InsertedOutboundMessage>(
        `update public.chat_messages
            set content = coalesce($2, content),
                type = coalesce($3, type),
                view_status = $4,
                external_id = coalesce($5, external_id),
                sender_id = coalesce($6, sender_id),
                sender_name = coalesce($7, sender_name),
                sender_avatar_url = coalesce($8, sender_avatar_url),
                interactive_content = coalesce($9, interactive_content),
                media_url = coalesce($10, media_url),
                media_storage_path = coalesce($11, media_storage_path),
                media_public_url = coalesce($12, media_public_url),
                media_source = coalesce($13, media_source),
                updated_at = now()
          where id = $1
          returning id, chat_id, content, type, view_status, created_at, external_id, sender_id, sender_name, sender_avatar_url, media_url, media_public_url, media_storage_path, media_source, replied_message_id, replied_message_external_id, interactive_content, is_from_customer`,
        [
          args.messageId,
          args.content,
          type,
          viewStatus,
          args.externalId,
          senderId,
          senderName,
          senderAvatarUrl,
          args.interactiveContent ?? null,
          args.mediaUrl ?? null,
          args.mediaStoragePath ?? null,
          args.mediaPublicUrl ?? null,
          args.mediaSource ?? null,
        ],
      );
      if (row) {
        operation = "update";
      }
    }

    if (!row) {
      if (args.messageId) {
        row = await db.oneOrNone<InsertedOutboundMessage>(
          `insert into public.chat_messages
             (id, chat_id, sender_id, sender_name, sender_avatar_url, is_from_customer, external_id, content, type, view_status, interactive_content, media_url, media_storage_path, media_public_url, media_source)
           values ($1, $2, $3, $4, $5, false, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           on conflict (chat_id, external_id) do update
             set view_status = excluded.view_status,
                 content = excluded.content,
                 type = excluded.type,
                 sender_id = excluded.sender_id,
                 sender_name = excluded.sender_name,
                 sender_avatar_url = excluded.sender_avatar_url,
                 interactive_content = excluded.interactive_content,
                 media_url = excluded.media_url,
                 media_storage_path = excluded.media_storage_path,
                 media_public_url = excluded.media_public_url,
                 media_source = excluded.media_source,
                 updated_at = now()
           returning id, chat_id, content, type, view_status, created_at, external_id, sender_id, sender_name, sender_avatar_url, media_url, replied_message_id, replied_message_external_id, interactive_content, is_from_customer`,
          [
            args.messageId,
            args.chatId,
            senderId,
            senderName,
            senderAvatarUrl,
            args.externalId,
            args.content,
            type,
            viewStatus,
            args.interactiveContent ?? null,
            args.mediaUrl ?? null,
            args.mediaStoragePath ?? null,
            args.mediaPublicUrl ?? null,
            args.mediaSource ?? null,
          ],
        );
      } else {
        row = await db.oneOrNone<InsertedOutboundMessage>(
          `insert into public.chat_messages
             (chat_id, sender_id, sender_name, sender_avatar_url, is_from_customer, external_id, content, type, view_status, interactive_content, media_url, media_storage_path, media_public_url, media_source)
           values ($1, $2, $3, $4, false, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           on conflict (chat_id, external_id) do update
             set view_status = excluded.view_status,
                 content = excluded.content,
                 type = excluded.type,
                 sender_id = excluded.sender_id,
                 sender_name = excluded.sender_name,
                 sender_avatar_url = excluded.sender_avatar_url,
                 interactive_content = excluded.interactive_content,
                 media_url = excluded.media_url,
                 media_storage_path = excluded.media_storage_path,
                 media_public_url = excluded.media_public_url,
                 media_source = excluded.media_source,
                 updated_at = now()
           returning id, chat_id, content, type, view_status, created_at, external_id, sender_id, sender_name, sender_avatar_url, media_url, media_public_url, media_storage_path, media_source, replied_message_id, replied_message_external_id, interactive_content, is_from_customer`,
          [
            args.chatId,
            senderId,
            senderName,
            senderAvatarUrl,
            args.externalId,
            args.content,
            type,
            viewStatus,
            args.interactiveContent ?? null,
            args.mediaUrl ?? null,
            args.mediaStoragePath ?? null,
            args.mediaPublicUrl ?? null,
            args.mediaSource ?? null,
          ],
        );
      }
      if (row) {
        operation = "insert";
      }
    }

    if (!row || !operation) {
      return null;
    }

    await invalidateChatCaches(row.chat_id, { inboxId: args.inboxId });

    // 🪝 Trigger Webhook for outbound message
    // Note: We need companyId. We can get it from the chat if needed, but for now 
    // let's try to pass it if available or do a quick lookup if webhook is active.
    // However, store.service functions are often called where we don't have companyId.
    // Let's do a more robust approach in the worker for outbound.
    
    return { message: row, operation };
  } catch (e) {
    console.error("[DB] insertOutboundMessage error", e);
    throw e;
  }
}
