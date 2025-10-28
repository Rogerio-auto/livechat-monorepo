import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";

const VIEW_USER_AGENDA = process.env.VIEW_USER_AGENDA || "user_agenda";
const TABLE_CALENDARS = process.env.TABLE_CALENDARS || "calendars";
const TABLE_EVENTS = process.env.TABLE_EVENTS || "events";
const TABLE_EVENT_PARTICIPANTS = process.env.TABLE_EVENT_PARTICIPANTS || "event_participants";

async function checkAvailability(userId: string, startISO: string, endISO: string) {
  const { data, error } = await (supabaseAdmin as any).rpc("is_user_available_simple", {
    p_user_id: userId,
    p_start_time: startISO,
    p_end_time: endISO,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export function registerCalendarRoutes(app: express.Application) {
  // GET calendars of current user
  app.get("/calendar/calendars", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const ownerId = (urow as any)?.id || null;
      if (!ownerId) return res.json([]);

      const { data, error } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("*")
        .eq("owner_id", ownerId)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Calendars list error" });
    }
  });

  // GET events by range (intersection)
  app.get("/calendar/events", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const start = String(req.query.start || "").trim();
      const end = String(req.query.end || "").trim();
      if (!start || !end)
        return res.status(400).json({ error: "start e end obrigatórios (ISO)" });

      let items: any[] = [];
      let viewFailed = false;
      try {
        const { data, error } = await supabaseAdmin
          .from(VIEW_USER_AGENDA)
          .select("*")
          .eq("user_id", userId)
          .lt("start_time", end)
          .gt("end_time", start)
          .order("start_time", { ascending: true });
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
            customer_name: e.customer_name,
            lead_name: e.lead_name,
          },
          raw: e,
        }));
      } catch {
        viewFailed = true;
      }

      if (viewFailed) {
        const { data: evs, error: errEv } = await supabaseAdmin
          .from(TABLE_EVENTS)
          .select(
            "id, title, description, location, event_type, status, start_time, end_time, calendar_id, customer_id"
          )
          .lt("start_time", end)
          .gt("end_time", start)
          .eq("created_by_id", userId)
          .order("start_time", { ascending: true });
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
              user_id: userId,
              is_organizer: true,
            },
            raw: e,
          };
        });
      }

      return res.json({ items });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Events list error" });
    }
  });

  // Create event with participants
  app.post("/calendar/events", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const schema = z
        .object({
          title: z.string().min(1),
          description: z.string().optional().nullable(),
          location: z.string().optional().nullable(),
          event_type: z
            .enum(["MEETING", "CALL", "TECHNICAL_VISIT", "FOLLOW_UP", "OTHER"])
            .optional(),
          status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
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
  app.put("/calendar/events/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const schema = z
        .object({
          title: z.string().optional(),
          description: z.string().optional().nullable(),
          location: z.string().optional().nullable(),
          event_type: z
            .enum(["MEETING", "CALL", "TECHNICAL_VISIT", "FOLLOW_UP", "OTHER"])
            .optional(),
          status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
          start_time: z.string().optional(),
          end_time: z.string().optional(),
          is_all_day: z.boolean().optional(),
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
  app.delete("/calendar/events/:id", requireAuth, async (req: any, res) => {
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
}
