// src/routes/meta.health.ts
import express from "express";
import type { Application } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import {
  fetchMetaAccountHealth,
  updateInboxHealthStatus,
  isInboxHealthy,
} from "../services/meta/health.service.js";

export function registerMetaHealthRoutes(app: Application) {
  async function resolveCompanyId(req: any): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, user_id, company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = data as any;
    const companyId = row?.company_id;
    if (!companyId) throw new Error("Usuário sem company_id");

    req.user.company_id ||= companyId;
    req.user.db_user_id = row?.id ?? null;
    req.user.user_uid = row?.user_id ?? null;

    return companyId;
  }

  const router = express.Router();

  /**
   * GET /api/meta/health/:inboxId
   * Busca health status de uma inbox Meta
   * Query params:
   *   - refresh: true para forçar busca da API (senão usa cache)
   */
  router.get("/:inboxId", requireAuth, async (req, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { inboxId } = req.params;
      const { refresh } = req.query;

      // Validar inbox pertence à company
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, name, provider, meta_quality_rating, meta_messaging_tier, meta_tier_limit, meta_health_updated_at")
        .eq("id", inboxId)
        .eq("company_id", companyId)
        .single();

      if (inboxErr) {
        return res.status(404).json({ error: "Inbox não encontrada" });
      }

      if (!inbox) {
        return res.status(404).json({ error: "Inbox não encontrada" });
      }

      if (inbox.provider !== "META_CLOUD") {
        return res.status(400).json({ error: "Inbox deve ser do tipo META_CLOUD" });
      }

      // Se refresh=true ou nunca foi atualizado, buscar da API
      if (refresh === "true" || !inbox.meta_health_updated_at) {
        const health = await updateInboxHealthStatus(inboxId);
        return res.json({
          inbox_id: inboxId,
          inbox_name: inbox.name,
          ...health,
          cached: false,
          updated_at: new Date().toISOString(),
        });
      }

      // Retornar do cache
      return res.json({
        inbox_id: inboxId,
        inbox_name: inbox.name,
        phone_number_id: inbox.id,
        quality_rating: inbox.meta_quality_rating || "UNKNOWN",
        messaging_limit_tier: inbox.meta_messaging_tier || "UNKNOWN",
        tier_limit: inbox.meta_tier_limit || 100,
        display_phone_number: inbox.name, // Fallback
        cached: true,
        updated_at: inbox.meta_health_updated_at,
      });
    } catch (error) {
      console.error("[Meta Health API] Erro:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao buscar health status",
      });
    }
  });

  /**
   * POST /api/meta/health/:inboxId/refresh
   * Força atualização do health status da Meta API
   */
  router.post("/:inboxId/refresh", requireAuth, async (req, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { inboxId } = req.params;

      // Validar inbox
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, name, provider")
        .eq("id", inboxId)
        .eq("company_id", companyId)
        .single();

      if (inboxErr || !inbox) {
        return res.status(404).json({ error: "Inbox não encontrada" });
      }

      if (inbox.provider !== "META_CLOUD") {
        return res.status(400).json({ error: "Inbox deve ser do tipo META_CLOUD" });
      }

      const health = await updateInboxHealthStatus(inboxId);

      return res.json({
        inbox_id: inboxId,
        inbox_name: inbox.name,
        ...health,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Meta Health API] Erro ao refresh:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao atualizar health status",
      });
    }
  });

  /**
   * GET /api/meta/health/:inboxId/check
   * Verifica se inbox está saudável (simples true/false)
   */
  router.get("/:inboxId/check", requireAuth, async (req, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { inboxId } = req.params;

      // Validar inbox
      const { data: inbox } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider")
        .eq("id", inboxId)
        .eq("company_id", companyId)
        .single();

      if (!inbox) {
        return res.status(404).json({ error: "Inbox não encontrada" });
      }

      if (inbox.provider !== "META_CLOUD") {
        return res.status(400).json({ error: "Inbox deve ser do tipo META_CLOUD" });
      }

      const health = await isInboxHealthy(inboxId);

      return res.json(health);
    } catch (error) {
      console.error("[Meta Health API] Erro ao check:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao verificar health",
      });
    }
  });

  app.use("/api/meta/health", router);
}
