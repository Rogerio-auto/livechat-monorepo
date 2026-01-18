// Middleware para bloquear acesso após trial expirado
import type { Request, Response, NextFunction } from "express";
import { getSubscription } from "../services/subscriptions.service.js";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    company_id: string;
    role?: string;
  };
}

/**
 * Middleware que verifica se a empresa tem uma assinatura ativa
 * Bloqueia acesso se:
 * - Trial expirado
 * - Assinatura cancelada
 * - Assinatura expirada
 * - Pagamento em atraso (past_due)
 */
export async function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.user?.company_id;
    
    if (!companyId) {
      res.status(401).json({ 
        error: "Unauthorized",
        message: "Company ID not found"
      });
      return;
    }

    const subscription = await getSubscription(companyId);

    if (!subscription) {
      res.status(403).json({
        error: "No subscription found",
        message: "Please subscribe to a plan to continue",
        requiresUpgrade: true,
        redirectTo: "/subscription"
      });
      return;
    }

    // Verificar status da assinatura
    const blockedStatuses = ["expired", "canceled", "past_due"];
    
    if (blockedStatuses.includes(subscription.status)) {
      let message = "Your subscription is no longer active";
      
      if (subscription.status === "expired") {
        message = "Your trial period has ended. Please upgrade to continue using the platform.";
      } else if (subscription.status === "past_due") {
        message = "Your payment is overdue. Please update your payment method to continue.";
      } else if (subscription.status === "canceled") {
        message = "Your subscription has been canceled. Please reactivate to continue.";
      }

      res.status(403).json({
        error: "Subscription inactive",
        message,
        status: subscription.status,
        requiresUpgrade: true,
        redirectTo: "/subscription"
      });
      return;
    }

    // Verificar se o trial está prestes a expirar (últimos 3 dias)
    if (subscription.status === "trial" && subscription.trial_ends_at) {
      const trialEnd = new Date(subscription.trial_ends_at);
      const now = new Date();
      const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Adicionar header de aviso se faltar menos de 3 dias
      if (daysRemaining <= 3 && daysRemaining > 0) {
        res.setHeader("X-Trial-Expiring", "true");
        res.setHeader("X-Trial-Days-Remaining", daysRemaining.toString());
      }
    }

    // Assinatura ativa, continuar
    next();
  } catch (error) {
    console.error("[requireActiveSubscription] Error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: "Failed to verify subscription status"
    });
  }
}

/**
 * Versão mais leve do middleware - apenas avisa mas não bloqueia
 * Útil para rotas de visualização ou páginas de configuração
 */
export async function warnInactiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.user?.company_id;
    
    if (!companyId) {
      next();
      return;
    }

    const subscription = await getSubscription(companyId);

    if (subscription) {
      res.locals.subscription = subscription;
      
      // Adicionar headers informativos
      res.setHeader("X-Subscription-Status", subscription.status);
      res.setHeader("X-Subscription-Plan", subscription.plan?.name || "unknown");

      if (subscription.status === "trial" && subscription.trial_ends_at) {
        const trialEnd = new Date(subscription.trial_ends_at);
        const now = new Date();
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 3 && daysRemaining > 0) {
          res.setHeader("X-Trial-Expiring", "true");
          res.setHeader("X-Trial-Days-Remaining", daysRemaining.toString());
        }
      }
    }

    next();
  } catch (error) {
    console.error("[warnInactiveSubscription] Error:", error);
    next(); // Não bloquear em caso de erro
  }
}
