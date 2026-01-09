// backend/src/routes/notifications.ts

import type { Application } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { markAsRead } from "../services/notification.service.ts";

// ==================== HELPERS ====================

function getUserId(req: any): string {
  const userId = req.user?.id;
  if (!userId) {
    throw Object.assign(new Error("User ID not found"), { status: 401 });
  }
  return userId;
}

function handleError(error: unknown) {
  console.error("[Notifications] Error:", error);

  if (error instanceof z.ZodError) {
    return {
      status: 400,
      payload: {
        error: "Validation failed",
        details: (error as any).errors || (error as any).issues,
      },
    };
  }

  const status = (error as any)?.status || 500;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Internal server error";

  return { status, payload: { error: message } };
}

// ==================== ROUTES ====================

export function registerNotificationRoutes(app: Application) {
  
  /**
   * GET /api/notifications
   * Lista notificações do usuário
   * Query params: status, type, limit, offset
   */
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { status, type, limit = 50, offset = 0 } = req.query;

      let query = supabaseAdmin
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

      if (status) {
        query = query.eq("status", status);
      }

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Retornar diretamente o array para compatibilidade com o hook atual
      return res.json(data || []);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Conta notificações não lidas
   */
  app.get("/api/notifications/unread-count", requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);

      const { count, error } = await supabaseAdmin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("status", "SENT");

      if (error) throw error;

      return res.json({ count: count || 0 });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * PATCH /api/notifications/:id/read
   * Marca notificação como lida (Suporta PUT e PATCH)
   */
  const handleMarkRead = async (req: any, res: any) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      // Verificar se notificação pertence ao usuário
      const { data: notification } = await supabaseAdmin
        .from("notifications")
        .select("user_id")
        .eq("id", id)
        .single();

      if (!notification || notification.user_id !== userId) {
        return res.status(404).json({ error: "Notification not found" });
      }

      await markAsRead(id);

      return res.json({ success: true });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  };

  app.put("/api/notifications/:id/read", requireAuth, handleMarkRead);
  app.patch("/api/notifications/:id/read", requireAuth, handleMarkRead);

  /**
   * POST/PUT /api/notifications/read-all
   * Marca todas as notificações como lidas
   */
  const handleMarkAllRead = async (req: any, res: any) => {
    try {
      const userId = getUserId(req);

      const { error } = await supabaseAdmin
        .from("notifications")
        .update({
          status: "READ",
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .is("read_at", null);

      if (error) throw error;

      return res.json({ success: true });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  };

  app.put("/api/notifications/read-all", requireAuth, handleMarkAllRead);
  app.post("/api/notifications/read-all", requireAuth, handleMarkAllRead);

  /**
   * DELETE /api/notifications/:id
   * Deleta uma notificação
   */
  app.delete("/api/notifications/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const { error } = await supabaseAdmin
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      return res.json({ success: true });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * GET /api/notifications/preferences
   * Busca preferências de notificação do usuário
   */
  app.get("/api/notifications/preferences", requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);

      const { data, error } = await supabaseAdmin
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      // Se não existir, retornar padrão
      if (!data) {
        return res.json({
          whatsapp_enabled: true,
          email_enabled: false,
          quiet_hours_enabled: false,
          quiet_hours_start: "22:00",
          quiet_hours_end: "08:00",
          preferences: {},
        });
      }

      return res.json(data);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * PUT /api/notifications/preferences
   * Atualiza preferências de notificação
   */
  app.put("/api/notifications/preferences", requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const companyId = req.user?.company_id;

      const schema = z.object({
        whatsapp_enabled: z.boolean().optional(),
        email_enabled: z.boolean().optional(),
        quiet_hours_enabled: z.boolean().optional(),
        quiet_hours_start: z.string().optional(),
        quiet_hours_end: z.string().optional(),
        preferences: z.record(z.string(), z.any()).optional(),
      });

      const validated = schema.parse(req.body || {});

      const { data, error } = await supabaseAdmin
        .from("notification_preferences")
        .upsert({
          user_id: userId,
          company_id: companyId,
          ...validated,
        })
        .select()
        .single();

      if (error) throw error;

      return res.json(data);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * GET /api/notifications/stats
   * Estatísticas de notificações
   */
  app.get("/api/notifications/stats", requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);

      const { data, error } = await supabaseAdmin
        .from("v_notification_stats")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      return res.json(data || []);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });
}
