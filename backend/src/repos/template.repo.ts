// backend/src/repos/template.repo.ts

import { db } from '../pg.js';
import { AgentTemplate, TemplateTool, TemplateTest, TemplateValidation, TemplateVersion, AgentTemplateQuestion } from '../types/agent-template.types.js';

export class TemplateRepository {
  
  /**
   * Listar templates com filtros
   */
  static async listTemplates(options: {
    category?: string;
    isPublic?: boolean;
    companyId?: string;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ templates: AgentTemplate[]; total: number }> {
    const {
      category,
      isPublic,
      companyId,
      isActive = true,
      search,
      limit = 50,
      offset = 0,
    } = options;

    const whereConditions = ['is_active = $1'];
    const params: any[] = [isActive];
    let paramIndex = 2;

    if (category) {
      whereConditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (isPublic !== undefined) {
      whereConditions.push(`is_public = $${paramIndex}`);
      params.push(isPublic);
      paramIndex++;
    }

    if (companyId) {
      whereConditions.push(`(company_id = $${paramIndex} OR is_public = TRUE)`);
      params.push(companyId);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countResult = await db.one(
      `SELECT COUNT(*) as total FROM agent_templates WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.total, 10);

    // Get data
    const dataResult = await db.any<AgentTemplate>(
      `SELECT * FROM agent_templates_with_tools 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      templates: dataResult,
      total,
    };
  }

  /**
   * Buscar template por ID
   */
  static async getTemplateById(id: string): Promise<AgentTemplate | null> {
    return db.oneOrNone<AgentTemplate>(
      `SELECT * FROM agent_templates_with_tools WHERE id = $1`,
      [id]
    );
  }

  /**
   * Criar template
   */
  static async createTemplate(template: Omit<AgentTemplate, 'id' | 'version' | 'usage_count' | 'created_at' | 'updated_at'>): Promise<AgentTemplate> {
    return db.one<AgentTemplate>(
      `INSERT INTO agent_templates (
        name, description, category, system_prompt, model_config,
        behavior_config, knowledge_base_config, is_active, is_public,
        company_id, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        template.name,
        template.description || null,
        template.category,
        template.system_prompt,
        template.model_config,
        template.behavior_config || {},
        template.knowledge_base_config || {},
        template.is_active,
        template.is_public,
        template.company_id || null,
        template.created_by || null,
      ]
    );
  }

  /**
   * Atualizar template
   */
  static async updateTemplate(id: string, updates: Partial<AgentTemplate>): Promise<AgentTemplate> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.system_prompt !== undefined) {
      fields.push(`system_prompt = $${paramIndex++}`);
      values.push(updates.system_prompt);
    }

    if (updates.model_config !== undefined) {
      fields.push(`model_config = $${paramIndex++}`);
      values.push(updates.model_config);
    }

    if (updates.behavior_config !== undefined) {
      fields.push(`behavior_config = $${paramIndex++}`);
      values.push(updates.behavior_config);
    }

    if (updates.knowledge_base_config !== undefined) {
      fields.push(`knowledge_base_config = $${paramIndex++}`);
      values.push(updates.knowledge_base_config);
    }

    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (updates.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    return db.one<AgentTemplate>(
      `UPDATE agent_templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
  }

  /**
   * Deletar template
   */
  static async deleteTemplate(id: string): Promise<void> {
    await db.none(`DELETE FROM agent_templates WHERE id = $1`, [id]);
  }

  /**
   * Buscar ferramentas de um template
   */
  static async getTemplateTools(templateId: string): Promise<TemplateTool[]> {
    return db.any<TemplateTool>(
      `SELECT 
        att.*,
        tc.name as tool_name,
        tc.category as tool_category,
        tc.description as tool_description
      FROM agent_template_tools att
      JOIN tools_catalog tc ON att.tool_id = tc.id
      WHERE att.template_id = $1`,
      [templateId]
    );
  }

  /**
   * Adicionar ferramenta ao template
   */
  static async addToolToTemplate(templateId: string, toolId: string, required: boolean = false, overrides: Record<string, any> = {}): Promise<TemplateTool> {
    return db.one<TemplateTool>(
      `INSERT INTO agent_template_tools (template_id, tool_id, required, overrides)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (template_id, tool_id) DO UPDATE
       SET required = EXCLUDED.required, overrides = EXCLUDED.overrides, updated_at = NOW()
       RETURNING *`,
      [templateId, toolId, required, overrides]
    );
  }

  /**
   * Remover ferramenta do template
   */
  static async removeToolFromTemplate(templateId: string, toolId: string): Promise<void> {
    await db.none(
      `DELETE FROM agent_template_tools WHERE template_id = $1 AND tool_id = $2`,
      [templateId, toolId]
    );
  }

  /**
   * Buscar versões de um template
   */
  static async getTemplateVersions(templateId: string, limit: number = 10): Promise<TemplateVersion[]> {
    return db.any<TemplateVersion>(
      `SELECT * FROM agent_template_versions 
       WHERE template_id = $1 
       ORDER BY version DESC 
       LIMIT $2`,
      [templateId, limit]
    );
  }

  /**
   * Incrementar contador de uso
   */
  static async incrementUsageCount(templateId: string): Promise<void> {
    await db.none(
      `UPDATE agent_templates SET usage_count = usage_count + 1 WHERE id = $1`,
      [templateId]
    );
  }

  /**
   * Atualizar rating
   */
  static async updateRating(templateId: string, rating: number): Promise<void> {
    await db.none(
      `UPDATE agent_templates 
       SET rating = (COALESCE(rating, 0) * usage_count + $2) / (usage_count + 1)
       WHERE id = $1`,
      [templateId, rating]
    );
  }

  /**
   * Buscar perguntas de um template
   */
  static async getTemplateQuestions(templateId: string): Promise<AgentTemplateQuestion[]> {
    return db.any<AgentTemplateQuestion>(
      `SELECT * FROM agent_template_questions 
       WHERE template_id = $1 
       ORDER BY order_index ASC`,
      [templateId]
    );
  }

  /**
   * Adicionar/Atualizar pergunta no template
   */
  static async upsertQuestion(question: Omit<AgentTemplateQuestion, 'id'>): Promise<AgentTemplateQuestion> {
    return db.one<AgentTemplateQuestion>(
      `INSERT INTO agent_template_questions (
        template_id, key, label, type, required, help, options, order_index
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (template_id, key) DO UPDATE
      SET label = EXCLUDED.label, 
          type = EXCLUDED.type, 
          required = EXCLUDED.required, 
          help = EXCLUDED.help, 
          options = EXCLUDED.options, 
          order_index = EXCLUDED.order_index
      RETURNING *`,
      [
        question.template_id,
        question.key,
        question.label,
        question.type,
        question.required,
        question.help || null,
        question.options || [],
        question.order_index || 0
      ]
    );
  }

  /**
   * Remover pergunta do template
   */
  static async removeQuestion(templateId: string, questionId: string): Promise<void> {
    await db.none(
      `DELETE FROM agent_template_questions WHERE template_id = $1 AND id = $2`,
      [templateId, questionId]
    );
  }

  /**
   * Limpar todas as perguntas de um template (útil para re-sincronização)
   */
  static async clearQuestions(templateId: string): Promise<void> {
    await db.none(`DELETE FROM agent_template_questions WHERE template_id = $1`, [templateId]);
  }
}
