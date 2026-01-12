// backend/src/controllers/admin/tool.controller.ts

import { Request, Response } from 'express';
import { ToolManagementService } from '../../services/admin/tool-management.service.js';

export class ToolController {
  
  static async getDashboard(req: Request, res: Response) {
    try {
      const dashboard = await ToolManagementService.getToolDashboard();
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getLogs(req: Request, res: Response) {
    try {
      const filters = {
        toolId: req.query.toolId as string,
        agentId: req.query.agentId as string,
        status: req.query.status as 'success' | 'error',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await ToolManagementService.getLogs(filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async testHealth(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const result = await ToolManagementService.testToolHealth(id, userId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getTestHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const history = await ToolManagementService.getToolTestHistory(id);
      res.json(history);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
}
