-- 002_chats_ai_agent.sql
-- Add per-chat AI agent linkage and index

alter table public.chats
  add column if not exists ai_agent_id uuid null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chats_ai_agent_id_fkey'
  ) then
    alter table public.chats
      add constraint chats_ai_agent_id_fkey
      foreign key (ai_agent_id) references public.agents(id)
      on delete set null;
  end if;
end $$;

create index if not exists chats_ai_agent_id_idx on public.chats(ai_agent_id);
