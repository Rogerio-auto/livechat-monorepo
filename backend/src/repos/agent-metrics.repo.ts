import { db } from "../pg.js";

export interface AgentMetric {
  id: string;
  agent_id: string;
  company_id: string;
  period_start: Date;
  period_end: Date;
  period_type: 'hour' | 'day' | 'week' | 'month';
  total_conversations: number;
  active_conversations: number;
  completed_conversations: number;
  abandoned_conversations: number;
  escalated_conversations: number;
  avg_response_time_ms: number;
  min_response_time_ms?: number;
  max_response_time_ms?: number;
  avg_conversation_length: number;
  success_rate: number;
  escalation_rate: number;
  avg_satisfaction?: number;
  positive_feedback_count: number;
  negative_feedback_count: number;
  error_count: number;
  error_rate: number;
  timeout_count: number;
  api_error_count: number;
  validation_error_count: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost: number;
  avg_cost_per_conversation: number;
  created_at: Date;
  updated_at: Date;
}

export interface AgentError {
  id: string;
  agent_id: string;
  company_id: string;
  chat_id?: string;
  message_id?: string;
  error_type: string;
  error_code?: string;
  error_message: string;
  stack_trace?: string;
  user_message?: string;
  agent_context?: any;
  request_payload?: any;
  resolved: boolean;
  resolved_at?: Date;
  resolved_by?: string;
  resolution_notes?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_recurring: boolean;
  occurrence_count: number;
  created_at: Date;
  updated_at: Date;
}

export class AgentMetricsRepository {
  static async getMetricsByAgent(agentId: string, companyId: string, periodType: string = 'day', limit: number = 30) {
    return db.any<AgentMetric>(
      `SELECT * FROM agent_metrics 
       WHERE agent_id = $1 AND company_id = $2 AND period_type = $3 
       ORDER BY period_start DESC LIMIT $4`,
      [agentId, companyId, periodType, limit]
    );
  }

  static async getGlobalMetrics(companyId: string, periodType: string = 'day', limit: number = 30) {
    return db.any(
      `SELECT 
        period_start,
        SUM(total_conversations) as total_conversations,
        SUM(active_conversations) as active_conversations,
        SUM(error_count) as error_count,
        AVG(success_rate) as avg_success_rate,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost
       FROM agent_metrics 
       WHERE company_id = $1 AND period_type = $2 
       GROUP BY period_start 
       ORDER BY period_start DESC LIMIT $3`,
      [companyId, periodType, limit]
    );
  }

  static async getErrors(companyId: string, agentId?: string, limit: number = 50) {
    let query = `SELECT * FROM agent_errors WHERE company_id = $1`;
    const params: any[] = [companyId];

    if (agentId) {
      query += ` AND agent_id = $2`;
      params.push(agentId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    return db.any<AgentError>(query, params);
  }

  static async logError(error: Partial<AgentError>) {
    return db.one(
      `INSERT INTO agent_errors (
        agent_id, company_id, chat_id, message_id, error_type, 
        error_code, error_message, stack_trace, user_message, 
        agent_context, request_payload, severity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        error.agent_id, error.company_id, error.chat_id, error.message_id,
        error.error_type, error.error_code, error.error_message,
        error.stack_trace, error.user_message, error.agent_context,
        error.request_payload, error.severity || 'MEDIUM'
      ]
    );
  }

  static async updateMetrics(agentId: string, companyId: string, periodType: string, data: Partial<AgentMetric>) {
    const now = new Date();
    let periodStart: Date;

    if (periodType === 'hour') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
    } else if (periodType === 'day') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else {
      // Default to day for simplicity in this example
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    }

    const periodEnd = new Date(periodStart);
    if (periodType === 'hour') periodEnd.setHours(periodEnd.getHours() + 1);
    else periodEnd.setDate(periodEnd.getDate() + 1);

    return db.one(
      `INSERT INTO agent_metrics (
        agent_id, company_id, period_start, period_end, period_type,
        total_conversations, active_conversations, total_tokens, total_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (agent_id, period_start, period_type)
      DO UPDATE SET
        total_conversations = agent_metrics.total_conversations + EXCLUDED.total_conversations,
        active_conversations = EXCLUDED.active_conversations,
        total_tokens = agent_metrics.total_tokens + EXCLUDED.total_tokens,
        total_cost = agent_metrics.total_cost + EXCLUDED.total_cost,
        updated_at = NOW()
      RETURNING *`,
      [
        agentId, companyId, periodStart, periodEnd, periodType,
        data.total_conversations || 0, data.active_conversations || 0,
        data.total_tokens || 0, data.total_cost || 0
      ]
    );
  }
}
