// ESM
import type { Request, Response } from "express";
import { handleMetaWebhook, verifyMetaWebhook, validateSignatureOrThrow } from "../services/meta/handlers.ts";

export async function metaWebhookGet(req: Request, res: Response) {
    try {
        const out = await verifyMetaWebhook(req.query);
        return res.status(out.status).send(out.body);
    } catch (e: any) {
        return res.status(403).send("forbidden");
    }
}

export async function metaWebhookPost(req: Request, res: Response) {
    // console.log("[WEBHOOK] headers:", req.headers);
    // console.log("[WEBHOOK] raw len:", (req as any).rawBody?.length);
    // console.log("[WEBHOOK] body:", JSON.stringify(req.body));

    try {
        const rawBody = (req as any).rawBody;
        const signature = req.headers["x-hub-signature-256"] as string | undefined;
        
        // Valida assinatura usando segredo do banco (se disponível) ou env
        if (rawBody) {
            await validateSignatureOrThrow(rawBody, signature, req.body);
        }
    } catch (e: any) {
        console.error("[WEBHOOK] Signature validation failed:", e.message);
        return res.status(403).send("Invalid signature");
    }

    // responda rápido
    res.sendStatus(200);
    try {
        await handleMetaWebhook(req.body);
    } catch (e) {
        // loga e segue
    }
}
