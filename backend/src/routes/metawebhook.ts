// ESM
import type { Request, Response } from "express";
import { handleMetaWebhook, verifyMetaWebhook } from "../services/meta/handlers.ts";

export async function metaWebhookGet(req: Request, res: Response) {
    try {
        const out = await verifyMetaWebhook(req.query);
        return res.status(out.status).send(out.body);
    } catch (e: any) {
        return res.status(403).send("forbidden");
    }
}

export async function metaWebhookPost(req: Request, res: Response) {
    console.log("[WEBHOOK] headers:", req.headers);
    console.log("[WEBHOOK] raw len:", (req as any).rawBody?.length);
    console.log("[WEBHOOK] body:", JSON.stringify(req.body));
    // responda rápido
    res.sendStatus(200);
    try {
        await handleMetaWebhook(req.body);
    } catch (e) {
        // loga e segue
    }
}
