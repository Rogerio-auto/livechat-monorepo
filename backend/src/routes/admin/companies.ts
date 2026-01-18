// backend/src/routes/admin/companies.ts
import { Router, Response, NextFunction } from "express";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { AuthRequest } from "../../types/express.js";
import { AdminCompanyController } from "../../controllers/admin/adminCompany.controller.js";

const router = Router();

// Middleware para verificar se é ADMIN
const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

// Rutas de Usuários da Empresa
router.get("/:companyId/users", requireAuth, requireAdmin, AdminCompanyController.listUsers);
router.patch("/:companyId/users/:userId/role", requireAuth, requireAdmin, AdminCompanyController.updateUserRole);
router.patch("/:companyId/users/:userId/status", requireAuth, requireAdmin, AdminCompanyController.updateUserStatus);
router.get("/:companyId/users/:userId/activity", requireAuth, requireAdmin, AdminCompanyController.getUserActivity);
router.delete("/:companyId/users/:userId", requireAuth, requireAdmin, AdminCompanyController.removeUser);

// Rutas de Logs da Empresa
router.get("/:companyId/logs", requireAuth, requireAdmin, AdminCompanyController.listLogs);
router.get("/:companyId/logs/:logId", requireAuth, requireAdmin, AdminCompanyController.getLogDetails);

// Rutas de Uso e Financeiro
router.get("/:companyId/usage", requireAuth, requireAdmin, AdminCompanyController.getUsage);
router.get("/:companyId/billing", requireAuth, requireAdmin, AdminCompanyController.getBilling);

export default router;
