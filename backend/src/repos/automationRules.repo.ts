import { supabaseAdmin } from "../lib/supabase.js";

export interface TaskAutomationRule {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  conditions: Condition[];
  task_template: TaskTemplate;
  check_existing_tasks: boolean;
  duplicate_prevention_window_hours: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_executed_at?: string;
  execution_count: number;
  metadata?: Record<string, any>;
}

export type TriggerType =
  | "LEAD_INACTIVE"
  | "STAGE_CHANGE"
  | "CAMPAIGN_RESPONSE"
  | "EVENT_UPCOMING"
  | "TASK_COMPLETED"
  | "CUSTOM_DATE"
  | "LEAD_CREATED";

export interface Condition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_null" | "is_null" | "greater_than" | "less_than";
  value?: any;
}

export interface TaskTemplate {
  title: string;
  description?: string;
  type: string;
  priority: string;
  due_date_offset?: string; // "+1d", "+2h", etc
  assigned_to?: string; // "{{lead.assigned_to_id}}", "{{rule.created_by}}", or UUID
  metadata?: Record<string, any>;
}

export interface CreateRuleInput {
  company_id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  conditions?: Condition[];
  task_template: TaskTemplate;
  check_existing_tasks?: boolean;
  duplicate_prevention_window_hours?: number;
  created_by?: string;
  metadata?: Record<string, any>;
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  is_active?: boolean;
  trigger_config?: Record<string, any>;
  conditions?: Condition[];
  task_template?: TaskTemplate;
  check_existing_tasks?: boolean;
  duplicate_prevention_window_hours?: number;
  metadata?: Record<string, any>;
}

export interface AutomationLog {
  id: string;
  rule_id: string;
  company_id: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  tasks_created: number;
  error_message?: string;
  trigger_context?: Record<string, any>;
  execution_time_ms?: number;
  created_at: string;
}

/**
 * Listar regras de automação de uma empresa
 */
export async function listRulesByCompany(
  companyId: string,
  activeOnly: boolean = false
): Promise<TaskAutomationRule[]> {
  let query = supabaseAdmin
    .from("task_automation_rules")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[AutomationRules] Error listing rules:", error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Buscar regra por ID
 */
export async function getRuleById(ruleId: string): Promise<TaskAutomationRule | null> {
  const { data, error } = await supabaseAdmin
    .from("task_automation_rules")
    .select("*")
    .eq("id", ruleId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return data;
}

/**
 * Criar nova regra
 */
export async function createRule(input: CreateRuleInput): Promise<TaskAutomationRule> {
  const { data, error } = await supabaseAdmin
    .from("task_automation_rules")
    .insert({
      company_id: input.company_id,
      name: input.name,
      description: input.description,
      is_active: input.is_active ?? true,
      trigger_type: input.trigger_type,
      trigger_config: input.trigger_config,
      conditions: input.conditions || [],
      task_template: input.task_template,
      check_existing_tasks: input.check_existing_tasks ?? true,
      duplicate_prevention_window_hours: input.duplicate_prevention_window_hours ?? 24,
      created_by: input.created_by,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("[AutomationRules] Error creating rule:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Atualizar regra
 */
export async function updateRule(
  ruleId: string,
  input: UpdateRuleInput
): Promise<TaskAutomationRule> {
  const { data, error } = await supabaseAdmin
    .from("task_automation_rules")
    .update(input)
    .eq("id", ruleId)
    .select()
    .single();

  if (error) {
    console.error("[AutomationRules] Error updating rule:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Deletar regra
 */
export async function deleteRule(ruleId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("task_automation_rules")
    .delete()
    .eq("id", ruleId);

  if (error) {
    console.error("[AutomationRules] Error deleting rule:", error);
    throw new Error(error.message);
  }
}

/**
 * Buscar regras ativas por tipo de trigger
 */
export async function getRulesByTriggerType(
  companyId: string,
  triggerType: TriggerType
): Promise<TaskAutomationRule[]> {
  const { data, error } = await supabaseAdmin
    .from("task_automation_rules")
    .select("*")
    .eq("company_id", companyId)
    .eq("trigger_type", triggerType)
    .eq("is_active", true);

  if (error) {
    console.error("[AutomationRules] Error fetching rules by trigger:", error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Atualizar contadores de execução
 */
export async function updateExecutionStats(ruleId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("task_automation_rules")
    .update({
      last_executed_at: new Date().toISOString(),
      execution_count: supabaseAdmin.rpc("increment", { x: 1 }) as any,
    })
    .eq("id", ruleId);

  if (error) {
    console.error("[AutomationRules] Error updating execution stats:", error);
  }
}

/**
 * Registrar log de execução
 */
export async function logExecution(log: Omit<AutomationLog, "id" | "created_at">): Promise<void> {
  const { error } = await supabaseAdmin.from("task_automation_logs").insert({
    rule_id: log.rule_id,
    company_id: log.company_id,
    status: log.status,
    tasks_created: log.tasks_created,
    error_message: log.error_message,
    trigger_context: log.trigger_context,
    execution_time_ms: log.execution_time_ms,
  });

  if (error) {
    console.error("[AutomationRules] Error logging execution:", error);
  }
}

/**
 * Buscar logs de uma regra
 */
export async function getRuleLogs(
  ruleId: string,
  limit: number = 50
): Promise<AutomationLog[]> {
  const { data, error } = await supabaseAdmin
    .from("task_automation_logs")
    .select("*")
    .eq("rule_id", ruleId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[AutomationRules] Error fetching logs:", error);
    throw new Error(error.message);
  }

  return data || [];
}
