import express, { Response } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { AuthRequest } from "../types/express.js";
import crypto from "node:crypto";
import db from "../pg.js";
import { supabaseAdmin } from "../lib/supabase.js";

const router = express.Router();

/**
 * Listar chaves de API da empresa
 */
router.get("/settings/api-keys", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: "Contexto de empresa não encontrado" });

    const keys = await db.any(
      `SELECT id, label, key_prefix, scopes, is_active, last_used_at, created_at 
       FROM public.api_keys 
       WHERE company_id = $1 
       ORDER BY created_at DESC`,
      [companyId]
    );

    return res.json(keys);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Criar nova chave de API
 */
router.post("/settings/api-keys", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { label } = req.body;
    if (!companyId) return res.status(400).json({ error: "Contexto de empresa não encontrado" });
    if (!label) return res.status(400).json({ error: "Rótulo (label) é obrigatório" });

    // 1. Gerar chave aleatória
    const randomPart = crypto.randomBytes(24).toString("hex");
    const fullKey = `sk_live_${randomPart}`;
    const keyPrefix = "sk_live_";
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");

    // 2. Salvar no banco
    const newKey = await db.one(
      `INSERT INTO public.api_keys (company_id, label, key_prefix, key_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, label, key_prefix, created_at`,
      [companyId, label, keyPrefix, keyHash]
    );

    // 3. Retornar a chave completa APENAS UMA VEZ
    return res.status(201).json({
      ...newKey,
      api_key: fullKey,
      warning: "Guarde esta chave em um local seguro. Você não poderá visualizá-la novamente."
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Revogar (Deletar) chave de API
 */
router.delete("/settings/api-keys/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    if (!companyId) return res.status(400).json({ error: "Contexto de empresa não encontrado" });

    const result = await db.result(
      `DELETE FROM public.api_keys WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Chave não encontrada" });
    }

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// --- WEBHOOKS (SETTINGS) ---

/**
 * Listar assinaturas de webhooks da empresa
 */
router.get("/settings/webhooks", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: "Contexto de empresa não encontrado" });

    const { data: webhooks, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .select("id, url, events, secret, is_active, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.json(webhooks);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Criar nova assinatura de webhook
 */
router.post("/settings/webhooks", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { url, events } = req.body;
    if (!companyId) return res.status(400).json({ error: "Contexto de empresa não encontrado" });
    if (!url) return res.status(400).json({ error: "URL é obrigatória" });

    // Gerar um secret para assinatura HMAC
    const secret = crypto.randomBytes(32).toString("hex");

    const { data: newWebhook, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .insert({
        company_id: companyId,
        url,
        events: events || ["*"],
        secret,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(newWebhook);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Deletar assinatura de webhook
 */
router.delete("/settings/webhooks/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    if (!companyId) return res.status(400).json({ error: "Contexto de empresa não encontrado" });

    const { error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw error;
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const settingsApiRouter = router;
