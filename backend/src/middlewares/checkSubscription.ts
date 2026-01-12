import { Response, NextFunction } from "express";
import {
  getSubscription,
  checkLimit,
  checkFeatureAccess,
} from "../services/subscriptions.service.js";
import type {
  PlanFeatures,
  PlanLimits,
} from "../services/subscriptions.service.js";

/**
 * Middleware para verificar se a empresa tem uma assinatura ativa
 * Bloqueia se status = 'expired' ou 'canceled'
 */
export async function requireActiveSubscription(req: any, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized: company_id not found" });
    }

    const subscription = await getSubscription(companyId);
    if (!subscription) {
      return res.status(403).json({
        error: "No active subscription",
        code: "NO_SUBSCRIPTION"
      });
    }

    // Bloquear se expirado ou cancelado
    if (subscription.status === "expired" || subscription.status === "canceled") {
      return res.status(403).json({
        error: `Subscription ${subscription.status}`,
        code: `SUBSCRIPTION_${subscription.status.toUpperCase()}`,
        subscription: {
          status: subscription.status,
          plan: {
            id: subscription.plan.id,
            name: subscription.plan.name,
            displayName: subscription.plan.display_name,
          },
        }
      });
    }

    // Passar subscription no req para uso posterior
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("[requireActiveSubscription] Error:", error);
    return res.status(500).json({ error: "Failed to verify subscription" });
  }
}

/**
 * Middleware para verificar se a empresa tem acesso a uma feature específica
 */
export function requireFeature(feature: keyof PlanFeatures) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(401).json({ error: "Unauthorized: company_id not found" });
      }

  const hasAccess = await checkFeatureAccess(companyId, feature);
      if (!hasAccess) {
        return res.status(403).json({
          error: `Feature '${feature}' not available in your plan`,
          code: "FEATURE_NOT_AVAILABLE",
          feature
        });
      }

      next();
    } catch (error) {
      console.error(`[requireFeature(${feature})] Error:`, error);
      return res.status(500).json({ error: "Failed to verify feature access" });
    }
  };
}

/**
 * Middleware para verificar limite de um recurso antes de criar
 * Se o limite for atingido, retorna 403 com informações do limite
 */
export function checkResourceLimit(resource: keyof PlanLimits) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(401).json({ error: "Unauthorized: company_id not found" });
      }

  const limitCheck = await checkLimit(companyId, resource);
      
      console.log(`[checkResourceLimit] ${resource}:`, {
        companyId,
        allowed: limitCheck.allowed,
        limit: limitCheck.limit,
        current: limitCheck.current,
        remaining: limitCheck.remaining
      });
      
      if (!limitCheck.allowed) {
        return res.status(403).json({
          error: `Limit reached for ${resource}`,
          code: "LIMIT_REACHED",
          resource,
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
          message: `Você atingiu o limite de ${limitCheck.limit} ${resource === 'users' ? 'colaboradores' : resource}. Atualmente você tem ${limitCheck.current} ${resource === 'users' ? 'colaboradores' : resource} cadastrados.`
        });
      }

      // Passar limitCheck no req para uso posterior se necessário
      req.limitCheck = limitCheck;
      next();
    } catch (error) {
      console.error(`[checkResourceLimit(${resource})] Error:`, error);
      return res.status(500).json({ error: "Failed to check resource limit" });
    }
  };
}

/**
 * Middleware "soft limit" - apenas avisa se está próximo do limite, mas não bloqueia
 * Adiciona headers com informações de uso
 */
export function warnOnLimit(resource: keyof PlanLimits, warningThreshold = 0.8) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return next();
      }

  const limitCheck = await checkLimit(companyId, resource);
      
      // Adicionar headers com informações de uso
      res.setHeader("X-Resource-Limit", limitCheck.limit);
      res.setHeader("X-Resource-Current", limitCheck.current);
      res.setHeader("X-Resource-Remaining", limitCheck.remaining);

      // Se está próximo do limite (ex: 80%), adicionar warning
      if (limitCheck.limit > 0 && limitCheck.current / limitCheck.limit >= warningThreshold) {
        res.setHeader("X-Resource-Warning", "approaching-limit");
      }

      req.limitCheck = limitCheck;
      next();
    } catch (error) {
      console.error(`[warnOnLimit(${resource})] Error:`, error);
      // Não bloquear em caso de erro, apenas seguir
      next();
    }
  };
}
