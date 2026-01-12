import type { Application } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";

const TeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional().default(true),
  auto_assign: z.boolean().optional().default(true),
  max_concurrent_chats: z.number().int().min(1).max(100).optional().default(10),
  priority: z.number().int().min(0).max(100).optional().default(0),
});

const TeamMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["MEMBER", "LEAD", "MANAGER"]).optional().default("MEMBER"),
});

const TeamScheduleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: z.string().optional().default("America/Sao_Paulo"),
  is_active: z.boolean().optional().default(true),
});

export function registerTeamsRoutes(app: Application) {
  console.log("[TEAMS] 👥 Registering teams routes");
  
  // 📋 GET /api/teams - Listar times da empresa
  app.get("/api/teams", requireAuth, async (req: any, res) => {
    try {
      console.log("[GET /api/teams] Request received");
      console.log("[GET /api/teams] req.user:", req.user);
      
      const companyId = req.user?.company_id;
      if (!companyId) {
        console.error("[GET /api/teams] No company_id found in req.user");
        return res.status(401).json({ error: "Empresa não identificada" });
      }

      console.log("[GET /api/teams] Querying for company_id:", companyId);

      const { data, error } = await supabaseAdmin
        .from("teams")
        .select(`
          *,
          department:departments(id, name, color),
          members:team_members(count),
          active_chats:chats!team_id(count)
        `)
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      console.log("[GET /api/teams] Query result - data:", data, "error:", error);

      if (error) {
        console.error("[GET /api/teams] Database error:", error);
        throw error;
      }

      console.log("[GET /api/teams] Returning", data?.length || 0, "teams");
      return res.json(data || []);
    } catch (error: any) {
      console.error("[GET /api/teams] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 🔍 GET /api/teams/:id - Buscar time específico
  app.get("/api/teams/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;

      const { data, error } = await supabaseAdmin
        .from("teams")
        .select(`
          *,
          department:departments(id, name, color),
          members:team_members(
            id,
            role,
            joined_at,
            user:users(id, name, email, avatar)
          ),
          schedules:team_schedules(*)
        `)
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      return res.json(data);
    } catch (error: any) {
      console.error("[GET /api/teams/:id] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ➕ POST /api/teams - Criar time
  app.post("/api/teams", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) {
        return res.status(401).json({ error: "Empresa não identificada" });
      }

      const parsed = TeamSchema.parse(req.body);

      // Verificar se já existe time com mesmo nome
      const { data: existing } = await supabaseAdmin
        .from("teams")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", parsed.name)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({
          error: "Já existe um time com este nome",
        });
      }

      // Se department_id fornecido, validar que pertence à empresa
      if (parsed.department_id) {
        const { data: dept } = await supabaseAdmin
          .from("departments")
          .select("id")
          .eq("id", parsed.department_id)
          .eq("company_id", companyId)
          .maybeSingle();

        if (!dept) {
          return res.status(400).json({
            error: "Departamento não encontrado ou não pertence a esta empresa",
          });
        }
      }

      const { data, error } = await supabaseAdmin
        .from("teams")
        .insert({
          ...parsed,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[POST /api/teams] Created: ${data.id} - ${data.name}`);
      return res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.issues,
        });
      }
      console.error("[POST /api/teams] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ✏️ PUT /api/teams/:id - Atualizar time
  app.put("/api/teams/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;
      const parsed = TeamSchema.partial().parse(req.body);

      // Verificar propriedade
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("company_id")
        .eq("id", id)
        .maybeSingle();

      if (!team || team.company_id !== companyId) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      // Se mudando nome, verificar duplicatas
      if (parsed.name) {
        const { data: existing } = await supabaseAdmin
          .from("teams")
          .select("id")
          .eq("company_id", companyId)
          .ilike("name", parsed.name)
          .neq("id", id)
          .maybeSingle();

        if (existing) {
          return res.status(409).json({
            error: "Já existe outro time com este nome",
          });
        }
      }

      // Se department_id fornecido, validar
      if (parsed.department_id) {
        const { data: dept } = await supabaseAdmin
          .from("departments")
          .select("id")
          .eq("id", parsed.department_id)
          .eq("company_id", companyId)
          .maybeSingle();

        if (!dept) {
          return res.status(400).json({
            error: "Departamento não encontrado",
          });
        }
      }

      const { data, error } = await supabaseAdmin
        .from("teams")
        .update(parsed)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[PUT /api/teams/:id] Updated: ${id}`);
      return res.json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.issues,
        });
      }
      console.error("[PUT /api/teams/:id] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 🗑️ DELETE /api/teams/:id - Deletar time
  app.delete("/api/teams/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;

      // Verificar propriedade
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("company_id, name")
        .eq("id", id)
        .maybeSingle();

      if (!team || team.company_id !== companyId) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      // Verificar se há chats vinculados
      const { count: chatsCount } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("team_id", id);

      if (chatsCount && chatsCount > 0) {
        return res.status(409).json({
          error: `Não é possível excluir time com ${chatsCount} conversa(s) vinculada(s)`,
          chats_count: chatsCount,
        });
      }

      const { error } = await supabaseAdmin.from("teams").delete().eq("id", id);

      if (error) throw error;

      console.log(`[DELETE /api/teams/:id] Deleted: ${id} - ${team.name}`);
      return res.status(204).send();
    } catch (error: any) {
      console.error("[DELETE /api/teams/:id] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 👥 GET /api/teams/:id/members - Listar membros do time
  app.get("/api/teams/:id/members", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;

      // Verificar propriedade do time
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("company_id")
        .eq("id", id)
        .maybeSingle();

      if (!team || team.company_id !== companyId) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      const { data, error } = await supabaseAdmin
        .from("team_members")
        .select(`
          id,
          role,
          joined_at,
          user:users(id, name, email, avatar, role)
        `)
        .eq("team_id", id)
        .order("joined_at", { ascending: true });

      if (error) throw error;

      return res.json(data || []);
    } catch (error: any) {
      console.error("[GET /api/teams/:id/members] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ➕ POST /api/teams/:id/members - Adicionar membro ao time
  app.post("/api/teams/:id/members", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;
      const parsed = TeamMemberSchema.parse(req.body);

      // Verificar propriedade do time
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("company_id")
        .eq("id", id)
        .maybeSingle();

      if (!team || team.company_id !== companyId) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      // Verificar que o usuário pertence à mesma empresa
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("id", parsed.user_id)
        .maybeSingle();

      if (!user || user.company_id !== companyId) {
        return res.status(400).json({
          error: "Usuário não encontrado ou não pertence a esta empresa",
        });
      }

      // Verificar se já é membro
      const { data: existing } = await supabaseAdmin
        .from("team_members")
        .select("id")
        .eq("team_id", id)
        .eq("user_id", parsed.user_id)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({
          error: "Usuário já é membro deste time",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("team_members")
        .insert({
          team_id: id,
          user_id: parsed.user_id,
          role: parsed.role,
        })
        .select(`
          id,
          role,
          joined_at,
          user:users(id, name, email, avatar)
        `)
        .single();

      if (error) throw error;

      console.log(`[POST /api/teams/:id/members] Added member: ${parsed.user_id} to team ${id}`);
      return res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.issues,
        });
      }
      console.error("[POST /api/teams/:id/members] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 🗑️ DELETE /api/teams/:id/members/:memberId - Remover membro do time
  app.delete("/api/teams/:teamId/members/:memberId", requireAuth, async (req: any, res) => {
    try {
      const { teamId, memberId } = req.params;
      const companyId = req.user.company_id;

      // Verificar propriedade do time
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("company_id")
        .eq("id", teamId)
        .maybeSingle();

      if (!team || team.company_id !== companyId) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      const { error } = await supabaseAdmin
        .from("team_members")
        .delete()
        .eq("id", memberId)
        .eq("team_id", teamId);

      if (error) throw error;

      console.log(`[DELETE /api/teams/:teamId/members/:memberId] Removed member: ${memberId}`);
      return res.status(204).send();
    } catch (error: any) {
      console.error("[DELETE /api/teams/:teamId/members/:memberId] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 📅 GET /api/teams/:id/schedules - Listar horários do time
  app.get("/api/teams/:id/schedules", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;

      // Verificar propriedade do time
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("company_id")
        .eq("id", id)
        .maybeSingle();

      if (!team || team.company_id !== companyId) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      const { data, error } = await supabaseAdmin
        .from("team_schedules")
        .select("*")
        .eq("team_id", id)
        .order("day_of_week", { ascending: true });

      if (error) throw error;

      return res.json(data || []);
    } catch (error: any) {
      console.error("[GET /api/teams/:id/schedules] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ➕ POST /api/teams/:id/schedules - Adicionar/atualizar horário
  app.post("/api/teams/:id/schedules", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;
      const parsed = TeamScheduleSchema.parse(req.body);

      // Verificar propriedade do time
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("company_id")
        .eq("id", id)
        .maybeSingle();

      if (!team || team.company_id !== companyId) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      // Upsert (insert ou update se já existe)
      const { data, error } = await supabaseAdmin
        .from("team_schedules")
        .upsert(
          {
            team_id: id,
            ...parsed,
          },
          {
            onConflict: "team_id,day_of_week",
          }
        )
        .select()
        .single();

      if (error) throw error;

      console.log(`[POST /api/teams/:id/schedules] Updated schedule for day ${parsed.day_of_week}`);
      return res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.issues,
        });
      }
      console.error("[POST /api/teams/:id/schedules] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 🗑️ DELETE /api/teams/:teamId/schedules/:scheduleId - Remover horário
  app.delete("/api/teams/:teamId/schedules/:scheduleId", requireAuth, async (req: any, res) => {
    try {
      const { teamId, scheduleId } = req.params;
      const companyId = req.user.company_id;

      // Verificar propriedade do time
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("company_id")
        .eq("id", teamId)
        .maybeSingle();

      if (!team || team.company_id !== companyId) {
        return res.status(404).json({ error: "Time não encontrado" });
      }

      const { error } = await supabaseAdmin
        .from("team_schedules")
        .delete()
        .eq("id", scheduleId)
        .eq("team_id", teamId);

      if (error) throw error;

      console.log(`[DELETE /api/teams/:teamId/schedules/:scheduleId] Removed schedule: ${scheduleId}`);
      return res.status(204).send();
    } catch (error: any) {
      console.error("[DELETE /api/teams/:teamId/schedules/:scheduleId] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 👥 GET /api/users - List users for team member management
  app.get("/api/users", requireAuth, async (req: any, res) => {
    try {
      console.log('[GET /api/users] Request received');
      console.log('[GET /api/users] req.user:', req.user);
      console.log('[GET /api/users] req.profile:', req.profile);
      
      const companyId = req.user?.company_id || req.profile?.company_id;
      console.log('[GET /api/users] company_id:', companyId);
      
      if (!companyId) {
        console.error('[GET /api/users] No company_id found');
        return res.status(401).json({ error: "Empresa não identificada" });
      }
      
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, user_id, name, email, avatar, role, status, profile_picture")
        .eq("company_id", companyId)
        .order("name");

      if (error) throw error;
      
      // Map users to include public_user_id for mentions
      const mapped = (data || []).map((u: any) => ({
        ...u,
        public_user_id: u.user_id || u.id,
      }));
      
      console.log('[GET /api/users] Found', mapped.length, 'users');
      res.json(mapped);
    } catch (err: any) {
      console.error('[GET /api/users] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Alias for mentions functionality
  app.get("/api/users/company", requireAuth, async (req: any, res) => {
    try {
      console.log('[GET /api/users/company] Starting request');
      const authUserId = req.user?.id; // ID do auth.users
      const inboxId = req.query.inboxId as string | undefined;
      console.log('[GET /api/users/company] Auth user ID:', authUserId, 'Inbox ID:', inboxId);
      
      if (!authUserId) {
        console.log('[GET /api/users/company] No auth user ID found');
        return res.status(401).json({ error: "Usuário não autenticado" });
      }
      
      // Primeiro, busca o usuário atual na tabela public.users para pegar o company_id
      console.log('[GET /api/users/company] Fetching user from public.users with user_id:', authUserId);
      const { data: currentUser, error: userError } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", authUserId)
        .single();

      console.log('[GET /api/users/company] Current user:', currentUser, 'Error:', userError);

      if (userError || !currentUser?.company_id) {
        console.error('[GET /api/users/company] User not found or no company:', userError);
        return res.status(404).json({ error: "Usuário ou empresa não encontrada" });
      }
      
      // Agora busca todos os usuários da mesma empresa
      console.log('[GET /api/users/company] Fetching users for company_id:', currentUser.company_id);
      
      let query = supabaseAdmin
        .from("users")
        .select("id, user_id, name, email, avatar, role, status")
        .eq("company_id", currentUser.company_id)
        .order("name");

      if (inboxId) {
        console.log('[GET /api/users/company] Filtering by inbox_id:', inboxId);
        const { data: inboxUsers } = await supabaseAdmin
          .from("inbox_users")
          .select("user_id")
          .eq("inbox_id", inboxId);
          
        const userIds = inboxUsers?.map((iu: any) => iu.user_id).filter(Boolean) || [];
        
        if (userIds.length > 0) {
          query = query.in("id", userIds);
        } else {
          console.log('[GET /api/users/company] No users found in inbox');
          return res.json([]);
        }
      }

      const { data, error } = await query;

      console.log('[GET /api/users/company] Found users:', data?.length, 'Error:', error);

      if (error) throw error;
      
      // Map users to include public_user_id for mentions
      const mapped = (data || []).map((u: any) => ({
        ...u,
        public_user_id: u.user_id || u.id,
        avatar: u.avatar || undefined,
      }));
      
      console.log('[GET /api/users/company] Returning', mapped.length, 'users');
      res.json(mapped);
    } catch (err: any) {
      console.error('[GET /api/users/company] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
