-- 001_livechat_core.sql
-- Postgres/Supabase migration for livechat core + AI buffer support

-- Extensions
create extension if not exists "pgcrypto";

-- Companies/users are assumed to exist in your auth schema. We avoid FK to keep this portable.

-- Integrations (OpenAI)
create table if not exists public.integrations_openai (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  api_key_enc text,
  default_model text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists integrations_openai_company_active_idx on public.integrations_openai(company_id, is_active);

-- Agents
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','ARCHIVED')),
  integration_openai_id uuid,
  model text,
  model_params jsonb,
  aggregation_enabled boolean not null default false,
  aggregation_window_sec integer,
  max_batch_messages integer,
  reply_if_idle_sec integer,
  media_config jsonb,
  tools_policy jsonb,
  allow_handoff boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists agents_company_status_idx on public.agents(company_id, status);

-- Inboxes and Secrets
create table if not exists public.inboxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  provider text not null default 'META' check (upper(provider) in ('META','WAHA')),
  phone_number_id text,
  phone_number text,
  instance_id text,
  waba_id text,
  app_secret text,
  webhook_verify_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists inboxes_company_idx on public.inboxes(company_id);

create table if not exists public.inbox_secrets (
  inbox_id uuid primary key references public.inboxes(id) on delete cascade,
  access_token text,
  refresh_token text,
  provider_api_key text,
  updated_at timestamptz
);

-- Customers (minimal)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  name text,
  phone text,
  msisdn text,
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists customers_company_phone_idx on public.customers(company_id, phone);

-- Leads (minimal)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Chats
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  inbox_id uuid not null references public.inboxes(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  external_id text,
  remote_id text,
  kind text,
  chat_type text,
  group_name text,
  group_avatar_url text,
  status text not null default 'AI' check (upper(status) in ('OPEN','PENDING','CLOSED','ASSIGNED','AI','RESOLVED')),
  last_message text,
  last_message_at timestamptz,
  last_message_from text,
  last_message_type text,
  last_message_media_url text,
  assignee_agent uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Safe guards: add columns if missing (for existing installs)
alter table public.chats add column if not exists company_id uuid;
alter table public.chats add column if not exists remote_id text;
alter table public.chats add column if not exists kind text;
alter table public.chats add column if not exists chat_type text;
alter table public.chats add column if not exists group_name text;
alter table public.chats add column if not exists group_avatar_url text;
alter table public.chats add column if not exists status text;
alter table public.chats alter column status set default 'AI';
alter table public.chats add column if not exists last_message text;
alter table public.chats add column if not exists last_message_at timestamptz;
alter table public.chats add column if not exists last_message_from text;
alter table public.chats add column if not exists last_message_type text;
alter table public.chats add column if not exists last_message_media_url text;
alter table public.chats add column if not exists assignee_agent uuid;

create index if not exists chats_inbox_last_idx on public.chats(inbox_id, last_message_at desc nulls last);
create index if not exists chats_status_idx on public.chats((upper(status)));
create index if not exists chats_remote_idx on public.chats(inbox_id, remote_id);
create unique index if not exists chats_unique_direct_idx on public.chats(inbox_id, customer_id) where customer_id is not null;

-- Messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid,
  is_from_customer boolean not null,
  external_id text not null,
  content text,
  type text,
  view_status text,
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  remote_participant_id uuid,
  remote_sender_id text,
  remote_sender_name text,
  remote_sender_phone text,
  remote_sender_avatar_url text,
  remote_sender_is_admin boolean,
  replied_message_id uuid
);
create unique index if not exists chat_messages_chat_external_uq on public.chat_messages(chat_id, external_id);
create index if not exists chat_messages_chat_created_idx on public.chat_messages(chat_id, created_at);

-- Attachments (optional but used by WAHA path)
create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.chat_messages(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete cascade,
  inbox_id uuid references public.inboxes(id) on delete cascade,
  provider text,
  storage_bucket text,
  storage_key text,
  public_url text,
  mime_type text,
  filename text,
  bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Remote participants (for group chats)
create table if not exists public.chat_remote_participants (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  remote_id text not null,
  name text,
  phone text,
  avatar_url text,
  is_admin boolean,
  joined_at timestamptz,
  left_at timestamptz,
  updated_at timestamptz
);
create unique index if not exists chat_remote_participants_uq on public.chat_remote_participants(chat_id, remote_id);
create index if not exists chat_remote_participants_chat_idx on public.chat_remote_participants(chat_id);

-- Webhook events de-duplication
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.inboxes(id) on delete cascade,
  provider text not null check (upper(provider) in ('META','WAHA')),
  event_uid text not null,
  raw jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists webhook_events_inbox_uid_uq on public.webhook_events(inbox_id, event_uid);

-- Inbox users (minimal, used to resolve assignee names)
create table if not exists public.inbox_users (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.inboxes(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists inbox_users_inbox_idx on public.inbox_users(inbox_id);

-- Users (minimal lookups)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  company_id uuid,
  name text,
  avatar text,
  created_at timestamptz not null default now()
);
create index if not exists users_company_idx on public.users(company_id);

-- Helpful defaults
update public.chats set status = 'AI' where status is null;

-- Optional: ensure last_message_at has some value on existing rows
update public.chats c
   set last_message_at = coalesce(last_message_at, created_at)
 where last_message_at is null;
