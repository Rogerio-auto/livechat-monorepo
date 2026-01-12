import { Response } from "express";
import { AuthRequest } from "../types/express.js";
import { EX_APP, publish } from "../queue/rabbit.js";

export class QueueController {
  static async startChat(req: AuthRequest, res: Response) {
    try {
      const { leadId, inboxId } = req.body ?? {};
      if (!leadId || !inboxId) {
        return res.status(400).json({ error: "leadId e inboxId obrigatórios" });
      }

      // Publica no exchange do app usando a routing key já bindada
      await publish(EX_APP, "outbound.request", {
        leadId,
        inboxId,
        jobType: "livechat.startChat",
        attempt: 0,
      });

      return res.status(202).json({ queued: true });
    } catch (e: any) {
      console.error("[queue] publish error:", e);
      return res.status(500).json({ error: e?.message || "queue publish error" });
    }
  }
}
