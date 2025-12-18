// backend/src/repos/test.repo.ts

import { db } from '../pg.ts';
import { TemplateTest, TemplateValidation, TestScenario } from '../types/agentTemplate.ts';

export class TestRepository {
  
  /**
   * Listar testes de um template
   */
  static async getTemplateTests(templateId: string): Promise<TemplateTest[]> {
    return db.any<TemplateTest>(
      `SELECT * FROM agent_template_tests WHERE template_id = $1 ORDER BY created_at DESC`,
      [templateId]
    );
  }

  /**
   * Criar novo teste
   */
  static async createTest(test: Omit<TemplateTest, 'id' | 'created_at'>): Promise<TemplateTest> {
    return db.one<TemplateTest>(
      `INSERT INTO agent_template_tests (
        template_id, version, status, results, metrics, duration_ms, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        test.template_id,
        test.version,
        test.status,
        test.results || {},
        test.metrics || {},
        test.duration_ms || 0,
        test.created_by || null
      ]
    );
  }

  /**
   * Atualizar status do teste
   */
  static async updateTestStatus(testId: string, status: string, results?: any, metrics?: any, duration?: number): Promise<TemplateTest> {
    const fields: string[] = ['status = $2'];
    const values: any[] = [testId, status];
    let paramIndex = 3;

    if (results !== undefined) {
      fields.push(`results = $${paramIndex++}`);
      values.push(results);
    }

    if (metrics !== undefined) {
      fields.push(`metrics = $${paramIndex++}`);
      values.push(metrics);
    }

    if (duration !== undefined) {
      fields.push(`duration_ms = $${paramIndex++}`);
      values.push(duration);
    }

    return db.one<TemplateTest>(
      `UPDATE agent_template_tests SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
  }

  /**
   * Listar cenários de teste
   */
  static async getScenarios(templateId?: string): Promise<TestScenario[]> {
    if (templateId) {
      return db.any<TestScenario>(
        `SELECT * FROM agent_test_scenarios WHERE template_id = $1 OR template_id IS NULL ORDER BY name ASC`,
        [templateId]
      );
    }
    return db.any<TestScenario>(`SELECT * FROM agent_test_scenarios ORDER BY name ASC`);
  }

  /**
   * Criar cenário de teste
   */
  static async createScenario(scenario: Omit<TestScenario, 'id' | 'created_at' | 'updated_at'>): Promise<TestScenario> {
    return db.one<TestScenario>(
      `INSERT INTO agent_test_scenarios (
        name, description, template_id, input_data, expected_output, category, tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        scenario.name,
        scenario.description || null,
        scenario.template_id || null,
        scenario.input_data,
        scenario.expected_output || null,
        scenario.category || 'general',
        scenario.tags || []
      ]
    );
  }

  /**
   * Listar validações de um template
   */
  static async getTemplateValidations(templateId: string): Promise<TemplateValidation[]> {
    return db.any<TemplateValidation>(
      `SELECT * FROM agent_template_validations WHERE template_id = $1 ORDER BY created_at DESC`,
      [templateId]
    );
  }

  /**
   * Criar validação
   */
  static async createValidation(validation: Omit<TemplateValidation, 'id' | 'created_at'>): Promise<TemplateValidation> {
    return db.one<TemplateValidation>(
      `INSERT INTO agent_template_validations (
        template_id, version, validator_id, status, feedback, score, validated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        validation.template_id,
        validation.version,
        validation.validator_id,
        validation.status,
        validation.feedback || null,
        validation.score || 0,
        validation.validated_by || null
      ]
    );
  }
}
