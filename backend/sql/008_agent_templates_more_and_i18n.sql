-- 008_agent_templates_more_and_i18n.sql
-- Phase 2: add at least 2 more templates
-- Phase 3: introduce i18n tables for templates and questions

-- Unique index to avoid duplicate questions per (template_id, key)
create unique index if not exists agent_template_questions_tpl_key_uidx
  on public.agent_template_questions(template_id, key);

-- i18n tables (Phase 3)
create table if not exists public.agent_template_translations (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.agent_templates(id) on delete cascade,
  locale text not null,
  name text not null,
  description text null,
  prompt_template text not null,
  created_at timestamptz not null default now(),
  unique (template_id, locale)
);

create table if not exists public.agent_template_question_translations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.agent_template_questions(id) on delete cascade,
  locale text not null,
  label text not null,
  help text null,
  created_at timestamptz not null default now(),
  unique (question_id, locale)
);

-- =====================
-- Template: Agendamento (scheduling)
-- =====================
with existing as (
  select id from public.agent_templates where key = 'scheduling' and company_id is null
), ins as (
  insert into public.agent_templates(key, name, category, description, prompt_template, default_model, default_model_params, default_tools)
  select 'scheduling', 'Agendamento', 'Atendimento', 'Agenda compromissos e confirma horários.',
         $prompt$
Você é um agente de agendamento da {{company_name}}.
Horários disponíveis: {{availability}}.
Coletar: nome do cliente, contato, data/horário preferido e motivo.
Regras: confirme o horário e envie instruções adicionais se necessário.
         $prompt$,
         'gpt-4o-mini', '{"temperature":0.2,"max_tokens":550}'::jsonb, '[]'::jsonb
  where not exists (select 1 from existing)
  returning id
), tpl as (
  select id from ins
  union all
  select id from existing
)
insert into public.agent_template_questions(template_id, key, label, type, required, help, options, order_index)
select (select id from tpl limit 1), v.key, v.label, v.type, v.required, v.help, v.options, v.order_index
from (
  values
    ('company_name','Nome da empresa','text',true,'Como devemos mencionar a empresa?','[]'::jsonb,1),
    ('availability','Horários disponíveis','textarea',true,'Ex.: Seg-Sex 9h-18h; Sáb 9h-12h','[]'::jsonb,2),
    ('instructions','Instruções adicionais','textarea',false,'Ex.: local, documentos, política de atraso','[]'::jsonb,3)
) as v(key,label,type,required,help,options,order_index)
on conflict (template_id, key) do nothing;

-- i18n (en-US) for "scheduling"
with tpl as (
  select id from public.agent_templates where key = 'scheduling' and company_id is null
)
insert into public.agent_template_translations(template_id, locale, name, description, prompt_template)
select (select id from tpl), 'en-US', 'Scheduling', 'Books appointments and confirms times.',
$prompt$
You are a scheduling agent for {{company_name}}.
Available times: {{availability}}.
Collect: customer name, contact, preferred date/time and purpose.
Rules: confirm availability and send any additional instructions.
$prompt$
on conflict (template_id, locale) do nothing;

-- translate questions (en-US)
with tpl as (
  select t.id from public.agent_templates t where t.key = 'scheduling' and t.company_id is null
), qs as (
  select q.id, q.key from public.agent_template_questions q where q.template_id = (select id from tpl)
)
insert into public.agent_template_question_translations(question_id, locale, label, help)
select q.id, 'en-US',
  case q.key
    when 'company_name' then 'Company name'
    when 'availability' then 'Available hours'
    when 'instructions' then 'Additional instructions'
    else initcap(replace(q.key,'_',' ')) end,
  case q.key
    when 'company_name' then 'How should the agent mention the company?'
    when 'availability' then 'e.g., Mon-Fri 9am-6pm; Sat 9am-12pm'
    when 'instructions' then 'e.g., location, documents, late policy'
    else null end
from qs q
on conflict (question_id, locale) do nothing;

-- =====================
-- Template: Pesquisa de Satisfação (csat)
-- =====================
with existing as (
  select id from public.agent_templates where key = 'csat' and company_id is null
), ins as (
  insert into public.agent_templates(key, name, category, description, prompt_template, default_model, default_model_params, default_tools)
  select 'csat', 'Pesquisa de Satisfação', 'Pós-atendimento', 'Aplica pesquisa simples de satisfação (CSAT/NPS).',
         $prompt$
Você é um agente que conduz pesquisas de satisfação da {{company_name}}.
Tipo de pesquisa: {{survey_type}} (ex.: CSAT, NPS).
Perguntas: {{survey_questions}}.
Se o cliente responder baixo, peça feedback qualitativo e encaminhe alerta.
         $prompt$,
         'gpt-4o-mini', '{"temperature":0.2,"max_tokens":400}'::jsonb, '[]'::jsonb
  where not exists (select 1 from existing)
  returning id
), tpl as (
  select id from ins
  union all
  select id from existing
)
insert into public.agent_template_questions(template_id, key, label, type, required, help, options, order_index)
select (select id from tpl limit 1), v.key, v.label, v.type, v.required, v.help, v.options, v.order_index
from (
  values
    ('company_name','Nome da empresa','text',true,null,'[]'::jsonb,1),
    ('survey_type','Tipo de pesquisa','select',true,'Escolha CSAT ou NPS','["CSAT","NPS"]'::jsonb,2),
    ('survey_questions','Perguntas','textarea',true,'Uma por linha','[]'::jsonb,3)
) as v(key,label,type,required,help,options,order_index)
on conflict (template_id, key) do nothing;

-- i18n (en-US) for "csat"
with tpl as (
  select id from public.agent_templates where key = 'csat' and company_id is null
)
insert into public.agent_template_translations(template_id, locale, name, description, prompt_template)
select (select id from tpl), 'en-US', 'Customer Satisfaction Survey', 'Runs simple CSAT/NPS surveys.',
$prompt$
You are a survey agent for {{company_name}}.
Survey type: {{survey_type}} (e.g., CSAT, NPS).
Questions: {{survey_questions}}.
If the score is low, ask for qualitative feedback and raise an alert.
$prompt$
on conflict (template_id, locale) do nothing;

-- translate questions (en-US)
with tpl as (
  select t.id from public.agent_templates t where t.key = 'csat' and t.company_id is null
), qs as (
  select q.id, q.key from public.agent_template_questions q where q.template_id = (select id from tpl)
)
insert into public.agent_template_question_translations(question_id, locale, label, help)
select q.id, 'en-US',
  case q.key
    when 'company_name' then 'Company name'
    when 'survey_type' then 'Survey type'
    when 'survey_questions' then 'Questions'
    else initcap(replace(q.key,'_',' ')) end,
  case q.key
    when 'survey_type' then 'Choose CSAT or NPS'
    when 'survey_questions' then 'One per line'
    else null end
from qs q
on conflict (question_id, locale) do nothing;
