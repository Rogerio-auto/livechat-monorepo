// backend/src/routes/admin/infrastructure.ts

import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { InfrastructureController } from '../../controllers/admin/infrastructure.controller.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { AuthRequest } from '../../types/express.js';

const router = Router();

/**
 * Middleware para verificar se o usuário logado tem permissão de ADMIN
 */
const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = String(req.profile?.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Acesso negado. Apenas para administradores do sistema." });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: "Falha ao validar permissões de admin" });
  }
};

/**
 * GET /api/admin/infrastructure/summary
 * Retorna visão geral de toda a infra (Redis, Rabbit, DB, Workers)
 */
router.get('/summary', requireAuth, requireAdmin as any, InfrastructureController.getSummary);

/**
 * GET /api/admin/infrastructure/redis
 * Detalhes específicos do Redis
 */
router.get('/redis', requireAuth, requireAdmin as any, InfrastructureController.getRedisStats);

/**
 * GET /api/admin/infrastructure/rabbit
 * Detalhes específicos de filas
 */
router.get('/rabbit', requireAuth, requireAdmin as any, InfrastructureController.getRabbitStats);

/**
 * GET /api/admin/infrastructure/workers
 * Status das instâncias de workers
 */
router.get('/workers', requireAuth, requireAdmin as any, InfrastructureController.getWorkerStatus);

export default router;
