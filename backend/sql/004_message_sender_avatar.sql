-- Add sender avatar URL to chat messages (for human agent messages)
alter table if exists public.chat_messages
  add column if not exists sender_avatar_url text null;

comment on column public.chat_messages.sender_avatar_url is 'Avatar URL of the local sender (agent) at send time. Null for AI or when unknown.';
