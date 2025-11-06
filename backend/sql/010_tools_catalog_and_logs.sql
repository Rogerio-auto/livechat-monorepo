-- 010_tools_catalog_and_logs.sql
-- Sistema de ferramentas (tools) para agentes de IA com controle granular de acesso a colunas

-- ====== 1. Catálogo de ferramentas disponíveis ======
-- Drop e recria para garantir schema correto
drop table if exists public.agent_tool_logs cascade;
drop table if exists public.agent_tools cascade;
drop table if exists public.tools_catalog cascade;

create table public.tools_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category text null, -- ex.: 'CRM', 'Workflow', 'Database', 'Integration'
  description text null,
  schema jsonb not null, -- OpenAI function schema (parameters, required, etc.)
  handler_type text not null check (handler_type in ('INTERNAL_DB','HTTP','WORKFLOW','SOCKET')),
  handler_config jsonb not null default '{}'::jsonb, -- { table, action, allowed_columns, restricted_columns, etc. }
  is_active boolean not null default true,
  company_id uuid null references public.companies(id) on delete cascade, -- null = global tool
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create index tools_catalog_category_idx on public.tools_catalog(category) where is_active = true;
create index tools_catalog_handler_type_idx on public.tools_catalog(handler_type) where is_active = true;
create index tools_catalog_company_idx on public.tools_catalog(company_id);

-- ====== 2. Associação: agente ↔ ferramentas habilitadas ======
create table public.agent_tools (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  tool_id uuid not null references public.tools_catalog(id) on delete cascade,
  is_enabled boolean not null default true,
  overrides jsonb not null default '{}'::jsonb, -- permite customizar allowed_columns por agente
  created_at timestamptz not null default now(),
  unique(agent_id, tool_id)
);

create index agent_tools_agent_idx on public.agent_tools(agent_id) where is_enabled = true;
create index agent_tools_tool_idx on public.agent_tools(tool_id);

-- ====== 3. Log de execução de ferramentas (auditoria e compliance) ======
create table public.agent_tool_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  tool_id uuid not null,
  chat_id uuid null,
  contact_id uuid null,
  action text not null, -- ex.: 'update', 'select', 'insert'
  table_name text null,
  columns_accessed text[] not null,
  params jsonb not null,
  result jsonb null,
  error text null,
  executed_at timestamptz not null default now()
);

create index agent_tool_logs_agent_idx on public.agent_tool_logs(agent_id, executed_at desc);
create index agent_tool_logs_chat_idx on public.agent_tool_logs(chat_id, executed_at desc);
create index agent_tool_logs_tool_idx on public.agent_tool_logs(tool_id, executed_at desc);

-- ====== 4. Seeds: ferramentas básicas ======
do $$
begin
  -- FERRAMENTA 1: Consultar dados do contato (READ-ONLY)
  if not exists (select 1 from public.tools_catalog where key = 'query_contact_data') then
    insert into public.tools_catalog(key, name, category, description, schema, handler_type, handler_config) values (
      'query_contact_data',
      'Consultar Dados do Contato',
      'CRM',
      'Permite ao agente consultar informações básicas de um contato (nome, email, telefone, tags). Sem acesso a dados sensíveis.',
      '{
        "type": "function",
        "function": {
          "name": "query_contact_data",
          "description": "Consulta informações de um contato existente.",
          "parameters": {
            "type": "object",
            "properties": {
              "contact_id": { "type": "string", "description": "ID do contato" },
              "phone": { "type": "string", "description": "Telefone (alternativa ao ID)" }
            }
          }
        }
      }'::jsonb,
      'INTERNAL_DB',
      '{
        "table": "contacts",
        "action": "select",
        "allowed_columns": {
          "read": ["id", "name", "email", "phone", "tags", "created_at", "updated_at"]
        },
        "restricted_columns": ["password", "password_hash", "credit_card", "ssn", "internal_notes"]
      }'::jsonb
    );
  end if;

  -- FERRAMENTA 2: Atualizar dados do contato (WRITE)
  if not exists (select 1 from public.tools_catalog where key = 'update_contact_data') then
    insert into public.tools_catalog(key, name, category, description, schema, handler_type, handler_config) values (
      'update_contact_data',
      'Atualizar Dados do Contato',
      'CRM',
      'Permite ao agente atualizar nome, email, telefone e tags de um contato. Não permite alterar dados sensíveis ou de controle interno.',
      '{
        "type": "function",
        "function": {
          "name": "update_contact_data",
          "description": "Atualiza informações de um contato existente.",
          "parameters": {
            "type": "object",
            "properties": {
              "contact_id": { "type": "string", "description": "ID do contato" },
              "name": { "type": "string", "description": "Nome completo" },
              "email": { "type": "string", "description": "Email" },
              "phone": { "type": "string", "description": "Telefone" },
              "tags": { "type": "array", "items": { "type": "string" }, "description": "Tags do contato" }
            },
            "required": ["contact_id"]
          }
        }
      }'::jsonb,
      'INTERNAL_DB',
      '{
        "table": "contacts",
        "action": "update",
        "allowed_columns": {
          "read": ["id", "name", "email", "phone", "tags"],
          "write": ["name", "email", "phone", "tags"]
        },
        "restricted_columns": ["password", "password_hash", "company_id", "owner_id", "created_by", "credit_card"],
        "required_columns": ["contact_id"],
        "default_values": { "updated_by": "ai_agent" }
      }'::jsonb
    );
  end if;

  -- FERRAMENTA 3: Adicionar tag ao contato
  if not exists (select 1 from public.tools_catalog where key = 'add_contact_tag') then
    insert into public.tools_catalog(key, name, category, description, schema, handler_type, handler_config) values (
      'add_contact_tag',
      'Adicionar Tag ao Contato',
      'CRM',
      'Marca um contato com uma tag específica (ex.: "interessado", "qualificado", "quente").',
      '{
        "type": "function",
        "function": {
          "name": "add_contact_tag",
          "description": "Adiciona uma tag a um contato.",
          "parameters": {
            "type": "object",
            "properties": {
              "contact_id": { "type": "string", "description": "ID do contato" },
              "tag_name": { "type": "string", "description": "Nome da tag (ex.: interessado, qualificado)" }
            },
            "required": ["contact_id", "tag_name"]
          }
        }
      }'::jsonb,
      'INTERNAL_DB',
      '{
        "table": "contact_tags",
        "action": "insert",
        "allowed_columns": {
          "write": ["contact_id", "tag_name"]
        },
        "restricted_columns": ["id", "company_id", "created_by"],
        "required_columns": ["contact_id", "tag_name"],
        "default_values": { "created_by": "ai_agent" }
      }'::jsonb
    );
  end if;

  -- FERRAMENTA 4: Criar evento/agendamento
  if not exists (select 1 from public.tools_catalog where key = 'create_event') then
    insert into public.tools_catalog(key, name, category, description, schema, handler_type, handler_config) values (
      'create_event',
      'Criar Evento/Agendamento',
      'Workflow',
      'Cria um evento ou agendamento (ex.: demo, follow-up, reunião) no calendário do usuário.',
      '{
        "type": "function",
        "function": {
          "name": "create_event",
          "description": "Cria um novo evento no calendário.",
          "parameters": {
            "type": "object",
            "properties": {
              "title": { "type": "string", "description": "Título do evento (ex.: Demo Produto X)" },
              "description": { "type": "string", "description": "Descrição detalhada do evento" },
              "start_time": { "type": "string", "description": "Data/hora início (ISO 8601, ex.: 2025-11-10T14:00:00Z)" },
              "end_time": { "type": "string", "description": "Data/hora fim (ISO 8601)" },
              "event_type": { "type": "string", "enum": ["MEETING", "DEMO", "FOLLOW_UP", "OTHER"], "description": "Tipo do evento" },
              "location": { "type": "string", "description": "Local/link do evento" },
              "lead_id": { "type": "string", "description": "ID do lead relacionado (opcional)" },
              "customer_id": { "type": "string", "description": "ID do cliente relacionado (opcional)" }
            },
            "required": ["title", "start_time", "end_time"]
          }
        }
      }'::jsonb,
      'INTERNAL_DB',
      '{
        "table": "events",
        "action": "insert",
        "allowed_columns": {
          "write": ["title", "description", "start_time", "end_time", "event_type", "location", "lead_id", "customer_id"]
        },
        "restricted_columns": ["id", "calendar_id", "created_by_id", "technical_visit_id"],
        "required_columns": ["title", "start_time", "end_time"],
        "default_values": { 
          "status": "SCHEDULED", 
          "is_all_day": false,
          "event_type": "OTHER"
        },
        "post_insert_action": "assign_default_calendar"
      }'::jsonb
    );
  end if;

  -- FERRAMENTA 5: Transferir para outro agente (handoff)
  if not exists (select 1 from public.tools_catalog where key = 'transfer_agent') then
    insert into public.tools_catalog(key, name, category, description, schema, handler_type, handler_config) values (
      'transfer_agent',
      'Transferir para Outro Agente',
      'Workflow',
      'Transfere a conversa atual para outro agente de IA ou humano. Envia um resumo do contexto.',
      '{
        "type": "function",
        "function": {
          "name": "transfer_agent",
          "description": "Transfere a conversa para outro agente.",
          "parameters": {
            "type": "object",
            "properties": {
              "target_agent_id": { "type": "string", "description": "ID do agente de destino (null para humano)" },
              "reason": { "type": "string", "description": "Motivo da transferência" },
              "context_summary": { "type": "string", "description": "Resumo do contexto da conversa" }
            },
            "required": ["reason"]
          }
        }
      }'::jsonb,
      'WORKFLOW',
      '{
        "action": "handoff",
        "emit_event": "agent_handoff_requested",
        "target_queue": "human_support"
      }'::jsonb
    );
  end if;

  -- FERRAMENTA 6: Consultar base de conhecimento (knowledge base)
  if not exists (select 1 from public.tools_catalog where key = 'query_knowledge_base') then
    insert into public.tools_catalog(key, name, category, description, schema, handler_type, handler_config) values (
      'query_knowledge_base',
      'Consultar Base de Conhecimento',
      'Database',
      'Busca informações na base de conhecimento da empresa (FAQs, documentação, políticas).',
      '{
        "type": "function",
        "function": {
          "name": "query_knowledge_base",
          "description": "Busca informações na base de conhecimento.",
          "parameters": {
            "type": "object",
            "properties": {
              "query_text": { "type": "string", "description": "Texto da busca" },
              "category": { "type": "string", "description": "Categoria (opcional, ex.: produto, politica, suporte)" },
              "max_results": { "type": "integer", "description": "Número máximo de resultados (padrão: 5)" }
            },
            "required": ["query_text"]
          }
        }
      }'::jsonb,
      'INTERNAL_DB',
      '{
        "table": "knowledge_base",
        "action": "select",
        "allowed_columns": {
          "read": ["id", "title", "content", "category", "tags", "created_at"]
        },
        "restricted_columns": ["internal_notes", "draft_content"],
        "search_column": "content",
        "max_results": 5
      }'::jsonb
    );
  end if;

end$$;
