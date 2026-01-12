// backend/src/routes/admin/templates.ts

import { Router } from 'express';
import { TemplateController } from '../../controllers/admin/template.controller.js';
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

// Rotas de Templates
router.get('/', requireAuth, requireAdmin, TemplateController.list);
router.get('/scenarios', requireAuth, requireAdmin, TemplateController.listScenarios);
router.get('/:id', requireAuth, requireAdmin, TemplateController.getById);
router.post('/', requireAuth, requireAdmin, TemplateController.create);
router.put('/:id', requireAuth, requireAdmin, TemplateController.update);

// Ferramentas do Template
router.put('/:id/tools', requireAuth, requireAdmin, TemplateController.updateTools);

// Perguntas do Template
router.put('/:id/questions', requireAuth, requireAdmin, TemplateController.updateQuestions);

// Testes e Validações
router.post('/:id/test', requireAuth, requireAdmin, TemplateController.runTest);
router.post('/:id/validate', requireAuth, requireAdmin, TemplateController.validate);

export default router;
