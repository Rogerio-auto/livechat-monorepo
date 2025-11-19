import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  listRulesByCompany,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  getRuleLogs,
  type CreateRuleInput,
  type UpdateRuleInput,
} from "../repos/automationRules.repo.js";

export function registerAutomationRulesRoutes(app: express.Application) {
  /**
   * GET /api/automation-rules - Listar regras da empresa
   */
  app.get("/api/automation-rules", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user?.company_id;
      const activeOnly = req.query.active_only === "true";

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const rules = await listRulesByCompany(companyId, activeOnly);
      return res.json({ rules });
    } catch (error: any) {
      console.error("[AutomationRules API] Error listing rules:", error);
      return res.status(500).json({ error: error.message || "Failed to list rules" });
    }
  });

  /**
   * GET /api/automation-rules/:id - Buscar regra por ID
   */
  app.get("/api/automation-rules/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user?.company_id;

      const rule = await getRuleById(id);

      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      // Verificar se a regra pertence à empresa do usuário
      if (rule.company_id !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      return res.json(rule);
    } catch (error: any) {
      console.error("[AutomationRules API] Error fetching rule:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch rule" });
    }
  });

  /**
   * POST /api/automation-rules - Criar nova regra
   * Permite ADMIN, MANAGER, SUPERVISOR e AGENT
   */
  app.post("/api/automation-rules", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.public_user_id || req.user?.id;
      const companyId = req.user?.company_id;
      const userRole = req.user?.role;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      // Permitir ADMIN, MANAGER, SUPERVISOR e AGENT
      if (!["ADMIN", "MANAGER", "SUPERVISOR", "AGENT"].includes(userRole)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const input: CreateRuleInput = {
        ...req.body,
        company_id: companyId,
        created_by: userId,
      };

      // Validações básicas
      if (!input.name || !input.trigger_type || !input.task_template) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const rule = await createRule(input);

      console.log(`[AutomationRules] ✅ Rule created: ${rule.id} by user ${userId}`);

      return res.status(201).json(rule);
    } catch (error: any) {
      console.error("[AutomationRules API] Error creating rule:", error);
      return res.status(500).json({ error: error.message || "Failed to create rule" });
    }
  });

  /**
   * PUT /api/automation-rules/:id - Atualizar regra
   * Permite ADMIN, MANAGER, SUPERVISOR e AGENT (apenas suas próprias regras para AGENT)
   */
  app.put("/api/automation-rules/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.public_user_id || req.user?.id;
      const companyId = req.user?.company_id;
      const userRole = req.user?.role;

      const existingRule = await getRuleById(id);

      if (!existingRule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      // Verificar se a regra pertence à empresa do usuário
      if (existingRule.company_id !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // AGENT só pode editar suas próprias regras
      if (userRole === "AGENT" && existingRule.created_by !== userId) {
        return res.status(403).json({ error: "You can only edit your own rules" });
      }

      const input: UpdateRuleInput = req.body;
      const rule = await updateRule(id, input);

      console.log(`[AutomationRules] ✅ Rule updated: ${rule.id} by user ${userId}`);

      return res.json(rule);
    } catch (error: any) {
      console.error("[AutomationRules API] Error updating rule:", error);
      return res.status(500).json({ error: error.message || "Failed to update rule" });
    }
  });

  /**
   * DELETE /api/automation-rules/:id - Deletar regra
   * Permite ADMIN, MANAGER, SUPERVISOR e AGENT (apenas suas próprias regras para AGENT)
   */
  app.delete("/api/automation-rules/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.public_user_id || req.user?.id;
      const companyId = req.user?.company_id;
      const userRole = req.user?.role;

      const existingRule = await getRuleById(id);

      if (!existingRule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      // Verificar se a regra pertence à empresa do usuário
      if (existingRule.company_id !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // AGENT só pode deletar suas próprias regras
      if (userRole === "AGENT" && existingRule.created_by !== userId) {
        return res.status(403).json({ error: "You can only delete your own rules" });
      }

      await deleteRule(id);

      console.log(`[AutomationRules] ✅ Rule deleted: ${id} by user ${userId}`);

      return res.status(204).send();
    } catch (error: any) {
      console.error("[AutomationRules API] Error deleting rule:", error);
      return res.status(500).json({ error: error.message || "Failed to delete rule" });
    }
  });

  /**
   * GET /api/automation-rules/:id/logs - Buscar logs de execução
   */
  app.get("/api/automation-rules/:id/logs", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user?.company_id;
      const limit = parseInt(req.query.limit || "50");

      const rule = await getRuleById(id);

      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      // Verificar se a regra pertence à empresa do usuário
      if (rule.company_id !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const logs = await getRuleLogs(id, limit);
      return res.json({ logs });
    } catch (error: any) {
      console.error("[AutomationRules API] Error fetching logs:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch logs" });
    }
  });
}
