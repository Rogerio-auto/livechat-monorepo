import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { getIO } from "../lib/io.ts";

export function registerLivechatInboxesRoutes(app: express.Application) {
  // Inboxes do usuário autenticado
  app.get("/livechat/inboxes/my", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;

      let { data: links, error: errLinks } = await supabaseAdmin
        .from("inbox_users")
        .select("inbox_id")
        .eq("user_id", authUserId);
      if (errLinks) return res.status(500).json({ error: errLinks.message });

      if (!links || links.length === 0) {
        try {
          const { data: urow } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("user_id", authUserId)
            .maybeSingle();
          if (urow?.id) {
            const resp2 = await supabaseAdmin
              .from("inbox_users")
              .select("inbox_id")
              .eq("user_id", urow.id);
            if (!resp2.error) links = resp2.data as any[];
          }
        } catch {}
      }

      const ids = Array.from(new Set((links || []).map((r: any) => r.inbox_id))).filter(Boolean);
      if (ids.length === 0) return res.json([]);

      const { data, error } = await supabaseAdmin
        .from("inboxes")
        .select("id, name, phone_number, is_active, provider, channel, waha_db_name")
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
  });

  // List all inboxes of current user's company
  app.get('/livechat/inboxes', requireAuth, async (req: any, res) => {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin.from('users').select('company_id, role').eq('user_id', req.user.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id;
      if (!companyId) return res.status(404).json({ error: 'Usuário sem company_id' });
      const { data, error } = await supabaseAdmin
        .from('inboxes')
        .select('id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, waha_db_name')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'inboxes list error' });
    }
  });

  // Create a new inbox in current company
  app.post('/livechat/inboxes', requireAuth, async (req: any, res) => {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin.from('users').select('company_id, role, id').eq('user_id', req.user.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id as string | null;
      if (!companyId) return res.status(404).json({ error: 'Usuário sem company_id' });
      const actorLocalUserId = (urow as any)?.id || null;

      const schema = z.object({
        name: z.string().min(1),
        phone_number: z.string().min(5),
        webhook_url: z.string().url().optional().nullable(),
        channel: z.string().optional().default('WHATSAPP'),
        provider: z.string().optional().default('META_CLOUD'),
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
      if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.format() });
      const b = parsed.data as any;

      const nowIso = new Date().toISOString();
      const insert = {
        name: b.name,
        phone_number: b.phone_number,
        webhook_url: b.webhook_url ?? null,
        channel: b.channel || 'WHATSAPP',
        provider: b.provider || 'META_CLOUD',
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
        .from('inboxes')
        .insert([insert])
        .select('id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, company_id, waha_db_name')
        .single();
      if (error) return res.status(500).json({ error: error.message });

      if (b.webhook_verify_token || b.app_secret) {
        await supabaseAdmin
          .from('inbox_secrets')
          .upsert([{ inbox_id: (inbox as any).id, access_token: null, refresh_token: null, provider_api_key: null, updated_at: nowIso }], { onConflict: 'inbox_id' });
        const patch: any = {};
        if (b.webhook_verify_token !== undefined) patch.webhook_verify_token = b.webhook_verify_token;
        if (b.app_secret !== undefined) patch.app_secret = b.app_secret;
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from('inboxes').update(patch).eq('id', (inbox as any).id);
        }
      }

      try {
        if (b.add_current_as_manager && actorLocalUserId) {
          await supabaseAdmin
            .from('inbox_users')
            .upsert([{ user_id: actorLocalUserId, inbox_id: (inbox as any).id, can_read: true, can_write: true, can_manage: true }], { onConflict: 'user_id,inbox_id' });
        }
      } catch {}

      try { getIO()?.emit('inbox:created', { companyId, inbox }); } catch {}
      return res.status(201).json(inbox);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'inbox create error' });
    }
  });

  // Update inbox settings
  app.put('/livechat/inboxes/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const { data: inbox, error: iErr } = await supabaseAdmin.from('inboxes').select('id, company_id').eq('id', id).maybeSingle();
      if (iErr) return res.status(500).json({ error: iErr.message });
      if (!inbox) return res.status(404).json({ error: 'Inbox não encontrada' });
      const { data: urow, error: uerr } = await supabaseAdmin.from('users').select('company_id, role, id').eq('user_id', req.user.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const sameCompany = (urow as any)?.company_id === (inbox as any).company_id;
      if (!sameCompany) return res.status(403).json({ error: 'Proibido' });
      let allowed = false;
      const role = ((urow as any)?.role || '').toString().toUpperCase();
      if (role && role !== 'AGENT') allowed = true;
      if (!allowed) {
        const { data: link } = await supabaseAdmin.from('inbox_users').select('can_manage').eq('inbox_id', id).eq('user_id', (urow as any)?.id).maybeSingle();
        if (link?.can_manage) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: 'Sem permissão para editar esta inbox' });

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
      if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.format() });
      const b = parsed.data as any;
      const update: any = {};
      const fields = ['name','phone_number','is_active','webhook_url','channel','provider','base_url','api_version','phone_number_id','waba_id','instance_id','webhook_verify_token','app_secret'];
      for (const k of fields) if (Object.prototype.hasOwnProperty.call(b, k)) update[k] = b[k];
      update.updated_at = new Date().toISOString();
      if (Object.keys(update).length === 1) return res.status(400).json({ error: 'Nada para atualizar' });
      const { data: updated, error } = await supabaseAdmin
        .from('inboxes')
        .update(update)
        .eq('id', id)
        .select('id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, company_id, waha_db_name')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      try { getIO()?.emit('inbox:updated', { inboxId: id, companyId: (updated as any).company_id, changes: update, inbox: updated }); } catch {}
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'inbox update error' });
    }
  });

  // Delete inbox
  app.delete('/livechat/inboxes/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const { data: inbox, error: inboxErr } = await supabaseAdmin.from('inboxes').select('id, company_id').eq('id', id).maybeSingle();
      if (inboxErr) return res.status(500).json({ error: inboxErr.message });
      if (!inbox) return res.status(404).json({ error: 'Inbox nao encontrada' });

      const { data: actor, error: actorErr } = await supabaseAdmin.from('users').select('id, role, company_id').eq('user_id', req.user.id).maybeSingle();
      if (actorErr) return res.status(500).json({ error: actorErr.message });
      if (!actor || (actor as any).company_id !== (inbox as any).company_id) return res.status(403).json({ error: 'Proibido' });

      let allowed = false;
      const role = ((actor as any).role || '').toString().toUpperCase();
      if (role && role !== 'AGENT') allowed = true;
      if (!allowed) {
        const { data: link, error: linkErr } = await supabaseAdmin
          .from('inbox_users')
          .select('can_manage')
          .eq('inbox_id', id)
          .eq('user_id', (actor as any).id)
          .maybeSingle();
        if (linkErr) return res.status(500).json({ error: linkErr.message });
        if (link?.can_manage) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: 'Sem permissao para excluir inbox' });

      const { data: chats } = await supabaseAdmin.from('chats').select('id').eq('inbox_id', id);
      const chatIds = (chats || []).map((row: any) => row.id).filter(Boolean);
      if (chatIds.length > 0) {
        const chunk = (arr: any[], size = 100) => {
          const parts: any[][] = [];
          for (let i = 0; i < arr.length; i += size) parts.push(arr.slice(i, i + size));
          return parts;
        };
        for (const part of chunk(chatIds, 100)) {
          try { await supabaseAdmin.from('chat_messages').delete().in('chat_id', part); } catch {}
          try { await supabaseAdmin.from('chat_participants').delete().in('chat_id', part); } catch {}
          try { await supabaseAdmin.from('chat_tags').delete().in('chat_id', part); } catch {}
        }
        try { await supabaseAdmin.from('chats').delete().in('id', chatIds); } catch {}
      }

      try { await supabaseAdmin.from('inbox_users').delete().eq('inbox_id', id); } catch {}
      try { await supabaseAdmin.from('inbox_secrets').delete().eq('inbox_id', id); } catch {}

      const { error: delErr } = await supabaseAdmin.from('inboxes').delete().eq('id', id);
      if (delErr) {
        console.error('Delete inbox error', delErr);
        return res.status(500).json({ error: delErr.message, details: (delErr as any)?.details || null, hint: (delErr as any)?.hint || null });
      }

      try { getIO()?.emit('inbox:deleted', { inboxId: id, companyId: (inbox as any).company_id }); } catch {}
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'inbox delete error' });
    }
  });

  // Manage inbox users: add/update permissions
  app.post('/livechat/inboxes/:id/users', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const schema = z.object({ userId: z.string().min(1), can_read: z.boolean().optional().default(true), can_write: z.boolean().optional().default(true), can_manage: z.boolean().optional().default(false) });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.format() });
      const b = parsed.data as any;
      const { data: inbox } = await supabaseAdmin.from('inboxes').select('id, company_id').eq('id', id).maybeSingle();
      if (!inbox) return res.status(404).json({ error: 'Inbox não encontrada' });
      const { data: actor } = await supabaseAdmin.from('users').select('id, role, company_id').eq('user_id', req.user.id).maybeSingle();
      if (!actor || (actor as any).company_id !== (inbox as any).company_id) return res.status(403).json({ error: 'Proibido' });
      const role = ((actor as any).role || '').toString().toUpperCase();
      if (role === 'AGENT') {
        const { data: link } = await supabaseAdmin.from('inbox_users').select('can_manage').eq('inbox_id', id).eq('user_id', (actor as any).id).maybeSingle();
        if (!link?.can_manage) return res.status(403).json({ error: 'Sem permissão para gerenciar usuários da inbox' });
      }
      const { data: target } = await supabaseAdmin.from('users').select('id, company_id').eq('id', b.userId).maybeSingle();
      if (!target || (target as any).company_id !== (inbox as any).company_id) return res.status(400).json({ error: 'Usuário inválido para esta empresa' });
      const { data, error } = await supabaseAdmin
        .from('inbox_users')
        .upsert([{ user_id: b.userId, inbox_id: id, can_read: b.can_read, can_write: b.can_write, can_manage: b.can_manage }], { onConflict: 'user_id,inbox_id' })
        .select('user_id, inbox_id, can_read, can_write, can_manage')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      try { getIO()?.emit('inbox:users:updated', { inboxId: id, companyId: (inbox as any).company_id }); } catch {}
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'inbox users add error' });
    }
  });

  app.delete('/livechat/inboxes/:id/users/:userId', requireAuth, async (req: any, res) => {
    try {
      const { id, userId } = req.params as { id: string; userId: string };
      const { data: inbox } = await supabaseAdmin.from('inboxes').select('id, company_id').eq('id', id).maybeSingle();
      if (!inbox) return res.status(404).json({ error: 'Inbox não encontrada' });
      const { data: actor } = await supabaseAdmin.from('users').select('id, role, company_id').eq('user_id', req.user.id).maybeSingle();
      if (!actor || (actor as any).company_id !== (inbox as any).company_id) return res.status(403).json({ error: 'Proibido' });
      const role = ((actor as any).role || '').toString().toUpperCase();
      if (role === 'AGENT') {
        const { data: link } = await supabaseAdmin.from('inbox_users').select('can_manage').eq('inbox_id', id).eq('user_id', (actor as any).id).maybeSingle();
        if (!link?.can_manage) return res.status(403).json({ error: 'Sem permissão para gerenciar usuários da inbox' });
      }
      const { error } = await supabaseAdmin.from('inbox_users').delete().eq('inbox_id', id).eq('user_id', userId);
      if (error) return res.status(500).json({ error: error.message });
      try { getIO()?.emit('inbox:users:updated', { inboxId: id, companyId: (inbox as any).company_id }); } catch {}
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'inbox users remove error' });
    }
  });
}
