// backend/src/repos/toolManagement.repo.ts

import { db } from '../pg.js';
import type { ToolStats, ToolLog, ToolTest } from '@livechat/shared';

export class ToolManagementRepository {
  
  /**
   * Listar estatísticas de todas as ferramentas
   */
  static async getAllToolStats(): Promise<ToolStats[]> {
    return db.any<ToolStats>(`SELECT * FROM tool_statistics ORDER BY total_calls DESC`);
  }

  /**
   * Buscar estatísticas de uma ferramenta específica
   */
  static async getToolStats(toolId: string): Promise<ToolStats | null> {
    return db.oneOrNone<ToolStats>(
      `SELECT * FROM tool_statistics WHERE tool_id = $1`,
      [toolId]
    );
  }

  /**
   * Listar logs de execução de ferramentas
   */
  static async getToolLogs(options: {
    toolId?: string;
    agentId?: string;
    status?: 'success' | 'error';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: ToolLog[]; total: number }> {
    const { toolId, agentId, status, limit = 50, offset = 0 } = options;
    
    const whereConditions = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (toolId) {
      whereConditions.push(`tool_id = $${paramIndex++}`);
      params.push(toolId);
    }

    if (agentId) {
      whereConditions.push(`agent_id = $${paramIndex++}`);
      params.push(agentId);
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.one(
      `SELECT COUNT(*) as total FROM tool_execution_logs ${whereClause}`,
      params
    );
    
    const logs = await db.any<ToolLog>(
      `SELECT * FROM tool_execution_logs 
       ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      logs,
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
   * Buscar ferramentas mais problemáticas (maior taxa de erro)
   */
  static async getTopErrorProneTools(limit: number = 5): Promise<ToolStats[]> {
    return db.any<ToolStats>(
      `SELECT * FROM tool_statistics 
       WHERE total_calls > 0 
       ORDER BY (error_count::float / total_calls::float) DESC 
       LIMIT $1`,
      [limit]
    );
  }
}
