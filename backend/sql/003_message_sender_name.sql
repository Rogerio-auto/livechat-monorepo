-- 003_message_sender_name.sql
-- Add sender_name to chat_messages to display agent name (human or AI) in message bubbles

alter table public.chat_messages
  add column if not exists sender_name text null;

create index if not exists chat_messages_sender_name_idx on public.chat_messages(sender_name)
  where sender_name is not null;

comment on column public.chat_messages.sender_name is 'Agent name (human user or AI agent) who sent the message; null for customer messages';
