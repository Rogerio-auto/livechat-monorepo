import { Response } from "express";
import { AuthRequest } from "../types/express.js";
import { z } from "zod";
import db from "../pg.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { rDel, k, clearMessageCache, redis } from "../lib/redis.js";
import { getBoardIdForCompany } from "../services/meta/store.service.js";

export class LivechatController {
  // GET /livechat/inboxes/:id/agents
  static async getInboxAgents(req: AuthRequest, res: Response) {
    try {
      const inboxId = String(req.params?.id || "").trim();
      if (!inboxId) return res.status(400).json({ error: "inboxId ausente" });
      if (!/^[0-9a-f-]{32,36}$/i.test(inboxId)) {
        return res.status(400).json({ error: "inboxId inválido" });
      }

      const { data: inboxRow, error: errInbox } = await supabaseAdmin
        .from("inboxes")
        .select("id, company_id, is_active, name")
        .eq("id", inboxId)
        .maybeSingle();

      if (errInbox) return res.status(500).json({ error: errInbox.message });
      if (!inboxRow) return res.status(404).json({ error: "Inbox não encontrada" });
      if (inboxRow.is_active === false) {
        return res.status(403).json({ error: "Inbox inativa" });
      }

      const authUserId = req.user?.id;
      let localUserId: string | null = null;
      let userCompanyId: string | null = null;

      const { data: uByExt } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", authUserId)
        .maybeSingle();

      if (uByExt?.id) {
        localUserId = uByExt.id;
        userCompanyId = uByExt.company_id || null;
      } else {
        const { data: uByLocal } = await supabaseAdmin
          .from("users")
          .select("id, company_id")
          .eq("id", authUserId)
          .maybeSingle();
        if (uByLocal?.id) {
          localUserId = uByLocal.id;
          userCompanyId = uByLocal.company_id || null;
        }
      }

      let allowed = false;
      if (localUserId) {
        const { data: myLink } = await supabaseAdmin
          .from("inbox_users")
          .select("id")
          .eq("inbox_id", inboxId)
          .eq("user_id", localUserId)
          .maybeSingle();
        allowed = !!myLink;
      }

      if (!allowed && userCompanyId && userCompanyId === inboxRow.company_id) {
        allowed = true;
      }

      if (!allowed) {
        return res.status(403).json({ error: "Sem acesso a esta inbox" });
      }

      const { data: links, error: errLinks } = await supabaseAdmin
        .from("inbox_users")
        .select("id, user_id")
        .eq("inbox_id", inboxId);
      if (errLinks) return res.status(500).json({ error: errLinks.message });

      const userIds = Array.from(new Set((links || []).map((r: any) => r.user_id).filter(Boolean)));
      let users: any[] = [];
      if (userIds.length > 0) {
        const { data: rows, error: errUsers } = await supabaseAdmin
          .from("users")
          .select("id, user_id, name, role, avatar")
          .in("id", userIds)
          .order("name", { ascending: true });
        if (errUsers) return res.status(500).json({ error: errUsers.message });
        users = rows || [];
      }

      const byId: Record<string, any> = Object.fromEntries(users.map((u: any) => [u.id, u]));
      const result = (links || []).map((link: any) => {
        const u = byId[link.user_id] || {};
        return {
          id: link.id,
          user_id: u.id || link.user_id,
          name: u.name || u.id || null,
          role: u.role || null,
          avatar: u.avatar || null,
        };
      });

      return res.json({ ok: true, inbox: { id: inboxRow.id, name: inboxRow.name }, data: result });
    } catch (e: any) {
      console.error("[LivechatController.getInboxAgents] error:", e);
      return res.status(500).json({ error: e?.message || "agents error" });
    }
  }

  // PUT /livechat/chats/:id/assignee
  static async assignChat(req: AuthRequest, res: Response) {
    try {
      const chatId = String(req.params.id);
      const { linkId: linkIdParam, userId: userIdParam, unassign } = req.body || {};
      const io = req.app?.locals?.io;

      const { data: chat, error: errChat } = await supabaseAdmin
        .from("chats")
        .select("id, inbox_id")
        .eq("id", chatId)
        .maybeSingle();
      if (errChat) return res.status(500).json({ error: errChat.message });
      if (!chat) return res.status(404).json({ error: "Chat não encontrado" });

      const authUserId = req.user?.id;
      let actingLocalUserId: string | null = null;

      const { data: uExt } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uExt?.id) actingLocalUserId = uExt.id;

      if (!actingLocalUserId) {
        const { data: uLoc } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("id", authUserId)
          .maybeSingle();
        if (uLoc?.id) actingLocalUserId = uLoc.id;
      }

      if (actingLocalUserId) {
        const { data: linkAct } = await supabaseAdmin
          .from("inbox_users")
          .select("can_write, can_manage")
          .eq("inbox_id", (chat as any).inbox_id)
          .eq("user_id", actingLocalUserId)
          .maybeSingle();
        if (!linkAct || (!linkAct.can_write && !linkAct.can_manage)) {
          return res.status(403).json({ error: "Sem permissão para atribuir nesta inbox" });
        }
      }

      const getActorName = async () => {
        if (!actingLocalUserId) return "Alguém";
        const { data: u } = await supabaseAdmin
          .from("users")
          .select("name")
          .eq("id", actingLocalUserId)
          .maybeSingle();
        return u?.name || "Alguém";
      };

      if (unassign === true) {
        const { error: errUpd } = await supabaseAdmin
          .from("chats")
          .update({ assignee_agent: null })
          .eq("id", chatId);
        if (errUpd) return res.status(500).json({ error: errUpd.message });

        const actorName = await getActorName();
        const { data: insertedMsg, error: insertError } = await supabaseAdmin.from("chat_messages").insert({
          chat_id: chatId,
          content: `${actorName} removeu a atribuição`,
          type: "SYSTEM",
          is_from_customer: false,
          created_at: new Date().toISOString(),
        }).select().single();

        try {
          io?.emit("chat:updated", {
            chatId,
            assigned_agent_id: null,
            assigned_agent_name: null,
          });
          if (insertedMsg) {
            io?.to(`chat:${chatId}`).emit("message:new", {
                id: insertedMsg.id,
                chat_id: chatId,
                content: `${actorName} removeu a atribuição`,
                type: "SYSTEM",
                sender_type: "SYSTEM",
                created_at: insertedMsg.created_at,
            });
          }
        } catch (e) {
          console.error("[assignChat] Socket emit error:", e);
        }

        await rDel(k.chat(chatId));
        await clearMessageCache(chatId);
        const companyId = req.user?.company_id;
        if (companyId) {
          const pattern = k.listPrefixCompany(companyId);
          const keys = await redis.keys(pattern);
          if (keys.length > 0) await redis.del(...keys);
        }

        return res.json({ ok: true, assigned_agent_id: null, assigned_agent_name: null });
      }

      let targetLinkId: string | null = null;
      if (linkIdParam) {
        const { data: linkRow } = await supabaseAdmin
          .from("inbox_users")
          .select("id, user_id, inbox_id")
          .eq("id", String(linkIdParam))
          .maybeSingle();
        if (!linkRow) return res.status(404).json({ error: "Link não encontrado" });
        if (linkRow.inbox_id !== (chat as any).inbox_id)
          return res.status(400).json({ error: "Link não pertence à inbox do chat" });
        targetLinkId = linkRow.id;
      } else if (userIdParam) {
        let localUserId: string | null = null;
        const { data: u1 } = await supabaseAdmin.from("users").select("id").eq("id", String(userIdParam)).maybeSingle();
        if (u1?.id) localUserId = u1.id;
        if (!localUserId) {
          const { data: u2 } = await supabaseAdmin.from("users").select("id").eq("user_id", String(userIdParam)).maybeSingle();
          if (u2?.id) localUserId = u2.id;
        }
        if (!localUserId) return res.status(404).json({ error: "Usuário alvo não encontrado" });
        const { data: linkRow } = await supabaseAdmin
          .from("inbox_users")
          .select("id")
          .eq("inbox_id", (chat as any).inbox_id)
          .eq("user_id", localUserId)
          .maybeSingle();
        if (!linkRow) return res.status(400).json({ error: "Usuário não vinculado a esta inbox" });
        targetLinkId = linkRow.id;
      } else {
        return res.status(400).json({ error: "linkId ou userId é obrigatório" });
      }

      await supabaseAdmin.from("chats").update({ assignee_agent: targetLinkId }).eq("id", chatId);

      let assignedName: string | null = null;
      try {
        const { data: linkRow } = await supabaseAdmin.from("inbox_users").select("user_id").eq("id", targetLinkId!).maybeSingle();
        if (linkRow?.user_id) {
          const { data: u } = await supabaseAdmin.from("users").select("name").eq("id", linkRow.user_id).maybeSingle();
          assignedName = (u as any)?.name || null;
        }
      } catch {}

      try {
        io?.emit("chat:updated", { chatId, assigned_agent_id: targetLinkId, assigned_agent_name: assignedName });
        const actorName = await getActorName();
        const msgContent = `${actorName} atribuiu a ${assignedName || "um agente"}`;
        const { data: insertedMsg } = await supabaseAdmin.from("chat_messages").insert({
          chat_id: chatId,
          content: msgContent,
          type: "SYSTEM",
          is_from_customer: false,
          created_at: new Date().toISOString(),
        }).select().single();

        if (insertedMsg) {
          io?.to(`chat:${chatId}`).emit("message:new", {
            id: insertedMsg.id,
            chat_id: chatId,
            content: msgContent,
            type: "SYSTEM",
            sender_type: "SYSTEM",
            created_at: insertedMsg.created_at,
          });
        }
      } catch (e) {
        console.error("[assignChat] System message error:", e);
      }

      await rDel(k.chat(chatId));
      await clearMessageCache(chatId);
      const companyId = req.user?.company_id;
      if (companyId) {
        const pattern = k.listPrefixCompany(companyId);
        const keys = await redis.keys(pattern);
        if (keys.length > 0) await redis.del(...keys);
      }

      return res.json({ ok: true, assigned_agent_id: targetLinkId, assigned_agent_name: assignedName });
    } catch (e: any) {
      console.error("[LivechatController.assignChat] error:", e);
      return res.status(500).json({ error: e?.message || "assignee error" });
    }
  }

  // GET /livechat/inboxes/my
  static async getMyInboxes(req: AuthRequest, res: Response) {
    try {
      const authUserId = req.user?.id as string;
      let { data: links, error: errLinks } = await supabaseAdmin
        .from("inbox_users")
        .select("inbox_id")
        .eq("user_id", authUserId);
      if (errLinks) return res.status(500).json({ error: errLinks.message });

      if (!links || links.length === 0) {
        try {
          const { data: urow } = await supabaseAdmin.from("users").select("id").eq("user_id", authUserId).maybeSingle();
          if (urow?.id) {
            const resp2 = await supabaseAdmin.from("inbox_users").select("inbox_id").eq("user_id", urow.id);
            if (!resp2.error) links = resp2.data as any[];
          }
        } catch { }
      }

      const ids = Array.from(new Set((links || []).map((r: any) => r.inbox_id))).filter(Boolean);
      if (ids.length === 0) return res.json([]);

      const { data, error } = await supabaseAdmin
        .from("inboxes")
        .select("id, name, phone_number, is_active, channel, provider, base_url, instance_id, waha_db_name")
        .in("id", ids)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      const rows = (data || []).map((row: any) => ({
        ...row,
        provider: row?.provider ?? "META_CLOUD",
        channel: row?.channel ?? null,
      }));
      return res.json(rows);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "inboxes fetch error" });
    }
  }

  // GET /livechat/inboxes/stats
  static async getInboxesStats(req: AuthRequest, res: Response) {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("company_id, role")
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { data: inboxes, error } = await supabaseAdmin
        .from("inboxes")
        .select("id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, waha_db_name")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });

      const inboxesWithStats = await Promise.all((inboxes || []).map(async (inbox: any) => {
        const { count: totalContacts } = await supabaseAdmin
          .from("chats")
          .select("customer_id", { count: "exact", head: true })
          .eq("inbox_id", inbox.id)
          .not("customer_id", "is", null);

        const { count: activeContacts } = await supabaseAdmin
          .from("chats")
          .select("customer_id", { count: "exact", head: true })
          .eq("inbox_id", inbox.id)
          .not("customer_id", "is", null)
          .or("status.eq.OPEN,status.is.null");

        return {
          ...inbox,
          stats: {
            total_contacts: totalContacts || 0,
            active_contacts: activeContacts || 0,
          }
        };
      }));

      return res.json(inboxesWithStats);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "inboxes stats error" });
    }
  }

  // GET /livechat/inboxes
  static async listInboxes(req: AuthRequest, res: Response) {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("company_id, role")
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { data, error } = await supabaseAdmin
        .from("inboxes")
        .select("id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, waha_db_name")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "inboxes list error" });
    }
  }

  // POST /livechat/inboxes
  static async createInbox(req: AuthRequest, res: Response) {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("company_id, role, id")
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id as string | null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });
      const actorLocalUserId = (urow as any)?.id || null;

      const schema = z.object({
        name: z.string().min(1),
        phone_number: z.string().min(5),
        webhook_url: z.string().url().optional().nullable(),
        channel: z.string().optional().default("WHATSAPP"),
        provider: z.string().optional().default("META_CLOUD"),
        base_url: z.string().url().optional().nullable(),
        api_version: z.string().optional().nullable(),
        phone_number_id: z.string().optional().nullable(),
        waba_id: z.string().optional().nullable(),
        instance_id: z.string().optional().nullable(),
        webhook_verify_token: z.string().optional().nullable(),
        app_secret: z.string().optional().nullable(),
        add_current_as_manager: z.boolean().optional().default(true),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      const b = parsed.data as any;

      const nowIso = new Date().toISOString();
      const insert = {
        name: b.name,
        phone_number: b.phone_number,
        webhook_url: b.webhook_url ?? null,
        channel: b.channel || "WHATSAPP",
        provider: b.provider || "META_CLOUD",
        base_url: b.base_url ?? null,
        api_version: b.api_version ?? null,
        phone_number_id: b.phone_number_id ?? null,
        waba_id: b.waba_id ?? null,
        instance_id: b.instance_id ?? null,
        company_id: companyId,
        created_at: nowIso,
        updated_at: nowIso,
      } as any;

      const { data: inbox, error } = await supabaseAdmin
        .from("inboxes")
        .insert([insert])
        .select("id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, company_id, waha_db_name")
        .single();
      if (error) return res.status(500).json({ error: error.message });

      if (b.webhook_verify_token || b.app_secret) {
        await supabaseAdmin.from("inbox_secrets").upsert([{ inbox_id: (inbox as any).id, access_token: null, refresh_token: null, provider_api_key: null, updated_at: nowIso }], { onConflict: "inbox_id" });
        const patch: any = {};
        if (b.webhook_verify_token !== undefined) patch.webhook_verify_token = b.webhook_verify_token;
        if (b.app_secret !== undefined) patch.app_secret = b.app_secret;
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from("inboxes").update(patch).eq("id", (inbox as any).id);
        }
      }

      if (b.add_current_as_manager && actorLocalUserId) {
        await supabaseAdmin.from("inbox_users").upsert([{ user_id: actorLocalUserId, inbox_id: (inbox as any).id, can_read: true, can_write: true, can_manage: true }], { onConflict: "user_id,inbox_id" });
      }

      req.app?.locals?.io?.emit("inbox:created", { companyId, inbox });
      return res.status(201).json(inbox);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "inbox create error" });
    }
  }

  // PUT /livechat/inboxes/:id
  static async updateInbox(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { data: inbox, error: iErr } = await supabaseAdmin.from("inboxes").select("id, company_id").eq("id", id).maybeSingle();
      if (iErr) return res.status(500).json({ error: iErr.message });
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });

      const { data: urow, error: uerr } = await supabaseAdmin.from("users").select("company_id, role, id").eq("user_id", req.user?.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      if ((urow as any)?.company_id !== (inbox as any).company_id) return res.status(403).json({ error: "Proibido" });

      let allowed = false;
      const role = ((urow as any)?.role || "").toString().toUpperCase();
      if (role && role !== "AGENT") allowed = true;
      if (!allowed) {
        const { data: link } = await supabaseAdmin.from("inbox_users").select("can_manage").eq("inbox_id", id).eq("user_id", (urow as any)?.id).maybeSingle();
        if (link?.can_manage) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: "Sem permissão para editar esta inbox" });

      const schema = z.object({
        name: z.string().min(1).optional(),
        phone_number: z.string().min(5).optional(),
        is_active: z.boolean().optional(),
        webhook_url: z.string().url().optional().nullable(),
        channel: z.string().optional(),
        provider: z.string().optional(),
        base_url: z.string().optional().nullable(),
        api_version: z.string().optional().nullable(),
        phone_number_id: z.string().optional().nullable(),
        waba_id: z.string().optional().nullable(),
        instance_id: z.string().optional().nullable(),
        webhook_verify_token: z.string().optional().nullable(),
        app_secret: z.string().optional().nullable(),
      }).passthrough();

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      const b = parsed.data as any;
      const update: any = {};
      const fields = ["name", "phone_number", "is_active", "webhook_url", "channel", "provider", "base_url", "api_version", "phone_number_id", "waba_id", "instance_id", "webhook_verify_token", "app_secret"];
      for (const k of fields) if (Object.prototype.hasOwnProperty.call(b, k)) update[k] = b[k];
      update.updated_at = new Date().toISOString();
      if (Object.keys(update).length === 1) return res.status(400).json({ error: "Nada para atualizar" });

      const { data: updated, error } = await supabaseAdmin.from("inboxes").update(update).eq("id", id).select("id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, company_id, waha_db_name").single();
      if (error) return res.status(500).json({ error: error.message });

      req.app?.locals?.io?.emit("inbox:updated", { inboxId: id, companyId: (updated as any).company_id, changes: update, inbox: updated });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "inbox update error" });
    }
  }

  // DELETE /livechat/inboxes/:id
  static async deleteInbox(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { data: inbox, error: inboxErr } = await supabaseAdmin.from("inboxes").select("id, company_id").eq("id", id).maybeSingle();
      if (inboxErr) return res.status(500).json({ error: inboxErr.message });
      if (!inbox) return res.status(404).json({ error: "Inbox nao encontrada" });

      const { data: actor, error: actorErr } = await supabaseAdmin.from("users").select("id, role, company_id").eq("user_id", req.user?.id).maybeSingle();
      if (actorErr) return res.status(500).json({ error: actorErr.message });
      if (!actor || (actor as any).company_id !== (inbox as any).company_id) return res.status(403).json({ error: "Proibido" });

      let allowed = false;
      const role = ((actor as any).role || "").toString().toUpperCase();
      if (role && role !== "AGENT") allowed = true;
      if (!allowed) {
        const { data: link } = await supabaseAdmin.from("inbox_users").select("can_manage").eq("inbox_id", id).eq("user_id", (actor as any).id).maybeSingle();
        if (link?.can_manage) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: "Sem permissao para excluir inbox" });

      const { data: chats } = await supabaseAdmin.from("chats").select("id").eq("inbox_id", id);
      const chatIds = (chats || []).map((row: any) => row.id).filter(Boolean);
      if (chatIds.length > 0) {
        const chunk = (arr: any[], size = 100) => {
          const parts: any[][] = [];
          for (let i = 0; i < arr.length; i += size) parts.push(arr.slice(i, i + size));
          return parts;
        };
        for (const part of chunk(chatIds, 100)) {
          try { await supabaseAdmin.from("chat_messages").delete().in("chat_id", part); } catch { }
          try { await supabaseAdmin.from("chat_participants").delete().in("chat_id", part); } catch { }
          try { await supabaseAdmin.from("chat_tags").delete().in("chat_id", part); } catch { }
        }
        try { await supabaseAdmin.from("chats").delete().in("id", chatIds); } catch { }
      }

      try { await supabaseAdmin.from("inbox_users").delete().eq("inbox_id", id); } catch { }
      try { await supabaseAdmin.from("inbox_secrets").delete().eq("inbox_id", id); } catch { }

      const { error: delErr } = await supabaseAdmin.from("inboxes").delete().eq("id", id);
      if (delErr) return res.status(500).json({ error: delErr.message });

      req.app?.locals?.io?.emit("inbox:deleted", { inboxId: id, companyId: (inbox as any).company_id });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "inbox delete error" });
    }
  }

  // POST /livechat/inboxes/:id/users
  static async addInboxAgent(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const schema = z.object({
        userId: z.string().min(1),
        can_read: z.boolean().optional().default(true),
        can_write: z.boolean().optional().default(true),
        can_manage: z.boolean().optional().default(false),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      const b = parsed.data as any;

      const { data: inbox } = await supabaseAdmin.from("inboxes").select("id, company_id").eq("id", id).maybeSingle();
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });

      const { data: actor } = await supabaseAdmin.from("users").select("id, role, company_id").eq("user_id", req.user.id).maybeSingle();
      if (!actor || (actor as any).company_id !== (inbox as any).company_id) return res.status(403).json({ error: "Proibido" });

      const role = ((actor as any).role || "").toString().toUpperCase();
      if (role === "AGENT") {
        const { data: link } = await supabaseAdmin.from("inbox_users").select("can_manage").eq("inbox_id", id).eq("user_id", (actor as any).id).maybeSingle();
        if (!link?.can_manage) return res.status(403).json({ error: "Sem permissão para gerenciar usuários da inbox" });
      }

      const { data: target } = await supabaseAdmin.from("users").select("id, company_id").eq("id", b.userId).maybeSingle();
      if (!target || (target as any).company_id !== (inbox as any).company_id) return res.status(400).json({ error: "Usuário inválido para esta empresa" });

      const { data, error } = await supabaseAdmin.from("inbox_users").upsert([{ user_id: b.userId, inbox_id: id, can_read: b.can_read, can_write: b.can_write, can_manage: b.can_manage }], { onConflict: "user_id,inbox_id" }).select("user_id, inbox_id, can_read, can_write, can_manage").single();
      if (error) return res.status(500).json({ error: error.message });

      req.app?.locals?.io?.emit("inbox:users:updated", { inboxId: id, companyId: (inbox as any).company_id });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "inbox users add error" });
    }
  }

  // DELETE /livechat/inboxes/:id/users/:userId
  static async removeInboxAgent(req: AuthRequest, res: Response) {
    try {
      const { id, userId } = req.params as { id: string; userId: string };
      const { data: inbox } = await supabaseAdmin.from("inboxes").select("id, company_id").eq("id", id).maybeSingle();
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });

      const { data: actor } = await supabaseAdmin.from("users").select("id, role, company_id").eq("user_id", req.user.id).maybeSingle();
      if (!actor || (actor as any).company_id !== (inbox as any).company_id) return res.status(403).json({ error: "Proibido" });

      const role = ((actor as any).role || "").toString().toUpperCase();
      if (role === "AGENT") {
        const { data: link } = await supabaseAdmin.from("inbox_users").select("can_manage").eq("inbox_id", id).eq("user_id", (actor as any).id).maybeSingle();
        if (!link?.can_manage) return res.status(403).json({ error: "Sem permissão para gerenciar usuários da inbox" });
      }

      const { error } = await supabaseAdmin.from("inbox_users").delete().eq("inbox_id", id).eq("user_id", userId);
      if (error) return res.status(500).json({ error: error.message });

      req.app?.locals?.io?.emit("inbox:users:updated", { inboxId: id, companyId: (inbox as any).company_id });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "inbox users remove error" });
    }
  }

  // GET /livechat/chats/:id/kanban
  static async getChatKanban(req: AuthRequest, res: Response) {
    try {
      const chatId = String(req.params.id);
      const { data: chat, error: errChat } = await supabaseAdmin.from("chats").select("id, inbox_id, customer_id, last_message_at").eq("id", chatId).maybeSingle();
      if (errChat) return res.status(500).json({ error: errChat.message });
      if (!chat) return res.status(404).json({ error: "Chat não encontrado" });

      const { data: customer, error: errCust } = await supabaseAdmin.from("customers").select("id, company_id, lead_id, name").eq("id", chat.customer_id).maybeSingle();
      if (errCust) return res.status(500).json({ error: errCust.message });
      if (!customer) return res.status(404).json({ error: "Cliente não encontrado" });

      let boardId: string | null = null;
      let currentColumnId: string | null = null;
      let currentColumnName: string | null = null;

      if (customer.lead_id) {
        const { data: lead, error: errLead } = await supabaseAdmin.from("leads").select("id, kanban_board_id, kanban_column_id, kanban_column:kanban_columns(id, name)").eq("id", customer.lead_id).maybeSingle();
        if (errLead) return res.status(500).json({ error: errLead.message });
        if (lead) {
          boardId = (lead as any).kanban_board_id || null;
          currentColumnId = (lead as any).kanban_column_id || null;
          currentColumnName = (lead as any).kanban_column?.name || null;
        }
      }

      if (!boardId) boardId = await getBoardIdForCompany(customer.company_id);

      const { data: columns, error: errCols } = await supabaseAdmin.from("kanban_columns").select("id, name, color, position").eq("kanban_board_id", boardId).order("position", { ascending: true });
      if (errCols) return res.status(500).json({ error: errCols.message });

      if (!currentColumnId && customer.lead_id && boardId) {
        const { data: card } = await supabaseAdmin.from("kanban_cards").select("kanban_column_id, kanban_column:kanban_columns(id, name)").eq("lead_id", customer.lead_id).eq("kanban_board_id", boardId).maybeSingle();
        if (card) {
          currentColumnId = (card as any).kanban_column_id;
          currentColumnName = (card as any).kanban_column?.name;
        }
      }

      return res.json({
        ok: true,
        stage_id: currentColumnId,
        stage_name: currentColumnName,
        note: null,
        board: { id: boardId },
        columns: columns || [],
        current: { column_id: currentColumnId },
        chat: { id: chatId, customer_id: chat.customer_id, last_message_at: chat.last_message_at },
        customer: { id: customer.id, name: customer.name, company_id: customer.company_id }
      });
    } catch (e: any) {
      console.error("[LivechatController.getChatKanban] error:", e);
      return res.status(500).json({ error: e?.message || "kanban chat error" });
    }
  }

  static startListeners() {
    // Optional: add any startup logic here
  }
}
