export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskType = "FOLLOW_UP" | "CALL" | "EMAIL" | "MEETING" | "WHATSAPP" | "PROPOSAL" | "GENERAL" | "VISIT";
export type ReminderChannel = "IN_APP" | "EMAIL" | "WHATSAPP";

export interface Task {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  related_lead_id: string | null;
  related_customer_id: string | null;
  related_chat_id: string | null;
  related_event_id: string | null;
  related_campaign_id: string | null;
  kanban_column_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  reminder_enabled: boolean;
  reminder_time: string | null;
  reminder_sent: boolean;
  reminder_channels: ReminderChannel[] | string[] | null;
  recurrence_type: string | null;
  recurrence_interval: number | null;
  recurrence_end_date: string | null;
  parent_task_id: string | null;
  metadata: Record<string, any> | null;
  
  // Joined fields
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  assigned_to_avatar?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
  lead_name?: string | null;
  customer_name?: string | null;
  chat_contact_name?: string | null;
  kanban_column_name?: string | null;
  event_title?: string | null;
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
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  by_type: {
    follow_up: number;
    call: number;
    email: number;
    meeting: number;
    whatsapp: number;
    proposal: number;
    general: number;
    visit: number;
  };
  by_assignee: Record<string, number>;
}

export interface CreateTaskDTO {
  company_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  created_by: string;
  related_lead_id?: string | null;
  related_customer_id?: string | null;
  related_chat_id?: string | null;
  related_event_id?: string | null;
  related_campaign_id?: string | null;
  kanban_column_id?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  due_date?: string | null;
  reminder_enabled?: boolean;
  reminder_time?: string | null;
  reminder_channels?: ReminderChannel[] | string[] | null;
}

export interface UpdateTaskDTO extends Partial<Omit<CreateTaskDTO, "company_id" | "created_by">> {
  completed_at?: string | null;
  kanban_order?: number;
}

// Aliases para compatibilidade com o frontend
export type CreateTaskInput = CreateTaskDTO;
export type UpdateTaskInput = UpdateTaskDTO;

export interface TaskFilters {
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  type?: TaskType | "all";
  assigned_to?: string | "all";
  related_lead_id?: string;
  related_customer_id?: string;
  related_chat_id?: string;
  kanban_column_id?: string;
  overdue?: boolean;
  due_today?: boolean;
  due_this_week?: boolean;
  search?: string;
}

// Helper types for UI
export interface TaskWithRelations extends Task {
  // Additional computed fields for UI
  isOverdue?: boolean;
  isDueToday?: boolean;
  isDueThisWeek?: boolean;
}

// Socket.io events payloads
export interface TaskCreatedPayload {
  task: Task;
  company_id: string;
}

export interface TaskUpdatedPayload {
  task: Task;
  company_id: string;
  changes: Partial<Task>;
}

export interface TaskAssignedPayload {
  task: Task;
  company_id: string;
  assigned_to: string;
  assigned_by: string;
}

export interface TaskCompletedPayload {
  task: Task;
  company_id: string;
  completed_by: string;
}

export interface TaskDeletedPayload {
  taskId: string;
  companyId: string;
}

export interface TaskReminderPayload {
  task: Task;
  company_id: string;
  reminder_channels: ReminderChannel[];
}
