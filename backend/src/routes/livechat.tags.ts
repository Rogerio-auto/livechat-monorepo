import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { getIO } from "../lib/io.ts";

export function registerLivechatTagsRoutes(app: express.Application) {
  // List company tags
  app.get("/livechat/tags", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
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
  app.post("/livechat/tags", requireAuth, async (req: any, res) => {
    const authUserId = req.user.id as string;
    const schema = z.object({ name: z.string().min(1), color: z.string().min(1).optional(), createColumn: z.boolean().optional() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { name, color, createColumn = false } = parsed.data;

    const { data: urow, error: errU } = await supabaseAdmin.from("users").select("company_id, role").eq("user_id", authUserId).maybeSingle();
    if (errU) return res.status(500).json({ error: errU.message });
    if (!urow?.company_id) return res.status(404).json({ error: "Usuário sem company_id" });
    const role = (urow as any).role as string | null;
    const allowed = role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";
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

  // Gerenciar tags do chat (set completo)
  app.put("/livechat/chats/:id/tags", requireAuth, async (req, res) => {
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
      const authUserId = (req as any).user.id as string;
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
      const rowsToInsert: { chat_id: string; tag_id: string; kanban_colum_id: string }[] = [];
      for (const t of (tagRows as any[]) || []) {
        let columnId: string | null = null;
        if (boardId) {
          const { data: col } = await supabaseAdmin
            .from('kanban_columns')
            .select('id')
            .eq('kanban_board_id', boardId)
            .eq('name', (t as any).name)
            .maybeSingle();
          columnId = (col as any)?.id || null;
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
        if (!columnId) return res.status(400).json({ error: 'Nenhuma coluna/board disponível para vincular a tag' });
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
  app.get("/livechat/chats/:id/tags", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    try {
      const { data, error } = await supabaseAdmin.from('chat_tags').select('tag_id').eq('chat_id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json(((data as any[]) || []).map((r) => (r as any).tag_id));
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'tags list error' });
    }
  });
}
