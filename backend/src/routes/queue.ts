// backend/src/routes/queue.ts
import type { Application, Request, Response } from "express";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { publish, EX_APP } from "../queue/rabbit.ts";

export function registerQueueRoutes(app: Application) {
  app.post(
    "/queue/livechat/start-chat",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { leadId, inboxId } = (req.body ?? {}) as {
          leadId?: string;
          inboxId?: string;
        };

        if (!leadId || !inboxId) {
          return res
            .status(400)
            .json({ error: "leadId e inboxId obrigatórios" });
        }

        // Publica no exchange do app, na routing key já bindada à Q_OUTBOUND
        await publish(EX_APP, "outbound.request", {
          leadId,
          inboxId,
          jobType: "livechat.startChat",
        });

        return res.status(202).json({ queued: true });
      } catch (e: any) {
        console.error("[queue] publish error:", e);
        return res
          .status(500)
          .json({ error: e?.message || "queue publish error" });
      }
    }
  );
}
