// backend/src/routes/admin/tools.ts

import { Router } from 'express';
import { ToolController } from '../../controllers/admin/tool.controller.ts';
import { requireAuth } from '../../middlewares/requireAuth.js';

const router = Router();

// Middleware para verificar se é ADMIN
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const role = String(req.profile?.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: "Erro ao verificar permissões" });
  }
};

// Rotas de Ferramentas
router.get('/dashboard', requireAuth, requireAdmin, ToolController.getDashboard);
router.get('/logs', requireAuth, requireAdmin, ToolController.getLogs);
router.post('/:id/test', requireAuth, requireAdmin, ToolController.testHealth);
router.get('/:id/tests', requireAuth, requireAdmin, ToolController.getTestHistory);

export default router;
