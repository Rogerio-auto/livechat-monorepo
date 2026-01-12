import express from "express";
import type { Application, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { getIO } from "../lib/io.js";
import { triggerFlow } from "../services/flow-engine.service.js";
import { AuthRequest } from "../types/express.js";

export function registerLivechatTagsRoutes(app: Application) {
  // List company tags
  app.get("/livechat/tags", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUserId = req.user?.id as string;
      const { data: urow, error: errU } = await supabaseAdmin.from("users").select("company_id").eq("user_id", authUserId).maybeSingle();
      if (errU) return res.status(500).json({ error: errU.message });
      if (!urow?.company_id) return res.status(404).json({ error: "Usuário sem company_id" });
      const { data, error } = await supabaseAdmin
        .from("tags")
        .select("id, name, color, created_at, updated_at")
        .eq("company_id", (urow as any).company_id)
        .order("name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "tags list error" });
    }
  });

  // Create tag; optionally create a kanban column in default board
  app.post("/livechat/tags", requireAuth, async (req: AuthRequest, res: Response) => {
    const authUserId = req.user?.id as string;
    const schema = z.object({ name: z.string().min(1), color: z.string().min(1).optional(), createColumn: z.boolean().optional() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { name, color, createColumn = false } = parsed.data;

    const { data: urow, error: errU } = await supabaseAdmin.from("users").select("company_id, role").eq("user_id", authUserId).maybeSingle();
    if (errU) return res.status(500).json({ error: errU.message });
    if (!urow?.company_id) return res.status(404).json({ error: "Usuário sem company_id" });
    const role = (urow as any).role as string | null;
    const allowed = role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR" || role === "SUPER_ADMIN";
    if (!allowed) return res.status(403).json({ error: "Sem permissão para criar labels" });

    const { data: tag, error: errTag } = await supabaseAdmin
      .from("tags")
      .insert([{ name, color: color || null, company_id: (urow as any).company_id }])
      .select("id, name, color")
      .single();
    if (errTag) return res.status(400).json({ error: errTag.message });

    let createdColumn: any = null;
    if (createColumn) {
      const { data: board } = await supabaseAdmin
        .from("kanban_boards")
        .select("id, is_default, created_at")
        .eq("company_id", (urow as any).company_id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (board?.id) {
        const { data: last } = await supabaseAdmin
          .from("kanban_columns")
          .select("position")
          .eq("kanban_board_id", (board as any).id)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextPos = ((last as any)?.position || 0) + 1;
        const { data: col } = await supabaseAdmin
          .from("kanban_columns")
          .insert([{ name, color: color || null, position: nextPos, kanban_board_id: (board as any).id }])
          .select("id, name, color, position")
          .single();
        createdColumn = col || null;
      }
    }

    return res.status(201).json({ tag, column: createdColumn });
  });

  // Adicionar uma tag individual a um chat (POST /livechat/chats/:id/tags)
  app.post("/livechat/chats/:id/tags", requireAuth, async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const { tagId } = req.body || {};
    
    if (!tagId) {
      return res.status(400).json({ error: 'tagId is required' });
    }

    try {
      const authUserId = req.user?.id as string;
      const { data: urow } = await supabaseAdmin.from('users').select('company_id').eq('user_id', authUserId).maybeSingle();
      const companyId = (urow as any)?.company_id;

      // Get tag info
      const { data: tag } = await supabaseAdmin.from('tags').select('id, name, color').eq('id', tagId).maybeSingle();
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      // Try to find kanban board and column
      let columnId: string | null = null;
      let boardId: string | null = null;
      
      if (companyId) {
        const { data: board } = await supabaseAdmin
          .from('kanban_boards')
          .select('id, is_default, created_at')
          .eq('company_id', companyId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        boardId = (board as any)?.id || null;

        if (boardId) {
          const { data: col } = await supabaseAdmin
            .from('kanban_columns')
            .select('id')
            .eq('kanban_board_id', boardId)
            .eq('name', (tag as any).name)
            .maybeSingle();
          columnId = (col as any)?.id || null;

          // Create column if it doesn't exist
          if (!columnId) {
            const { data: last } = await supabaseAdmin
              .from('kanban_columns')
              .select('position')
              .eq('kanban_board_id', boardId)
              .order('position', { ascending: false })
              .limit(1)
              .maybeSingle();
            const nextPos = ((last as any)?.position || 0) + 1;
            const { data: created } = await supabaseAdmin
              .from('kanban_columns')
              .insert([{ name: (tag as any).name, color: (tag as any).color || null, position: nextPos, kanban_board_id: boardId }])
              .select('id')
              .single();
            columnId = (created as any)?.id || null;
          }
        }
      }

      // Insert chat_tag (allow NULL kanban_colum_id)
      const { data, error } = await supabaseAdmin
        .from('chat_tags')
        .insert([{ chat_id: id, tag_id: tagId, kanban_colum_id: columnId }])
        .select('tag_id')
        .single();

      if (error) {
        // Check if it's a duplicate key error
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Tag already added to this chat' });
        }
        return res.status(500).json({ error: error.message });
      }

      // Trigger Flow Builder
      try {
        const { data: chat } = await supabaseAdmin.from('chats').select('customer_id').eq('id', id).maybeSingle();
        if (chat?.customer_id && companyId) {
          triggerFlow({
            companyId,
            contactId: chat.customer_id,
            triggerType: 'TAG_ADDED',
            triggerData: { tag_id: tagId }
          }).catch(err => console.error("[FlowEngine] Trigger error:", err));
        }
      } catch (err) {
        console.error("[FlowEngine] Failed to fetch chat for trigger:", err);
      }

      // System message
      try {
        const { data: actorUser } = await supabaseAdmin
          .from("users")
          .select("name")
          .eq("user_id", authUserId)
          .maybeSingle();
        const actorName = actorUser?.name || "Alguém";
        
        const msgContent = `${actorName} adicionou a tag "${tag.name}"`;
        await supabaseAdmin.from("chat_messages").insert({
          chat_id: id,
          content: msgContent,
          type: "SYSTEM",
          is_from_customer: false,
          created_at: new Date().toISOString(),
        });
        
        getIO()?.to(`chat:${id}`).emit("message:new", {
            id: crypto.randomUUID(),
            chat_id: id,
            content: msgContent,
            type: "SYSTEM",
            sender_type: "SYSTEM",
            created_at: new Date().toISOString(),
        });
      } catch (sysErr) {
        console.error("Failed to create system message for tag add", sysErr);
      }

      // Emit socket event
      try {
        const { data: allTags } = await supabaseAdmin.from('chat_tags').select('tag_id').eq('chat_id', id);
        const tagIds = ((allTags as any[]) || []).map((r) => (r as any).tag_id);
        getIO()?.to(`chat:${id}`).emit('chat:tags', { chatId: id, tags: tagIds });
      } catch {}

      return res.status(201).json({ ok: true, tag_id: (data as any).tag_id });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'add tag error' });
    }
  });

  // Gerenciar tags do chat (set completo)
  app.put("/livechat/chats/:id/tags", requireAuth, async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const { tags } = req.body || {};
    const tagIds: string[] = Array.isArray(tags) ? tags : [];

    const { error: errDel } = await supabaseAdmin.from("chat_tags").delete().eq("chat_id", id);
    if (errDel) return res.status(500).json({ error: errDel.message });
    if (tagIds.length === 0) {
      try { getIO()?.to(`chat:${id}`).emit('chat:tags', { chatId: id, tags: [] }); } catch {}
      return res.json({ ok: true, count: 0 });
    }

    try {
      const authUserId = req.user?.id as string;
      const { data: urow } = await supabaseAdmin.from('users').select('company_id').eq('user_id', authUserId).maybeSingle();
      const companyId = (urow as any)?.company_id;

      let boardId: string | null = null;
      if (companyId) {
        const { data: board } = await supabaseAdmin
          .from('kanban_boards')
          .select('id, is_default, created_at')
          .eq('company_id', companyId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        boardId = (board as any)?.id || null;
      }

      const { data: tagRows } = await supabaseAdmin.from('tags').select('id, name, color').in('id', tagIds);
      const rowsToInsert: { chat_id: string; tag_id: string; kanban_colum_id: string | null }[] = [];
      for (const t of (tagRows as any[]) || []) {
        let columnId: string | null = null;
        
        // Try to find or create kanban column if board exists
        if (boardId) {
          const { data: col } = await supabaseAdmin
            .from('kanban_columns')
            .select('id')
            .eq('kanban_board_id', boardId)
            .eq('name', (t as any).name)
            .maybeSingle();
          columnId = (col as any)?.id || null;
          
          // Create column if it doesn't exist
          if (!columnId) {
            const { data: last } = await supabaseAdmin
              .from('kanban_columns')
              .select('position')
              .eq('kanban_board_id', boardId)
              .order('position', { ascending: false })
              .limit(1)
              .maybeSingle();
            const nextPos = ((last as any)?.position || 0) + 1;
            const { data: created } = await supabaseAdmin
              .from('kanban_columns')
              .insert([{ name: (t as any).name, color: (t as any).color || null, position: nextPos, kanban_board_id: boardId }])
              .select('id')
              .single();
            columnId = (created as any)?.id || null;
          }
        }
        
        // Allow NULL kanban_colum_id if no board is configured
        rowsToInsert.push({ chat_id: id, tag_id: (t as any).id, kanban_colum_id: columnId });
      }

      const { data, error } = await supabaseAdmin.from('chat_tags').insert(rowsToInsert).select('tag_id');
      if (error) return res.status(500).json({ error: error.message });
      const savedTagIds = ((data as any[]) || []).map((r) => (r as any).tag_id);
      try { getIO()?.to(`chat:${id}`).emit('chat:tags', { chatId: id, tags: savedTagIds }); } catch {}
      return res.json({ ok: true, count: savedTagIds.length });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'tags set error' });
    }
  });

  // Listar tags do chat
  app.get("/livechat/chats/:id/tags", requireAuth, async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    try {
      const { data, error } = await supabaseAdmin.from('chat_tags').select('tag_id').eq('chat_id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json(((data as any[]) || []).map((r) => (r as any).tag_id));
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'tags list error' });
    }
  });

  // Remover uma tag individual de um chat (DELETE /livechat/chats/:id/tags/:tagId)
  app.delete("/livechat/chats/:id/tags/:tagId", requireAuth, async (req: AuthRequest, res: Response) => {
    const { id, tagId } = req.params as { id: string; tagId: string };
    
    try {
      // Fetch tag name before deleting (for system message)
      const { data: tag } = await supabaseAdmin
        .from('tags')
        .select('name')
        .eq('id', tagId)
        .maybeSingle();

      const { error } = await supabaseAdmin
        .from('chat_tags')
        .delete()
        .eq('chat_id', id)
        .eq('tag_id', tagId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // System message
      try {
        const authUserId = req.user?.id as string;
        const { data: actorUser } = await supabaseAdmin
          .from("users")
          .select("name")
          .eq("user_id", authUserId)
          .maybeSingle();
        const actorName = actorUser?.name || "Alguém";
        const tagName = tag?.name || "uma tag";
        
        const msgContent = `${actorName} removeu a tag "${tagName}"`;
        await supabaseAdmin.from("chat_messages").insert({
          chat_id: id,
          content: msgContent,
          type: "SYSTEM",
          is_from_customer: false,
          created_at: new Date().toISOString(),
        });
        
        getIO()?.to(`chat:${id}`).emit("message:new", {
            id: crypto.randomUUID(),
            chat_id: id,
            content: msgContent,
            type: "SYSTEM",
            sender_type: "SYSTEM",
            created_at: new Date().toISOString(),
        });
      } catch (sysErr) {
        console.error("Failed to create system message for tag remove", sysErr);
      }

      // Emit socket event
      try {
        const { data: allTags } = await supabaseAdmin.from('chat_tags').select('tag_id').eq('chat_id', id);
        const tagIds = ((allTags as any[]) || []).map((r) => (r as any).tag_id);
        getIO()?.to(`chat:${id}`).emit('chat:tags', { chatId: id, tags: tagIds });
      } catch {}

      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'remove tag error' });
    }
  });
}
