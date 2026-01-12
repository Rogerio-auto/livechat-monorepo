import express, { Response } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  getSubscription,
  getActivePlans,
  getPlanLimits,
  checkLimit,
  getCurrentUsage,
  getTrialDaysRemaining,
  checkFeatureAccess,
  changePlan,
  type PlanLimits,
  type SubscriptionWithPlan,
} from "../services/subscriptions.service.js";

export function registerSubscriptionRoutes(app: express.Application) {
  // ========== GET /api/subscriptions/current ==========
  // Obter assinatura atual da empresa (com plano e dias de trial)
  // 1. Get current subscription
  app.get("/api/subscriptions/current", requireAuth, async (req: any, res: Response) => {
    // Prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "company_id not found" });
      }

      const subscription = await getSubscription(companyId);
      if (!subscription) {
        return res.status(404).json({ 
          error: "No subscription found",
          message: "This company does not have a subscription yet"
        });
      }

      // Calcular dias restantes de trial
      const trialDaysRemaining = getTrialDaysRemaining(subscription);

      // Retornar subscription com trial_days_remaining direto no objeto
      res.json({
        ...subscription,
        trial_days_remaining: trialDaysRemaining,
      });
    } catch (error) {
      console.error("[subscriptions] Error getting current subscription:", error);
      res.status(500).json({ 
        error: "Failed to get subscription",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // ========== GET /api/subscriptions/plans ==========
  // Listar todos os planos disponíveis
  app.get("/api/subscriptions/plans", async (req: any, res: Response) => {
    try {
      const plans = await getActivePlans();
      res.json(plans);
    } catch (error) {
      console.error("[subscriptions] Error getting plans:", error);
      res.status(500).json({ error: "Failed to get plans" });
    }
  });

  // ========== GET /api/subscriptions/limits ==========
  // Obter limites do plano atual com uso atual
  // 2. Get plan limits
  app.get("/api/subscriptions/limits", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "company_id not found" });
      }

      const limits = await getPlanLimits(companyId);
      if (!limits) {
        return res.status(404).json({ error: "No plan limits found" });
      }

      // Verificar uso atual de cada recurso
      const [usersCheck, inboxesCheck, agentsCheck, messagesCheck, campaignsCheck] = await Promise.all([
        checkLimit(companyId, "users"),
        checkLimit(companyId, "inboxes"),
        checkLimit(companyId, "ai_agents"),
        checkLimit(companyId, "messages_per_month"),
        checkLimit(companyId, "campaigns_per_month"),
      ]);

      res.json({
        limits,
        usage: {
          users: usersCheck,
          inboxes: inboxesCheck,
          ai_agents: agentsCheck,
          messages_per_month: messagesCheck,
          campaigns_per_month: campaignsCheck,
        },
      });
    } catch (error) {
      console.error("[subscriptions] Error getting limits:", error);
      res.status(500).json({ error: "Failed to get limits" });
    }
  });

  // ========== GET /api/subscriptions/usage ==========
  // Obter uso detalhado do período atual
  // 3. Get usage stats
  app.get("/api/subscriptions/usage", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "company_id not found" });
      }

      const subscription = await getSubscription(companyId);
      if (!subscription) {
        return res.status(404).json({ error: "No subscription found" });
      }

      // Obter uso de todas as métricas
      const [messagesSent, aiCalls, campaignsSent] = await Promise.all([
        getCurrentUsage(companyId, "messages_sent"),
        getCurrentUsage(companyId, "ai_calls"),
        getCurrentUsage(companyId, "campaigns_sent"),
      ]);

      res.json({
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
        usage: {
          messages_sent: messagesSent,
          ai_calls: aiCalls,
          campaigns_sent: campaignsSent,
        },
      });
    } catch (error) {
      console.error("[subscriptions] Error getting usage:", error);
      res.status(500).json({ error: "Failed to get usage" });
    }
  });

  // ========== GET /api/subscriptions/features ==========
  // Verificar acesso a features específicas
  // 4. Get features available
  app.get("/api/subscriptions/features", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "company_id not found" });
      }

      const subscription = await getSubscription(companyId);
      if (!subscription) {
        return res.status(404).json({ error: "No subscription found" });
      }

      res.json({
        features: subscription.plan.features,
      });
    } catch (error) {
      console.error("[subscriptions] Error getting features:", error);
      res.status(500).json({ error: "Failed to get features" });
    }
  });

  // ========== POST /api/subscriptions/check-limit ==========
  // Verificar se pode criar um recurso específico
  // 5. Check if can create resource
  app.post("/api/subscriptions/check-limit", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "company_id not found" });
      }

      const { resource } = req.body;
      if (!resource) {
        return res.status(400).json({ error: "resource is required" });
      }

      const validResources: (keyof PlanLimits)[] = [
        "users",
        "inboxes",
        "ai_agents",
        "messages_per_month",
        "campaigns_per_month",
        "contacts",
        "storage_mb",
      ];

      if (!validResources.includes(resource as keyof PlanLimits)) {
        return res.status(400).json({ error: "Invalid resource" });
      }

      const result = await checkLimit(companyId, resource as keyof PlanLimits);

      res.json(result);
    } catch (error) {
      console.error("[subscriptions] Error checking limit:", error);
      res.status(500).json({ error: "Failed to check limit" });
    }
  });

  // ========== POST /api/subscriptions/upgrade ==========
  // Upgrade/downgrade de plano (sem Stripe por enquanto)
  // 6. Upgrade/downgrade plan
  app.post("/api/subscriptions/upgrade", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "company_id not found" });
      }

      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "planId is required" });
      }

      // Atualizar plano diretamente (sem Stripe por enquanto)
      await changePlan(companyId, planId);

      // Buscar subscription atualizada
      const updatedSubscription = await getSubscription(companyId);

      res.json({
        success: true,
        message: "Plan updated successfully",
        subscription: updatedSubscription,
      });
    } catch (error) {
      console.error("[subscriptions] Error upgrading subscription:", error);
      res.status(500).json({ 
        error: "Failed to upgrade subscription",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  console.log("[routes] Subscription routes registered");
}
