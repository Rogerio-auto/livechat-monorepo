// backend/src/services/admin/templateManagement.service.ts

import { TemplateRepository } from '../../repos/template.repo.js';
import { TestRepository } from '../../repos/test.repo.js';
import { AgentTemplate, TemplateTool, TemplateTest, TemplateValidation } from '../../types/agent-template.types.js';
import OpenAI from 'openai';

export class TemplateManagementService {
  
  /**
   * Listar templates com paginação e filtros
   */
  static async listTemplates(filters: any) {
    return TemplateRepository.listTemplates(filters);
  }

  /**
   * Obter detalhes completos de um template
   */
  static async getTemplateDetails(id: string) {
    const template = await TemplateRepository.getTemplateById(id);
    if (!template) throw new Error('Template não encontrado');

    const tools = await TemplateRepository.getTemplateTools(id);
    const versions = await TemplateRepository.getTemplateVersions(id);
    const tests = await TestRepository.getTemplateTests(id);
    const questions = await TemplateRepository.getTemplateQuestions(id);

    return {
      ...template,
      tools,
      versions,
      questions,
      recentTests: tests.slice(0, 5)
    };
  }

  /**
   * Criar novo template
   */
  static async createTemplate(data: any) {
    // Validações básicas
    if (!data.name || !data.system_prompt) {
      throw new Error('Nome e System Prompt são obrigatórios');
    }

    return TemplateRepository.createTemplate(data);
  }

  /**
   * Atualizar template existente
   */
  static async updateTemplate(id: string, updates: any) {
    const template = await TemplateRepository.getTemplateById(id);
    if (!template) throw new Error('Template não encontrado');

    return TemplateRepository.updateTemplate(id, updates);
  }

  /**
   * Gerenciar ferramentas do template
   */
  static async updateTemplateTools(templateId: string, tools: { tool_id: string, required?: boolean, overrides?: any }[]) {
    // Primeiro remove todas as ferramentas atuais (ou faz um diff)
    // Para simplificar, vamos remover e adicionar as novas
    const currentTools = await TemplateRepository.getTemplateTools(templateId);
    
    for (const tool of currentTools) {
      await TemplateRepository.removeToolFromTemplate(templateId, tool.tool_id);
    }

    const addedTools = [];
    for (const tool of tools) {
      const added = await TemplateRepository.addToolToTemplate(
        templateId, 
        tool.tool_id, 
        tool.required, 
        tool.overrides
      );
      addedTools.push(added);
    }

    return addedTools;
  }

  /**
   * Gerenciar perguntas do template
   */
  static async updateTemplateQuestions(templateId: string, questions: any[]) {
    // Para simplificar, vamos limpar e adicionar as novas
    await TemplateRepository.clearQuestions(templateId);

    const addedQuestions = [];
    for (const q of questions) {
      const added = await TemplateRepository.upsertQuestion({
        template_id: templateId,
        key: q.key,
        label: q.label,
        type: q.type,
        required: q.required,
        help: q.help,
        options: q.options,
        order_index: q.order_index
      });
      addedQuestions.push(added);
    }

    return addedQuestions;
  }

  /**
   * Executar teste de template (Real LLM call)
   */
  static async runTemplateTest(templateId: string, scenarioId: string | undefined, userId: string, customMessage?: string) {
    const template = await TemplateRepository.getTemplateById(templateId);
    if (!template) throw new Error('Template não encontrado');

    let inputMessage = customMessage;
    let scenarioName = 'Custom Test';
    let expectedOutput = '';
    let inputData: any = {};

    if (scenarioId) {
      const scenarios = await TestRepository.getScenarios();
      const scenario = scenarios.find(s => s.id === scenarioId);
      if (!scenario) throw new Error('Cenário não encontrado');
      
      inputData = scenario.input_data || {};
      inputMessage = typeof scenario.input_data === 'string' 
        ? scenario.input_data 
        : (scenario.input_data as any).message || JSON.stringify(scenario.input_data);
      scenarioName = scenario.name;
      expectedOutput = scenario.expected_output || '';
    }

    if (!inputMessage) throw new Error('Mensagem de entrada não fornecida');

    // Renderizar o prompt com as variáveis do cenário
    const questions = await TemplateRepository.getTemplateQuestions(templateId);
    let renderedSystemPrompt = template.system_prompt || '';
    
    if (questions.length > 0) {
      for (const q of questions) {
        const value = String(inputData[q.key] || `[${q.label || q.key}]`);
        // Usar split/join para evitar problemas com caracteres especiais no regex
        renderedSystemPrompt = renderedSystemPrompt.split(`{{${q.key}}}`).join(value);
      }
    }

    // Criar registro de teste como "in_progress"
    const testRecord = await TestRepository.createTest({
      template_id: templateId,
      version: template.version,
      status: 'in_progress',
      results: {},
      metrics: {},
      duration_ms: 0,
      created_by: userId
    });

    try {
      const startTime = Date.now();
      
      // Configuração do OpenAI
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY não configurada no servidor');

      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: template.model_config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: renderedSystemPrompt },
          { role: 'user', content: inputMessage }
        ],
        temperature: template.model_config.temperature || 0.7,
        max_tokens: template.model_config.max_tokens || 1000
      });

      const output = response.choices[0]?.message?.content || '';
      const duration = Date.now() - startTime;
      
      const results = {
        input: inputMessage,
        output: output,
        expected: expectedOutput,
        match: expectedOutput ? output.toLowerCase().includes(expectedOutput.toLowerCase()) : true
      };

      const metrics = {
        tokens_used: response.usage?.total_tokens || 0,
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        latency: duration
      };

      return await TestRepository.updateTestStatus(
        testRecord.id,
        'success',
        results,
        metrics,
        duration
      );

    } catch (error: any) {
      console.error('[runTemplateTest] Error:', error);
      return await TestRepository.updateTestStatus(
        testRecord.id,
        'failed',
        { error: error.message },
        {},
        0
      );
    }
  }

  /**
   * Validar template (Aprovação humana ou por IA superior)
   */
  static async validateTemplate(templateId: string, validationData: any) {
    const template = await TemplateRepository.getTemplateById(templateId);
    if (!template) throw new Error('Template não encontrado');

    return TestRepository.createValidation({
      template_id: templateId,
      version: template.version,
      validator_id: validationData.validator_id,
      status: validationData.status,
      feedback: validationData.feedback,
      score: validationData.score,
      validated_by: validationData.userId
    });
  }

  /**
   * Listar cenários de teste
   */
  static async listScenarios(templateId?: string) {
    return TestRepository.getScenarios(templateId);
  }
}
