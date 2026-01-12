import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { 
  requireCalendarOwner, 
  requireCalendarCreateEvent, 
  requireEventOwner 
} from "../middlewares/calendarPermissions.js";

const VIEW_USER_AGENDA = process.env.VIEW_USER_AGENDA || "user_agenda";
const TABLE_CALENDARS = process.env.TABLE_CALENDARS || "calendars";
const TABLE_EVENTS = process.env.TABLE_EVENTS || "events";
const TABLE_EVENT_PARTICIPANTS = process.env.TABLE_EVENT_PARTICIPANTS || "event_participants";
const TABLE_EVENT_REMINDERS = process.env.TABLE_EVENT_REMINDERS || "event_reminders";
const TABLE_AVAILABILITY_RULES = process.env.TABLE_AVAILABILITY_RULES || "availability_rules";
const TABLE_AVAILABILITY_EXCEPTIONS = process.env.TABLE_AVAILABILITY_EXCEPTIONS || "availability_exceptions";
const TABLE_CALENDAR_PERMISSIONS = process.env.TABLE_CALENDAR_PERMISSIONS || "calendar_permissions";

async function checkAvailability(userId: string, startISO: string, endISO: string) {
  // TODO: Criar função is_user_available_simple no Supabase
  // Por enquanto, retorna sempre true para não bloquear criação de eventos
  try {
    const { data, error } = await (supabaseAdmin as any).rpc("is_user_available_simple", {
      p_user_id: userId,
      p_start_time: startISO,
      p_end_time: endISO,
    });
    if (error) {
      console.warn("[checkAvailability] Função is_user_available_simple não encontrada, assumindo disponível");
      return true; // Assume disponível se função não existir
    }
    return Boolean(data);
  } catch (err) {
    console.warn("[checkAvailability] Erro ao verificar disponibilidade:", err);
    return true; // Assume disponível em caso de erro
  }
}

export function registerCalendarRoutes(app: express.Application) {
  // Alias for /settings/calendars used by some frontend components
  app.get("/settings/calendars", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, role, company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      
      const ownerId = (urow as any)?.id || null;
      const userRole = (urow as any)?.role || null;
      const companyId = (urow as any)?.company_id || null;
      const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

      if (!ownerId && !isAdmin) return res.json([]);

      let query = supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("*")
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      
      // Filter by company if present, otherwise fallback to legacy logic
      if (companyId) {
        query = query.eq("company_id", companyId);
      } else if (!isAdmin && ownerId) {
        query = query.eq("owner_id", ownerId);
      }

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Calendars list error" });
    }
  });

  app.post("/settings/calendars", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const companyId = req.user.company_id as string;

      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const ownerId = (urow as any)?.id || null;
      if (!ownerId) return res.status(400).json({ error: "User not found" });

      const { name, type, color, description, is_default, timezone } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });

      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .insert([{
          name,
          type: type || "PERSONAL",
          color: color || "#3B82F6",
          description,
          owner_id: ownerId,
          company_id: companyId,
          is_default: !!is_default,
          timezone: timezone || "UTC"
        }])
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create calendar error" });
    }
  });

  app.delete("/settings/calendars/:id", requireAuth, requireCalendarOwner, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .delete()
        .eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Delete calendar error" });
    }
  });

  app.put("/settings/calendars/:id", requireAuth, requireCalendarOwner, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .update(req.body)
        .eq("id", id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update calendar error" });
    }
  });

  app.patch("/settings/calendars/:id", requireAuth, requireCalendarOwner, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .update(req.body)
        .eq("id", id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update calendar error" });
    }
  });

  // GET calendars of current user (ADMIN sees all calendars)
  app.get("/calendar/calendars", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, role")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      
      const ownerId = (urow as any)?.id || null;
      const userRole = (urow as any)?.role || null;
      const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

      if (!ownerId && !isAdmin) return res.json([]);

      let query = supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("*")
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      
      // ADMIN sees all calendars, regular users see only their own
      if (!isAdmin && ownerId) {
        query = query.eq("owner_id", ownerId);
      }

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Calendars list error" });
    }
  });

  // GET events by range (intersection)
  app.get("/calendar/events", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const start = String(req.query.start || "").trim();
      const end = String(req.query.end || "").trim();
      if (!start || !end)
        return res.status(400).json({ error: "start e end obrigatórios (ISO)" });

      // Map auth user -> local users.id and get role
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, role")
        .eq("user_id", authUserId)
        .maybeSingle();
      
      if (uerr) return res.status(500).json({ error: uerr.message });
      
      const userId = (urow as any)?.id || null;
      const userRole = (urow as any)?.role || null;
      const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

      let items: any[] = [];
      let viewFailed = false;

      // Try using the view first
      try {
        let query = supabaseAdmin
          .from(VIEW_USER_AGENDA)
          .select("*")
          .lt("start_time", end)
          .gt("end_time", start)
          .order("start_time", { ascending: true });
        
        // ADMIN sees all events, regular users see only their events
        if (!isAdmin && userId) {
          query = query.eq("user_id", userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        items = (data || []).map((e: any) => ({
          id: e.id,
          title: e.title,
          start: e.start_time,
          end: e.end_time,
          backgroundColor: e.calendar_color || undefined,
          extendedProps: {
            description: e.description,
            event_type: e.event_type,
            status: e.status,
            location: e.location,
            calendar_name: e.calendar_name,
            calendar_color: e.calendar_color,
            user_id: e.user_id,
            is_organizer: e.is_organizer,
            customer_id: e.customer_id,
            customer_name: e.customer_name,
            lead_id: e.lead_id,
            lead_name: e.lead_name,
          },
          raw: e,
        }));
      } catch {
        viewFailed = true;
      }

      // Fallback to direct events query if view doesn't exist
      if (viewFailed) {
        let evQuery = supabaseAdmin
          .from(TABLE_EVENTS)
          .select(
            "id, title, description, location, event_type, status, start_time, end_time, calendar_id, customer_id, lead_id, created_by_id"
          )
          .lt("start_time", end)
          .gt("end_time", start)
          .order("start_time", { ascending: true });
        
        // ADMIN sees all events, regular users see only events they created
        if (!isAdmin && userId) {
          evQuery = evQuery.eq("created_by_id", userId);
        }

        const { data: evs, error: errEv } = await evQuery;
        if (errEv) return res.status(500).json({ error: errEv.message });
        
        const cids = Array.from(
          new Set(((evs as any[]) || []).map((r) => (r as any).calendar_id).filter(Boolean))
        );
        let cmap: Record<string, { name: string | null; color: string | null }> = {};
        if (cids.length > 0) {
          const { data: cals } = await supabaseAdmin
            .from(TABLE_CALENDARS)
            .select("id, name, color")
            .in("id", cids);
          cmap = Object.fromEntries(
            ((cals as any[]) || []).map((c) => [
              (c as any).id,
              { name: (c as any).name || null, color: (c as any).color || null },
            ])
          );
        }
        items = ((evs as any[]) || []).map((e: any) => {
          const cal = cmap[(e as any).calendar_id] || {};
          return {
            id: e.id,
            title: e.title,
            start: e.start_time,
            end: e.end_time,
            backgroundColor: (cal as any).color || undefined,
            extendedProps: {
              description: e.description,
              event_type: e.event_type,
              status: e.status,
              location: e.location,
              calendar_name: (cal as any).name || null,
              calendar_color: (cal as any).color || null,
              customer_id: e.customer_id || null,
              lead_id: e.lead_id || null,
              user_id: (e as any).created_by_id,
              is_organizer: true,
            },
            raw: e,
          };
        });
      }

      // ==================== 2. PROJETOS ====================
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("id, title, start_date, estimated_end_date, status, priority, owner_user_id, assigned_users")
        .eq("company_id", (req.user as any).company_id)
        .eq("is_archived", false)
        .or(`start_date.gte.${start},estimated_end_date.lte.${end}`);

      if (projects) {
        for (const project of projects) {
          // Verificar se usuário está envolvido no projeto
          const isInvolved = 
            project.owner_user_id === authUserId ||
            (project.assigned_users || []).includes(authUserId);

          if (isInvolved) {
            // Adicionar evento de início
            if (project.start_date) {
              items.push({
                id: `project-start-${project.id}`,
                title: `🚀 Início: ${project.title}`,
                start: project.start_date,
                end: project.start_date,
                type: 'project-start',
                color: getPriorityColor(project.priority),
                allDay: true,
                projectId: project.id,
                url: `/projects/${project.id}`,
              });
            }

            // Adicionar evento de prazo
            if (project.estimated_end_date) {
              const isOverdue = new Date(project.estimated_end_date) < new Date() && project.status === 'active';
              
              items.push({
                id: `project-deadline-${project.id}`,
                title: `${isOverdue ? '🚨' : '🏁'} Prazo: ${project.title}`,
                start: project.estimated_end_date,
                end: project.estimated_end_date,
                type: 'project-deadline',
                color: isOverdue ? '#EF4444' : getPriorityColor(project.priority),
                allDay: true,
                projectId: project.id,
                url: `/projects/${project.id}`,
                className: isOverdue ? 'event-overdue' : '',
              });
            }
          }
        }
      }

      // ==================== 3. TAREFAS ====================
      const { data: tasks } = await supabaseAdmin
        .from("project_tasks")
        .select(`
          id,
          title,
          due_date,
          is_completed,
          assigned_to,
          project_id,
          projects (
            id,
            title,
            priority
          )
        `)
        .eq("is_completed", false)
        .eq("assigned_to", authUserId)
        .gte("due_date", start)
        .lte("due_date", end);

      if (tasks) {
        for (const task of tasks) {
          const isOverdue = new Date(task.due_date) < new Date();
          
          items.push({
            id: `task-${task.id}`,
            title: `${isOverdue ? '🚨' : '✅'} ${task.title}`,
            start: task.due_date,
            end: task.due_date,
            type: 'task',
            color: isOverdue ? '#EF4444' : '#8B5CF6',
            allDay: true,
            taskId: task.id,
            projectId: task.project_id,
            url: `/projects/${task.project_id}?tab=tasks`,
            className: isOverdue ? 'event-overdue' : '',
            extendedProps: {
              projectTitle: (task.projects as any)?.title,
            },
          });
        }
      }

      return res.json({ items });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Events list error" });
    }
  });

  /**
   * GET /calendar/summary
   * Resumo de eventos do dia/semana
   */
  app.get("/calendar/summary", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const companyId = req.user?.company_id;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Projetos vencendo hoje
      const { data: projectsDueToday } = await supabaseAdmin
        .from("projects")
        .select("id, title")
        .eq("company_id", companyId)
        .eq("status", "active")
        .gte("estimated_end_date", today.toISOString().split('T')[0])
        .lt("estimated_end_date", tomorrow.toISOString().split('T')[0])
        .or(`owner_user_id.eq.${userId},assigned_users.cs.{${userId}}`);

      // Tarefas vencendo hoje
      const { data: tasksDueToday } = await supabaseAdmin
        .from("project_tasks")
        .select("id, title, project_id")
        .eq("assigned_to", userId)
        .eq("is_completed", false)
        .gte("due_date", today.toISOString().split('T')[0])
        .lt("due_date", tomorrow.toISOString().split('T')[0]);

      // Projetos vencendo esta semana
      const { data: projectsDueThisWeek } = await supabaseAdmin
        .from("projects")
        .select("id, title")
        .eq("company_id", companyId)
        .eq("status", "active")
        .gte("estimated_end_date", today.toISOString().split('T')[0])
        .lt("estimated_end_date", nextWeek.toISOString().split('T')[0])
        .or(`owner_user_id.eq.${userId},assigned_users.cs.{${userId}}`);

      return res.json({
        today: {
          projects: projectsDueToday || [],
          tasks: tasksDueToday || [],
        },
        this_week: {
          projects: projectsDueThisWeek || [],
        },
      });
    } catch (error: any) {
      console.error("[Calendar] Error fetching summary:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Create event with participants
  app.post("/calendar/events", requireAuth, requireCalendarCreateEvent, async (req: any, res) => {
    try {
      const authUserId = req.user.id;
      
      // Buscar ID da tabela users (não o auth user id)
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      
      if (uerr || !urow) {
        return res.status(403).json({ error: "User not found" });
      }
      
      const userId = (urow as any).id;
      
      const schema = z
        .object({
          title: z.string().min(1),
          description: z.string().optional().nullable(),
          location: z.string().optional().nullable(),
          event_type: z
            .enum(["MEETING", "CALL", "TECHNICAL_VISIT", "FOLLOW_UP", "PRESENTATION", "TRAINING", "OTHER"])
            .optional(),
          status: z.enum(["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"]).optional(),
          start_time: z.string().min(1),
          end_time: z.string().min(1),
          calendar_id: z.string().uuid(),
          participant_ids: z.array(z.string().uuid()).optional().default([]),
          customer_id: z.string().uuid().optional(),
        })
        .passthrough();
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      if (new Date(payload.end_time) <= new Date(payload.start_time)) {
        return res.status(400).json({ error: "end_time deve ser maior que start_time" });
      }

      const participantsAll = Array.from(new Set([userId, ...payload.participant_ids]));
      const availabilityResults: Record<string, boolean> = {};
      for (const uid of participantsAll) {
        availabilityResults[uid] = await checkAvailability(
          uid,
          payload.start_time,
          payload.end_time
        );
      }
      const busy = Object.entries(availabilityResults)
        .filter(([, ok]) => !ok)
        .map(([uid]) => uid);
      if (busy.length > 0) {
        return res.status(409).json({
          error: "Usuários indisponíveis para o intervalo",
          busy_user_ids: busy,
        });
      }

      const eventInsert: any = {
        title: payload.title,
        description: payload.description ?? null,
        location: payload.location ?? null,
        event_type: payload.event_type ?? "OTHER",
        status: payload.status ?? "SCHEDULED",
        start_time: payload.start_time,
        end_time: payload.end_time,
        is_all_day: false,
        calendar_id: payload.calendar_id,
        created_by_id: userId,
        customer_id: payload.customer_id ?? null,
      };
      const { data: ev, error: evErr } = await supabaseAdmin
        .from(TABLE_EVENTS)
        .insert(eventInsert)
        .select("*")
        .single();
      if (evErr) return res.status(500).json({ error: evErr.message });

      const rows = [
        { event_id: ev.id, user_id: userId, is_organizer: true },
        ...payload.participant_ids
          .filter((uid) => uid !== userId)
          .map((uid) => ({ event_id: ev.id, user_id: uid, is_organizer: false })),
      ];
      if (rows.length > 0) {
        const { error: pErr } = await supabaseAdmin
          .from(TABLE_EVENT_PARTICIPANTS)
          .insert(rows);
        if (pErr) return res.status(500).json({ error: pErr.message });
      }

      return res.status(201).json(ev);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create event error" });
    }
  });

  // Update event
  app.put("/calendar/events/:id", requireAuth, requireEventOwner, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const schema = z
        .object({
          title: z.string().optional(),
          description: z.string().optional().nullable(),
          location: z.string().optional().nullable(),
          event_type: z
            .enum(["MEETING", "CALL", "TECHNICAL_VISIT", "FOLLOW_UP", "PRESENTATION", "TRAINING", "OTHER", "DEMO"])
            .optional(),
          status: z.enum(["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"]).optional(),
          start_time: z.string().optional(),
          end_time: z.string().optional(),
          is_all_day: z.boolean().optional(),
          customer_id: z.string().uuid().optional().nullable(),
          lead_id: z.string().uuid().optional().nullable(),
          meeting_url: z.string().optional().nullable(),
          calendar_id: z.string().uuid().optional(),
        })
        .passthrough();
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const patch = parsed.data as any;
      if (patch.start_time && patch.end_time) {
        if (new Date(patch.end_time) <= new Date(patch.start_time)) {
          return res.status(400).json({ error: "end_time deve ser maior que start_time" });
        }
      }

      const { data, error } = await supabaseAdmin
        .from(TABLE_EVENTS)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update event error" });
    }
  });

  // Delete event
  app.delete("/calendar/events/:id", requireAuth, requireEventOwner, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const { error } = await supabaseAdmin.from(TABLE_EVENTS).delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Delete event error" });
    }
  });

  // Simple availability check
  app.get("/calendar/availability", requireAuth, async (req: any, res) => {
    try {
      const userId = (req.query.user_id as string) || req.user.id;
      const start = String(req.query.start || "").trim();
      const end = String(req.query.end || "").trim();
      if (!userId || !start || !end)
        return res
          .status(400)
          .json({ error: "user_id, start, end obrigatórios" });
      const available = await checkAvailability(userId, start, end);
      return res.json({ user_id: userId, available });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Availability error" });
    }
  });

  // ===== CALENDAR CRUD =====
  
  // POST /calendar/calendars - Create new calendar
  app.post("/calendar/calendars", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const companyId = req.user.company_id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const ownerId = (urow as any)?.id || null;
      if (!ownerId) return res.status(400).json({ error: "User not found" });

      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional().nullable(),
        color: z.string().optional().default("#3B82F6"),
        type: z.enum(["PERSONAL", "TEAM", "COMPANY", "CUSTOMER"]).optional().default("PERSONAL"),
        is_public: z.boolean().optional().default(false),
        is_default: z.boolean().optional().default(false),
        timezone: z.string().optional().default("America/Sao_Paulo"),
        team_id: z.string().uuid().optional().nullable(),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      // If setting as default, unset other defaults for this owner
      if (payload.is_default) {
        await supabaseAdmin
          .from(TABLE_CALENDARS)
          .update({ is_default: false })
          .eq("owner_id", ownerId);
      }

      const calendarInsert: any = {
        name: payload.name,
        description: payload.description ?? null,
        color: payload.color,
        type: payload.type,
        is_public: payload.is_public,
        is_default: payload.is_default,
        timezone: payload.timezone,
        company_id: companyId,
        owner_id: ownerId,
        team_id: payload.team_id ?? null,
      };

      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .insert(calendarInsert)
        .select("*")
        .single();
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create calendar error" });
    }
  });

  // PUT /calendar/calendars/:id - Update calendar
  app.put("/calendar/calendars/:id", requireAuth, requireCalendarOwner, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id (for is_default logic)
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const ownerId = (urow as any)?.id || null;

      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        color: z.string().optional(),
        type: z.enum(["PERSONAL", "TEAM", "COMPANY", "CUSTOMER"]).optional(),
        is_public: z.boolean().optional(),
        is_default: z.boolean().optional(),
        timezone: z.string().optional(),
        team_id: z.string().uuid().optional().nullable(),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      // If setting as default, unset other defaults for this owner
      if (payload.is_default && ownerId) {
        await supabaseAdmin
          .from(TABLE_CALENDARS)
          .update({ is_default: false })
          .eq("owner_id", ownerId)
          .neq("id", id);
      }

      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update calendar error" });
    }
  });

  // DELETE /calendar/calendars/:id - Delete calendar
  app.delete("/calendar/calendars/:id", requireAuth, requireCalendarOwner, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      
      // Calendar is already validated by middleware and attached to req.calendar
      const calendar = (req as any).calendar;

      // Prevent deleting default calendar
      if (calendar?.is_default) {
        return res.status(400).json({ error: "Cannot delete default calendar. Set another as default first." });
      }

      const { error } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .delete()
        .eq("id", id);
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Delete calendar error" });
    }
  });

  // GET /calendar/calendars/shared - Get calendars shared with user
  app.get("/calendar/calendars/shared", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;
      if (!userId) return res.json([]);

      // Get calendars where user has permissions
      const { data: permissions, error: permErr } = await supabaseAdmin
        .from("calendar_permissions")
        .select("calendar_id, can_view, can_edit, can_manage, can_create_events")
        .eq("user_id", userId);
      
      if (permErr) return res.status(500).json({ error: permErr.message });
      if (!permissions || permissions.length === 0) return res.json([]);

      const calendarIds = permissions.map((p: any) => p.calendar_id);
      const { data: calendars, error: calErr } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("*")
        .in("id", calendarIds)
        .order("name", { ascending: true });
      
      if (calErr) return res.status(500).json({ error: calErr.message });

      // Merge permissions into calendar objects
      const result = (calendars || []).map((cal: any) => {
        const perm = permissions.find((p: any) => p.calendar_id === cal.id);
        return {
          ...cal,
          permissions: {
            can_view: perm?.can_view || false,
            can_edit: perm?.can_edit || false,
            can_manage: perm?.can_manage || false,
            can_create_events: perm?.can_create_events || false,
          },
        };
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Shared calendars error" });
    }
  });

  // ===== EVENT PARTICIPANTS MANAGEMENT =====

  // GET /calendar/events/:eventId/participants - List participants
  app.get("/calendar/events/:eventId/participants", requireAuth, async (req: any, res) => {
    try {
      const { eventId } = req.params as { eventId: string };

      const { data, error } = await supabaseAdmin
        .from(TABLE_EVENT_PARTICIPANTS)
        .select(`
          *,
          users:user_id (id, name, email),
          customers:customer_id (id, name, email)
        `)
        .eq("event_id", eventId)
        .order("is_organizer", { ascending: false });
      
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "List participants error" });
    }
  });

  // POST /calendar/events/:eventId/participants - Add participant
  app.post("/calendar/events/:eventId/participants", requireAuth, async (req: any, res) => {
    try {
      const { eventId } = req.params as { eventId: string };

      const schema = z.object({
        user_id: z.string().uuid().optional(),
        customer_id: z.string().uuid().optional(),
        external_name: z.string().optional(),
        external_email: z.string().email().optional(),
        external_phone: z.string().optional(),
        is_required: z.boolean().optional().default(true),
        notes: z.string().optional().nullable(),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      // Validate at least one identifier
      if (!payload.user_id && !payload.customer_id && !payload.external_name) {
        return res.status(400).json({ error: "Must provide user_id, customer_id, or external_name" });
      }

      const participantInsert: any = {
        event_id: eventId,
        user_id: payload.user_id ?? null,
        customer_id: payload.customer_id ?? null,
        external_name: payload.external_name ?? null,
        external_email: payload.external_email ?? null,
        external_phone: payload.external_phone ?? null,
        is_organizer: false,
        is_required: payload.is_required,
        status: "PENDING",
        notes: payload.notes ?? null,
      };

      const { data, error } = await supabaseAdmin
        .from(TABLE_EVENT_PARTICIPANTS)
        .insert(participantInsert)
        .select("*")
        .single();
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Add participant error" });
    }
  });

  // PUT /calendar/events/:eventId/participants/:participantId - Update participant status
  app.put("/calendar/events/:eventId/participants/:participantId", requireAuth, async (req: any, res) => {
    try {
      const { eventId, participantId } = req.params as { eventId: string; participantId: string };

      const schema = z.object({
        status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "TENTATIVE"]).optional(),
        notes: z.string().optional().nullable(),
        is_required: z.boolean().optional(),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data as any;

      // If status is being updated, set response_time
      if (payload.status) {
        payload.response_time = new Date().toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from(TABLE_EVENT_PARTICIPANTS)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", participantId)
        .eq("event_id", eventId)
        .select("*")
        .single();
      
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Participant not found" });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update participant error" });
    }
  });

  // DELETE /calendar/events/:eventId/participants/:participantId - Remove participant
  app.delete("/calendar/events/:eventId/participants/:participantId", requireAuth, async (req: any, res) => {
    try {
      const { eventId, participantId } = req.params as { eventId: string; participantId: string };

      // Prevent removing organizer
      const { data: participant, error: getErr } = await supabaseAdmin
        .from(TABLE_EVENT_PARTICIPANTS)
        .select("is_organizer")
        .eq("id", participantId)
        .eq("event_id", eventId)
        .maybeSingle();
      
      if (getErr) return res.status(500).json({ error: getErr.message });
      if (!participant) return res.status(404).json({ error: "Participant not found" });
      if ((participant as any).is_organizer) {
        return res.status(400).json({ error: "Cannot remove event organizer" });
      }

      const { error } = await supabaseAdmin
        .from(TABLE_EVENT_PARTICIPANTS)
        .delete()
        .eq("id", participantId)
        .eq("event_id", eventId);
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Remove participant error" });
    }
  });

  // ===== AVAILABILITY RULES =====

  // GET /calendar/availability/rules - List user's availability rules
  app.get("/calendar/availability/rules", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;
      if (!userId) return res.json([]);

      const { data, error } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_RULES)
        .select("*")
        .eq("user_id", userId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "List availability rules error" });
    }
  });

  // POST /calendar/availability/rules - Create availability rule
  app.post("/calendar/availability/rules", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;
      if (!userId) return res.status(400).json({ error: "User not found" });

      const schema = z.object({
        name: z.string().min(1),
        day_of_week: z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
        start_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/), // HH:MM:SS
        end_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
        is_available: z.boolean().optional().default(true),
        is_active: z.boolean().optional().default(true),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      // Validate time range
      if (payload.start_time >= payload.end_time) {
        return res.status(400).json({ error: "end_time must be after start_time" });
      }

      const ruleInsert: any = {
        name: payload.name,
        day_of_week: payload.day_of_week,
        start_time: payload.start_time,
        end_time: payload.end_time,
        is_available: payload.is_available,
        is_active: payload.is_active,
        user_id: userId,
      };

      const { data, error } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_RULES)
        .insert(ruleInsert)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create availability rule error" });
    }
  });

  // PUT /calendar/availability/rules/:id - Update availability rule
  app.put("/calendar/availability/rules/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;

      // Check ownership
      const { data: existing, error: existErr } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_RULES)
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existErr) return res.status(500).json({ error: existErr.message });
      if (!existing) return res.status(404).json({ error: "Availability rule not found" });

      const schema = z.object({
        name: z.string().min(1).optional(),
        day_of_week: z.number().int().min(0).max(6).optional(),
        start_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
        end_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
        is_available: z.boolean().optional(),
        is_active: z.boolean().optional(),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data as any;

      // Validate time range if both provided
      if (payload.start_time && payload.end_time && payload.start_time >= payload.end_time) {
        return res.status(400).json({ error: "end_time must be after start_time" });
      }

      const { data, error } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_RULES)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update availability rule error" });
    }
  });

  // DELETE /calendar/availability/rules/:id - Delete availability rule
  app.delete("/calendar/availability/rules/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;

      // Check ownership
      const { data: existing, error: existErr } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_RULES)
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existErr) return res.status(500).json({ error: existErr.message });
      if (!existing) return res.status(404).json({ error: "Availability rule not found" });

      const { error } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_RULES)
        .delete()
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Delete availability rule error" });
    }
  });

  // ===== AVAILABILITY EXCEPTIONS =====

  // GET /calendar/availability/exceptions - List user's availability exceptions
  app.get("/calendar/availability/exceptions", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;
      if (!userId) return res.json([]);

      const { data, error } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_EXCEPTIONS)
        .select("*")
        .eq("user_id", userId)
        .order("start_date", { ascending: true });

      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "List availability exceptions error" });
    }
  });

  // POST /calendar/availability/exceptions - Create availability exception
  app.post("/calendar/availability/exceptions", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;
      if (!userId) return res.status(400).json({ error: "User not found" });

      const schema = z.object({
        title: z.string().min(1),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional().nullable(),
        end_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional().nullable(),
        is_all_day: z.boolean().optional().default(true),
        is_available: z.boolean().optional().default(false), // Usually unavailable
        notes: z.string().optional().nullable(),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      // Validate date range
      if (payload.start_date > payload.end_date) {
        return res.status(400).json({ error: "end_date must be after or equal to start_date" });
      }

      // Validate time range if not all day
      if (!payload.is_all_day) {
        if (!payload.start_time || !payload.end_time) {
          return res.status(400).json({ error: "start_time and end_time required when is_all_day is false" });
        }
        if (payload.start_time >= payload.end_time) {
          return res.status(400).json({ error: "end_time must be after start_time" });
        }
      }

      const exceptionInsert: any = {
        title: payload.title,
        start_date: payload.start_date,
        end_date: payload.end_date,
        start_time: payload.is_all_day ? null : payload.start_time,
        end_time: payload.is_all_day ? null : payload.end_time,
        is_all_day: payload.is_all_day,
        is_available: payload.is_available,
        notes: payload.notes ?? null,
        user_id: userId,
      };

      const { data, error } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_EXCEPTIONS)
        .insert(exceptionInsert)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create availability exception error" });
    }
  });

  // DELETE /calendar/availability/exceptions/:id - Delete availability exception
  app.delete("/calendar/availability/exceptions/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;

      // Check ownership
      const { data: existing, error: existErr } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_EXCEPTIONS)
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existErr) return res.status(500).json({ error: existErr.message });
      if (!existing) return res.status(404).json({ error: "Availability exception not found" });

      const { error } = await supabaseAdmin
        .from(TABLE_AVAILABILITY_EXCEPTIONS)
        .delete()
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Delete availability exception error" });
    }
  });

  // ===== EVENT REMINDERS =====

  // GET /calendar/events/:eventId/reminders - List event reminders
  app.get("/calendar/events/:eventId/reminders", requireAuth, async (req: any, res) => {
    try {
      const { eventId } = req.params as { eventId: string };

      const { data, error } = await supabaseAdmin
        .from(TABLE_EVENT_REMINDERS)
        .select("*")
        .eq("event_id", eventId)
        .order("minutes_before", { ascending: true });

      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "List reminders error" });
    }
  });

  // POST /calendar/events/:eventId/reminders - Create event reminder
  app.post("/calendar/events/:eventId/reminders", requireAuth, async (req: any, res) => {
    try {
      const { eventId } = req.params as { eventId: string };

      const schema = z.object({
        type: z.enum(["POPUP", "EMAIL", "WHATSAPP", "SMS"]),
        minutes_before: z.number().int().min(0),
        custom_message: z.string().optional().nullable(),
        participant_id: z.string().uuid().optional().nullable(), // NULL = all participants
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      const reminderInsert: any = {
        event_id: eventId,
        type: payload.type,
        minutes_before: payload.minutes_before,
        custom_message: payload.custom_message ?? null,
        participant_id: payload.participant_id ?? null,
        is_sent: false,
      };

      const { data, error } = await supabaseAdmin
        .from(TABLE_EVENT_REMINDERS)
        .insert(reminderInsert)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create reminder error" });
    }
  });

  // DELETE /calendar/reminders/:id - Delete reminder
  app.delete("/calendar/reminders/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };

      const { error } = await supabaseAdmin
        .from(TABLE_EVENT_REMINDERS)
        .delete()
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Delete reminder error" });
    }
  });

  // ===== NEXT AVAILABLE SLOT =====

  // GET /calendar/availability/next-slot - Get next available time slot
  app.get("/calendar/availability/next-slot", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const duration = Number(req.query.duration || 60); // Default 60 minutes
      const startFrom = String(req.query.start_from || new Date().toISOString());

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const userId = (urow as any)?.id || null;
      if (!userId) return res.status(400).json({ error: "User not found" });

      // Call SQL function
      const { data, error } = await (supabaseAdmin as any).rpc("get_next_available_slot", {
        p_user_id: userId,
        p_duration_minutes: duration,
        p_start_from: startFrom,
      });

      if (error) return res.status(500).json({ error: error.message });
      
      if (!data) {
        return res.status(404).json({ 
          error: "No available slot found in the next 30 days",
          user_id: userId,
          duration_minutes: duration,
        });
      }

      return res.json({
        user_id: userId,
        duration_minutes: duration,
        next_available_slot: data,
        searched_from: startFrom,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Next available slot error" });
    }
  });

  // ===== CALENDAR PERMISSIONS MANAGEMENT =====

  // GET /calendar/:calendarId/permissions - List calendar permissions
  app.get("/calendar/:calendarId/permissions", requireAuth, async (req: any, res) => {
    try {
      const { calendarId } = req.params as { calendarId: string };
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const ownerId = (urow as any)?.id || null;

      // Check if user owns the calendar
      const { data: calendar, error: calErr } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("id, owner_id")
        .eq("id", calendarId)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (calErr) return res.status(500).json({ error: calErr.message });
      if (!calendar) return res.status(403).json({ error: "Calendar not found or access denied" });

      // Get permissions with user info
      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDAR_PERMISSIONS)
        .select(`
          *,
          users:user_id (id, name, email)
        `)
        .eq("calendar_id", calendarId);

      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "List permissions error" });
    }
  });

  // POST /calendar/:calendarId/permissions - Add user permission
  app.post("/calendar/:calendarId/permissions", requireAuth, async (req: any, res) => {
    try {
      const { calendarId } = req.params as { calendarId: string };
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const ownerId = (urow as any)?.id || null;

      // Check if user owns the calendar or has can_manage permission
      const { data: calendar, error: calErr } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("id, owner_id")
        .eq("id", calendarId)
        .maybeSingle();

      if (calErr) return res.status(500).json({ error: calErr.message });
      if (!calendar) return res.status(404).json({ error: "Calendar not found" });

      const isOwner = (calendar as any).owner_id === ownerId;

      if (!isOwner) {
        // Check if user has can_manage permission
        const { data: perm, error: permErr } = await supabaseAdmin
          .from(TABLE_CALENDAR_PERMISSIONS)
          .select("can_manage")
          .eq("calendar_id", calendarId)
          .eq("user_id", ownerId)
          .maybeSingle();

        if (permErr || !perm || !(perm as any).can_manage) {
          return res.status(403).json({ error: "Permission denied. Only owner or users with can_manage can add permissions." });
        }
      }

      const schema = z.object({
        user_id: z.string().uuid(),
        can_view: z.boolean().optional().default(true),
        can_edit: z.boolean().optional().default(false),
        can_manage: z.boolean().optional().default(false),
        can_create_events: z.boolean().optional().default(false),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      // Prevent adding permission to calendar owner
      if (payload.user_id === (calendar as any).owner_id) {
        return res.status(400).json({ error: "Cannot add permission for calendar owner" });
      }

      const permissionInsert: any = {
        calendar_id: calendarId,
        user_id: payload.user_id,
        can_view: payload.can_view,
        can_edit: payload.can_edit,
        can_manage: payload.can_manage,
        can_create_events: payload.can_create_events,
      };

      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDAR_PERMISSIONS)
        .insert(permissionInsert)
        .select("*")
        .single();

      if (error) {
        // Handle unique constraint violation (user already has permission)
        if (error.code === "23505") {
          return res.status(409).json({ error: "Permission already exists for this user" });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Add permission error" });
    }
  });

  // PUT /calendar/:calendarId/permissions/:userId - Update user permission
  app.put("/calendar/:calendarId/permissions/:userId", requireAuth, async (req: any, res) => {
    try {
      const { calendarId, userId } = req.params as { calendarId: string; userId: string };
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const ownerId = (urow as any)?.id || null;

      // Check ownership or can_manage
      const { data: calendar, error: calErr } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("id, owner_id")
        .eq("id", calendarId)
        .maybeSingle();

      if (calErr) return res.status(500).json({ error: calErr.message });
      if (!calendar) return res.status(404).json({ error: "Calendar not found" });

      const isOwner = (calendar as any).owner_id === ownerId;

      if (!isOwner) {
        const { data: perm, error: permErr } = await supabaseAdmin
          .from(TABLE_CALENDAR_PERMISSIONS)
          .select("can_manage")
          .eq("calendar_id", calendarId)
          .eq("user_id", ownerId)
          .maybeSingle();

        if (permErr || !perm || !(perm as any).can_manage) {
          return res.status(403).json({ error: "Permission denied" });
        }
      }

      const schema = z.object({
        can_view: z.boolean().optional(),
        can_edit: z.boolean().optional(),
        can_manage: z.boolean().optional(),
        can_create_events: z.boolean().optional(),
      });

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const payload = parsed.data;

      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDAR_PERMISSIONS)
        .update(payload)
        .eq("calendar_id", calendarId)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Permission not found" });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update permission error" });
    }
  });

  // DELETE /calendar/:calendarId/permissions/:userId - Remove user permission
  app.delete("/calendar/:calendarId/permissions/:userId", requireAuth, async (req: any, res) => {
    try {
      const { calendarId, userId } = req.params as { calendarId: string; userId: string };
      const authUserId = req.user.id as string;

      // Map auth user -> local users.id
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const ownerId = (urow as any)?.id || null;

      // Check ownership or can_manage
      const { data: calendar, error: calErr } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("id, owner_id")
        .eq("id", calendarId)
        .maybeSingle();

      if (calErr) return res.status(500).json({ error: calErr.message });
      if (!calendar) return res.status(404).json({ error: "Calendar not found" });

      const isOwner = (calendar as any).owner_id === ownerId;

      if (!isOwner) {
        const { data: perm, error: permErr } = await supabaseAdmin
          .from(TABLE_CALENDAR_PERMISSIONS)
          .select("can_manage")
          .eq("calendar_id", calendarId)
          .eq("user_id", ownerId)
          .maybeSingle();

        if (permErr || !perm || !(perm as any).can_manage) {
          return res.status(403).json({ error: "Permission denied" });
        }
      }

      const { error } = await supabaseAdmin
        .from(TABLE_CALENDAR_PERMISSIONS)
        .delete()
        .eq("calendar_id", calendarId)
        .eq("user_id", userId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Remove permission error" });
    }
  });
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return '#EF4444';
    case 'medium': return '#F59E0B';
    case 'low': return '#10B981';
    default: return '#3B82F6';
  }
}
