import express, { Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireInboxAccess } from "../middlewares/requireInboxAccess.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { getIO } from "../lib/io.js";
import type { AuthRequest, Inbox, CreateInboxDTO, UpdateInboxDTO } from "../types/index.js";

export function registerLivechatInboxesRoutes(app: express.Application) {
  // Verificar se deve mostrar wizard de primeira inbox
  app.get("/livechat/inboxes/should-show-wizard", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin
        .from('users')
        .select('company_id')
        .eq('user_id', req.user.id)
        .maybeSingle();
      
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = urow?.company_id;
      if (!companyId) return res.status(404).json({ error: 'UsuÃ¡rio sem company_id' });

      // Verificar flag first_inbox_setup da empresa
      const { data: company, error: companyErr } = await supabaseAdmin
        .from('companies')
        .select('first_inbox_setup')
        .eq('id', companyId)
        .maybeSingle();
      
      if (companyErr) return res.status(500).json({ error: companyErr.message });
      
      // Se a flag jÃ¡ Ã© true, nÃ£o mostrar wizard
      if (company?.first_inbox_setup === true) {
        return res.json({ showWizard: false });
      }

      // Se a flag Ã© false/null, verificar se tem inboxes
      const { data: inboxes, error: inboxErr } = await supabaseAdmin
        .from('inboxes')
        .select('id')
        .eq('company_id', companyId)
        .limit(1);
      
      if (inboxErr) return res.status(500).json({ error: inboxErr.message });
      
      // Se tem inbox mas flag nÃ£o estÃ¡ setada, atualizar flag
      if (inboxes && inboxes.length > 0) {
        await supabaseAdmin
          .from('companies')
          .update({ first_inbox_setup: true })
          .eq('id', companyId);
        return res.json({ showWizard: false });
      }

      // NÃ£o tem inbox e flag nÃ£o estÃ¡ setada, mostrar wizard
      return res.json({ showWizard: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'wizard check error' });
    }
  });

  // Inboxes do usuÃ¡rio autenticado
  app.get("/livechat/inboxes/my", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUserId = req.user?.id as string;

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

      const ids = Array.from(new Set((links || []).map((r: any) => r.inbox_id))).filter((id): id is string => !!id);
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

  // List all inboxes of current user's company with stats
  app.get('/livechat/inboxes/stats', requireAuth, requireInboxAccess, async (req: AuthRequest, res: Response) => {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin.from('users').select('company_id, role').eq('user_id', req.user.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = urow?.company_id;
      if (!companyId) return res.status(404).json({ error: 'UsuÃ¡rio sem company_id' });
      
      const { data: inboxes, error } = await supabaseAdmin
        .from('inboxes')
        .select('id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, waha_db_name')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      
      // For each inbox, get contact stats
      const inboxesWithStats = await Promise.all((inboxes || []).map(async (inbox: any) => {
        // Count total customers linked to this inbox via chats
        const { count: totalContacts } = await supabaseAdmin
          .from('chats')
          .select('customer_id', { count: 'exact', head: true })
          .eq('inbox_id', inbox.id)
          .not('customer_id', 'is', null);
        
        // Count active chats (status OPEN or null)
        const { count: activeContacts } = await supabaseAdmin
          .from('chats')
          .select('customer_id', { count: 'exact', head: true })
          .eq('inbox_id', inbox.id)
          .not('customer_id', 'is', null)
          .or('status.eq.OPEN,status.is.null');
        
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
      return res.status(500).json({ error: e?.message || 'inboxes stats error' });
    }
  });

  // List all inboxes of current user's company
  app.get('/livechat/inboxes', requireAuth, requireInboxAccess, async (req: AuthRequest, res: Response) => {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin.from('users').select('company_id, role').eq('user_id', req.user.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = urow?.company_id;
      if (!companyId) return res.status(404).json({ error: 'UsuÃ¡rio sem company_id' });
      const { data, error } = await supabaseAdmin
        .from('inboxes')
        .select('id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, waha_db_name')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json((data || []) as Inbox[]);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'inboxes list error' });
    }
  });

  // Create a new inbox in current company
  app.post('/livechat/inboxes', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin.from('users').select('company_id, role, id').eq('user_id', req.user.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = urow?.company_id as string | null;
      if (!companyId) return res.status(404).json({ error: 'UsuÃ¡rio sem company_id' });
      const actorLocalUserId = urow?.id || null;

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
      if (!parsed.success) return res.status(400).json({ error: 'Dados invÃ¡lidos', details: parsed.error.format() });
      const b = parsed.data;

      const nowIso = new Date().toISOString();
      const insert: CreateInboxDTO = {
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
      };

      const { data: inbox, error } = await supabaseAdmin
        .from('inboxes')
        .insert([insert])
        .select('id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, company_id, waha_db_name')
        .single();
      if (error) return res.status(500).json({ error: error.message });

      const newInbox = inbox as Inbox;

      if (b.webhook_verify_token || b.app_secret) {
        await supabaseAdmin
          .from('inbox_secrets')
          .upsert([{ inbox_id: newInbox.id, access_token: null, refresh_token: null, provider_api_key: null, updated_at: nowIso }], { onConflict: 'inbox_id' });
        const patch: any = {};
        if (b.webhook_verify_token !== undefined) patch.webhook_verify_token = b.webhook_verify_token;
        if (b.app_secret !== undefined) patch.app_secret = b.app_secret;
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from('inboxes').update(patch).eq('id', newInbox.id);
        }
      }

      try {
        if (b.add_current_as_manager && actorLocalUserId) {
          await supabaseAdmin
            .from('inbox_users')
            .upsert([{ user_id: actorLocalUserId, inbox_id: newInbox.id, can_read: true, can_write: true, can_manage: true }], { onConflict: 'user_id,inbox_id' });
        }
      } catch {}

      // Marcar first_inbox_setup como true (primeira inbox configurada)
      try {
        await supabaseAdmin
          .from('companies')
          .update({ first_inbox_setup: true })
          .eq('id', companyId);
      } catch (e) {
        console.error('Error updating first_inbox_setup:', e);
      }

      try { getIO()?.emit('inbox:created', { companyId, inbox: newInbox }); } catch {}
      return res.status(201).json(newInbox);
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
      const update: UpdateInboxDTO = {};
      const fields = ['name','phone_number','is_active','webhook_url','channel','provider','base_url','api_version','phone_number_id','waba_id','instance_id','webhook_verify_token','app_secret'] as (keyof UpdateInboxDTO)[];
      for (const k of fields) if (Object.prototype.hasOwnProperty.call(b, k)) (update as any)[k] = b[k];
      
      if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Nada para atualizar' });
      
      const { data: updated, error } = await supabaseAdmin
        .from('inboxes')
        .update(update)
        .eq('id', id)
        .select('id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, created_at, updated_at, company_id, waha_db_name')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      
      const updatedInbox = updated as Inbox;
      try { getIO()?.emit('inbox:updated', { inboxId: id, companyId: updatedInbox.company_id, changes: update, inbox: updatedInbox }); } catch {}
      return res.json(updatedInbox);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'inbox update error' });
    }
  });

  // Delete inbox
  app.delete('/livechat/inboxes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { data: inbox, error: inboxErr } = await supabaseAdmin.from('inboxes').select('id, company_id').eq('id', id).maybeSingle();
      if (inboxErr) return res.status(500).json({ error: inboxErr.message });
      if (!inbox) return res.status(404).json({ error: 'Inbox nao encontrada' });

      const { data: actor, error: actorErr } = await supabaseAdmin.from('users').select('id, role, company_id').eq('user_id', req.user.id).maybeSingle();
      if (actorErr) return res.status(500).json({ error: actorErr.message });
      if (!actor || actor.company_id !== (inbox as any).company_id) return res.status(403).json({ error: 'Proibido' });

      let allowed = false;
      const role = (actor.role || '').toString().toUpperCase();
      if (role && role !== 'AGENT') allowed = true;
      if (!allowed) {
        const { data: link, error: linkErr } = await supabaseAdmin
          .from('inbox_users')
          .select('can_manage')
          .eq('inbox_id', id)
          .eq('user_id', actor.id)
          .maybeSingle();
        if (linkErr) return res.status(500).json({ error: linkErr.message });
        if (link?.can_manage) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: 'Sem permissao para excluir inbox' });

      const { data: chats } = await supabaseAdmin.from('chats').select('id').eq('inbox_id', id);
      const chatIds = (chats || []).map((row: any) => row.id).filter((cid): cid is string => !!cid);
      if (chatIds.length > 0) {
        const chunk = <T>(arr: T[], size = 100) => {
          const parts: T[][] = [];
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
  app.post('/livechat/inboxes/:id/users', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const schema = z.object({ userId: z.string().min(1), can_read: z.boolean().optional().default(true), can_write: z.boolean().optional().default(true), can_manage: z.boolean().optional().default(false) });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: 'Dados invÃ¡lidos', details: parsed.error.format() });
      const b = parsed.data;
      const { data: inbox } = await supabaseAdmin.from('inboxes').select('id, company_id').eq('id', id).maybeSingle();
      if (!inbox) return res.status(404).json({ error: 'Inbox nÃ£o encontrada' });
      const { data: actor } = await supabaseAdmin.from('users').select('id, role, company_id').eq('user_id', req.user.id).maybeSingle();
      if (!actor || actor.company_id !== (inbox as any).company_id) return res.status(403).json({ error: 'Proibido' });
      const role = (actor.role || '').toString().toUpperCase();
      if (role === 'AGENT') {
        const { data: link } = await supabaseAdmin.from('inbox_users').select('can_manage').eq('inbox_id', id).eq('user_id', actor.id).maybeSingle();
        if (!link?.can_manage) return res.status(403).json({ error: 'Sem permissÃ£o para gerenciar usuÃ¡rios da inbox' });
      }
      const { data: target } = await supabaseAdmin.from('users').select('id, company_id').eq('id', b.userId).maybeSingle();
      if (!target || target.company_id !== (inbox as any).company_id) return res.status(400).json({ error: 'UsuÃ¡rio invÃ¡lido para esta empresa' });
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

  app.delete('/livechat/inboxes/:id/users/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id, userId } = req.params as { id: string; userId: string };
      const { data: inbox } = await supabaseAdmin.from('inboxes').select('id, company_id').eq('id', id).maybeSingle();
      if (!inbox) return res.status(404).json({ error: 'Inbox nÃ£o encontrada' });
      const { data: actor } = await supabaseAdmin.from('users').select('id, role, company_id').eq('user_id', req.user.id).maybeSingle();
      if (!actor || actor.company_id !== (inbox as any).company_id) return res.status(403).json({ error: 'Proibido' });
      const role = (actor.role || '').toString().toUpperCase();
      if (role === 'AGENT') {
        const { data: link } = await supabaseAdmin.from('inbox_users').select('can_manage').eq('inbox_id', id).eq('user_id', actor.id).maybeSingle();
        if (!link?.can_manage) return res.status(403).json({ error: 'Sem permissÃ£o para gerenciar usuÃ¡rios da inbox' });
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
