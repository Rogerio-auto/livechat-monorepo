import {
  getRulesByTriggerType,
  logExecution,
  updateExecutionStats,
  type TaskAutomationRule,
  type TriggerType,
  type Condition,
  type TaskTemplate,
} from "../repos/automationRules.repo.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { getIO } from "../lib/io.js";

/**
 * Interface para o contexto de execução da regra
 */
export interface RuleContext {
  lead?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    stage?: string;
    status_client?: string;
    company_id: string;
    customer_id?: string;
  };
  chat?: {
    id: string;
    last_message_at?: Date;
    last_message_from?: string;
  };
  event?: {
    id: string;
    title: string;
    start_date: string;
    end_date?: string;
  };
  task?: {
    id: string;
    title: string;
    completed_at?: Date;
  };
  campaign?: {
    id: string;
    name: string;
  };
  config?: Record<string, any>;
  [key: string]: any;
}

/**
 * Avalia se todas as condições são satisfeitas
 */
export function evaluateConditions(
  conditions: Condition[],
  context: RuleContext
): boolean {
  if (!conditions || conditions.length === 0) return true;

  for (const cond of conditions) {
    const value = getNestedValue(context, cond.field);
    const compareValue = cond.value;

    let matches = false;
    switch (cond.operator) {
      case "equals":
        matches = value == compareValue; // Comparação flexível
        break;
      case "not_equals":
        matches = value != compareValue;
        break;
      case "contains":
        matches = String(value || "").includes(String(compareValue));
        break;
      case "greater_than":
        matches = Number(value) > Number(compareValue);
        break;
      case "less_than":
        matches = Number(value) < Number(compareValue);
        break;
      case "is_null":
        matches = value === null || value === undefined;
        break;
      case "not_null":
        matches = value !== null && value !== undefined;
        break;
      default:
        console.warn(`[RuleEngine] Unknown operator: ${cond.operator}`);
        matches = false;
    }

    if (!matches) {
      console.log(
        `[RuleEngine] Condition failed: ${cond.field} ${cond.operator} ${compareValue} (actual: ${value})`
      );
      return false;
    }
  }

  return true;
}

/**
 * Pega valor aninhado de um objeto usando notação de ponto (ex: "lead.name")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Interpola variáveis no template
 * Suporta: {{lead.name}}, {{config.days}}, {{rule.created_by}}, etc.
 */
export function interpolateTemplate(
  template: string,
  context: RuleContext,
  rule: TaskAutomationRule
): string {
  let result = template;

  // Substituir variáveis do contexto (lead, chat, event, config, etc.)
  const allVars = {
    ...context,
    rule: {
      id: rule.id,
      name: rule.name,
      created_by: rule.created_by,
    },
  };

  result = result.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(allVars, path.trim());
    return value !== undefined && value !== null ? String(value) : match;
  });

  return result;
}

/**
 * Calcula a data de vencimento baseado em offset
 * Suporta: "+1d", "+2h", "-30m", "+1w"
 */
export function calculateDueDate(offset?: string): Date | null {
  if (!offset) return null;

  const now = new Date();
  const match = offset.match(/^([+-])(\d+)([mhdw])$/);
  if (!match) {
    console.warn(`[RuleEngine] Invalid due_date_offset format: ${offset}`);
    return null;
  }

  const [, sign, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10) * (sign === "+" ? 1 : -1);

  switch (unit) {
    case "m": // minutos
      now.setMinutes(now.getMinutes() + amount);
      break;
    case "h": // horas
      now.setHours(now.getHours() + amount);
      break;
    case "d": // dias
      now.setDate(now.getDate() + amount);
      break;
    case "w": // semanas
      now.setDate(now.getDate() + amount * 7);
      break;
  }

  return now;
}

/**
 * Verifica se já existe uma task similar (prevenção de duplicatas)
 */
async function checkExistingTask(
  companyId: string,
  leadId: string,
  ruleId: string,
  windowHours: number
): Promise<boolean> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - windowHours);

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id")
    .eq("company_id", companyId)
    .eq("related_lead_id", leadId)
    .eq("automation_rule_id", ruleId)
    .gte("created_at", cutoffDate.toISOString())
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[RuleEngine] Error checking existing task:", error);
    return false;
  }

  return !!data;
}

/**
 * Executa uma regra específica para um contexto
 */
export async function executeRule(
  rule: TaskAutomationRule,
  context: RuleContext
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  const startTime = Date.now();

  try {
    console.log(`[RuleEngine] Executing rule: ${rule.name} (${rule.id})`);

    // 1. Avaliar condições
    if (!evaluateConditions(rule.conditions, context)) {
      console.log(`[RuleEngine] Conditions not met, skipping rule ${rule.id}`);
      await logExecution({
        rule_id: rule.id,
        company_id: rule.company_id,
        status: "SKIPPED",
        tasks_created: 0,
        trigger_context: context,
        execution_time_ms: Date.now() - startTime,
      });
      return { success: false, error: "Conditions not met" };
    }

    // 2. Verificar duplicatas (se habilitado)
    if (rule.check_existing_tasks && context.lead?.id) {
      const exists = await checkExistingTask(
        rule.company_id,
        context.lead.id,
        rule.id,
        rule.duplicate_prevention_window_hours
      );

      if (exists) {
        console.log(`[RuleEngine] Duplicate task found, skipping rule ${rule.id}`);
        await logExecution({
          rule_id: rule.id,
          company_id: rule.company_id,
          status: "SKIPPED",
          tasks_created: 0,
          trigger_context: context,
          execution_time_ms: Date.now() - startTime,
          error_message: "Duplicate prevention",
        });
        return { success: false, error: "Duplicate task" };
      }
    }

    // 3. Interpolar template
    const taskTemplate = rule.task_template;
    const title = interpolateTemplate(taskTemplate.title, context, rule);
    const description = taskTemplate.description
      ? interpolateTemplate(taskTemplate.description, context, rule)
      : undefined;

    // 4. Calcular due_date
    const dueDate = calculateDueDate(taskTemplate.due_date_offset);

    // 5. Criar task no Supabase
    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        company_id: rule.company_id,
        related_lead_id: context.lead?.id || null,
        title,
        description,
        due_date: dueDate?.toISOString() || null,
        priority: taskTemplate.priority || "MEDIUM",
        status: "PENDING",
        assigned_to_id: taskTemplate.assigned_to_id || null,
        kanban_column_id: taskTemplate.kanban_column_id || null,
        is_auto_generated: true,
        automation_rule_id: rule.id,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`[RuleEngine] Error creating task:`, error);
      await logExecution({
        rule_id: rule.id,
        company_id: rule.company_id,
        status: "FAILED",
        tasks_created: 0,
        error_message: error.message,
        trigger_context: context,
        execution_time_ms: Date.now() - startTime,
      });
      return { success: false, error: error.message };
    }

    console.log(`[RuleEngine] ✅ Task created: ${task.id} from rule ${rule.name}`);

    // 6. Log de sucesso
    await logExecution({
      rule_id: rule.id,
      company_id: rule.company_id,
      status: "SUCCESS",
      tasks_created: 1,
      trigger_context: context,
      execution_time_ms: Date.now() - startTime,
    });

    // 7. Atualizar estatísticas da regra
    await updateExecutionStats(rule.id);

    // 8. Emitir Socket.io para notificar frontend
    const io = getIO();
    if (io) {
      io.to(`company:${rule.company_id}`).emit("task:created", {
        task_id: task.id,
        is_auto_generated: true,
        rule_id: rule.id,
        rule_name: rule.name,
      });
    }

    return { success: true, taskId: task.id };
  } catch (error: any) {
    console.error(`[RuleEngine] Unexpected error executing rule ${rule.id}:`, error);
    await logExecution({
      rule_id: rule.id,
      company_id: rule.company_id,
      status: "FAILED",
      tasks_created: 0,
      error_message: error.message || String(error),
      trigger_context: context,
      execution_time_ms: Date.now() - startTime,
    });
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Processa todas as regras ativas de um trigger específico
 */
export async function processRulesByTrigger(
  companyId: string,
  triggerType: TriggerType,
  context: RuleContext
): Promise<{ processed: number; created: number; errors: number }> {
  try {
    console.log(`[RuleEngine] Processing ${triggerType} trigger for company ${companyId}`);

    const rules = await getRulesByTriggerType(companyId, triggerType);
    console.log(`[RuleEngine] Found ${rules.length} active rules for ${triggerType}`);

    let created = 0;
    let errors = 0;

    for (const rule of rules) {
      const result = await executeRule(rule, context);
      if (result.success) {
        created++;
      } else {
        errors++;
      }
    }

    console.log(
      `[RuleEngine] ${triggerType} processed: ${rules.length} rules, ${created} tasks created, ${errors} errors`
    );

    return { processed: rules.length, created, errors };
  } catch (error: any) {
    console.error(`[RuleEngine] Error processing trigger ${triggerType}:`, error);
    return { processed: 0, created: 0, errors: 1 };
  }
}
