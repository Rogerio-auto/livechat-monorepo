export type NotificationType = 
  | 'project_deadline'
  | 'task_assigned'
  | 'task_completed'
  | 'mention'
  | 'system_alert'
  | 'campaign_status';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  priority: NotificationPriority;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  preferences: Record<string, boolean>;
}
