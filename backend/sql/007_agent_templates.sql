-- 007_agent_templates.sql
-- Agent templates, questions and default seeds

create table if not exists public.agent_templates (
  id uuid primary key default gen_random_uuid(),
  -- null company_id => template global (disponível para todos)
  company_id uuid null,
  key text not null,
  name text not null,
  category text null,
  description text null,
  prompt_template text not null,
  default_model text null,
  default_model_params jsonb not null default '{}'::jsonb,
  default_tools jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists agent_templates_key_company_uidx
  on public.agent_templates((coalesce(company_id::text,'GLOBAL') || ':' || key));

create table if not exists public.agent_template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.agent_templates(id) on delete cascade,
  key text not null,
  label text not null,
  type text not null check (type in ('text','textarea','select','number','boolean','multiselect')),
  required boolean not null default false,
  help text null,
  options jsonb not null default '[]'::jsonb,
  order_index integer not null default 0
);

create index if not exists agent_template_questions_template_idx
  on public.agent_template_questions(template_id, order_index);

-- Opcional: associação com ferramentas do catálogo (se existir a tabela tools_catalog)
create table if not exists public.agent_template_tools (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.agent_templates(id) on delete cascade,
  tool_id uuid not null,
  required boolean not null default true,
  overrides jsonb not null default '{}'::jsonb
);
create index if not exists agent_template_tools_template_idx on public.agent_template_tools(template_id);

-- ====== Seeds básicos (globais) ======
do $$
declare
  tpl_id uuid;
begin
  -- VENDEDOR
  if not exists (select 1 from public.agent_templates where key = 'sales') then
    insert into public.agent_templates(key, name, category, description, prompt_template, default_model, default_model_params, default_tools)
    values (
      'sales',
      'Vendedor',
      'Comercial',
      'Agente orientado a conversão, qualifica leads e oferece produtos/serviços.',
      $prompt$
Você é um agente de vendas da empresa {{company_name}}.
Produtos/serviços principais: {{products}}.
Tom de voz: {{tone}}.
Objetivo: qualificar o lead e converter, respeitando regras:
- Se o cliente perguntar sobre preço, forneça faixas e convide para fechar.
- Ofereça próximos passos claros (ex.: agendar demo, orçamento, pagamento).
- Escale para humano quando detectar objeções críticas ou intenção de compra imediata.
Políticas: {{policies}}
      $prompt$,
      'gpt-4o-mini',
      '{"temperature":0.3,"max_tokens":700}'::jsonb,
      '["INTERNAL_DB","HTTP"]'::jsonb
    ) returning id into tpl_id;

    insert into public.agent_template_questions(template_id, key, label, type, required, help, options, order_index) values
      (tpl_id, 'company_name', 'Nome da empresa', 'text', true, 'Como o agente deve mencionar a empresa?', '[]'::jsonb, 1),
      (tpl_id, 'products', 'Produtos/Serviços', 'textarea', true, 'Liste o que o agente pode vender/oferecer', '[]'::jsonb, 2),
      (tpl_id, 'tone', 'Tom de voz', 'select', true, 'Selecione o tom preferido', '["profissional","amigavel","objetivo","consultivo"]'::jsonb, 3),
      (tpl_id, 'policies', 'Políticas/Restrições', 'textarea', false, 'Regras específicas (ex.: descontos, regiões, prazos)', '[]'::jsonb, 4);
  end if;

  -- RECEPCIONISTA
  if not exists (select 1 from public.agent_templates where key = 'reception') then
    insert into public.agent_templates(key, name, category, description, prompt_template, default_model, default_model_params, default_tools)
    values (
      'reception',
      'Recepcionista',
      'Atendimento',
      'Atende primeiro contato, coleta dados básicos e direciona.',
      $prompt$
Você é recepcionista virtual da {{company_name}}.
Horário de atendimento: {{business_hours}}.
Colete: nome, telefone/email e motivo do contato. Direcione conforme as regras:
{{routing_rules}}
Se fora do horário, informe e registre para retorno.
      $prompt$,
      'gpt-4o-mini',
      '{"temperature":0.2,"max_tokens":600}'::jsonb,
      '["INTERNAL_DB"]'::jsonb
    ) returning id into tpl_id;

    insert into public.agent_template_questions(template_id, key, label, type, required, help, options, order_index) values
      (tpl_id, 'company_name', 'Nome da empresa', 'text', true, null, '[]'::jsonb, 1),
      (tpl_id, 'business_hours', 'Horário de atendimento', 'text', true, 'Ex.: Seg-Sex 9h-18h', '[]'::jsonb, 2),
      (tpl_id, 'routing_rules', 'Regras de direcionamento', 'textarea', true, 'Ex.: Financeiro -> boleto; Suporte -> ticket', '[]'::jsonb, 3);
  end if;

  -- SUPORTE
  if not exists (select 1 from public.agent_templates where key = 'support') then
    insert into public.agent_templates(key, name, category, description, prompt_template, default_model, default_model_params, default_tools)
    values (
      'support',
      'Suporte',
      'Atendimento',
      'Resolve dúvidas comuns e abre ticket quando necessário.',
      $prompt$
Você é um agente de suporte da {{company_name}}.
Base de conhecimento e políticas: {{kb_policies}}
Coleta básica: produto/serviço, descrição do problema, urgência, anexos.
Diretrizes: tente resolver em até 3 interações; se falhar, abrir ticket e escalar.
      $prompt$,
      'gpt-4o-mini',
      '{"temperature":0.2,"max_tokens":700}'::jsonb,
      '["INTERNAL_DB","HTTP"]'::jsonb
    ) returning id into tpl_id;

    insert into public.agent_template_questions(template_id, key, label, type, required, help, options, order_index) values
      (tpl_id, 'company_name', 'Nome da empresa', 'text', true, null, '[]'::jsonb, 1),
      (tpl_id, 'kb_policies', 'Políticas/KB', 'textarea', true, 'Cole aqui regras/links importantes', '[]'::jsonb, 2);
  end if;

  -- PRIMEIRO CONTATO
  if not exists (select 1 from public.agent_templates where key = 'first_touch') then
    insert into public.agent_templates(key, name, category, description, prompt_template, default_model, default_model_params, default_tools)
    values (
      'first_touch',
      'Primeiro Contato',
      'Marketing',
      'Inicia conversas e captura interesse/qualificação inicial.',
      $prompt$
Você faz o primeiro contato pela {{channel}} em nome de {{company_name}}.
Mensagem de abertura base: {{opening}}
Se o cliente engajar, colete dados mínimos e encaminhe próximos passos.
      $prompt$,
      'gpt-4o-mini',
      '{"temperature":0.4,"max_tokens":500}'::jsonb,
      '[]'::jsonb
    ) returning id into tpl_id;

    insert into public.agent_template_questions(template_id, key, label, type, required, help, options, order_index) values
      (tpl_id, 'company_name', 'Nome da empresa', 'text', true, null, '[]'::jsonb, 1),
      (tpl_id, 'channel', 'Canal', 'select', true, null, '["WhatsApp","Instagram","Facebook","Site"]'::jsonb, 2),
      (tpl_id, 'opening', 'Mensagem de abertura', 'textarea', true, null, '[]'::jsonb, 3);
  end if;

  -- FOLLOW UP
  if not exists (select 1 from public.agent_templates where key = 'follow_up') then
    insert into public.agent_templates(key, name, category, description, prompt_template, default_model, default_model_params, default_tools)
    values (
      'follow_up',
      'Follow Up',
      'Comercial',
      'Reengaja contatos com base em contexto e cadência.',
      $prompt$
Você é responsável por follow ups da {{company_name}}.
Cadência: {{cadence}}.
Contexto do lead: {{lead_context}}
Se houver sinal de interesse, encaminhe para fechamento imediatamente.
      $prompt$,
      'gpt-4o-mini',
      '{"temperature":0.3,"max_tokens":500}'::jsonb,
      '[]'::jsonb
    ) returning id into tpl_id;

    insert into public.agent_template_questions(template_id, key, label, type, required, help, options, order_index) values
      (tpl_id, 'company_name', 'Nome da empresa', 'text', true, null, '[]'::jsonb, 1),
      (tpl_id, 'cadence', 'Cadência', 'text', true, 'Ex.: 3 tentativas em 7 dias', '[]'::jsonb, 2),
      (tpl_id, 'lead_context', 'Contexto do Lead', 'textarea', false, 'Ex.: origem, histórico, interesse', '[]'::jsonb, 3);
  end if;
end$$;
