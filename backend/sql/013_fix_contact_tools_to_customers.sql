-- 013_fix_contact_tools_to_customers.sql
-- Corrige as ferramentas de contato para usar a tabela correta: customers (não contacts)
-- E configura colunas permitidas conforme o schema real

-- FERRAMENTA 1: Atualizar query_contact_data para usar customers
UPDATE public.tools_catalog
SET 
  description = 'Consulta informações de um cliente/lead (nome, email, telefone). Busca em customers e leads sincronizados.',
  schema = '{
    "type": "function",
    "function": {
      "name": "query_contact_data",
      "description": "Consulta informações de um cliente existente no sistema (customers + leads).",
      "parameters": {
        "type": "object",
        "properties": {
          "customer_id": { "type": "string", "description": "ID do cliente (customer)" },
          "phone": { "type": "string", "description": "Telefone do cliente (alternativa ao ID)" }
        }
      }
    }
  }'::jsonb,
  handler_config = '{
    "table": "customers",
    "action": "select",
    "allowed_columns": {
      "read": ["id", "name", "phone", "msisdn", "avatar", "company_id", "created_at", "updated_at"]
    },
    "restricted_columns": []
  }'::jsonb
WHERE key = 'query_contact_data';

-- FERRAMENTA 2: Atualizar update_contact_data para usar customers
UPDATE public.tools_catalog
SET 
  description = 'Atualiza informações de um cliente (nome, telefone). Sincroniza automaticamente com a tabela leads se houver relacionamento.',
  schema = '{
    "type": "function",
    "function": {
      "name": "update_contact_data",
      "description": "Atualiza informações de um cliente existente. Atualiza customers e sincroniza com leads relacionado automaticamente.",
      "parameters": {
        "type": "object",
        "properties": {
          "customer_id": { "type": "string", "description": "ID do cliente (customer)" },
          "name": { "type": "string", "description": "Nome completo do cliente" },
          "phone": { "type": "string", "description": "Telefone do cliente" }
        },
        "required": ["customer_id"]
      }
    }
  }'::jsonb,
  handler_config = '{
    "table": "customers",
    "action": "update",
    "allowed_columns": {
      "read": ["id", "name", "phone", "msisdn", "avatar"],
      "write": ["name", "phone"]
    },
    "restricted_columns": ["company_id", "created_at"],
    "required_columns": ["customer_id"],
    "sync_to_leads": true
  }'::jsonb
WHERE key = 'update_contact_data';

-- Verificar as atualizações
SELECT 
  key,
  name,
  handler_config->>'table' as table_name,
  handler_config->>'action' as action,
  handler_config->'allowed_columns' as allowed_cols,
  handler_config->>'sync_to_leads' as sync_leads
FROM public.tools_catalog
WHERE key IN ('query_contact_data', 'update_contact_data');
