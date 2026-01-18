// backend/src/controllers/admin/adminCompany.controller.ts
import { Response } from "express";
import { AuthRequest } from "../../types/express.js";
import { adminUsersService } from "../../services/admin/adminUsers.service.js";
import { companyLogsService } from "../../services/admin/companyLogs.service.js";
import { companyUsageService } from "../../services/admin/companyUsage.service.js";
import { companyBillingService } from "../../services/admin/companyBilling.service.js";

export class AdminCompanyController {
  // === USERS ===
  
  static async listUsers(req: AuthRequest, res: Response) {
    try {
      const { companyId } = req.params;
      const { page, limit, role, status, search } = req.query;
      
      const result = await adminUsersService.listByCompany({
        company_id: companyId,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        role: role as string,
        status: status as string,
        search: search as string
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] listUsers error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async updateUserRole(req: AuthRequest, res: Response) {
    try {
      const { companyId, userId } = req.params;
      const { role } = req.body;
      
      if (!role) return res.status(400).json({ error: "Papel obrigatório" });
      
      const result = await adminUsersService.updateRole(userId, companyId, role);
      
      // Log this action
      await companyLogsService.create({
        company_id: companyId,
        user_id: req.user?.id,
        event_type: 'info',
        category: 'auth',
        severity: 'medium',
        title: 'Papel de usuário alterado',
        message: `O admin ${req.user?.id} alterou o papel do usuário ${userId} para ${role}`,
        metadata: { userId, role }
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] updateUserRole error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async updateUserStatus(req: AuthRequest, res: Response) {
    try {
      const { companyId, userId } = req.params;
      const { status } = req.body;
      
      if (!status) return res.status(400).json({ error: "Status obrigatório" });
      
      const result = await adminUsersService.updateStatus(userId, companyId, status);
      
      // Log this action
      await companyLogsService.create({
        company_id: companyId,
        user_id: req.user?.id,
        event_type: 'warning',
        category: 'auth',
        severity: 'high',
        title: 'Status de usuário alterado',
        message: `O admin ${req.user?.id} alterou o status do usuário ${userId} para ${status}`,
        metadata: { userId, status }
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] updateUserStatus error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async removeUser(req: AuthRequest, res: Response) {
    try {
      const { companyId, userId } = req.params;
      
      const result = await adminUsersService.removeUser(userId, companyId);
      
      // Log this action
      await companyLogsService.create({
        company_id: companyId,
        user_id: req.user?.id,
        event_type: 'warning',
        category: 'auth',
        severity: 'high',
        title: 'Usuário removido da empresa',
        message: `O admin ${req.user?.id} removeu o usuário ${userId} da empresa`,
        metadata: { userId }
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] removeUser error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async getUserActivity(req: AuthRequest, res: Response) {
    try {
      const { companyId, userId } = req.params;
      const result = await adminUsersService.getUserActivity(userId, companyId);
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] getUserActivity error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // === LOGS ===

  static async listLogs(req: AuthRequest, res: Response) {
    try {
      const { companyId } = req.params;
      const { page, limit, type, category, severity, startDate, endDate, userId, search } = req.query;
      
      const result = await companyLogsService.list({
        company_id: companyId,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        type: type as string,
        category: category as string,
        severity: severity as string,
        startDate: startDate as string,
        endDate: endDate as string,
        userId: userId as string,
        search: search as string
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] listLogs error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async getLogStats(req: AuthRequest, res: Response) {
    try {
      const { companyId } = req.params;
      const result = await companyLogsService.getStats(companyId);
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] getLogStats error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async getLogDetails(req: AuthRequest, res: Response) {
    try {
      const { companyId, logId } = req.params;
      const result = await companyLogsService.getById(logId, companyId);
      if (!result) return res.status(404).json({ error: "Log não encontrado" });
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] getLogDetails error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // === USAGE & BILLING ===

  static async getUsage(req: AuthRequest, res: Response) {
    try {
      const { companyId } = req.params;
      const result = await companyUsageService.getUsageByCompany(companyId);
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] getUsage error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async getBilling(req: AuthRequest, res: Response) {
    try {
      const { companyId } = req.params;
      const result = await companyBillingService.getBillingByCompany(companyId);
      return res.json(result);
    } catch (error: any) {
      console.error("[AdminCompanyController] getBilling error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
}
