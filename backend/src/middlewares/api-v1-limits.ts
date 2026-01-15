import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express.js";
import { getSubscription } from "../services/subscriptions.service.js";
import { RateLimitService } from "../services/rate-limit.service.js";
import { logger } from "../lib/logger.js";

/**
 * Middleware to check if the company's plan allows API access
 */
export async function requireApiFeature(req: AuthRequest, res: Response, next: NextFunction) {
    const companyId = req.user?.company_id;
    if (!companyId) {
        return res.status(401).json({ error: "Contexto de empresa não encontrado" });
    }

    try {
        const subscription = await getSubscription(companyId);
        
        // Check feature flag in plan
        const features = (subscription?.plan?.features || {}) as any;
        
        if (!features.api_access) {
            return res.status(403).json({ 
                error: "Seu plano atual não permite acesso à API Pública.",
                details: "Faça upgrade para o plano Professional ou Enterprise para utilizar esta funcionalidade."
            });
        }

        next();
    } catch (error) {
        logger.error(`[requireApiFeature] Error checking features for company ${companyId}`, error);
        res.status(500).json({ error: "Erro interno ao verificar permissões de plano" });
    }
}

/**
 * Middleware to enforce API rate limits per company
 */
export async function apiRateLimiter(req: AuthRequest, res: Response, next: NextFunction) {
    const companyId = req.user?.company_id;
    if (!companyId) return next();

    try {
        const { allowed, limit, remaining, reset } = await RateLimitService.checkRateLimit(companyId);
        
        // Set standard rate limit headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(reset / 1000));

        if (!allowed) {
            logger.warn(`[apiRateLimiter] Rate limit exceeded for company ${companyId}`);
            return res.status(429).json({ 
                error: "Limite de requisições excedido", 
                details: `Seu plano permite ${limit} requisições por minuto.` 
            });
        }

        next();
    } catch (error) {
        logger.error(`[apiRateLimiter] Error enforcing limit for company ${companyId}`, error);
        next(); // Fail open
    }
}
