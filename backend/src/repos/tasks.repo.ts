import { supabaseAdmin } from "../lib/supabase.js";
import type { Task, CreateTaskDTO, UpdateTaskDTO, TaskStatus, TaskPriority, TaskType } from "../types/index.js";

export interface TaskWithContext extends Task {
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  created_by_name?: string | null;
  lead_name?: string | null;
  lead_phone?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  kanban_stage_name?: string | null;
  kanban_stage_color?: string | null;
  event_title?: string | null;
  event_start_time?: string | null;
  due_status?: "completed" | "overdue" | "due_today" | "due_this_week" | "upcoming";
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  type?: TaskType[];
  assigned_to?: string[];
  created_by?: string;
  date_from?: string;
  date_to?: string;
  overdue?: boolean;
  due_today?: boolean;
  due_this_week?: boolean;
  search?: string;
  related_lead_id?: string;
  related_customer_id?: string;
  related_chat_id?: string;
  kanban_column_id?: string;
  limit?: number;
  offset?: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  due_today: number;
  due_this_week: number;
  by_priority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    URGENT: number;
  };
  by_type: {
    FOLLOW_UP: number;
    CALL: number;
    EMAIL: number;
    MEETING: number;
    WHATSAPP: number;
    PROPOSAL: number;
    GENERAL: number;
    VISIT: number;
  };
}

/**
 * Cria uma nova tarefa
 */
export async function createTask(input: CreateTaskDTO): Promise<Task> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert([
      {
        company_id: input.company_id,
        title: input.title,
        description: input.description ?? null,
        assigned_to: input.assigned_to ?? null,
        created_by: input.created_by,
        related_lead_id: input.related_lead_id ?? null,
        related_customer_id: input.related_customer_id ?? null,
        related_chat_id: input.related_chat_id ?? null,
        related_event_id: input.related_event_id ?? null,
        related_campaign_id: input.related_campaign_id ?? null,
        kanban_column_id: input.kanban_column_id ?? null,
        status: input.status ?? "PENDING",
        priority: input.priority ?? "MEDIUM",
        type: input.type ?? "GENERAL",
        due_date: input.due_date ?? null,
        reminder_enabled: input.reminder_enabled ?? false,
        reminder_time: input.reminder_time ?? null,
        reminder_channels: input.reminder_channels ? JSON.stringify(input.reminder_channels) : '["IN_APP"]',
        recurrence_type: input.recurrence_type ?? "NONE",
        recurrence_interval: input.recurrence_interval ?? null,
        recurrence_end_date: input.recurrence_end_date ?? null,
        parent_task_id: input.parent_task_id ?? null,
        metadata: input.metadata ?? {},
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return data as Task;
}

/**
 * Atualiza uma tarefa existente
 */
export async function updateTask(id: string, companyId: string, input: UpdateTaskDTO): Promise<Task> {
  const updates: Partial<Task> = {};

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to;
  if (input.related_lead_id !== undefined) updates.related_lead_id = input.related_lead_id;
  if (input.related_customer_id !== undefined) updates.related_customer_id = input.related_customer_id;
  if (input.related_chat_id !== undefined) updates.related_chat_id = input.related_chat_id;
  if (input.related_event_id !== undefined) updates.related_event_id = input.related_event_id;
  if (input.related_campaign_id !== undefined) updates.related_campaign_id = input.related_campaign_id;
  if (input.kanban_column_id !== undefined) updates.kanban_column_id = input.kanban_column_id;
  if (input.status !== undefined) updates.status = input.status;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.type !== undefined) updates.type = input.type;
  if (input.due_date !== undefined) updates.due_date = input.due_date;
  if (input.reminder_enabled !== undefined) updates.reminder_enabled = input.reminder_enabled;
  if (input.reminder_time !== undefined) updates.reminder_time = input.reminder_time;
  if (input.reminder_channels !== undefined) {
    updates.reminder_channels = JSON.stringify(input.reminder_channels);
  }
  if (input.metadata !== undefined) updates.metadata = input.metadata;

  // Se está marcando como completa, adiciona timestamp
  if (input.status === "COMPLETED" && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return data as Task;
}

/**
 * Deleta uma tarefa
 */
export async function deleteTask(id: string, companyId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id).eq("company_id", companyId);

  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}

/**
 * Busca uma tarefa por ID (com contexto)
 */
export async function getTaskById(id: string, companyId: string): Promise<TaskWithContext | null> {
  const { data, error } = await supabaseAdmin
    .from("tasks_with_context")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get task: ${error.message}`);
  return data as TaskWithContext | null;
}

/**
 * Lista tarefas da empresa com filtros
 */
export async function listTasksByCompany(
  companyId: string,
  filters?: TaskFilters
): Promise<{ tasks: TaskWithContext[]; total: number }> {
  let query = supabaseAdmin.from("tasks_with_context").select("*", { count: "exact" }).eq("company_id", companyId);

  // Filtros
  if (filters?.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }

  if (filters?.priority && filters.priority.length > 0) {
    query = query.in("priority", filters.priority);
  }

  if (filters?.type && filters.type.length > 0) {
    query = query.in("type", filters.type);
  }

  if (filters?.assigned_to && filters.assigned_to.length > 0) {
    query = query.in("assigned_to", filters.assigned_to);
  }

  if (filters?.created_by) {
    query = query.eq("created_by", filters.created_by);
  }

  if (filters?.related_lead_id) {
    query = query.eq("related_lead_id", filters.related_lead_id);
  }

  if (filters?.related_customer_id) {
    query = query.eq("related_customer_id", filters.related_customer_id);
  }

  if (filters?.related_chat_id) {
    query = query.eq("related_chat_id", filters.related_chat_id);
  }

  if (filters?.kanban_column_id) {
    query = query.eq("kanban_column_id", filters.kanban_column_id);
  }

  if (filters?.date_from) {
    query = query.gte("due_date", filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte("due_date", filters.date_to);
  }

  if (filters?.overdue) {
    query = query.eq("due_status", "overdue");
  }

  if (filters?.due_today) {
    query = query.eq("due_status", "due_today");
  }

  if (filters?.due_this_week) {
    query = query.eq("due_status", "due_this_week");
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  // Ordenação
  query = query.order("due_date", { ascending: true, nullsFirst: false });
  query = query.order("priority", { ascending: false });

  // Paginação
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to list tasks: ${error.message}`);

  return {
    tasks: (data as TaskWithContext[]) || [],
    total: count || 0,
  };
}

/**
 * Busca tarefas por entidade relacionada (lead, customer ou chat)
 */
export async function getTasksByEntity(
  companyId: string,
  entityType: "lead" | "customer" | "chat",
  entityId: string
): Promise<TaskWithContext[]> {
  let query = supabaseAdmin.from("tasks_with_context").select("*").eq("company_id", companyId);

  if (entityType === "lead") {
    query = query.eq("related_lead_id", entityId);
  } else if (entityType === "customer") {
    query = query.eq("related_customer_id", entityId);
  } else if (entityType === "chat") {
    query = query.eq("related_chat_id", entityId);
  }

  query = query.order("due_date", { ascending: true, nullsFirst: false });

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get tasks by entity: ${error.message}`);
  return (data as TaskWithContext[]) || [];
}

/**
 * Busca estatísticas de tarefas da empresa
 */
export async function getTaskStats(companyId: string): Promise<TaskStats> {
  const { data, error } = await supabaseAdmin.from("tasks_with_context").select("*").eq("company_id", companyId);

  if (error) throw new Error(`Failed to get task stats: ${error.message}`);

  const tasks = (data as TaskWithContext[]) || [];

  const stats: TaskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "PENDING").length,
    in_progress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    cancelled: tasks.filter((t) => t.status === "CANCELLED").length,
    overdue: tasks.filter((t) => t.due_status === "overdue").length,
    due_today: tasks.filter((t) => t.due_status === "due_today").length,
    due_this_week: tasks.filter((t) => t.due_status === "due_this_week").length,
    by_priority: {
      LOW: tasks.filter((t) => t.priority === "LOW").length,
      MEDIUM: tasks.filter((t) => t.priority === "MEDIUM").length,
      HIGH: tasks.filter((t) => t.priority === "HIGH").length,
      URGENT: tasks.filter((t) => t.priority === "URGENT").length,
    },
    by_type: {
      FOLLOW_UP: tasks.filter((t) => t.type === "FOLLOW_UP").length,
      CALL: tasks.filter((t) => t.type === "CALL").length,
      EMAIL: tasks.filter((t) => t.type === "EMAIL").length,
      MEETING: tasks.filter((t) => t.type === "MEETING").length,
      WHATSAPP: tasks.filter((t) => t.type === "WHATSAPP").length,
      PROPOSAL: tasks.filter((t) => t.type === "PROPOSAL").length,
      GENERAL: tasks.filter((t) => t.type === "GENERAL").length,
      VISIT: tasks.filter((t) => t.type === "VISIT").length,
    },
  };

  return stats;
}

/**
 * Busca tarefas com lembretes pendentes
 */
export async function getTasksWithPendingReminders(): Promise<TaskWithContext[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("tasks_with_context")
    .select("*")
    .eq("reminder_enabled", true)
    .eq("reminder_sent", false)
    .lte("reminder_time", now)
    .neq("status", "COMPLETED")
    .neq("status", "CANCELLED");

  if (error) throw new Error(`Failed to get tasks with pending reminders: ${error.message}`);
  return (data as TaskWithContext[]) || [];
}

/**
 * Marca lembrete como enviado
 */
export async function markReminderAsSent(taskId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("tasks").update({ reminder_sent: true }).eq("id", taskId);

  if (error) throw new Error(`Failed to mark reminder as sent: ${error.message}`);
}

/**
 * Marca tarefa como completa
 */
export async function completeTask(id: string, companyId: string): Promise<Task> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update({
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete task: ${error.message}`);
  return data as Task;
}

/**
 * Busca tarefas atrasadas (overdue)
 */
export async function getOverdueTasks(companyId: string): Promise<TaskWithContext[]> {
  const { data, error } = await supabaseAdmin
    .from("tasks_with_context")
    .select("*")
    .eq("company_id", companyId)
    .eq("due_status", "overdue");

  if (error) throw new Error(`Failed to get overdue tasks: ${error.message}`);
  return (data as TaskWithContext[]) || [];
}
