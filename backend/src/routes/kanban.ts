// src/routes/kanban.routes.ts
import type { Express, RequestHandler } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Server as SocketIOServer } from "socket.io";

type Deps = {
    requireAuth: RequestHandler;
    supabaseAdmin: SupabaseClient;
    io: SocketIOServer;
};

export function registerKanbanRoutes(app: Express, { requireAuth, supabaseAdmin, io }: Deps) {
    // ================== COLE SUAS ROTAS AQUI ==================
    // Dica: troque todas as referências diretas a supabaseAdmin/requireAuth/io
    // para usarem as variáveis do escopo (já estão disponíveis).
    //
    // EXEMPLO DE CABEÇALHO PADRÃO:
    // app.get("/kanban/my-board", requireAuth, async (req: any, res) => {
    //   const userId = req.user.id;
    //   const { data: userRow, error: errUser } = await supabaseAdmin
    //     .from("users")
    //     .select("company_id")
    //     .eq("user_id", userId)
    //     .maybeSingle();
    //   ...
    // });

    // ⬇️⬇️⬇️ COLE TODO O BLOCO QUE VOCÊ MANDOU AQUI ⬇️⬇️⬇️


    app.get("/kanban/my-board", requireAuth, async (req: any, res) => {
        const userId = req.user.id;

        // Busca a empresa do Usu rio autenticado na tabela public.users
        const { data: userRow, error: errUser } = await supabaseAdmin
            .from("users")
            .select("company_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (errUser) return res.status(500).json({ error: errUser.message });
        if (!userRow?.company_id) return res.status(404).json({ error: "Usu rio sem company_id" });

        const { data: board, error: errBoard } = await supabaseAdmin
            .from("kanban_boards")
            .select("id, name, is_default")
            .eq("company_id", userRow.company_id)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (errBoard) return res.status(500).json({ error: errBoard.message });
        if (!board) return res.status(404).json({ error: "Nenhum board para a empresa" });

        res.json(board); // { id, name, is_default }
    });

    // GET colunas do board
    app.get("/kanban/boards/:boardId/columns", requireAuth, async (req, res) => {
        const { boardId } = req.params;

        const { data, error } = await supabaseAdmin
            .from("kanban_columns")
            .select("id, name, color, position")
            .eq("kanban_board_id", boardId)
            .order("position", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });

        const mapped = (data || []).map((c) => ({
            id: c.id,
            title: c.name,
            color: c.color || "#6B7280",
            position: c.position,
        }));
        res.json(mapped);
    });

    // PUT atualizar coluna (nome, cor, posi??o)
    app.put("/kanban/columns/:id", requireAuth, async (req, res) => {
        const { id } = req.params as { id: string };
        const { name, color, position } = (req.body || {}) as {
            name?: string;
            color?: string;
            position?: number;
        };

        const update: any = {};
        if (name !== undefined) update.name = name;
        if (color !== undefined) update.color = color;
        if (position !== undefined) update.position = position;

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ error: "Nenhum campo para atualizar" });
        }

        const { data, error } = await supabaseAdmin
            .from("kanban_columns")
            .update(update)
            .eq("id", id)
            .select("id, name, color, position")
            .single();

        if (error) return res.status(500).json({ error: error.message });

        return res.json({
            id: data.id,
            title: data.name,
            color: data.color || "#6B7280",
            position: data.position,
        });
    });

    app.put("/kanban/boards/:boardId/columns/reorder", requireAuth, async (req, res) => {
        const { boardId } = req.params as { boardId: string };
        const { columnIds } = (req.body || {}) as { columnIds?: string[] };

        if (!Array.isArray(columnIds)) {
            return res.status(400).json({ error: "columnIds precisa ser um array" });
        }

        const normalized = columnIds.filter((id): id is string => typeof id === "string" && id.length > 0);
        if (normalized.length !== columnIds.length) {
            return res.status(400).json({ error: "columnIds cont�m valores inv�lidos" });
        }

        const unique = Array.from(new Set(normalized));
        if (unique.length !== normalized.length) {
            return res.status(400).json({ error: "columnIds cont�m duplicatas" });
        }

        const { data: existing, error: errExisting } = await supabaseAdmin
            .from("kanban_columns")
            .select("id, name, color, position")
            .eq("kanban_board_id", boardId)
            .order("position", { ascending: true });
        if (errExisting) return res.status(500).json({ error: errExisting.message });
        if (!existing || existing.length === 0) return res.json([]);

        const existingIds = existing.map((col: any) => col.id);
        const validRequested = unique.filter((id) => existingIds.includes(id));
        const missingInRequest = existingIds.filter((id) => !validRequested.includes(id));
        const finalOrder = [...validRequested, ...missingInRequest];

        const total = finalOrder.length;
        let tempPos = total + 1;
        for (const colId of finalOrder) {
            const { error: errTemp } = await supabaseAdmin
                .from("kanban_columns")
                .update({ position: tempPos++ })
                .eq("id", colId)
                .eq("kanban_board_id", boardId);
            if (errTemp) return res.status(500).json({ error: errTemp.message });
        }

        let finalPos = 1;
        for (const colId of finalOrder) {
            const { error: errFinal } = await supabaseAdmin
                .from("kanban_columns")
                .update({ position: finalPos++ })
                .eq("id", colId)
                .eq("kanban_board_id", boardId);
            if (errFinal) return res.status(500).json({ error: errFinal.message });
        }

        const { data: updated, error: errUpdated } = await supabaseAdmin
            .from("kanban_columns")
            .select("id, name, color, position")
            .eq("kanban_board_id", boardId)
            .order("position", { ascending: true });
        if (errUpdated) return res.status(500).json({ error: errUpdated.message });

        const mapped = (updated || []).map((col) => ({
            id: col.id,
            title: col.name,
            color: col.color || "#6B7280",
            position: col.position,
        }));

        try {
            io.emit("kanban:columns:reordered", { boardId, columns: mapped });
        } catch { }

        return res.json(mapped);
    });

    // GET cards do board
    app.get("/kanban/boards/:boardId/cards", requireAuth, async (req, res) => {
        const { boardId } = req.params;

        const { data, error } = await supabaseAdmin
            .from("kanban_cards")
            .select(`
      id, title, description, value_numeric, currency,
      owner_user_id, source, notes, kanban_column_id,
      email, contact, position, lead_id
    `)
            .eq("kanban_board_id", boardId)
            .order("kanban_column_id", { ascending: true })
            .order("position", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });

        const mapped = (data || []).map((r) => ({
            id: r.id,
            title: r.title,
            value: Number(r.value_numeric || 0),
            stage: r.kanban_column_id,
            owner: r.owner_user_id || null,
            description: (r as any).description || null,
            source: r.source || null,
            notes: r.notes || null,
            email: r.email || null,
            contact: r.contact || null,
            leadId: (r as any).lead_id || null,
            position: r.position,
        }));
        res.json(mapped);
    });


    // POST criar card
    app.post("/kanban/cards", async (req, res) => {
        const { boardId, columnId, title, value = 0, source = null, owner = null, email = null, contact = null, leadId = null } = req.body;

        if (!boardId || !columnId || !title) {
            return res.status(400).json({ error: "boardId, columnId e title s o obrigat rios" });
        }

        // calcula pr?xima posi??o da coluna
        const { data: last, error: errLast } = await supabaseAdmin
            .from("kanban_cards")
            .select("position")
            .eq("kanban_column_id", columnId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (errLast) return res.status(500).json({ error: errLast.message });

        const nextPos = (last?.position || 0) + 1;

        // Valida??o b?sica do owner (se informado) existir na tabela users
        if (owner) {
            const { data: uexists } = await supabaseAdmin
                .from("users")
                .select("id")
                .eq("id", owner)
                .maybeSingle();
            if (!uexists) return res.status(400).json({ error: "Usu?rio (owner) inv?lido" });
        }

        const { data, error } = await supabaseAdmin
            .from("kanban_cards")
            .insert([{
                kanban_board_id: boardId,
                kanban_column_id: columnId,
                title,
                value_numeric: value,
                source,
                owner_user_id: owner,
                email,
                contact,
                position: nextPos,
                ...(leadId ? { lead_id: leadId } : {})
            }])
            .select("*")
            .single();

        if (error) return res.status(500).json({ error: error.message });

        // If linked to a lead, sync lead's kanban fields
        try {
            const linkedLeadId = (data as any).lead_id as string | null;
            if (linkedLeadId) {
                await supabaseAdmin
                    .from("leads")
                    .update({
                        kanban_board_id: (data as any).kanban_board_id,
                        kanban_column_id: (data as any).kanban_column_id,
                        assigned_to_id: (data as any).owner_user_id || null,
                    })
                    .eq("id", linkedLeadId);
                // Best-effort: if there is a customers/customers row with same id, sync assigned_agent as well
                try {
                    // Try customers first
                    await supabaseAdmin
                        .from("customers")
                        .update({ assigned_agent: (data as any).owner_user_id || null })
                        .eq("id", linkedLeadId);
                    // Also try legacy table name customers (ignore errors if it doesn't exist)
                    try {
                        await supabaseAdmin
                            .from("customers")
                            .update({ assigned_agent: (data as any).owner_user_id || null })
                            .eq("lead_id", linkedLeadId);
                    } catch { }
                    // Emit update for any chats tied to this customer/lead
                    try {
                        const assignedId = (data as any).owner_user_id || null;
                        let assignedName: string | null = null;
                        if (assignedId) {
                            const { data: u } = await supabaseAdmin
                                .from("users")
                                .select("id, name")
                                .eq("id", assignedId)
                                .maybeSingle();
                            assignedName = (u as any)?.name || null;
                        }
                        // Find customers linked to this lead
                        let costumerIds: string[] = [];
                        try {
                            const { data: cRows } = await supabaseAdmin
                                .from("customers")
                                .select("id")
                                .eq("lead_id", linkedLeadId);
                            costumerIds = (cRows || []).map((r: any) => r.id).filter(Boolean);
                        } catch { }
                        // Collect chats and inboxes for authorization check
                        const chatIds: string[] = [];
                        const inboxIds: string[] = [];
                        try {
                            // Legacy: customer_id == lead id
                            const { data: chatsLegacy } = await supabaseAdmin
                                .from("chats")
                                .select("id,inbox_id")
                                .eq("customer_id", linkedLeadId);
                            for (const row of chatsLegacy || []) {
                                chatIds.push((row as any).id);
                                if ((row as any).inbox_id) inboxIds.push((row as any).inbox_id);
                            }
                        } catch { }
                        try {
                            if (costumerIds.length > 0) {
                                const { data: chatsByCostumer } = await supabaseAdmin
                                    .from("chats")
                                    .select("id,inbox_id")
                                    .in("customer_id", costumerIds);
                                for (const row of chatsByCostumer || []) {
                                    chatIds.push((row as any).id);
                                    if ((row as any).inbox_id) inboxIds.push((row as any).inbox_id);
                                }
                            }
                        } catch { }
                        const uniqChatIds = Array.from(new Set(chatIds));
                        const uniqInboxIds = Array.from(new Set(inboxIds));

                        // Determine if assigned user is allowed in at least one inbox for this customer
                        let allowed = false;
                        if (assignedId && uniqInboxIds.length > 0) {
                            try {
                                const { data: links } = await supabaseAdmin
                                    .from("inbox_users")
                                    .select("id")
                                    .eq("user_id", assignedId)
                                    .in("inbox_id", uniqInboxIds);
                                allowed = !!(links && (links as any[]).length > 0);
                            } catch { }
                        }

                        const effectiveAssignedId = assignedId && allowed ? assignedId : null;
                        const effectiveAssignedName = assignedId && allowed ? assignedName : null;

                        // Ensure contact tables reflect the effective assignment
                        try {
                            await supabaseAdmin
                                .from("customers")
                                .update({ assigned_agent: effectiveAssignedId })
                                .eq("id", linkedLeadId);
                        } catch { }
                        try {
                            await supabaseAdmin
                                .from("customers")
                                .update({ assigned_agent: effectiveAssignedId })
                                .eq("lead_id", linkedLeadId);
                        } catch { }

                        for (const cid of uniqChatIds) {
                            io.emit("chat:updated", {
                                chatId: cid,
                                assigned_agent_id: effectiveAssignedId,
                                assigned_agent_name: effectiveAssignedName,
                            });
                        }
                    } catch { }
                } catch { }
            }
        } catch (e) {
            // log only; do not fail card creation if lead update fails
            console.error("Failed to sync lead after card create:", e);
        }

        const mapped = {
            id: data.id,
            title: data.title,
            value: Number(data.value_numeric || 0),
            stage: data.kanban_column_id,
            owner: data.owner_user_id || null,
            source: data.source || null,
            notes: data.notes || null,
            email: data.email || null,
            contact: data.contact || null,
            leadId: (data as any).lead_id || null,
            position: Number((data as any).position ?? 0),
        };
        // Notify listeners (e.g., funnel UIs) about the new/updated card
        try {
            io.emit("kanban:card:updated", mapped);
        } catch { }
        res.status(201).json(mapped);
    });

    // PUT atualizar card (titulo, valor, stage, etc.)
    app.put("/kanban/cards/:id", async (req, res) => {
        const { id } = req.params;
        const patch = req.body as Partial<{
            title: string; value: number; stage: string; owner: string; source: string;
            notes: string; email: string; contact: string; leadId: string | null;
            description: string | null; position: number;
        }>;
        const TEMP_POSITION = 1_000_000;
        const computeTemporaryPosition = (cardId: string) => {
            const hex = (cardId || "").replace(/[^0-9a-f]/gi, "");
            if (!hex) return TEMP_POSITION + 1;
            const slice = hex.slice(-12);
            const parsed = Number.parseInt(slice, 16);
            const suffix = Number.isFinite(parsed) ? parsed : 0;
            return TEMP_POSITION + 1 + (suffix % 900_000);
        };
        type PositionUpdate = { id: string; finalPosition: number; currentPosition: number };

        const applyPositionUpdates = async (entries: PositionUpdate[]) => {
            if (!entries.length) return;
            const increases = entries
                .filter((entry) => entry.finalPosition > entry.currentPosition)
                .sort((a, b) => b.finalPosition - a.finalPosition);
            for (const entry of increases) {
                const { error } = await supabaseAdmin
                    .from("kanban_cards")
                    .update({ position: entry.finalPosition })
                    .eq("id", entry.id);
                if (error) throw new Error(error.message);
            }
            const decreases = entries
                .filter((entry) => entry.finalPosition < entry.currentPosition)
                .sort((a, b) => a.finalPosition - b.finalPosition);
            for (const entry of decreases) {
                const { error } = await supabaseAdmin
                    .from("kanban_cards")
                    .update({ position: entry.finalPosition })
                    .eq("id", entry.id);
                if (error) throw new Error(error.message);
            }
        };

        let originalCard: any = null;
        let movedToTemporary = false;
        const columnsToSync = new Set<string>();

        try {
            const { data: current, error: errCurrent } = await supabaseAdmin
                .from("kanban_cards")
                .select("id, kanban_board_id, kanban_column_id, position")
                .eq("id", id)
                .maybeSingle();
            if (errCurrent) return res.status(500).json({ error: errCurrent.message });
            if (!current) return res.status(404).json({ error: "Card nao encontrado" });
            originalCard = current;

            columnsToSync.add(current.kanban_column_id);

            const updatePayload: any = {};
            if (patch.title !== undefined) updatePayload.title = patch.title;
            if (patch.value !== undefined) updatePayload.value_numeric = patch.value;
            if (patch.stage !== undefined) updatePayload.kanban_column_id = patch.stage;
            if (patch.owner !== undefined) {
                if (patch.owner) {
                    const { data: uexists } = await supabaseAdmin
                        .from("users")
                        .select("id")
                        .eq("id", patch.owner)
                        .maybeSingle();
                    if (!uexists) return res.status(400).json({ error: "Usuario (owner) invalido" });
                }
                updatePayload.owner_user_id = patch.owner;
            }
            if (patch.source !== undefined) updatePayload.source = patch.source;
            if (patch.notes !== undefined) updatePayload.notes = patch.notes;
            if (patch.email !== undefined) updatePayload.email = patch.email;
            if (patch.contact !== undefined) updatePayload.contact = patch.contact;
            if (patch.leadId !== undefined) updatePayload.lead_id = patch.leadId;
            if (patch.description !== undefined) updatePayload.description = patch.description;

            const targetColumnId = patch.stage ?? current.kanban_column_id;
            const stageChanged = targetColumnId !== current.kanban_column_id;
            const shouldReorder = patch.stage !== undefined || patch.position !== undefined;

            let finalPosition: number | null = null;
            let destUpdates: PositionUpdate[] = [];
            let sourceUpdates: PositionUpdate[] = [];
            let needsReorder = stageChanged;

            if (stageChanged) {
                const { data: sourceData, error: errSource } = await supabaseAdmin
                    .from("kanban_cards")
                    .select("id, position")
                    .eq("kanban_column_id", current.kanban_column_id)
                    .neq("id", id)
                    .order("position", { ascending: true });
                if (errSource) return res.status(500).json({ error: errSource.message });
                sourceUpdates = (sourceData || []).map((row: any, idx: number) => ({
                    id: row.id,
                    finalPosition: idx + 1,
                    currentPosition: Number(row.position ?? idx + 1),
                }));
            }

            if (shouldReorder) {
                const { data: destData, error: errDest } = await supabaseAdmin
                    .from("kanban_cards")
                    .select("id, position")
                    .eq("kanban_column_id", targetColumnId)
                    .neq("id", id)
                    .order("position", { ascending: true });
                if (errDest) return res.status(500).json({ error: errDest.message });

                const destCards = destData || [];
                const destCount = destCards.length;
                const desiredIndex =
                    typeof patch.position === "number" && Number.isFinite(patch.position)
                        ? Math.max(0, Math.min(destCount, Math.floor(patch.position) - 1))
                        : destCount;

                finalPosition = desiredIndex + 1;
                const destIds = destCards.map((row: any) => row.id);
                destIds.splice(desiredIndex, 0, id);

                const destCurrentMap = new Map(
                    destCards.map((row: any) => [row.id, Number(row.position ?? 0)]),
                );
                const destSequence = destIds.map((cardId, idx) => ({
                    cardId,
                    finalPosition: idx + 1,
                }));

                destUpdates = destSequence
                    .filter((entry) => entry.cardId !== id)
                    .map((entry) => ({
                        id: entry.cardId,
                        finalPosition: entry.finalPosition,
                        currentPosition: destCurrentMap.get(entry.cardId) ?? entry.finalPosition,
                    }));

                if (!needsReorder) {
                    const currentPos = Number(current.position ?? 0);
                    needsReorder = stageChanged || currentPos !== finalPosition;
                }

                columnsToSync.add(targetColumnId);
            }

            if (!needsReorder && Object.keys(updatePayload).length === 0) {
                const { data: unchanged, error: errUnchanged } = await supabaseAdmin
                    .from("kanban_cards")
                    .select("*")
                    .eq("id", id)
                    .single();
                if (errUnchanged) return res.status(500).json({ error: errUnchanged.message });

                const mapped = {
                    id: unchanged.id,
                    title: unchanged.title,
                    value: Number((unchanged as any).value_numeric || 0),
                    stage: (unchanged as any).kanban_column_id,
                    owner: (unchanged as any).owner_user_id || null,
                    source: unchanged.source || null,
                    notes: unchanged.notes || null,
                    email: unchanged.email || null,
                    contact: unchanged.contact || null,
                    leadId: (unchanged as any).lead_id || null,
                    position: Number((unchanged as any).position ?? 0),
                };
                try {
                    io.emit("kanban:card:updated", mapped);
                } catch { }
                return res.json(mapped);
            }

            let updatedCard: any = null;

            if (needsReorder) {
                const basePayload = { ...updatePayload };
                if (stageChanged && basePayload.kanban_column_id === undefined) {
                    basePayload.kanban_column_id = targetColumnId;
                }
                const temporaryPosition = computeTemporaryPosition(id);
                const { error: errTempUpdate } = await supabaseAdmin
                    .from("kanban_cards")
                    .update({ ...basePayload, position: temporaryPosition })
                    .eq("id", id);
                if (errTempUpdate) return res.status(500).json({ error: errTempUpdate.message });
                movedToTemporary = true;

                if (sourceUpdates.length) {
                    await applyPositionUpdates(sourceUpdates);
                }
                if (destUpdates.length) {
                    await applyPositionUpdates(destUpdates);
                }

                const finalUpdatePayload: any = { position: finalPosition ?? 1 };
                if (stageChanged && updatePayload.kanban_column_id === undefined) {
                    finalUpdatePayload.kanban_column_id = targetColumnId;
                }

                const { data: reordered, error: errFinal } = await supabaseAdmin
                    .from("kanban_cards")
                    .update(finalUpdatePayload)
                    .eq("id", id)
                    .select("*")
                    .single();
                if (errFinal) return res.status(500).json({ error: errFinal.message });
                updatedCard = reordered;
            } else {
                const { data: simpleUpdate, error: errSimple } = await supabaseAdmin
                    .from("kanban_cards")
                    .update(updatePayload)
                    .eq("id", id)
                    .select("*")
                    .single();
                if (errSimple) return res.status(500).json({ error: errSimple.message });
                updatedCard = simpleUpdate;
            }

            // If linked to a lead, sync lead's kanban fields according to updated card
            try {
                const linkedLeadId = (updatedCard as any).lead_id as string | null;
                if (linkedLeadId) {
                    await supabaseAdmin
                        .from("leads")
                        .update({
                            kanban_board_id: (updatedCard as any).kanban_board_id,
                            kanban_column_id: (updatedCard as any).kanban_column_id,
                            assigned_to_id: (updatedCard as any).owner_user_id || null,
                        })
                        .eq("id", linkedLeadId);
                    // Best-effort: sync customers/customers.assigned_agent if customer is linked to this lead
                    try {
                        // Emit update for any chats tied to this customer/lead and set contact assignment if allowed in inbox
                        try {
                            const assignedId = (updatedCard as any).owner_user_id || null;
                            let assignedName: string | null = null;
                            if (assignedId) {
                                const { data: u } = await supabaseAdmin
                                    .from("users")
                                    .select("id, name")
                                    .eq("id", assignedId)
                                    .maybeSingle();
                                assignedName = (u as any)?.name || null;
                            }
                            // Find customers linked to this lead
                            let costumerIds: string[] = [];
                            try {
                                const { data: cRows } = await supabaseAdmin
                                    .from("customers")
                                    .select("id")
                                    .eq("lead_id", linkedLeadId);
                                costumerIds = (cRows || []).map((r: any) => r.id).filter(Boolean);
                            } catch { }
                            // Collect chats and inboxes
                            const chatIds: string[] = [];
                            const inboxIds: string[] = [];
                            try {
                                const { data: chatsLegacy } = await supabaseAdmin
                                    .from("chats")
                                    .select("id,inbox_id")
                                    .eq("customer_id", linkedLeadId);
                                for (const row of chatsLegacy || []) {
                                    chatIds.push((row as any).id);
                                    if ((row as any).inbox_id) inboxIds.push((row as any).inbox_id);
                                }
                            } catch { }
                            try {
                                if (costumerIds.length > 0) {
                                    const { data: chatsByCostumer } = await supabaseAdmin
                                        .from("chats")
                                        .select("id,inbox_id")
                                        .in("customer_id", costumerIds);
                                    for (const row of chatsByCostumer || []) {
                                        chatIds.push((row as any).id);
                                        if ((row as any).inbox_id) inboxIds.push((row as any).inbox_id);
                                    }
                                }
                            } catch { }
                            const uniqChatIds = Array.from(new Set(chatIds));
                            const uniqInboxIds = Array.from(new Set(inboxIds));

                            // Check authorization of assigned user for inboxes
                            let allowed = false;
                            if (assignedId && uniqInboxIds.length > 0) {
                                try {
                                    const { data: links } = await supabaseAdmin
                                        .from("inbox_users")
                                        .select("id")
                                        .eq("user_id", assignedId)
                                        .in("inbox_id", uniqInboxIds);
                                    allowed = !!(links && links.length);
                                } catch {
                                    allowed = false;
                                }
                            } else {
                                allowed = true;
                            }

                            const effectiveAssignedId = allowed ? assignedId : null;
                            const effectiveAssignedName = allowed ? assignedName : null;

                            // Sync customers table assignment
                            try {
                                await supabaseAdmin
                                    .from("customers")
                                    .update({ assigned_agent: effectiveAssignedId })
                                    .eq("lead_id", linkedLeadId);
                            } catch { }

                            for (const cid of uniqChatIds) {
                                io.emit("chat:updated", {
                                    chatId: cid,
                                    assigned_agent_id: effectiveAssignedId,
                                    assigned_agent_name: effectiveAssignedName,
                                });
                            }
                        } catch { }
                    } catch { }
                }
            } catch (e) {
                console.error("Failed to sync lead after card update:", e);
            }

            const mapped = {
                id: updatedCard.id,
                title: updatedCard.title,
                value: Number((updatedCard as any).value_numeric || 0),
                stage: (updatedCard as any).kanban_column_id,
                owner: (updatedCard as any).owner_user_id || null,
                source: updatedCard.source || null,
                notes: updatedCard.notes || null,
                email: updatedCard.email || null,
                contact: updatedCard.contact || null,
                leadId: (updatedCard as any).lead_id || null,
                position: Number((updatedCard as any).position ?? 0),
            };
            // Notify listeners (e.g., funnel UIs) about the card update
            try {
                io.emit("kanban:card:updated", mapped);
            } catch { }

            if (needsReorder) {
                const columnsToEmit = Array.from(columnsToSync);
                for (const columnId of columnsToEmit) {
                    try {
                        const { data: colCards, error: errColCards } = await supabaseAdmin
                            .from("kanban_cards")
                            .select("id, title, value_numeric, kanban_column_id, owner_user_id, source, notes, email, contact, lead_id, position")
                            .eq("kanban_column_id", columnId)
                            .order("position", { ascending: true });
                        if (errColCards) continue;
                        const payloadCards = (colCards || []).map((row: any) => ({
                            id: row.id,
                            title: row.title,
                            value: Number(row.value_numeric || 0),
                            stage: row.kanban_column_id,
                            owner: row.owner_user_id || null,
                            source: row.source || null,
                            notes: row.notes || null,
                            email: row.email || null,
                            contact: row.contact || null,
                            leadId: (row as any).lead_id || null,
                            position: Number(row.position ?? 0),
                        }));
                        try {
                            io.emit("kanban:column:reordered", { columnId, cards: payloadCards });
                        } catch { }
                    } catch { }
                }
            }

            res.json(mapped);
        } catch (e: any) {
            if (movedToTemporary && originalCard) {
                try {
                    await supabaseAdmin
                        .from("kanban_cards")
                        .update({
                            kanban_column_id: originalCard.kanban_column_id,
                            position: originalCard.position,
                        })
                        .eq("id", id);
                } catch (revertError) {
                    console.error("Failed to revert card after error:", revertError);
                }
            }
            console.error("PUT /kanban/cards/:id error:", e);
            return res.status(500).json({ error: e?.message || "Erro ao atualizar card" });
        }
    });

    // Util: backfill sync from kanban_cards -> leads for current company
    app.post("/kanban/sync-leads", requireAuth, async (req: any, res) => {
        try {
            const userId = req.user.id;
            const { data: userRow, error: errUser } = await supabaseAdmin
                .from("users")
                .select("company_id")
                .eq("user_id", userId)
                .maybeSingle();
            if (errUser) return res.status(500).json({ error: errUser.message });
            if (!userRow?.company_id) return res.status(404).json({ error: "Usu rio sem company_id" });

            // fetch cards for boards of this company
            const { data: boards, error: errBoards } = await supabaseAdmin
                .from("kanban_boards")
                .select("id")
                .eq("company_id", userRow.company_id);
            if (errBoards) return res.status(500).json({ error: errBoards.message });
            const boardIds = (boards || []).map((b: any) => b.id);
            if (boardIds.length === 0) return res.json({ updated: 0 });

            const { data: cards, error: errCards } = await supabaseAdmin
                .from("kanban_cards")
                .select("id, kanban_board_id, kanban_column_id, owner_user_id, lead_id")
                .in("kanban_board_id", boardIds);
            if (errCards) return res.status(500).json({ error: errCards.message });

            const toSync = (cards || []).filter((c: any) => !!c.lead_id);
            let updated = 0;
            for (const c of toSync) {
                const { error: errUp } = await supabaseAdmin
                    .from("leads")
                    .update({
                        kanban_board_id: c.kanban_board_id,
                        kanban_column_id: c.kanban_column_id,
                        assigned_to_id: c.owner_user_id || null,
                    })
                    .eq("id", c.lead_id as string);
                if (!errUp) updated++;
            }

            return res.json({ updated });
        } catch (e: any) {
            return res.status(500).json({ error: e?.message || "Sync error" });
        }
    });

    // GET users with role AGENT or SUPERVISOR in same company
    app.get("/users/agents-supervisors", requireAuth, async (req: any, res) => {
        const userId = req.user.id;

        const { data: userRow, error: errUser } = await supabaseAdmin
            .from("users")
            .select("company_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (errUser) return res.status(500).json({ error: errUser.message });
        if (!userRow?.company_id) return res.status(404).json({ error: "Usu rio sem company_id" });

        const { data, error } = await supabaseAdmin
            .from("users")
            .select("id, user_id, name, role")
            .eq("company_id", userRow.company_id)
            .in("role", ["AGENT", "SUPERVISOR", "TECHNICIAN", "MANAGER", "ADMIN"])
            .order("name", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });

        // Importante: retornar id = users.id (PK local) pois kanban_cards.owner_user_id referencia esta PK
        return res.json(
            (data || []).map((u) => ({ id: (u as any).id, name: (u as any).name || (u as any).id, role: (u as any).role }))
        );
    });

    // DELETE excluir coluna do kanban
    app.delete("/kanban/columns/:id", requireAuth, async (req: any, res) => {
        try {
            const columnId = String(req.params.id);
            const moveTo = (req.query.moveTo as string | undefined)?.trim() || null;
            const force = String(req.query.force || "false").toLowerCase() === "true";

            // 1) Descobre company_id do usuário
            const authUserId = String(req.user?.id || "");
            const { data: urow, error: errU } = await supabaseAdmin
                .from("users")
                .select("company_id, id, user_id")
                .or(`user_id.eq.${authUserId},id.eq.${authUserId}`)
                .maybeSingle();
            if (errU) return res.status(500).json({ error: errU.message });
            if (!urow?.company_id) return res.status(404).json({ error: "Usuário sem company_id" });
            const companyId = String(urow.company_id);

            // 2) Busca a coluna e valida o board/empresa
            const { data: col, error: errCol } = await supabaseAdmin
                .from("kanban_columns")
                .select("id, kanban_board_id, position, name")
                .eq("id", columnId)
                .maybeSingle();
            if (errCol) return res.status(500).json({ error: errCol.message });
            if (!col) return res.status(404).json({ error: "Coluna não encontrada" });

            const { data: board, error: errBoard } = await supabaseAdmin
                .from("kanban_boards")
                .select("id, company_id")
                .eq("id", col.kanban_board_id)
                .maybeSingle();
            if (errBoard) return res.status(500).json({ error: errBoard.message });
            if (!board || board.company_id !== companyId) {
                return res.status(403).json({ error: "Sem permissão para este board/coluna" });
            }

            // 3) Conta cards na coluna
            const { data: cards, error: errCards } = await supabaseAdmin
                .from("kanban_cards")
                .select("id, position")
                .eq("kanban_column_id", columnId)
                .order("position", { ascending: true });
            if (errCards) return res.status(500).json({ error: errCards.message });

            const hasCards = !!(cards && cards.length);

            // 4) Se tem cards, decidir política
            if (hasCards) {
                if (moveTo) {
                    // 4.1) Validar coluna destino (mesmo board)
                    const { data: targetCol, error: errTarget } = await supabaseAdmin
                        .from("kanban_columns")
                        .select("id, kanban_board_id")
                        .eq("id", moveTo)
                        .maybeSingle();
                    if (errTarget) return res.status(500).json({ error: errTarget.message });
                    if (!targetCol) return res.status(400).json({ error: "Coluna destino inexistente" });
                    if (targetCol.kanban_board_id !== col.kanban_board_id) {
                        return res.status(400).json({ error: "Coluna destino deve ser do mesmo board" });
                    }

                    // 4.2) Pega posição máxima na coluna destino
                    const { data: lastInTarget } = await supabaseAdmin
                        .from("kanban_cards")
                        .select("position")
                        .eq("kanban_column_id", targetCol.id)
                        .order("position", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    let nextPos = (lastInTarget?.position || 0) + 1;

                    // 4.3) Move cards preservando ordem relativa
                    for (const card of cards) {
                        const { error: errMove } = await supabaseAdmin
                            .from("kanban_cards")
                            .update({ kanban_column_id: targetCol.id, position: nextPos++ })
                            .eq("id", card.id);
                        if (errMove) return res.status(500).json({ error: errMove.message });
                    }
                } else if (force) {
                    // 4.4) Força exclusão de cards
                    const { error: errDelCards } = await supabaseAdmin
                        .from("kanban_cards")
                        .delete()
                        .eq("kanban_column_id", columnId);
                    if (errDelCards) return res.status(500).json({ error: errDelCards.message });
                } else {
                    // 4.5) Bloqueia exclusão
                    return res.status(409).json({
                        error:
                            "Coluna possui cards. Use ?moveTo=<coluna_destino> para mover os cards ou ?force=true para apagar tudo.",
                    });
                }
            }

            // 5) Exclui a coluna
            const { error: errDelCol } = await supabaseAdmin
                .from("kanban_columns")
                .delete()
                .eq("id", columnId);
            if (errDelCol) return res.status(500).json({ error: errDelCol.message });

            // 6) Normaliza posições das colunas restantes do board
            const { data: colsLeft, error: errColsLeft } = await supabaseAdmin
                .from("kanban_columns")
                .select("id")
                .eq("kanban_board_id", col.kanban_board_id)
                .order("position", { ascending: true });
            if (!errColsLeft && colsLeft) {
                let pos = 1;
                for (const c of colsLeft) {
                    await supabaseAdmin.from("kanban_columns").update({ position: pos++ }).eq("id", c.id);
                }
            }

            // 7) Evento de socket (best-effort)
            try {
                io.emit("kanban:column:deleted", {
                    id: columnId,
                    boardId: col.kanban_board_id,
                    movedTo: moveTo || null,
                    force,
                });
            } catch { }

            return res.status(204).send(); // sem conteúdo
        } catch (e: any) {
            console.error("DELETE /kanban/columns/:id error:", e);
            return res.status(500).json({ error: e?.message || "delete column error" });
        }
    });

    // POST /kanban/cards/ensure
    // Body: { boardId, columnId, title, leadId?, explicitLeadId?, email?, phone?, note? }
    app.post("/kanban/cards/ensure", requireAuth, async (req: any, res) => {
        try {
            const authUserId = String(req.user?.id || "");
            const { data: urow, error: errU } = await supabaseAdmin
                .from("users")
                .select("company_id, id, user_id")
                .or(`user_id.eq.${authUserId},id.eq.${authUserId}`)
                .maybeSingle();
            if (errU) return res.status(500).json({ error: errU.message });
            if (!urow?.company_id) return res.status(404).json({ error: "Usuário sem company_id" });

            const companyId = String(urow.company_id);
            const {
                boardId,
                columnId,
                title,
                leadId,
                explicitLeadId,
                email,
                phone,
                note,
            } = (req.body || {}) as {
                boardId: string;
                columnId: string;
                title: string;
                leadId?: string;
                explicitLeadId?: string;
                email?: string;
                phone?: string;
                note?: string;
            };

            if (!boardId || !columnId || !title) {
                return res.status(400).json({ error: "boardId, columnId e title são obrigatórios" });
            }

            // board pertence à empresa?
            const { data: board, error: errBoard } = await supabaseAdmin
                .from("kanban_boards")
                .select("id, company_id")
                .eq("id", boardId)
                .maybeSingle();
            if (errBoard) return res.status(500).json({ error: errBoard.message });
            if (!board || String(board.company_id) !== companyId) {
                return res.status(403).json({ error: "Sem permissão para este board" });
            }

            // 1) Tenta localizar card existente
            const candidateLeadId = explicitLeadId || leadId || null;
            let card: any = null;

            if (candidateLeadId) {
                const { data: byLead, error: e1 } = await supabaseAdmin
                    .from("kanban_cards")
                    .select("id, kanban_board_id, kanban_column_id, position")
                    .eq("kanban_board_id", boardId)
                    .eq("lead_id", candidateLeadId)
                    .limit(1)
                    .maybeSingle();
                if (e1) return res.status(500).json({ error: e1.message });
                if (byLead) card = byLead;
            }

            if (!card && (email || phone)) {
                // busca por email/phone no mesmo board
                let q = supabaseAdmin
                    .from("kanban_cards")
                    .select("id, kanban_board_id, kanban_column_id, position")
                    .eq("kanban_board_id", boardId)
                    .limit(1);
                if (email && phone) {
                    q = q.or(`email.eq.${email},contact.eq.${phone}`);
                } else if (email) {
                    q = q.eq("email", email);
                } else if (phone) {
                    q = q.eq("contact", phone);
                }
                const { data: byContact, error: e2 } = await q.maybeSingle();
                if (e2) return res.status(500).json({ error: e2.message });
                if (byContact) card = byContact;
            }

            // 2) Se encontrou → move de coluna (se necessário) + atualiza nota (opcional)
            if (card) {
                const patch: any = {};
                if (card.kanban_column_id !== columnId) {
                    // calcula próxima posição da coluna destino
                    const { data: last, error: errLast } = await supabaseAdmin
                        .from("kanban_cards")
                        .select("position")
                        .eq("kanban_column_id", columnId)
                        .order("position", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (errLast) return res.status(500).json({ error: errLast.message });
                    patch.kanban_column_id = columnId;
                    patch.position = (last?.position || 0) + 1;
                }
                if (note !== undefined && note !== null) patch.notes = String(note);

                if (Object.keys(patch).length > 0) {
                    const { error: errUp } = await supabaseAdmin
                        .from("kanban_cards")
                        .update(patch)
                        .eq("id", card.id);
                    if (errUp) return res.status(500).json({ error: errUp.message });
                }

                try {
                    io.emit("kanban:card:updated", { id: card.id, stage: columnId });
                } catch { }
                return res.json({ cardId: card.id, created: false, updated: true });
            }

            // 3) Não encontrou → cria card novo na coluna
            const { data: lastInDest, error: errLast2 } = await supabaseAdmin
                .from("kanban_cards")
                .select("position")
                .eq("kanban_column_id", columnId)
                .order("position", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (errLast2) return res.status(500).json({ error: errLast2.message });

            const ins = {
                kanban_board_id: boardId,
                kanban_column_id: columnId,
                title: String(title),
                position: (lastInDest?.position || 0) + 1,
                ...(candidateLeadId ? { lead_id: candidateLeadId } : {}),
                ...(email ? { email } : {}),
                ...(phone ? { contact: phone } : {}),
                ...(note ? { notes: String(note) } : {}),
            };

            const { data: created, error: errIns } = await supabaseAdmin
                .from("kanban_cards")
                .insert([ins])
                .select("id, kanban_board_id, kanban_column_id, position")
                .maybeSingle();
            if (errIns) return res.status(500).json({ error: errIns.message });

            // sincroniza lead (se houver)
            try {
                if (candidateLeadId) {
                    await supabaseAdmin
                        .from("leads")
                        .update({
                            kanban_board_id: boardId,
                            kanban_column_id: columnId,
                        })
                        .eq("id", candidateLeadId);
                }
            } catch { }

            try {
                io.emit("kanban:card:updated", { id: created?.id, stage: columnId, created: true });
            } catch { }

            return res.status(201).json({ cardId: created?.id, created: true, updated: false });
        } catch (e: any) {
            console.error("POST /kanban/cards/ensure error:", e);
            return res.status(500).json({ error: e?.message || "ensure card error" });
        }
    });





    // ================== FIM DO BLOCO DE ROTAS ==================
}
