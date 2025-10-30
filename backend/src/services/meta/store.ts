// src/services/meta/store.ts
import db from "../../pg.ts";
import { normalizeMsisdn } from "../../util.ts";
import { supabaseAdmin } from "../../lib/supabase.js";
import { clearMessageCache, rDel, rDelMatch, rGet, rSet, k } from "../../lib/redis.ts";
import { decryptSecret } from "../../lib/crypto.ts";
import { WAHA_PROVIDER } from "../waha/client.ts";

let customerAvatarColumnMissing = false;
let chatLastMessageFromColumnMissing = false;
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

export async function invalidateChatCaches(chatId: string, companyId?: string | null) {
  await rDel(k.chat(chatId));
  await clearMessageCache(chatId);

  let company = companyId ?? null;
  if (!company) {
    try {
      const row = await db.oneOrNone<{ company_id: string | null }>(
        `select company_id from public.chats where id = $1`,
        [chatId],
      );
      company = row?.company_id || null;
    } catch { }
  }

  await rDelMatch(k.listPrefixCompany(company));
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
             (inbox_id, company_id, remote_id, kind, chat_type, status, group_name, group_avatar_url, last_message_at)
           values ($1, $2, $3, 'GROUP', 'GROUP', 'OPEN', $4, $5, now())
            returning id, group_name, group_avatar_url`,
          [args.inboxId, args.companyId, trimmedRemote, args.groupName ?? null, args.groupAvatarUrl ?? null],
        );
        return { chatId: inserted.id, created: true };
      }

      const nextName = args.groupName?.trim() || null;
      const nextAvatar = args.groupAvatarUrl?.trim() || null;
      const shouldUpdateName = nextName && !(existing.group_name && existing.group_name.trim());
      const shouldUpdateAvatar = nextAvatar && !(existing.group_avatar_url && existing.group_avatar_url.trim());
      if (shouldUpdateName || shouldUpdateAvatar) {
        await tx.none(
          `update public.chats
              set group_name = coalesce($2, group_name),
                  group_avatar_url = coalesce($3, group_avatar_url),
                  updated_at = now()
            where id = $1`,
          [existing.id, shouldUpdateName ? nextName : null, shouldUpdateAvatar ? nextAvatar : null],
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
        typeof args.isAdmin === "boolean" ? args.isAdmin : null,
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
  view_status: string | null;
  created_at: string;
  remote_participant_id?: string | null;
  remote_sender_id?: string | null;
  remote_sender_name?: string | null;
  remote_sender_phone?: string | null;
  remote_sender_avatar_url?: string | null;
  remote_sender_is_admin?: boolean | null;
  replied_message_id?: string | null;
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
  media_url: string | null;
};

type UpsertOutboundMessageResult = {
  message: InsertedOutboundMessage;
  operation: "insert" | "update";
};

type UpsertChatMessageArgs = {
  chatId: string;
  externalId: string;
  isFromCustomer: boolean;
  content: string | null;
  type?: string | null;
  senderId?: string | null;
  viewStatus?: string | null;
  mediaUrl?: string | null;
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
};
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

  await invalidateChatCaches(chatId, args.companyId);

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

  const created = await db.one<{ id: string }>(
    `insert into public.kanban_boards (company_id, name, is_default)
     values ($1, $2, true)
     returning id`,
    [companyId, "WhatsApp Leads"],
  );
  await cacheWriteNullable(cacheKey, created.id, TTL_BOARD_LOOKUP);
  return created.id;
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
          set avatar_url = $1,
              updated_at = now()
        where id = $2
          and (avatar_url is distinct from $1)`,
      [avatarUrl, customerId],
    );
    return (result as any)?.rowCount > 0;
  } catch (e: any) {
    const message = String(e?.message || "");
    if (e?.code === "42703" || message.includes("avatar_url")) {
      customerAvatarColumnMissing = true;
      console.warn("[DB] customers.avatar_url column missing. Avatar updates disabled.");
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
}) {
  const msisdn = normalizeMsisdn(args.phone);
  const externalIdCandidate = extractExternalId(args.rawPhone ?? null) ?? extractExternalId(args.phone);
  const rawName = typeof args.name === "string" ? args.name.trim() : "";
  const fallbackName =
    (isMeaningfulName(rawName) ? rawName : null) ||
    msisdn ||
    extractExternalId(args.phone) ||
    "-";

  return db.withTransaction(async (tx) => {
    let lead = await tx.oneOrNone<{ id: string; name: string; customer_id: string | null }>(
      `select id, name, customer_id
         from public.leads
        where company_id = $1
          and phone = $2
        limit 1`,
      [args.companyId, msisdn],
    );
    console.log("[META][store] lead lookup", { companyId: args.companyId, msisdn, found: !!lead });

    if (!lead) {
      const boardId = await getBoardIdForCompany(args.companyId);
      try {
        lead = await tx.one<{ id: string; name: string; customer_id: string | null }>(
          `insert into public.leads (company_id, phone, name, kanban_board_id)
           values ($1, $2, $3, $4)
           returning id, name, customer_id`,
          [args.companyId, msisdn, fallbackName, boardId],
        );
        console.log("[META][store] lead created", { leadId: lead.id, companyId: args.companyId, msisdn });
      } catch (error: any) {
        if (String(error?.code) === "23505") {
          lead = await tx.one<{ id: string; name: string; customer_id: string | null }>(
            `select id, name, customer_id
               from public.leads
              where company_id = $1
                and phone = $2
              limit 1`,
            [args.companyId, msisdn],
          );
        } else {
          throw error;
        }
      }
    } else if (!isMeaningfulName(lead.name)) {
      lead = await tx.one<{ id: string; name: string; customer_id: string | null }>(
        `update public.leads
            set name = $1
          where id = $2
          returning id, name, customer_id`,
        [fallbackName, lead.id],
      );
    }

    let customer = await tx.oneOrNone<{ id: string; name: string }>(
      `select id, name
         from public.customers
        where phone = $1
        limit 1`,
      [msisdn],
    );
    console.log("[META][store] customer lookup", { msisdn, found: !!customer });

    if (!customer) {
      try {
        customer = await tx.one<{ id: string; name: string }>(
          `insert into public.customers (company_id, phone, name)
           values ($1, $2, $3)
           returning id, name`,
          [args.companyId, msisdn, fallbackName],
        );
        console.log("[META][store] customer created", { customerId: customer.id, companyId: args.companyId, msisdn });
      } catch (error: any) {
        if (String(error?.code) === "23505") {
          customer = await tx.one<{ id: string; name: string }>(
            `select id, name
               from public.customers
              where company_id = $1
                and phone = $2
              limit 1`,
            [args.companyId, msisdn],
          );
        } else {
          throw error;
        }
      }
    } else if (!isMeaningfulName(customer.name)) {
      customer = await tx.one<{ id: string; name: string }>(
        `update public.customers
            set name = $1
          where id = $2
          returning id, name`,
        [fallbackName, customer.id],
      );
    }

    if (!lead?.customer_id || lead.customer_id !== customer.id) {
      await tx.none(
        `update public.leads
            set customer_id = $2
          where id = $1`,
        [lead!.id, customer.id],
      );
      console.log("[META][store] lead linked to customer", { leadId: lead!.id, customerId: customer.id });
    }

    let chat = await tx.oneOrNone<{ id: string; external_id: string | null; chat_type: string | null }>(
      `select id, external_id, chat_type
         from public.chats
        where inbox_id = $1
          and customer_id = $2
        limit 1`,
      [args.inboxId, customer.id],
    );

    if (!chat) {
      try {
        chat = await tx.one<{ id: string; external_id: string | null; chat_type: string | null }>(
            `insert into public.chats (inbox_id, customer_id, status, last_message_at, external_id, chat_type)
           values ($1, $2, 'OPEN', now(), $3, coalesce($4::public.chat_type, 'CONTACT'))
           returning id, external_id, chat_type`,
          [args.inboxId, customer.id, externalIdCandidate ?? null, "CONTACT"],
        );
        console.log("[META][store] chat created", { chatId: chat.id, inboxId: args.inboxId, customerId: customer.id });
      } catch (error: any) {
        if (String(error?.code) === "23505") {
          chat = await tx.one<{ id: string; external_id: string | null; chat_type: string | null }>(
            `select id, external_id, chat_type
               from public.chats
              where inbox_id = $1
                and customer_id = $2
              limit 1`,
            [args.inboxId, customer.id],
          );
          console.log("[META][store] chat fetched after conflict", { chatId: chat.id, inboxId: args.inboxId, customerId: customer.id });
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
        console.log("[META][store] chat reused", { chatId: chat.id, inboxId: args.inboxId, customerId: customer.id });
      }
    }

    console.log("[META][store] ensureLeadCustomerChat result", {
      leadId: lead!.id,
      customerId: customer.id,
      chatId: chat!.id,
      externalId: chat.external_id ?? null,
      chatType: chat.chat_type ?? null,
    });
    return { leadId: lead!.id, customerId: customer.id, chatId: chat!.id, externalId: chat.external_id ?? null };
  });
}


export async function upsertChatMessage(args: UpsertChatMessageArgs): Promise<UpsertChatMessageResult | null> {
  const createdAtIso =
    args.createdAt instanceof Date
      ? args.createdAt.toISOString()
      : typeof args.createdAt === "string"
        ? new Date(args.createdAt).toISOString()
        : null;

  if (chatMessagesSupportsRemoteSenderColumns) {
    try {
      const row = await db.oneOrNone<UpsertChatMessageRow>(
        `
          insert into public.chat_messages
            (chat_id, sender_id, is_from_customer, external_id, content, type, view_status, media_url,
             remote_participant_id, remote_sender_id, remote_sender_name, remote_sender_phone,
             remote_sender_avatar_url, remote_sender_is_admin, replied_message_id, created_at)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8,
             $9, $10, $11, $12, $13, $14, $15, coalesce($16::timestamptz, now()))
          on conflict (chat_id, external_id) do update
            set content     = coalesce(excluded.content,     public.chat_messages.content),
                type        = coalesce(excluded.type,        public.chat_messages.type),
                sender_id   = coalesce(excluded.sender_id,   public.chat_messages.sender_id),
                view_status = coalesce(excluded.view_status, public.chat_messages.view_status),
                media_url   = coalesce(excluded.media_url,   public.chat_messages.media_url),
                remote_participant_id      = coalesce(excluded.remote_participant_id,      public.chat_messages.remote_participant_id),
                remote_sender_id           = coalesce(excluded.remote_sender_id,           public.chat_messages.remote_sender_id),
                remote_sender_name         = coalesce(excluded.remote_sender_name,         public.chat_messages.remote_sender_name),
                remote_sender_phone        = coalesce(excluded.remote_sender_phone,        public.chat_messages.remote_sender_phone),
                remote_sender_avatar_url   = coalesce(excluded.remote_sender_avatar_url,   public.chat_messages.remote_sender_avatar_url),
                remote_sender_is_admin     = coalesce(excluded.remote_sender_is_admin,     public.chat_messages.remote_sender_is_admin),
                replied_message_id         = coalesce(excluded.replied_message_id,         public.chat_messages.replied_message_id),
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
                    remote_participant_id,
                    remote_sender_id,
                    remote_sender_name,
                    remote_sender_phone,
                    remote_sender_avatar_url,
                    remote_sender_is_admin,
                    replied_message_id,
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
          args.mediaUrl ?? null,
          args.remoteParticipantId ?? null,
          args.remoteSenderId ?? null,
          args.remoteSenderName ?? null,
          args.remoteSenderPhone ?? null,
          args.remoteSenderAvatarUrl ?? null,
          typeof args.remoteSenderIsAdmin === "boolean" ? args.remoteSenderIsAdmin : null,
          args.repliedMessageId ?? null,
          createdAtIso,
        ],
      );
      if (!row) return null;
      return { message: row, inserted: row.inserted };
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

  const fallbackRow = await db.oneOrNone<UpsertChatMessageRow>(
    `
      insert into public.chat_messages
        (chat_id, sender_id, is_from_customer, external_id, content, type, view_status, media_url, created_at)
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::timestamptz, now()))
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
      args.mediaUrl ?? null,
      createdAtIso,
    ],
  );

  if (!fallbackRow) return null;
  return { message: fallbackRow, inserted: fallbackRow.inserted };
}

export async function touchChatAfterMessage(args: {
  chatId: string;
  content: string | null;
  lastMessageFrom?: "CUSTOMER" | "AGENT" | null;
}): Promise<void> {
  const messageFrom = args.lastMessageFrom ?? null;

  const updateArgsWithOrigin: [string, string | null, ("CUSTOMER" | "AGENT" | null)] = [
    args.chatId,
    args.content,
    messageFrom,
  ];

  try {
    if (!chatLastMessageFromColumnMissing) {
      await db.none(
        `update public.chats
            set last_message = $2,
                last_message_at = now(),
                last_message_from = $3,
                updated_at = now()
          where id = $1`,
        updateArgsWithOrigin,
      );
    } else {
      await db.none(
        `update public.chats
            set last_message = $2,
                last_message_at = now(),
                updated_at = now()
          where id = $1`,
        updateArgsWithOrigin.slice(0, 2),
      );
    }
  } catch (err) {
    const error = err as any;
    const message = String(error?.message || "");
    if (!chatLastMessageFromColumnMissing && (error?.code === "42703" || message.includes("last_message_from"))) {
      chatLastMessageFromColumnMissing = true;
      console.warn("[META][store] chats.last_message_from column missing. Falling back without it.");
      try {
        await db.none(
          `update public.chats
              set last_message = $2,
                  last_message_at = now(),
                  updated_at = now()
            where id = $1`,
          updateArgsWithOrigin.slice(0, 2),
        );
      } catch (fallbackError) {
        console.warn("[META][store] fallback chat update failed", { chatId: args.chatId, error: fallbackError });
      }
    } else {
      console.warn("[META][store] failed to update chat last_message", { chatId: args.chatId, error });
    }
  }

  await invalidateChatCaches(args.chatId);
}

export async function insertInboundMessage(args: {
  chatId: string;
  externalId: string;
  content: string;
  type?: "TEXT" | string;
  remoteParticipantId?: string | null;
  remoteSenderId?: string | null;
  remoteSenderName?: string | null;
  remoteSenderPhone?: string | null;
  remoteSenderAvatarUrl?: string | null;
  remoteSenderIsAdmin?: boolean | null;
  repliedMessageId?: string | null;
  createdAt?: string | Date | null;
}): Promise<InsertedInboundMessage | null> {
  console.log("[META][store] insertInboundMessage payload", args);
  const result = await upsertChatMessage({
    chatId: args.chatId,
    externalId: args.externalId,
    isFromCustomer: true,
    content: args.content,
    type: args.type ?? "TEXT",
    viewStatus: "Pending",
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
  });

  return {
    id: result.message.id,
    chat_id: result.message.chat_id,
    content: result.message.content,
    type: result.message.type,
    view_status: result.message.view_status,
    created_at: result.message.created_at,
    remote_participant_id: result.message.remote_participant_id ?? null,
    remote_sender_id: result.message.remote_sender_id ?? null,
    remote_sender_name: result.message.remote_sender_name ?? null,
    remote_sender_phone: result.message.remote_sender_phone ?? null,
    remote_sender_avatar_url: result.message.remote_sender_avatar_url ?? null,
    remote_sender_is_admin: result.message.remote_sender_is_admin ?? null,
    replied_message_id: result.message.replied_message_id ?? null,
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
      await invalidateChatCaches(updated.chat_id);
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
  }>(
    `select i.provider,
            s.access_token,
            s.refresh_token,
            s.provider_api_key,
            i.app_secret,
            i.webhook_verify_token,
            i.phone_number_id,
            i.waba_id
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
    };
  }

  await cacheWriteNullable(cacheKey, payload, TTL_CREDS_LOOKUP);
  return payload;
}

export async function getChatWithCustomerPhone(chatId: string): Promise<{
  chat_id: string;
  customer_phone: string;
  inbox_id: string;
}> {
  const cacheKey = chatPhoneCacheKey(chatId);
  const cached = await cacheReadNullable<{ chat_id: string; customer_phone: string; inbox_id: string }>(cacheKey);
  if (cached?.hit && cached.value) {
    return cached.value;
  }

  const row = await db.one<{ phone: string; inbox_id: string | null }>(
    `select c.phone, ch.inbox_id
       from public.chats ch
       join public.customers c on c.id = ch.customer_id
      where ch.id = $1`,
    [chatId],
  );

  const phone = normalizeMsisdn(row.phone || "");
  if (!phone) throw new Error("Telefone do cliente n?o encontrado");
  const inboxId = row.inbox_id;
  if (!inboxId) throw new Error("Inbox n?o encontrada para o chat");
  const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
  const result = { chat_id: chatId, customer_phone: normalizedPhone, inbox_id: inboxId };
  await cacheWriteNullable(cacheKey, result, TTL_CHAT_PHONE_LOOKUP);
  return result;
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
  messageId?: string | null;
  viewStatus?: string;
}): Promise<UpsertOutboundMessageResult | null> {
  try {
    const viewStatus = args.viewStatus ?? "Sent";
    const type = args.type ?? "TEXT";
    const senderId = args.senderId ?? null;

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
                updated_at = now()
          where id = $1
          returning id, chat_id, content, type, view_status, created_at, external_id, sender_id, media_url`,
        [
          args.messageId,
          args.content,
          type,
          viewStatus,
          args.externalId,
          senderId,
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
             (id, chat_id, sender_id, is_from_customer, external_id, content, type, view_status)
           values ($1, $2, $3, false, $4, $5, $6, $7)
           on conflict (chat_id, external_id) do update
             set view_status = excluded.view_status,
                 content = excluded.content,
                 type = excluded.type,
                 sender_id = excluded.sender_id,
                 updated_at = now()
           returning id, chat_id, content, type, view_status, created_at, external_id, sender_id, media_url`,
          [
            args.messageId,
            args.chatId,
            senderId,
            args.externalId,
            args.content,
            type,
            viewStatus,
          ],
        );
      } else {
        row = await db.oneOrNone<InsertedOutboundMessage>(
          `insert into public.chat_messages
             (chat_id, sender_id, is_from_customer, external_id, content, type, view_status)
           values ($1, $2, false, $3, $4, $5, $6)
           on conflict (chat_id, external_id) do update
             set view_status = excluded.view_status,
                 content = excluded.content,
                 type = excluded.type,
                 sender_id = excluded.sender_id,
                 updated_at = now()
           returning id, chat_id, content, type, view_status, created_at, external_id, sender_id, media_url`,
          [
            args.chatId,
            senderId,
            args.externalId,
            args.content,
            type,
            viewStatus,
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

    await invalidateChatCaches(row.chat_id);
    return { message: row, operation };
  } catch (e) {
    console.error("[DB] insertOutboundMessage error", e);
    throw e;
  }
}
