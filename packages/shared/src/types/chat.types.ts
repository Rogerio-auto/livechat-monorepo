export type ChatStatus = "open" | "resolved" | "pending" | "snoozed" | string;

export interface Chat {
  id: string;
  company_id: string;
  inbox_id: string;
  customer_id: string | null;
  remote_id: string; // phone or group jid
  name: string | null;
  avatar_url: string | null;
  status: ChatStatus;
  last_message?: string | null;
  last_message_content?: string | null;
  last_message_at: string | null;
  last_message_type: string | null;
  last_message_media_url: string | null;
  last_message_from?: "CUSTOMER" | "AGENT" | null;
  assignee_id: string | null;
  team_id: string | null;
  department_id: string | null;
  kanban_column_id: string | null;
  kanban_board_id: string | null;
  external_id?: string | null;
  kind?: "DIRECT" | "GROUP" | string | null;
  chat_type?: string | null;
  group_name?: string | null;
  group_avatar_url?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_avatar_url?: string | null;
  photo_url?: string | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  assigned_agent_user_id?: string | null;
  ai_agent_id?: string | null;
  ai_agent_name?: string | null;
  ai_mode?: string | null;
  department_name?: string | null;
  department_color?: string | null;
  department_icon?: string | null;
  display_name?: string | null;
  display_phone?: string | null;
  display_remote_id?: string | null;
  is_group?: boolean | null;
  group_size?: number | null;
  stage_id?: string | null;
  stage_name?: string | null;
  note?: string | null;
  unread_count?: number | null;
  tag_ids?: string[];
  created_at: string;
  updated_at: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface CreateChatDTO {
  company_id: string;
  inbox_id: string;
  customer_id?: string | null;
  remote_id: string;
  name?: string | null;
  avatar_url?: string | null;
  status?: ChatStatus;
  assignee_id?: string | null;
  team_id?: string | null;
  department_id?: string | null;
}

export interface UpdateChatDTO extends Partial<Omit<CreateChatDTO, "company_id" | "inbox_id" | "remote_id">> {
  last_message_at?: string | null;
  last_message_content?: string | null;
  last_message_type?: string | null;
  last_message_media_url?: string | null;
  kanban_column_id?: string | null;
  kanban_board_id?: string | null;
}
