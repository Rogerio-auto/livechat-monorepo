// backend/src/controllers/admin/template.controller.ts

import { Request, Response } from 'express';
import { TemplateManagementService } from '../../services/admin/templateManagement.service.ts';

export class TemplateController {
  
  static async list(req: Request, res: Response) {
    try {
      const filters = {
        category: req.query.category as string,
        isPublic: req.query.isPublic === 'true' ? true : req.query.isPublic === 'false' ? false : undefined,
        companyId: req.query.companyId as string,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await TemplateManagementService.listTemplates(filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const template = await TemplateManagementService.getTemplateDetails(id);
      res.json(template);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id; // Assumindo que o middleware de auth coloca o user no req
      const template = await TemplateManagementService.createTemplate({
        ...req.body,
        created_by: userId
      });
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const template = await TemplateManagementService.updateTemplate(id, req.body);
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateTools(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tools } = req.body;
      const result = await TemplateManagementService.updateTemplateTools(id, tools);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateQuestions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { questions } = req.body;
      const result = await TemplateManagementService.updateTemplateQuestions(id, questions);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async runTest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { scenarioId, message } = req.body;
      const userId = (req as any).user?.id;
      const result = await TemplateManagementService.runTemplateTest(id, scenarioId, userId, message);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async validate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const result = await TemplateManagementService.validateTemplate(id, {
        ...req.body,
        userId
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async listScenarios(req: Request, res: Response) {
    try {
      const { templateId } = req.query;
      const scenarios = await TemplateManagementService.listScenarios(templateId as string);
      res.json(scenarios);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
