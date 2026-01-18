// backend/src/repos/toolManagement.repo.ts

import { db } from '../pg.js';
import type { ToolStats, ToolLog, ToolTest } from '@livechat/shared';

export class ToolManagementRepository {
  
  /**
   * Listar estatísticas de todas as ferramentas baseadas em logs reais
   */
  static async getAllToolStats(): Promise<any[]> {
    return db.any(`
      SELECT 
        atl.tool_id,
        tc.key as tool_key,
        tc.name as tool_name,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN atl.error IS NOT NULL THEN 1 END) as error_count,
        COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(atl.executed_at, NOW()) - atl.executed_at)) * 1000), 0) as avg_latency_ms,
        MAX(atl.executed_at) as last_executed_at
      FROM public.agent_tool_logs atl
      JOIN public.tools_catalog tc ON atl.tool_id = tc.id
      GROUP BY atl.tool_id, tc.key, tc.name
      ORDER BY total_calls DESC
    `);
  }

  /**
   * Buscar estatísticas de uma ferramenta específica
   */
  static async getToolStats(toolId: string): Promise<any | null> {
    return db.oneOrNone(`
      SELECT 
        atl.tool_id,
        tc.key as tool_key,
        tc.name as tool_name,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN atl.error IS NOT NULL THEN 1 END) as error_count,
        0 as avg_latency_ms,
        MAX(atl.executed_at) as last_executed_at
      FROM public.agent_tool_logs atl
      JOIN public.tools_catalog tc ON atl.tool_id = tc.id
      WHERE atl.tool_id = $1
      GROUP BY atl.tool_id, tc.key, tc.name
    `, [toolId]);
  }

  /**
   * Listar logs de execução de ferramentas usando agent_tool_logs
   */
  static async getToolLogs(options: {
    toolId?: string;
    agentId?: string;
    status?: 'success' | 'error';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: any[]; total: number }> {
    const { toolId, agentId, status, limit = 50, offset = 0 } = options;
    
    const whereConditions = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (toolId) {
      whereConditions.push(`atl.tool_id = $${paramIndex++}`);
      params.push(toolId);
    }

    if (agentId) {
      whereConditions.push(`atl.agent_id = $${paramIndex++}`);
      params.push(agentId);
    }

    if (status) {
      if (status === 'success') {
        whereConditions.push(`atl.error IS NULL`);
      } else {
        whereConditions.push(`atl.error IS NOT NULL`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.one(
      `SELECT COUNT(*) as total FROM public.agent_tool_logs atl ${whereClause}`,
      params
    );
    
    const logs = await db.any(
      `SELECT 
          atl.*,
          tc.name as tool_name,
          tc.key as tool_key
       FROM public.agent_tool_logs atl
       JOIN public.tools_catalog tc ON atl.tool_id = tc.id
       ${whereClause} 
       ORDER BY atl.executed_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit || 50, offset || 0]
    );

    return {
      logs: logs.map(l => ({
        ...l,
        status: l.error ? 'error' : 'success',
        latency_ms: 0, // Not tracked in agent_tool_logs yet
        created_at: l.executed_at
      })),
      total: parseInt(countResult.total, 10)
    };
  }

  /**
   * Listar testes de ferramentas
   */
  static async getToolTests(toolId: string): Promise<ToolTest[]> {
    return db.any<ToolTest>(
      `SELECT * FROM tool_tests WHERE tool_id = $1 ORDER BY created_at DESC`,
      [toolId]
    );
  }

  /**
   * Registrar resultado de teste de ferramenta
   */
  static async createToolTest(test: Partial<ToolTest>): Promise<ToolTest> {
    return db.one<ToolTest>(
      `INSERT INTO tool_tests (
        tool_id, tester_id, test_name, test_input, status, 
        actual_output, error_message, execution_time_ms, validation_passed
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        test.tool_id,
        test.tester_id,
        test.test_name || 'Health Check',
        test.test_input || {},
        test.status || 'PENDING',
        test.actual_output || null,
        test.error_message || null,
        test.execution_time_ms || 0,
        test.validation_passed ?? (test.status === 'PASSED')
      ]
    );
  }

  /**
   * Buscar ferramentas mais problemáticas (maior taxa de erro) usando logs reais
   */
  static async getTopErrorProneTools(limit: number = 5): Promise<any[]> {
    return db.any(`
      SELECT 
        atl.tool_id,
        tc.name as tool_name,
        tc.key as tool_key,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN atl.error IS NOT NULL THEN 1 END) as error_count,
        (COUNT(CASE WHEN atl.error IS NOT NULL THEN 1 END)::float / COUNT(*)::float) * 100 as error_rate
      FROM public.agent_tool_logs atl
      JOIN public.tools_catalog tc ON atl.tool_id = tc.id
      GROUP BY atl.tool_id, tc.name, tc.key
      HAVING COUNT(*) > 0
      ORDER BY error_rate DESC 
      LIMIT $1
    `, [limit]);
  }
}
