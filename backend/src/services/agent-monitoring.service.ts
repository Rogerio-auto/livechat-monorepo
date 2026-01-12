import { AgentMetricsRepository } from "../repos/agent-metrics.repo.js";
import { db } from "../pg.js";

export class AgentMonitoringService {
  static async getDashboardStats(companyId: string) {
    const [metrics, recentErrors, agents] = await Promise.all([
      AgentMetricsRepository.getGlobalMetrics(companyId, 'day', 7),
      AgentMetricsRepository.getErrors(companyId, undefined, 10),
      db.any('SELECT id, name, status FROM agents WHERE company_id = $1', [companyId])
    ]);

    // Calcular totais rápidos
    const totalConversations = metrics.reduce((acc: number, m: any) => acc + Number(m.total_conversations), 0);
    const totalErrors = metrics.reduce((acc: number, m: any) => acc + Number(m.error_count), 0);
    
    return {
      summary: {
        totalConversations,
        totalErrors,
        activeAgents: agents.filter((a: any) => a.status === 'ACTIVE').length,
        totalAgents: agents.length
      },
      charts: {
        conversationsOverTime: metrics.map((m: any) => ({
          date: m.period_start,
          total: Number(m.total_conversations),
          errors: Number(m.error_count)
        })).reverse()
      },
      recentErrors,
      agents: agents.map((a: any) => ({
        ...a,
        metrics: metrics.find((m: any) => m.agent_id === a.id) || null
      }))
    };
  }

  static async getAgentDetails(agentId: string, companyId: string) {
    const [agent, metrics, errors] = await Promise.all([
      db.oneOrNone('SELECT * FROM agents WHERE id = $1 AND company_id = $2', [agentId, companyId]),
      AgentMetricsRepository.getMetricsByAgent(agentId, companyId, 'day', 30),
      AgentMetricsRepository.getErrors(companyId, agentId, 20)
    ]);

    if (!agent) throw new Error('Agent not found');

    return {
      agent,
      metrics,
      errors
    };
  }

  static async logAgentError(data: {
    agentId: string;
    companyId: string;
    chatId?: string;
    errorType: string;
    errorMessage: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    metadata?: any;
  }) {
    return AgentMetricsRepository.logError({
      agent_id: data.agentId,
      company_id: data.companyId,
      chat_id: data.chatId,
      error_type: data.errorType,
      error_message: data.errorMessage,
      severity: data.severity || 'MEDIUM',
      agent_context: data.metadata
    });
  }
}
