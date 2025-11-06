-- 014_fix_upsert_contact_tool.sql
-- Corrige a ferramenta upsert_contact existente para usar a tabela customers (não contacts)
-- ID da ferramenta: eab3415e-3b01-4cb0-ad8a-205d7fc8b6d3

-- Atualizar a ferramenta existente para apontar para customers
UPDATE public.tools_catalog
SET 
  name = 'Criar ou Atualizar Cliente',
  description = 'Cria um novo cliente ou atualiza um cliente existente (nome, telefone). Usa tabela customers e sincroniza automaticamente com leads.',
  handler_config = jsonb_build_object(
    'table', 'customers',
    'action', 'upsert',
    'conflict_target', 'phone',
    'allowed_columns', jsonb_build_object(
      'read', jsonb_build_array('id', 'name', 'phone', 'msisdn', 'avatar', 'created_at', 'updated_at'),
      'write', jsonb_build_array('name', 'phone')
    ),
    'restricted_columns', jsonb_build_array('company_id', 'created_at', 'password', 'password_hash'),
    'required_columns', jsonb_build_array('phone'),
    'sync_to_leads', true
  ),
  schema = jsonb_build_object(
    'type', 'function',
    'function', jsonb_build_object(
      'name', 'upsert_contact',
      'description', 'Cria ou atualiza um cliente na tabela customers. Se o telefone já existe, atualiza; se não, cria novo. Sincroniza automaticamente com a tabela leads.',
      'parameters', jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'phone', jsonb_build_object(
            'type', 'string',
            'description', 'Telefone do cliente (obrigatório, usado como chave única). Formato: 5569XXXXXXXX'
          ),
          'name', jsonb_build_object(
            'type', 'string',
            'description', 'Nome completo do cliente'
          ),
          'tags', jsonb_build_object(
            'type', 'array',
            'items', jsonb_build_object('type', 'string'),
            'description', 'Tags para categorizar o contato (opcional)'
          )
        ),
        'required', jsonb_build_array('phone')
      )
    )
  ),
  updated_at = now()
WHERE key = 'upsert_contact' 
  AND company_id IS NULL;

-- Verificar se a ferramenta foi criada/atualizada
SELECT 
  key,
  name,
  handler_config->>'table' as table_name,
  handler_config->>'action' as action,
  handler_config->>'sync_to_leads' as sync_leads,
  is_active
FROM public.tools_catalog
WHERE key = 'upsert_contact';

-- Verificar se está habilitada para o agente
SELECT 
  at.id,
  at.agent_id,
  tc.key,
  tc.name,
  tc.is_active as tool_active,
  CASE WHEN at.id IS NOT NULL THEN true ELSE false END as enabled_for_agent
FROM tools_catalog tc
LEFT JOIN agent_tools at ON at.tool_id = tc.id AND at.agent_id = '52c55a45-5ef1-45a1-8022-c3d980d6e8e1'
WHERE tc.key IN ('upsert_contact', 'update_contact_data', 'query_contact_data')
  AND tc.company_id IS NULL
ORDER BY tc.key;
