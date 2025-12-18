import { Router, Express } from "express";
import { AgentMonitoringService } from "../services/agentMonitoring.ts";
import { AgentMetricsRepository } from "../repos/agent_metrics.repo.ts";
import { runAgentReply } from "../services/agents.runtime.ts";
import { db } from "../pg.ts";

const router = Router();

// Dashboard global de monitoramento
router.get("/stats", async (req, res) => {
  try {
    const companyId = (req as any).user?.company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized" });

    const stats = await AgentMonitoringService.getDashboardStats(companyId);
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching monitoring stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Detalhes de um agente específico
router.get("/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const companyId = (req as any).user?.company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized" });

    const details = await AgentMonitoringService.getAgentDetails(agentId, companyId);
    res.json(details);
  } catch (error: any) {
    console.error("Error fetching agent details:", error);
    res.status(500).json({ error: error.message });
  }
});

// Listagem de erros
router.get("/errors", async (req, res) => {
  try {
    const companyId = (req as any).user?.company_id;
    const { agentId, limit } = req.query;
    if (!companyId) return res.status(401).json({ error: "Unauthorized" });

    const errors = await AgentMetricsRepository.getErrors(
      companyId, 
      agentId as string,
      limit ? parseInt(limit as string) : 50
    );
    res.json(errors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Playground - Testar prompt do agente
router.post("/:agentId/test", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { message, context } = req.body;
    const companyId = (req as any).user?.company_id;
    const userId = (req as any).user?.id;

    if (!companyId) return res.status(401).json({ error: "Unauthorized" });

    // Usar um chatId temporário para o playground
    const playgroundChatId = `playground:${agentId}:${userId}`;

    // Executar a lógica real do agente
    const result = await runAgentReply({
      agentId,
      companyId,
      chatId: playgroundChatId,
      userMessage: message,
      agentOverride: context?.system_prompt ? { system_prompt: context.system_prompt } : undefined,
      isPlayground: true
    });

    // Salvar o teste no banco para histórico (opcional, mas bom para auditoria)
    await db.none(
      `INSERT INTO agent_playground_tests (
        agent_id, company_id, user_id, input_message, output_response, 
        tokens_used, latency_ms, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        agentId, companyId, userId, message, result.reply,
        result.usage?.total_tokens || 0,
        0, // Latência pode ser calculada se necessário
        { model: result.model, steps: result.steps }
      ]
    ).catch(err => console.error("Error saving playground test:", err));

    res.json({ 
      message: result.reply,
      usage: result.usage,
      model: result.model,
      steps: result.steps
    });
  } catch (error: any) {
    console.error("Playground error:", error);
    res.status(500).json({ error: error.message });
  }
});

export function registerAgentsMonitoringRoutes(app: Express) {
  app.use("/api/agents-monitoring", router);
}

export default router;
