export type Chat = {
  id: string;
  created_at: string,
  status: string;
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_type?: string | null;
  last_message_media_url?: string | null;
  last_message_from?: "CUSTOMER" | "AGENT" | null;
  inbox_id: string;
  customer_id: string;
  external_id?: string | null;
  remote_id?: string | null;
  kind?: "DIRECT" | "GROUP" | string | null;
  chat_type?: string | null;
  group_name?: string | null;
  group_avatar_url?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_avatar_url?: string | null;
  photo_url?: string | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  assigned_agent_user_id?: string | null;
  display_name?: string | null;
  display_phone?: string | null;
  display_remote_id?: string | null;
  is_group?: boolean | null;
  group_size?: number | null;
  stage_id?: string | null;
  stage_name?: string | null;
  note?: string | null;
  unread_count?: number | null;
};

export type Message = {
  id: string;
  chat_id: string;
  content: string;
  is_from_customer?: "CUSTOMER" | "AGENT" | string;
  body: string;
  sender_type?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_avatar_url?: string | null;
  created_at: string;
  view_status?: string | null;
  type?: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "FILE" | "PRIVATE" | string;
  is_private?: boolean | null;
  media_url?: string | null;
  // UI-only fields (not persisted):
  upload_progress?: number | null;
  remote_participant_id?: string | null;
  remote_sender_id?: string | null;
  remote_sender_name?: string | null;
  remote_sender_phone?: string | null;
  remote_sender_avatar_url?: string | null;
  remote_sender_is_admin?: boolean | null;
  replied_message_id?: string | null;
  delivery_status?: string | null;
  client_draft_id?: string | null;
  error_reason?: string | null;
};

export type Inbox = {
  id: string;
  name: string;
  phone_number: string;
  is_active?: boolean | null;
  provider?: string | null;
  channel?: string | null;
  waha_db_name?: string | null;
};
export type Tag = {
  id: string;  
  name: string;  
  color?: string | null;
};

export type Contact = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  // …adicione os campos que você realmente usa
};
