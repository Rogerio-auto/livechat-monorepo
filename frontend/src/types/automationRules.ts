export type TriggerType =
  | "LEAD_INACTIVE"
  | "STAGE_CHANGE"
  | "CAMPAIGN_RESPONSE"
  | "EVENT_UPCOMING"
  | "TASK_COMPLETED"
  | "CUSTOM_DATE"
  | "LEAD_CREATED";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "is_null"
  | "not_null";

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface TaskTemplate {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  due_date_offset?: string;
  assigned_to_id?: string;
  kanban_column_id?: string;
}

export interface AutomationRule {
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
  created_by: string;
  created_at: string;
  updated_at: string;
  last_executed_at?: string;
  execution_count: number;
}

export interface CreateAutomationRuleInput {
  name: string;
  description?: string;
  is_active?: boolean;
  trigger_type: TriggerType;
  trigger_config?: Record<string, any>;
  conditions?: Condition[];
  task_template: TaskTemplate;
  check_existing_tasks?: boolean;
  duplicate_prevention_window_hours?: number;
}

export interface UpdateAutomationRuleInput {
  name?: string;
  description?: string;
  is_active?: boolean;
  trigger_type?: TriggerType;
  trigger_config?: Record<string, any>;
  conditions?: Condition[];
  task_template?: TaskTemplate;
  check_existing_tasks?: boolean;
  duplicate_prevention_window_hours?: number;
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

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  LEAD_INACTIVE: "Lead Inativo",
  STAGE_CHANGE: "Mudança de Stage",
  CAMPAIGN_RESPONSE: "Resposta de Campanha",
  EVENT_UPCOMING: "Evento Próximo",
  TASK_COMPLETED: "Task Completada",
  CUSTOM_DATE: "Data Específica",
  LEAD_CREATED: "Novo Lead",
};

export const TRIGGER_DESCRIPTIONS: Record<TriggerType, string> = {
  LEAD_INACTIVE: "Dispara quando um lead fica sem interação por X dias",
  STAGE_CHANGE: "Dispara quando um lead muda de stage no kanban",
  CAMPAIGN_RESPONSE: "Dispara quando um lead responde uma campanha",
  EVENT_UPCOMING: "Dispara X horas antes de um evento agendado",
  TASK_COMPLETED: "Dispara quando uma task específica é completada",
  CUSTOM_DATE: "Dispara em uma data/hora específica",
  LEAD_CREATED: "Dispara quando um novo lead é criado no sistema",
};

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "Igual a",
  not_equals: "Diferente de",
  contains: "Contém",
  greater_than: "Maior que",
  less_than: "Menor que",
  is_null: "É nulo",
  not_null: "Não é nulo",
};
