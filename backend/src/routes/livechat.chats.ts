import express from "express";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { getIO } from "../lib/io.ts";
import { EX_APP, publish } from "../queue/rabbit.ts"; // <??" padroniza ??oqueue???
import { rGet, rSet, rDel, rDelMatch, k } from "../lib/redis.ts";
import { WAHA_PROVIDER } from "../services/waha/client.ts";
import { normalizeMsisdn } from "../util.ts";

const TTL_LIST = Number(process.env.CACHE_TTL_LIST || 5);   // segundos
const TTL_CHAT = Number(process.env.CACHE_TTL_CHAT || 30);
const TTL_MSGS = Number(process.env.CACHE_TTL_MSGS || 5);
const ALLOWED_CHAT_STATUSES = new Set([
  "OPEN",
  "PENDING",
  "CLOSED",
  "ASSIGNED",
  "AI",
  "RESOLVED",
]);

function normalizeSupabaseError(error: any, fallbackMessage = "Unexpected error") {
  let message = error?.message ?? fallbackMessage;
  let details = error?.details ?? undefined;
  let hint = error?.hint ?? undefined;
  let code = error?.code ?? undefined;

  if (typeof message === "string" && message.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(message);
      message = parsed?.message || message;
      details = details ?? parsed?.details ?? undefined;
      hint = hint ?? parsed?.hint ?? undefined;
      code = code ?? parsed?.code ?? undefined;
    } catch {
      // ignore parse errors, keep original message
    }
  }

  return {
    error: message || fallbackMessage,
    details,
    hint,
    code,
  };
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string | null;
      name?: string | null;
      role?: string | null;
      company_id?: string | null;
    }

    interface Request {
      user?: User; // agora req.user existe no tipo
    }
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toUuidArray(arr: any[]): string[] {
  const out: string[] = [];
  for (const v of arr || []) {
    const s =
      typeof v === "string"
        ? v
        : v && typeof v === "object" && typeof v.id === "string"
        ? v.id
        : "";
    if (s && UUID_RE.test(s)) out.push(s);
  }
  return Array.from(new Set(out));
}


export function registerLivechatChatRoutes(app: express.Application) {
  // Listar chats (com cache)
app.get("/livechat/chats", requireAuth, async (req: any, res) => {
  const inboxId = (req.query.inboxId as string) || undefined;
  const rawStatus = (req.query.status as string) || undefined;
  const q = (req.query.q as string) || undefined;
  const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 20;
  const offset = req.query.offset ? Math.max(0, Number(req.query.offset)) : 0;

  try {
    // 1) Normaliza/valida status
    const normalizedStatus = rawStatus ? rawStatus.trim().toUpperCase() : undefined;
    if (
      normalizedStatus &&
      normalizedStatus !== "ALL" &&
      !ALLOWED_CHAT_STATUSES.has(normalizedStatus)
    ) {
      return res.status(400).json({ error: "Status invalido" });
    }
    const statusFilter =
      normalizedStatus && normalizedStatus !== "ALL" ? normalizedStatus : undefined;

    // 2) Descobre company_id do usuário
    const { data: actorRows, error: actorErr } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", req.user.id) // se sua coluna for "id", troque aqui para .eq("id", req.user.id)
      .limit(1);

    if (actorErr) return res.status(500).json({ error: actorErr.message });

    const companyId = ((actorRows as any[])?.[0]?.company_id ?? null) as string | null;
    if (!companyId) return res.status(404).json({ error: "Usuario sem company_id" });
    if (companyId && !req.user?.company_id) (req.user as any).company_id = companyId;

    if (inboxId && !UUID_RE.test(inboxId)) {
      return res.status(400).json({ error: "Inbox invalida" });
    }

    const cacheKey = k.list(companyId, inboxId, statusFilter, q, offset, limit);
    const cached = await rGet<{ items: any[]; total: number }>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    console.log("[livechat] list query", {
      companyId,
      inboxId,
      statusFilter,
      q,
      offset,
      limit,
    });

    let query = supabaseAdmin
      .from("chats")
      .select(
        `
          id,
          kind,
          remote_id,
          group_name,
          group_avatar_url,
          external_id,
          status,
          last_message,
          last_message_at,
          inbox_id,
          customer_id,
          created_at,
          updated_at,
          assignee_agent,
          inbox:inboxes!inner(id, company_id)
        `,
        { count: "exact" },
      )
      .eq("inbox.company_id", companyId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });

    if (inboxId) {
      const { data: inboxCheck, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id")
        .eq("id", inboxId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (inboxErr) return res.status(500).json({ error: inboxErr.message });
      if (!inboxCheck) return res.status(404).json({ error: "Inbox nao encontrada" });
      query = query.eq("inbox_id", inboxId);
    }

    if (statusFilter) query = query.eq("status", statusFilter);

    if (q && q.trim()) {
      const term = q.trim();
      query = query.or(`last_message.ilike.%${term}%,external_id.ilike.%${term}%`);
    }

    const { data, error, count } = await query.range(
      offset,
      offset + Math.max(0, limit - 1),
    );

    if (error) {
      try {
        console.error("[livechat] list range raw error", error);
        console.error(
          "[livechat] list range raw error JSON",
          JSON.stringify(error, null, 2),
        );
      } catch {
        console.error("[livechat] list range raw error (string)", String(error));
      }
      const parsedError = normalizeSupabaseError(error);
      console.error("[livechat] list range error", parsedError);
      return res.status(500).json(parsedError);
    }

    const rawItems = (data || []) as any[];
    const items = rawItems.map((row: any) => {
      if (row?.inbox) delete row.inbox;
      return row;
    });

    // 8) Enriquecimento: agente atribuído
    try {
      const linkIds = toUuidArray(items.map((c: any) => c.assignee_agent));
      if (linkIds.length > 0) {
        const { data: links } = await supabaseAdmin
          .from("inbox_users")
          .select("id, user_id")
          .in("id", linkIds);

        const userIdByLink: Record<string, string> = {};
        for (const r of (links as any[]) || []) {
          const lid = (r as any).id;
          const uid = (r as any).user_id;
          if (UUID_RE.test(lid) && UUID_RE.test(uid)) {
            userIdByLink[lid] = uid;
          }
        }

        const userIds = toUuidArray(Object.values(userIdByLink));
        let usersById: Record<string, { name: string | null; avatar: string | null }> = {};
        if (userIds.length > 0) {
          const { data: usersRows } = await supabaseAdmin
            .from("users")
            .select("id, name, avatar")
            .in("id", userIds);
          usersById = Object.fromEntries(
            ((usersRows as any[]) || []).map((row: any) => [
              row.id,
              { name: row?.name || row?.id, avatar: row?.avatar || null },
            ]),
          );
        }

        for (const chat of items as any[]) {
          const linkId = chat.assignee_agent || null;
          const userId = linkId ? userIdByLink[linkId] : null;
          chat.assigned_agent_id = linkId;
          chat.assigned_agent_user_id = userId || null;
          chat.assigned_agent_name = userId ? usersById[userId]?.name || null : null;
          chat.assigned_agent_avatar_url = userId ? usersById[userId]?.avatar || null : null;
        }
      }
    } catch (err) {
      console.warn("[livechat] enrich agents skipped:", String(err));
    }

    // 9) Enriquecimento: display do cliente
    try {
      const customerIds = toUuidArray(items.map((c: any) => c.customer_id));
      if (customerIds.length > 0) {
        const displayById: Record<
          string,
          { name: string | null; phone: string | null; avatar: string | null }
        > = {};

        async function loadDisplay(table: string, cols: string[]) {
          const selectCols = ["id", ...cols].join(",");
          let rows: any[] = [];
          const { data: attempt, error: attemptErr } = await supabaseAdmin
            .from(table)
            .select(selectCols)
            .in("id", customerIds);
          if (attemptErr) {
            const { data: fallback, error: fallbackErr } = await supabaseAdmin
              .from(table)
              .select("*")
              .in("id", customerIds);
            if (!fallbackErr) rows = (fallback as any[]) || [];
          } else {
            rows = (attempt as any[]) || [];
          }
          for (const row of rows) {
            const name = row?.name || row?.title || null;
            const phone =
              row?.phone ||
              row?.cellphone ||
              row?.celular ||
              row?.telefone ||
              row?.contact ||
              null;
            const avatar =
              row?.avatar_url ||
              row?.avatar ||
              row?.profile_pic_url ||
              row?.photo ||
              null;
            displayById[row.id] = { name, phone, avatar };
          }
        }

        await loadDisplay("customers", [
          "name",
          "phone",
          "cellphone",
          "contact",
          "avatar_url",
          "avatar",
        ]).catch(() => {});
        await loadDisplay("customers", [
          "name",
          "celular",
          "telefone",
          "contact",
          "avatar_url",
          "avatar",
        ]).catch(() => {});
        await loadDisplay("leads", ["name", "phone", "cellphone"]).catch(() => {});

        for (const chat of items as any[]) {
          const display = displayById[chat.customer_id];
          chat.customer_name = display?.name || null;
          chat.customer_phone = display?.phone || null;
          chat.customer_avatar_url = display?.avatar || null;
        }
      }
    } catch (err) {
      console.warn("[livechat] enrich customers skipped:", String(err));
    }

    // 10) Último remetente
    try {
      const chatIds = toUuidArray(items.map((c: any) => c.id));
      if (chatIds.length > 0) {
        const { data: messages } = await supabaseAdmin
          .from("chat_messages")
          .select("chat_id, is_from_customer, sender_type, created_at")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: false });

        const lastByChat: Record<string, string> = {};
        for (const row of (messages as any[]) || []) {
          const cid = row.chat_id as string;
          if (lastByChat[cid]) continue;
          const from = (row as any).sender_type || ((row as any).is_from_customer ? "CUSTOMER" : "AGENT");
          lastByChat[cid] = from;
        }
        for (const chat of items as any[]) {
          const cid = chat.id as string;
          if (lastByChat[cid]) chat.last_message_from = lastByChat[cid];
        }
      }
    } catch (err) {
      console.warn("[livechat] enrich last_message_from skipped:", String(err));
    }

    // 11) Enriquecimento: preview da última mídia (media_url e tipo)
    try {
      const chatIds = toUuidArray(items.map((c: any) => c.id));
      if (chatIds.length > 0) {
        const { data: lastMsgs } = await supabaseAdmin
          .from("chat_messages")
          .select("chat_id, content, media_url, type, created_at")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: false });

        const lastFullByChat: Record<string, any> = {};
        for (const row of (lastMsgs as any[]) || []) {
          const cid = row.chat_id as string;
          if (lastFullByChat[cid]) continue; // já temos o mais recente
          lastFullByChat[cid] = row;
        }

        for (const chat of items as any[]) {
          const cid = chat.id as string;
          const r = lastFullByChat[cid];
          chat.last_message_type = r?.type ?? null;
          chat.last_message_media_url = r?.media_url ?? null;

          // opcional: se o último conteúdo for vazio mas tiver mídia, gere um fallback para busca
          if (!chat.last_message && r?.media_url) {
            chat.last_message = `[${(r?.type || "MEDIA").toString().toUpperCase()}]`;
          }
        }
      }
    } catch (err) {
      console.warn("[livechat] enrich last media skipped:", String(err));
    }

    // 12) Cacheia e responde
    const payload = { items, total: count ?? 0 };
    await rSet(cacheKey, payload, TTL_LIST);
    try {
      await Promise.all(
        items
          .filter((chat: any) => chat?.id && UUID_RE.test(String(chat.id)))
          .map((chat: any) => rSet(k.chat(chat.id), chat, TTL_CHAT)),
      );
    } catch (cacheErr) {
      console.warn("[livechat] chat cache populate failed:", cacheErr);
    }
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  } catch (e: any) {
    const parsedError = normalizeSupabaseError(e, "chat list error");
    console.error("[livechat] list error", parsedError);
    return res.status(500).json(parsedError);
  }
});



  app.post("/livechat/messages", requireAuth, async (req: any, res) => {
    const { chatId, text, senderType = "AGENT" } = req.body || {};
    if (!chatId || !text) {
      return res.status(400).json({ error: "chatId e text obrigatorios" });
    }

    try {
      let senderSupabaseId: string | null = null;
      let actorCompanyId: string | null =
        (req.user?.company_id as string | null) || null;
      try {
        const { data: urow } = await supabaseAdmin
          .from("users")
          .select("id, company_id")
          .eq("user_id", req.user.id)
          .maybeSingle();
        senderSupabaseId = (urow as any)?.id || null;
        const companyFromUser = (urow as any)?.company_id || null;
        if (!actorCompanyId && companyFromUser) {
          actorCompanyId = companyFromUser;
          if (req.user) (req.user as any).company_id = companyFromUser;
        }
      } catch {}

      const { data: chatRow, error: chatErr } = await supabaseAdmin
        .from("chats")
        .select("id, inbox_id, customer_id, external_id")
        .eq("id", chatId)
        .maybeSingle();
      if (chatErr) return res.status(500).json({ error: chatErr.message });
      if (!chatRow?.inbox_id) return res.status(404).json({ error: "Inbox do chat nao encontrada" });

      const inboxId = String(chatRow.inbox_id);
      const { data: inboxRow, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider, company_id")
        .eq("id", inboxId)
        .maybeSingle();
      if (inboxErr) return res.status(500).json({ error: inboxErr.message });
      if (!inboxRow) {
        return res.status(404).json({ error: "Inbox nao encontrada" });
      }

      const provider = String((inboxRow as any)?.provider || "").toUpperCase();
      const isWahaProvider = provider === WAHA_PROVIDER;
      const companyId =
        actorCompanyId || (inboxRow as any)?.company_id || req.user?.company_id || null;

      if (isWahaProvider && (!companyId || typeof companyId !== "string")) {
        return res.status(400).json({ error: "companyId ausente para inbox WAHA" });
      }

      let customerPhone: string | null = null;
      if (chatRow.customer_id) {
        try {
          const { data: customerRow } = await supabaseAdmin
            .from("customers")
            .select("phone, cellphone, celular, telefone, contact")
            .eq("id", chatRow.customer_id)
            .maybeSingle();
          customerPhone =
            (customerRow as any)?.phone ||
            (customerRow as any)?.cellphone ||
            (customerRow as any)?.celular ||
            (customerRow as any)?.telefone ||
            (customerRow as any)?.contact ||
            null;
        } catch {}
      }

      let wahaRecipient: string | null = null;
      if (isWahaProvider) {
        const digits = normalizeMsisdn(customerPhone || "");
        if (digits) {
          wahaRecipient = `${digits}@c.us`;
        } else if (
          typeof (chatRow as any)?.external_id === "string" &&
          (chatRow as any).external_id.trim()
        ) {
          wahaRecipient = (chatRow as any).external_id.trim();
        }
      }

      const nowIso = new Date().toISOString();
      const isFromCustomer = String(senderType).toUpperCase() === "CUSTOMER";

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("chat_messages")
        .insert([
          {
            chat_id: chatId,
            content: String(text),
            type: "TEXT",
            is_from_customer: isFromCustomer,
            sender_id: senderSupabaseId,
            created_at: nowIso,
            view_status: "Pending",
          },
        ])
        .select(
          "id, chat_id, content, is_from_customer, sender_id, created_at, view_status, type",
        )
        .single();
      if (insErr) return res.status(500).json({ error: insErr.message });

      await supabaseAdmin
        .from("chats")
        .update({ last_message: String(text), last_message_at: nowIso })
        .eq("id", chatId);

      await rDel(k.chat(chatId));
      await rDelMatch(k.msgsPrefix(chatId));
      await rDelMatch(k.listPrefixCompany(req.user?.company_id));

      const io = getIO();
      if (io) {
        const mapped = {
          id: inserted.id,
          chat_id: inserted.chat_id,
          body: inserted.content,
          sender_type: inserted.is_from_customer ? "CUSTOMER" : "AGENT",
          sender_id: inserted.sender_id || null,
          created_at: inserted.created_at,
          view_status: inserted.view_status || "Pending",
          type: inserted.type || "TEXT",
          is_private: false,
        };
        io.to(`chat:${chatId}`).emit("message:new", mapped);
      }

      if (isWahaProvider) {
        const safeCompanyId = companyId as string;
        const payload: Record<string, any> = {
          type: "text",
          content: String(text),
          draftId: inserted.id,
        };
        if (wahaRecipient) payload.to = wahaRecipient;
        await publish(EX_APP, "outbound.request", {
          jobType: "outbound.request",
          provider: WAHA_PROVIDER,
          companyId: safeCompanyId,
          inboxId,
          chatId,
          customerId: chatRow.customer_id,
          messageId: inserted.id,
          payload,
          attempt: 0,
          createdAt: nowIso,
          senderUserSupabaseId: senderSupabaseId,
        });
      } else {
        await publish(EX_APP, "outbound.request", {
          jobType: "message.send",
          kind: "send-text",
          provider: "META",
          chatId,
          inboxId: chatRow.inbox_id,
          customerId: chatRow.customer_id,
          messageId: inserted.id,
          content: String(text),
          attempt: 0,
          createdAt: nowIso,
          senderUserSupabaseId: senderSupabaseId,
        });
      }

      return res.status(201).json({ ok: true, data: inserted });
    } catch (e: any) {
      console.error("[livechat:send] error (service route)", e);
      return res.status(500).json({ error: e?.message || "send error" });
    }
  });

  app.post("/livechat/chats", requireAuth, async (req, res) => {
    const { inboxId, customerId, externalId, initialMessage } = req.body || {};
    if (!inboxId || !customerId) {
      return res.status(400).json({ error: "inboxId e customerId sao obrigatorios" });
    }

    const payload: any = {
      inbox_id: inboxId,
      customer_id: customerId,
      external_id: externalId || null,
      status: "OPEN",
    };

    const { data: chat, error: errUpsert } = await supabaseAdmin
      .from("chats")
      .upsert(payload, { onConflict: "inbox_id,customer_id" })
      .select("*")
      .single();

    if (errUpsert) return res.status(500).json({ error: errUpsert.message });

    await rDel(k.chat(chat.id));
    await rDelMatch(k.msgsPrefix(chat.id));
    await rDelMatch(k.listPrefixCompany(req.user?.company_id));

    if (initialMessage) {
      const nowIso = new Date().toISOString();
      const { error: errMsg } = await supabaseAdmin
        .from("chat_messages")
        .insert([{
          chat_id: chat.id,
          content: String(initialMessage),
          type: "TEXT",
          is_from_customer: false,
          sender_id: req.user?.id || null,
          created_at: nowIso,
          view_status: "Pending",
        }]);
      if (errMsg) return res.status(500).json({ error: errMsg.message });

      await supabaseAdmin
        .from("chats")
        .update({ last_message: String(initialMessage), last_message_at: nowIso })
        .eq("id", chat.id);

      await rDel(k.chat(chat.id));
      await rDelMatch(k.msgsPrefix(chat.id));

      await publish(EX_APP, "outbound.request", {
        jobType: "message.send",
        kind: "send-text",
        provider: "META",
        chatId: chat.id,
        inboxId,
        customerId,
        messageId: null,
        content: String(initialMessage),
        attempt: 0,
        createdAt: nowIso,
      });
    }

    return res.status(201).json(chat);
  });

  // Detalhar chat (com cache)
  app.get("/livechat/chats/:id", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };

    const cacheKey = k.chat(id);
    const cached = await rGet<any>(cacheKey);
    if (cached) return res.json(cached);

    const { data, error } = await supabaseAdmin
      .from("chats")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Chat nao encontrado" });

    await rSet(cacheKey, data, TTL_CHAT);
    return res.json(data);
  });

  // Atualizar status (invalida chat + listas)
  app.put("/livechat/chats/:id/status", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: "status obrigatorio" });

    const { data, error } = await supabaseAdmin
      .from("chats")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await rDel(k.chat(id));
    await rDelMatch(k.listPrefixCompany(req.user?.company_id));

    return res.json(data);
  });

  // Listar mensagens (publicas + privadas) com cache
  app.get("/livechat/chats/:id/messages", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 20;
    const before = (req.query.before as string) || undefined;

    const cacheKey = k.msgsKey(id, before, limit);
    const cached = await rGet<any[]>(cacheKey);
    if (cached) {
      const nextBeforeCached = cached.length > 0 ? cached[0].created_at : "";
      res.setHeader("X-Next-Before", cached.length < limit ? "" : nextBeforeCached);
      return res.json(cached);
    }

    try {
      let pubQuery = supabaseAdmin
        .from("chat_messages")
        .select(
          "id, chat_id, content, is_from_customer, sender_id, created_at, type, view_status, media_url, remote_participant_id, remote_sender_id, remote_sender_name, remote_sender_phone, remote_sender_avatar_url, remote_sender_is_admin, replied_message_id",
        )
        .eq("chat_id", id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (before) pubQuery = pubQuery.lt("created_at", before);

      const { data: pubRows, error: pubErr } = await pubQuery;
      if (pubErr && (pubErr as any).code === "42P01") {
        res.setHeader("X-Next-Before", "");
        return res.json([]);
      }
      if (pubErr) return res.status(500).json({ error: pubErr.message });

      const mappedPub = (pubRows || []).map((row: any) => ({
        id: row.id,
        chat_id: row.chat_id,
        body: row.content,
        sender_type: row.is_from_customer ? "CUSTOMER" : "AGENT",
        sender_id: row.sender_id || null,
        created_at: row.created_at,
        view_status: row.view_status || null,
        type: row.type || "TEXT",
        is_private: false,
        media_url: row.media_url ?? null,
        remote_participant_id: row.remote_participant_id ?? null,
        remote_sender_id: row.remote_sender_id ?? null,
        remote_sender_name: row.remote_sender_name ?? null,
        remote_sender_phone: row.remote_sender_phone ?? null,
        remote_sender_avatar_url: row.remote_sender_avatar_url ?? null,
        remote_sender_is_admin: row.remote_sender_is_admin ?? null,
        replied_message_id: row.replied_message_id ?? null,
      }));

      let mappedPrivate: any[] = [];
      try {
        const { data: privChat } = await supabaseAdmin
          .from("private_chats")
          .select("id")
          .eq("chat_id", id)
          .maybeSingle();

        if (privChat?.id) {
          const { data: privMsgs } = await supabaseAdmin
            .from("private_messages")
            .select("id, content, private_chat_id, sender_id, created_at, media_url")
            .eq("private_chat_id", privChat.id)
            .order("created_at", { ascending: true });

          const senderIds = Array.from(
            new Set((privMsgs || []).map((row: any) => row.sender_id).filter(Boolean)),
          );
          const names: Record<string, string> = {};
          if (senderIds.length > 0) {
            const { data: usersList } = await supabaseAdmin
              .from("users")
              .select("id, name")
              .in("id", senderIds);
            for (const user of usersList || []) {
              names[(user as any).id] = (user as any).name || (user as any).id;
            }
          }

          mappedPrivate = (privMsgs || []).map((row: any) => ({
            id: row.id,
            chat_id: id,
            body: row.content,
            sender_type: "AGENT",
            sender_id: row.sender_id || null,
            created_at: row.created_at,
            view_status: null,
            type: "PRIVATE",
            is_private: true,
            sender_name: row.sender_id ? names[row.sender_id] || null : null,
            media_url: row.media_url ?? null,
          }));
        }
      } catch { }

      const pubAsc = [...mappedPub].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const combined = [...pubAsc, ...mappedPrivate].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      await rSet(cacheKey, combined, TTL_MSGS);

      const nextBefore = pubAsc.length > 0 ? pubAsc[0].created_at : "";
      res.setHeader("X-Next-Before", pubAsc.length < limit ? "" : nextBefore);

      return res.json(combined);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "messages error" });
    }
  });
  // Enviar mensagem (AGENTE/CLIENTE) — invalida mensagens/listas/chat
  app.post("/livechat/chats/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const { id: chatId } = req.params as { id: string };
      const { text, senderType = "AGENT" } = req.body || {};
      if (!text) return res.status(400).json({ error: "text obrigatorio" });

      const { data: chat, error: chatErr } = await supabaseAdmin
        .from("chats")
        .select("id, inbox_id, customer_id")
        .eq("id", chatId)
        .maybeSingle();
      if (chatErr) return res.status(500).json({ error: chatErr.message });
      if (!chat) return res.status(404).json({ error: "Chat not found" });

      const isFromCustomer = String(senderType).toUpperCase() === "CUSTOMER";
      const nowIso = new Date().toISOString();

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("chat_messages")
        .insert([{
          chat_id: chatId,
          content: String(text),
          type: "TEXT",
          is_from_customer: isFromCustomer,
          sender_id: req.user?.id || null,
          created_at: nowIso,
          view_status: "Pending",
        }])
        .select("id, chat_id, content, is_from_customer, sender_id, created_at, view_status, type")
        .single();
      if (insErr) return res.status(500).json({ error: insErr.message });

      await supabaseAdmin
        .from("chats")
        .update({ last_message: String(text), last_message_at: nowIso })
        .eq("id", chatId);

      // invalida caches relacionados
      await rDel(k.chat(chatId));
      await rDelMatch(k.msgsPrefix(chatId));
      await rDelMatch(k.listPrefixCompany(req.user?.company_id));

      const io = getIO();
      if (io) {
        const mapped = {
          id: inserted.id,
          chat_id: inserted.chat_id,
          body: inserted.content,
          sender_type: inserted.is_from_customer ? "CUSTOMER" : "AGENT",
          sender_id: inserted.sender_id || null,
          created_at: inserted.created_at,
          view_status: inserted.view_status || "Pending",
          type: inserted.type || "TEXT",
          is_private: false,
        };
        io.to(`chat:${chatId}`).emit("message:new", mapped);
        io.emit("chat:updated", {
          chatId,
          inboxId: (chat as any).inbox_id,
          last_message: String(text),
          last_message_at: nowIso,
          last_message_from: mapped.sender_type,
        });
      }

      // Se for AGENTE -> manda para a fila outbound
      if (!isFromCustomer) {
        await publish(EX_APP, "outbound.request", {
          jobType: "message.send",
          kind: "send-text",
          provider: "META",
          chatId,
          inboxId: (chat as any).inbox_id,
          customerId: (chat as any).customer_id,
          messageId: inserted.id,
          content: String(text),
          attempt: 0,
          createdAt: nowIso,
        });
      }

      return res.status(201).json({ ok: true, data: inserted });
    } catch (e: any) {
      console.error("[livechat:send] error", e);
      return res.status(500).json({ error: e?.message || "send error" });
    }
  });

  // Enviar arquivo (base64) — invalida mensagens/listas/chat
  app.post("/livechat/chats/:id/messages/file", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    const { filename, mime, data } = (req.body || {}) as { filename?: string; mime?: string; data?: string };
    if (!filename || !data) return res.status(400).json({ error: "filename e data obrigatorios" });
    const contentType = mime || "application/octet-stream";

    try {
      const buffer = Buffer.from(
        String(data).replace(/^data:[^;]+;base64,/, ""),
        "base64"
      );
      const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
      const path = `${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      try {
        await (supabaseAdmin as any).storage.createBucket("chat-uploads", { public: true });
      } catch { }

      const { data: up, error: upErr } = await supabaseAdmin
        .storage
        .from("chat-uploads")
        .upload(path, buffer, { contentType, upsert: false });
      if (upErr) return res.status(500).json({ error: upErr.message });

      const pub = supabaseAdmin.storage.from("chat-uploads").getPublicUrl(up!.path);
      const url = (pub as any)?.data?.publicUrl || null;

      const nowIso = new Date().toISOString();
      const kind = contentType.startsWith("image/")
        ? "IMAGE"
        : contentType.startsWith("audio/")
          ? "AUDIO"
          : "FILE";

      const { data: inserted, error } = await supabaseAdmin
        .from("chat_messages")
        .insert([{
          chat_id: id,
          content: String(url || filename),
          type: kind,
          is_from_customer: false,
          sender_id: req.user?.id || null,
          created_at: nowIso,
          view_status: "Sent",
        }])
        .select("id, chat_id, content, is_from_customer, sender_id, created_at, view_status, type")
        .single();
      if (error) return res.status(500).json({ error: error.message });

      await supabaseAdmin
        .from("chats")
        .update({ last_message: `[Arquivo] ${filename}`, last_message_at: nowIso })
        .eq("id", id);

      // invalida caches
      await rDel(k.chat(id));
      await rDelMatch(k.msgsPrefix(id));
      await rDelMatch(k.listPrefixCompany(req.user?.company_id));

      const mapped = {
        id: inserted.id,
        chat_id: inserted.chat_id,
        body: inserted.content,
        sender_type: inserted.is_from_customer ? "CUSTOMER" : "AGENT",
        sender_id: inserted.sender_id || null,
        created_at: inserted.created_at,
        view_status: inserted.view_status || null,
        type: inserted.type || kind,
        is_private: false,
      };

      const io = getIO();
      io?.to(`chat:${id}`).emit("message:new", mapped);
      io?.emit("chat:updated", {
        chatId: id,
        last_message: `[Arquivo] ${filename}`,
        last_message_at: nowIso,
        last_message_from: mapped.sender_type,
      });

      return res.status(201).json(mapped);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "upload error" });
    }
  });

  // Mensagens privadas - listar (mantive sem cache para simplificar)
  app.get("/livechat/chats/:id/private/messages", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    try {
      const { data: privChat, error: errPc } = await supabaseAdmin
        .from("private_chats")
        .select("id")
        .eq("chat_id", id)
        .maybeSingle();
      if (errPc) return res.status(500).json({ error: errPc.message });
      if (!privChat?.id) return res.json([]);

      const { data, error } = await supabaseAdmin
        .from("private_messages")
        .select("id, content, sender_id, created_at, media_url")
        .eq("private_chat_id", privChat.id)
        .order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });

      const senderIds = Array.from(
        new Set((data || []).map((r: any) => r.sender_id).filter(Boolean))
      );
      let nameMap: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: usersList } = await supabaseAdmin
          .from("users")
          .select("id, name")
          .in("id", senderIds);
        for (const u of usersList || [])
          nameMap[(u as any).id] = (u as any).name || (u as any).id;
      }

      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        chat_id: id,
        body: r.content,
        sender_type: "AGENT",
        sender_id: r.sender_id || null,
        created_at: r.created_at,
        view_status: null,
        type: "PRIVATE",
        is_private: true,
        sender_name: r.sender_id ? nameMap[r.sender_id] || null : null,
        media_url: r.media_url ?? null,
      }));

      return res.json(mapped);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "private list error" });
    }
  });

  // Mensagens privadas - enviar (invalida msgs privadas do chat)
  app.post("/livechat/chats/:id/private/messages", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    const { text } = (req.body || {}) as { text?: string };
    if (!text) return res.status(400).json({ error: "text obrigatorio" });

    try {
      let localUserId: string | null = null;
      try {
        const { data: urow } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("user_id", req.user.id)
          .maybeSingle();
        localUserId = (urow as any)?.id || null;
      } catch { }

      let privateChatId: string | null = null;
      const { data: existing } = await supabaseAdmin
        .from("private_chats")
        .select("id")
        .eq("chat_id", id)
        .maybeSingle();
      if (existing?.id) privateChatId = existing.id;
      else {
        const { data: created, error: errCreate } = await supabaseAdmin
          .from("private_chats")
          .insert([{ chat_id: id, is_active: true }])
          .select("id")
          .single();
        if (errCreate) return res.status(500).json({ error: errCreate.message });
        privateChatId = (created as any)?.id || null;
      }
      if (!privateChatId) return res.status(500).json({ error: "Falha ao criar private_chat" });

      const nowIso = new Date().toISOString();
      const { data: inserted, error } = await supabaseAdmin
        .from("private_messages")
        .insert([{
          content: String(text),
          private_chat_id: privateChatId,
          sender_id: localUserId || req.user.id,
          created_at: nowIso,
        }])
        .select("id, content, sender_id, created_at")
        .single();
      if (error) return res.status(500).json({ error: error.message });

      // limpa caches de mensagens públicas NÃO é necessário; mas se você optar por cachear privadas, limpe aqui
      // await rDelMatch(`lc:privmsgs:${id}:*`) // exemplo se existir

      let senderName: string | null = null;
      if (localUserId) {
        try {
          const { data: u } = await supabaseAdmin
            .from("users")
            .select("name")
            .eq("id", localUserId)
            .maybeSingle();
          senderName = (u as any)?.name || null;
        } catch { }
      }

      const mapped = {
        id: inserted.id,
        chat_id: id,
        body: inserted.content,
        sender_type: "AGENT",
        sender_id: inserted.sender_id || null,
        created_at: inserted.created_at,
        view_status: null,
        type: "PRIVATE",
        is_private: true,
        sender_name: senderName,
      };
      getIO()?.to(`chat:${id}`).emit("message:new", mapped);

      return res.status(201).json(mapped);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "private send error" });
    }
  });

  // Participantes
  app.post("/livechat/chats/:id/participants", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId obrigatorio" });

    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("chat_participants")
      .upsert(
        [{ chat_id: id, user_id: userId, is_active: true, left_at: null, joined_at: nowIso }],
        { onConflict: "chat_id,user_id" }
      )
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  });

  app.delete("/livechat/chats/:id/participants/:userId", requireAuth, async (req, res) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const { error } = await supabaseAdmin
      .from("chat_participants")
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq("chat_id", id)
      .eq("user_id", userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  });

  app.get("/livechat/chats/:id/participants", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("chat_participants")
        .select("user_id, joined_at, left_at, is_active")
        .eq("chat_id", id);
      if (error) return res.status(500).json({ error: error.message });

      const uids = Array.from(
        new Set((rows || []).map((r: any) => r.user_id).filter(Boolean))
      );

      let usersMap: Record<
        string,
        { name: string | null; role: string | null; user_id: string | null }
      > = {};

      if (uids.length > 0) {
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id, user_id, name, role")
          .in("id", uids);

        for (const u of (users || [])) {
          usersMap[(u as any).id] = {
            name: (u as any).name || (u as any).id,
            role: (u as any).role || null,
            user_id: (u as any).user_id || null,
          };
        }
      }

      const list = (rows || []).map((r: any) => ({
        id: r.user_id,
        name: usersMap[r.user_id]?.name || r.user_id,
        role: usersMap[r.user_id]?.role || null,
        is_current: usersMap[r.user_id]?.user_id === req.user.id,
      }));

      return res.json(list);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "participants error" });
    }
  });
}
