-- 013_populate_template_tools.sql
-- Popular agent_template_tools vinculando ferramentas úteis aos templates

do $$
declare
  tpl_sales_id uuid;
  tpl_reception_id uuid;
  tool_query_contact uuid;
  tool_update_contact uuid;
  tool_add_tag uuid;
begin
  -- Buscar IDs dos templates
  select id into tpl_sales_id from public.agent_templates where key = 'sales' and company_id is null;
  select id into tpl_reception_id from public.agent_templates where key = 'reception' and company_id is null;
  
  -- Buscar IDs das ferramentas globais
  select id into tool_query_contact from public.tools_catalog where key = 'query_contact_data' and company_id is null;
  select id into tool_update_contact from public.tools_catalog where key = 'update_contact_data' and company_id is null;
  select id into tool_add_tag from public.tools_catalog where key = 'add_contact_tag' and company_id is null;
  
  -- Vincular ferramentas ao template VENDEDOR
  if tpl_sales_id is not null then
    -- Vendedor pode consultar dados do contato
    if tool_query_contact is not null then
      insert into public.agent_template_tools(template_id, tool_id, required, overrides)
      values (tpl_sales_id, tool_query_contact, false, '{}'::jsonb)
      on conflict (template_id, tool_id) do nothing;
    end if;
    
    -- Vendedor pode adicionar tags (ex: qualificado, hot_lead)
    if tool_add_tag is not null then
      insert into public.agent_template_tools(template_id, tool_id, required, overrides)
      values (tpl_sales_id, tool_add_tag, false, '{}'::jsonb)
      on conflict (template_id, tool_id) do nothing;
    end if;
  end if;
  
  -- Vincular ferramentas ao template RECEPCIONISTA
  if tpl_reception_id is not null then
    -- Recepcionista pode consultar dados
    if tool_query_contact is not null then
      insert into public.agent_template_tools(template_id, tool_id, required, overrides)
      values (tpl_reception_id, tool_query_contact, false, '{}'::jsonb)
      on conflict (template_id, tool_id) do nothing;
    end if;
    
    -- Recepcionista pode atualizar dados básicos
    if tool_update_contact is not null then
      insert into public.agent_template_tools(template_id, tool_id, required, overrides)
      values (tpl_reception_id, tool_update_contact, false, '{}'::jsonb)
      on conflict (template_id, tool_id) do nothing;
    end if;
    
    -- Recepcionista pode adicionar tags
    if tool_add_tag is not null then
      insert into public.agent_template_tools(template_id, tool_id, required, overrides)
      values (tpl_reception_id, tool_add_tag, false, '{}'::jsonb)
      on conflict (template_id, tool_id) do nothing;
    end if;
  end if;
  
end $$;
