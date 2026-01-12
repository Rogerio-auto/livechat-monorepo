// backend/src/services/admin/toolManagement.service.ts

import { ToolManagementRepository } from '../../repos/tool-management.repo.js';
import { ToolStats, ToolLog, ToolTest } from '../../types/tool-management.types.js';

export class ToolManagementService {
  
  /**
   * Obter dashboard de ferramentas
   */
  static async getToolDashboard() {
    const stats = await ToolManagementRepository.getAllToolStats();
    const criticalTools = await ToolManagementRepository.getTopErrorProneTools(5);
    
    // Calcular métricas globais
    const totalCalls = stats.reduce((acc, s) => acc + s.total_calls, 0);
    const totalErrors = stats.reduce((acc, s) => acc + s.error_count, 0);
    const avgLatency = stats.length > 0 
      ? stats.reduce((acc, s) => acc + s.avg_latency_ms, 0) / stats.length 
      : 0;

    return {
      globalMetrics: {
        totalCalls,
        totalErrors,
        errorRate: totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0,
        avgLatency
      },
      toolStats: stats,
      criticalTools
    };
  }

  /**
   * Listar logs com filtros
   */
  static async getLogs(filters: any) {
    return ToolManagementRepository.getToolLogs(filters);
  }

  /**
   * Executar teste de saúde da ferramenta
   */
  static async testToolHealth(toolId: string, userId: string) {
    // Aqui viria a lógica de instanciar a ferramenta e executar um comando de teste
    // Por enquanto, simulamos a execução
    
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let errorMessage = null;
    let responsePayload = { status: 'ok', message: 'Tool is responding correctly' };

    try {
      // Simulação de delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simulação de erro aleatório (5% de chance)
      if (Math.random() < 0.05) {
        throw new Error('Timeout connecting to tool service');
      }

    } catch (error: any) {
      status = 'error';
      errorMessage = error.message;
      responsePayload = { status: 'error', message: error.message };
    }

    const duration = Date.now() - startTime;

    return ToolManagementRepository.createToolTest({
      tool_id: toolId,
      tester_id: userId,
      test_name: 'Health Check',
      test_input: { action: 'health_check' },
      status: status === 'success' ? 'PASSED' : 'ERROR',
      actual_output: responsePayload,
      error_message: errorMessage,
      execution_time_ms: duration,
      validation_passed: status === 'success'
    });
  }

  /**
   * Obter histórico de testes de uma ferramenta
   */
  static async getToolTestHistory(toolId: string) {
    return ToolManagementRepository.getToolTests(toolId);
  }
}
