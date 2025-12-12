import express from "express";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { NotificationService } from "../services/NotificationService.ts";

export function registerNotificationRoutes(app: express.Application) {
  console.log("[NOTIFICATION ROUTES] 🔔 Registering notification routes");

  // Buscar notificações não lidas
  app.get("/api/notifications/unread", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;
      console.log(`[API] GET /notifications/unread - User: ${userId}`);

      const notifications = await NotificationService.getUnread(userId, companyId);
      return res.json(notifications);
    } catch (error: any) {
      console.error("[GET /api/notifications/unread] Error:", error);
      return res.status(500).json({ error: "Erro ao buscar notificações não lidas" });
    }
  });

  // Contar notificações não lidas
  app.get("/api/notifications/unread/count", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;

      const count = await NotificationService.countUnread(userId, companyId);
      return res.json({ count });
    } catch (error: any) {
      console.error("[GET /api/notifications/unread/count] Error:", error);
      return res.status(500).json({ error: "Erro ao contar notificações não lidas" });
    }
  });

  // Buscar todas as notificações (com paginação)
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;
      const limit = parseInt((req.query.limit as string) || "50");
      const offset = parseInt((req.query.offset as string) || "0");

      const notifications = await NotificationService.getAll(userId, companyId, limit, offset);
      return res.json(notifications);
    } catch (error: any) {
      console.error("[GET /api/notifications] Error:", error);
      return res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  });

  // Marcar notificação como lida
  app.patch("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user.id;

      await NotificationService.markAsRead(notificationId, userId);
      return res.json({ ok: true });
    } catch (error: any) {
      console.error("[PATCH /api/notifications/:id/read] Error:", error);
      return res.status(500).json({ error: "Erro ao marcar notificação como lida" });
    }
  });

  // Marcar todas como lidas
  app.post("/api/notifications/read-all", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;

      await NotificationService.markAllAsRead(userId, companyId);
      return res.json({ ok: true });
    } catch (error: any) {
      console.error("[POST /api/notifications/read-all] Error:", error);
      return res.status(500).json({ error: "Erro ao marcar todas como lidas" });
    }
  });

  // Deletar notificação
  app.delete("/api/notifications/:id", requireAuth, async (req: any, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user.id;

      await NotificationService.delete(notificationId, userId);
      return res.json({ ok: true });
    } catch (error: any) {
      console.error("[DELETE /api/notifications/:id] Error:", error);
      return res.status(500).json({ error: "Erro ao deletar notificação" });
    }
  });

  // Criar notificação (admin/debug)
  app.post("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;
      const { title, message, type, priority, data, soundType, actionUrl, category } = req.body;

      console.log(`[API] POST /notifications - User: ${userId}`, { title, type });

      if (!title || !message || !type) {
        return res.status(400).json({ error: "title, message e type são obrigatórios" });
      }

      const notification = await NotificationService.create({
        title,
        message,
        type,
        priority,
        userId,
        companyId,
        data,
        soundType,
        actionUrl,
        category,
      });

      return res.json(notification);
    } catch (error: any) {
      console.error("[POST /api/notifications] Error:", error);
      return res.status(500).json({ error: "Erro ao criar notificação" });
    }
  });
}
