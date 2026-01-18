// backend/src/controllers/admin/infrastructure.controller.ts

import { Request, Response } from 'express';
import { InfrastructureService } from '../../services/admin/infrastructure.service.js';

const infraService = new InfrastructureService();

export class InfrastructureController {
  static async getSummary(req: Request, res: Response) {
    try {
      const summary = await infraService.getSummary();
      res.json(summary);
    } catch (error: any) {
      console.error('[InfraController] getSummary error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getRedisStats(req: Request, res: Response) {
    try {
      const stats = await infraService.getRedisStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getRabbitStats(req: Request, res: Response) {
    try {
      const stats = await infraService.getRabbitMQStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getWorkerStatus(req: Request, res: Response) {
    try {
      const stats = await infraService.getWorkerStatus();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
