export type NotificationType = 
  | "SYSTEM"
  | "CHAT_MESSAGE"
  | "NEW_LEAD"
  | "PROPOSAL_VIEWED"
  | "PROPOSAL_ACCEPTED"
  | "PROPOSAL_REJECTED"
  | "PROPOSAL_EXPIRED"
  | "TECHNICAL_VISIT"
  | "SYSTEM_ALERT"
  | "MASS_DISPATCH"
  | "CHAT_ASSIGNED"
  | "CHAT_TRANSFERRED"
  | "CHAT_CLOSED"
  | "LEAD_CONVERTED"
  | "NEW_CUSTOMER"
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_DUE_TODAY"
  | "TASK_DUE_TOMORROW"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "TASK_COMPLETED"
  | "CAMPAIGN_COMPLETED"
  | "CAMPAIGN_FAILED"
  | "MENTION"
  | "TEAM_INVITE"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "USER_MESSAGE"
  | "PROJECT_CREATED"
  | "PROJECT_ASSIGNED"
  | "PROJECT_STAGE_CHANGED"
  | "PROJECT_COMPLETED"
  | "PROJECT_COMMENTED"
  | "PROJECT_OVERDUE"
  | "PROJECT_DEADLINE_TODAY"
  | "PROJECT_DEADLINE_TOMORROW"
  | "PROJECT_DEADLINE_WARNING"
  // Aliases para compatibilidade com o frontend legado
  | "project_deadline"
  | "task_assigned"
  | "task_completed"
  | "mention"
  | "system_alert";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SoundType = "default" | "success" | "warning" | "error" | "message" | "urgent" | "silent";
export type NotificationCategory = "chat" | "lead" | "proposal" | "task" | "campaign" | "system" | "payment" | "general" | "project";

export interface Notification {
  id: string;
  user_id: string;
  company_id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  category: NotificationCategory;
  is_read: boolean;
  data: Record<string, unknown> | null;
  sound_type: SoundType;
  action_url: string | null;
  project_id: string | null;
  task_id: string | null;
  comment_id: string | null;
  created_at: string;
  updated_at: string | null;

  // Aliases para compatibilidade legada
  link?: string | null;
  read_at?: string | null;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  preferences: Record<string, boolean>;
}

export interface CreateNotificationDTO {
  user_id: string;
  company_id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  data?: Record<string, unknown>;
  sound_type?: SoundType;
  action_url?: string;
  project_id?: string;
  task_id?: string;
  comment_id?: string;
}
