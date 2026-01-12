import express from "express";
import type { Application, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import * as flowsRepo from "../repos/flows.repo.js";
import { triggerManualFlow } from "../services/flow-engine.service.js";
import { AuthRequest } from "../types/express.js";

export function registerFlowRoutes(app: Application) {
  /**
   * GET /api/livechat/flows - Listar fluxos da empresa
   */
  app.get("/api/livechat/flows", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) return res.status(400).json({ error: "Company ID is required" });

      const flows = await flowsRepo.listFlows(companyId);
      return res.json(flows);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/livechat/flows/:id - Buscar fluxo por ID
   */
  app.get("/api/livechat/flows/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const flow = await flowsRepo.getFlowById(id);
      
      if (!flow) return res.status(404).json({ error: "Flow not found" });
      if (flow.company_id !== req.user?.company_id) return res.status(403).json({ error: "Access denied" });

      return res.json(flow);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/livechat/flows - Criar novo fluxo
   */
  app.post("/api/livechat/flows", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) return res.status(400).json({ error: "Company ID is required" });

      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        trigger_config: z.any().optional(),
        nodes: z.array(z.any()).optional(),
        edges: z.array(z.any()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const flow = await flowsRepo.createFlow({
        ...parsed.data,
        company_id: companyId,
        created_by: req.user?.id,
        status: 'DRAFT'
      });

      return res.status(201).json(flow);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/livechat/flows/:id - Atualizar fluxo
   */
  app.put("/api/livechat/flows/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const flow = await flowsRepo.getFlowById(id);
      
      if (!flow) return res.status(404).json({ error: "Flow not found" });
      if (flow.company_id !== req.user?.company_id) return res.status(403).json({ error: "Access denied" });

      const schema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
        trigger_config: z.any().optional(),
        nodes: z.array(z.any()).optional(),
        edges: z.array(z.any()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const updated = await flowsRepo.updateFlow(id, parsed.data);
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/livechat/flows/:id - Deletar fluxo
   */
  app.delete("/api/livechat/flows/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const flow = await flowsRepo.getFlowById(id);
      
      if (!flow) return res.status(404).json({ error: "Flow not found" });
      if (flow.company_id !== req.user?.company_id) return res.status(403).json({ error: "Access denied" });

      await flowsRepo.deleteFlow(id);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/livechat/flows/:id/trigger - Disparar fluxo manualmente
   */
  app.post("/api/livechat/flows/:id/trigger", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { contactId, chatId, variables } = req.body;
      const companyId = req.user?.company_id;

      if (!contactId || !companyId) return res.status(400).json({ error: "Contact ID and Company ID are required" });

      await triggerManualFlow({
        companyId,
        flowId: id,
        contactId,
        chatId,
        variables,
        userId: req.user?.id
      });

      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });
}
