export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "VOICE" | "STICKER" | "LOCATION" | "CONTACT" | "INTERACTIVE" | "FILE" | "PRIVATE" | "CONTACTS" | "POLL" | "BUTTONS" | "LIST" | "TEMPLATE" | "REACTION" | "SYSTEM";
export type MessageViewStatus = "sent" | "delivered" | "read" | "failed" | "pending" | "deleted" | "sending" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "PENDING" | "DELETED" | "SENDING" | string;

export interface Message {
  id: string;
  chat_id: string;
  content: string | null;
  body?: string | null;
  is_from_customer?: boolean | string;
  sender_type?: string | null;
  sender_id: string | null; // agent user id
  sender_name?: string | null;
  sender_avatar_url?: string | null;
  type: MessageType;
  view_status: MessageViewStatus;
  is_private?: boolean | null;
  media_url?: string | null;
  media_public_url?: string | null;
  media_storage_path?: string | null;
  caption?: string | null;
  media_mime?: string | null;
  media_size?: number | null;
  media_sha256?: string | null;
  media_source?: string | null;
  is_media_sensitive?: boolean;
  template_id?: string | null;
  sent_from_device?: string | null;
  remote_participant_id?: string | null;
  remote_sender_id?: string | null;
  remote_sender_name?: string | null;
  remote_sender_phone?: string | null;
  remote_sender_avatar_url?: string | null;
  remote_sender_is_admin?: boolean | null;
  replied_message_id?: string | null;
  replied_message_external_id?: string | null;
  interactive_content?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  delivery_status?: string | null;
  upload_progress?: number | null;
  client_draft_id?: string | null;
  error_reason?: string | null;
  created_at: string;
}

export interface CreateMessageDTO {
  chat_id: string;
  content?: string | null;
  is_from_customer: boolean;
  sender_id?: string | null;
  type?: MessageType;
  view_status?: MessageViewStatus;
  media_url?: string | null;
  caption?: string | null;
  remote_sender_name?: string | null;
  remote_sender_phone?: string | null;
  interactive_content?: Record<string, any> | null;
}
