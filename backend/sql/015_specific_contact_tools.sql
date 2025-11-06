-- 015_specific_contact_tools.sql
-- Remove a ferramenta genérica upsert_contact e cria ferramentas específicas por campo
-- Isso evita atualizações acidentais e torna as operações mais seguras e precisas

-- 1. DESABILITAR ferramenta upsert_contact (muito genérica e perigosa)
UPDATE public.tools_catalog
SET is_active = false
WHERE key = 'upsert_contact' AND company_id IS NULL;

-- 2. CRIAR ferramenta específica: update_customer_name
INSERT INTO public.tools_catalog (
  key,
  name,
  description,
  handler_type,
  handler_config,
  schema,
  company_id,
  is_active
)
VALUES (
  'update_customer_name',
  'Atualizar Nome do Cliente',
  'Atualiza APENAS o nome de um cliente existente. Sincroniza automaticamente com a tabela leads.',
  'INTERNAL_DB',
  jsonb_build_object(
    'table', 'customers',
    'action', 'update',
    'allowed_columns', jsonb_build_object(
      'read', jsonb_build_array('id', 'name', 'phone'),
      'write', jsonb_build_array('name')
    ),
    'restricted_columns', jsonb_build_array('phone', 'msisdn', 'company_id', 'created_at'),
    'required_columns', jsonb_build_array('customer_id'),
    'sync_to_leads', true
  ),
  jsonb_build_object(
    'type', 'function',
    'function', jsonb_build_object(
      'name', 'update_customer_name',
      'description', 'Atualiza o nome de um cliente. Use o customer_id do contexto da conversa atual.',
      'parameters', jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'customer_id', jsonb_build_object(
            'type', 'string',
            'description', 'ID do cliente (obrigatório)'
          ),
          'name', jsonb_build_object(
            'type', 'string',
            'description', 'Nome completo do cliente'
          )
        ),
        'required', jsonb_build_array('customer_id', 'name')
      )
    )
  ),
  NULL,
  true
)
ON CONFLICT (key, company_id) DO UPDATE SET
  description = EXCLUDED.description,
  handler_config = EXCLUDED.handler_config,
  schema = EXCLUDED.schema,
  is_active = EXCLUDED.is_active;

-- 3. ATUALIZAR update_contact_data para ser mais específica
UPDATE public.tools_catalog
SET 
  name = 'Atualizar Email do Cliente',
  description = 'Atualiza o email de um cliente. Sincroniza com leads.',
  handler_config = jsonb_build_object(
    'table', 'customers',
    'action', 'update',
    'allowed_columns', jsonb_build_object(
      'read', jsonb_build_array('id', 'name', 'email'),
      'write', jsonb_build_array('email')
    ),
    'restricted_columns', jsonb_build_array('phone', 'msisdn', 'company_id', 'created_at'),
    'required_columns', jsonb_build_array('customer_id'),
    'sync_to_leads', true
  ),
  schema = jsonb_build_object(
    'type', 'function',
    'function', jsonb_build_object(
      'name', 'update_customer_email',
      'description', 'Atualiza o email de um cliente.',
      'parameters', jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'customer_id', jsonb_build_object(
            'type', 'string',
            'description', 'ID do cliente'
          ),
          'email', jsonb_build_object(
            'type', 'string',
            'description', 'Email do cliente'
          )
        ),
        'required', jsonb_build_array('customer_id', 'email')
      )
    )
  )
WHERE key = 'update_contact_data' AND company_id IS NULL;

-- Verificar ferramentas de contato
SELECT 
  key,
  name,
  handler_config->>'table' as table_name,
  handler_config->>'action' as action,
  handler_config->'allowed_columns'->'write' as writable_columns,
  handler_config->'restricted_columns' as restricted,
  is_active
FROM public.tools_catalog
WHERE key IN ('upsert_contact', 'update_customer_name', 'update_contact_data', 'query_contact_data')
  AND company_id IS NULL
ORDER BY key;

-- Verificar quais estão habilitadas para o agente
SELECT 
  at.id,
  tc.key,
  tc.name,
  tc.is_active as tool_active,
  CASE WHEN at.id IS NOT NULL THEN true ELSE false END as enabled_for_agent
FROM tools_catalog tc
LEFT JOIN agent_tools at ON at.tool_id = tc.id AND at.agent_id = '52c55a45-5ef1-45a1-8022-c3d980d6e8e1'
WHERE tc.key IN ('upsert_contact', 'update_customer_name', 'update_contact_data', 'query_contact_data')
  AND tc.company_id IS NULL
ORDER BY tc.key;

-- Habilitar a nova ferramenta para o agente
INSERT INTO public.agent_tools (agent_id, tool_id, is_active)
SELECT 
  '52c55a45-5ef1-45a1-8022-c3d980d6e8e1',
  id,
  true
FROM public.tools_catalog
WHERE key = 'update_customer_name'
  AND company_id IS NULL
ON CONFLICT (agent_id, tool_id) DO UPDATE SET is_active = true;
