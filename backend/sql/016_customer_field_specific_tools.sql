-- =====================================================
-- FERRAMENTAS ESPECÍFICAS POR CAMPO - CUSTOMERS/LEADS
-- =====================================================
-- Cria ferramentas individuais para atualizar cada campo
-- de customers com sincronização automática para leads
-- =====================================================

-- 1. UPDATE_CUSTOMER_NAME - Atualiza apenas nome
-- Sincroniza: customers.name → leads.name
INSERT INTO tools_catalog (
  key,
  name,
  category,
  description,
  schema,
  handler_type,
  handler_config,
  is_active,
  created_at,
  updated_at
) VALUES (
  'update_customer_name',
  'update_customer_name',
  'CUSTOM',
  'Atualiza o nome do cliente. Sincroniza automaticamente com a tabela leads.',
  '{
    "type": "object",
    "required": ["customer_id", "name"],
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "UUID do cliente (obter do contexto da conversa)"
      },
      "name": {
        "type": "string",
        "description": "Nome completo do cliente"
      }
    }
  }'::jsonb,
  'INTERNAL_DB',
  '{
    "table": "customers",
    "action": "update",
    "allowed_columns": {
      "read": ["id", "name", "phone", "email", "company_id"],
      "write": ["name"]
    },
    "restricted_columns": ["phone", "msisdn", "company_id", "created_at"],
    "required_columns": ["customer_id"],
    "sync_to_leads": true,
    "lead_mapping": {
      "name": "name"
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema,
  handler_type = EXCLUDED.handler_type,
  handler_config = EXCLUDED.handler_config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. UPDATE_CUSTOMER_EMAIL - Atualiza apenas email
-- Sincroniza: customers.email → leads.email
INSERT INTO tools_catalog (
  key,
  name,
  category,
  description,
  schema,
  handler_type,
  handler_config,
  is_active,
  created_at,
  updated_at
) VALUES (
  'update_customer_email',
  'update_customer_email',
  'CUSTOM',
  'Atualiza o email do cliente. Sincroniza automaticamente com a tabela leads.',
  '{
    "type": "object",
    "required": ["customer_id", "email"],
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "UUID do cliente (obter do contexto da conversa)"
      },
      "email": {
        "type": "string",
        "format": "email",
        "description": "Endereço de email do cliente"
      }
    }
  }'::jsonb,
  'INTERNAL_DB',
  '{
    "table": "customers",
    "action": "update",
    "allowed_columns": {
      "read": ["id", "name", "phone", "email", "company_id"],
      "write": ["email"]
    },
    "restricted_columns": ["phone", "msisdn", "company_id", "created_at"],
    "required_columns": ["customer_id"],
    "sync_to_leads": true,
    "lead_mapping": {
      "email": "email"
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema,
  handler_type = EXCLUDED.handler_type,
  handler_config = EXCLUDED.handler_config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. UPDATE_CUSTOMER_ADDRESS - Atualiza endereço/rua
-- Sincroniza: customers.address → leads.street
INSERT INTO tools_catalog (
  key,
  name,
  category,
  description,
  schema,
  handler_type,
  handler_config,
  is_active,
  created_at,
  updated_at
) VALUES (
  'update_customer_address',
  'update_customer_address',
  'CUSTOM',
  'Atualiza o endereço (rua/avenida) do cliente. Sincroniza com a coluna street na tabela leads.',
  '{
    "type": "object",
    "required": ["customer_id", "address"],
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "UUID do cliente (obter do contexto da conversa)"
      },
      "address": {
        "type": "string",
        "description": "Endereço completo (rua, número, complemento)"
      }
    }
  }'::jsonb,
  'INTERNAL_DB',
  '{
    "table": "customers",
    "action": "update",
    "allowed_columns": {
      "read": ["id", "name", "phone", "address", "company_id"],
      "write": ["address"]
    },
    "restricted_columns": ["phone", "msisdn", "company_id", "created_at"],
    "required_columns": ["customer_id"],
    "sync_to_leads": true,
    "lead_mapping": {
      "address": "street"
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema,
  handler_type = EXCLUDED.handler_type,
  handler_config = EXCLUDED.handler_config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 4. UPDATE_CUSTOMER_CITY - Atualiza cidade
-- Sincroniza: customers.city → leads.city
INSERT INTO tools_catalog (
  key,
  name,
  category,
  description,
  schema,
  handler_type,
  handler_config,
  is_active,
  created_at,
  updated_at
) VALUES (
  'update_customer_city',
  'update_customer_city',
  'CUSTOM',
  'Atualiza a cidade do cliente. Sincroniza automaticamente com a tabela leads.',
  '{
    "type": "object",
    "required": ["customer_id", "city"],
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "UUID do cliente (obter do contexto da conversa)"
      },
      "city": {
        "type": "string",
        "description": "Nome da cidade"
      }
    }
  }'::jsonb,
  'INTERNAL_DB',
  '{
    "table": "customers",
    "action": "update",
    "allowed_columns": {
      "read": ["id", "name", "phone", "city", "state", "company_id"],
      "write": ["city"]
    },
    "restricted_columns": ["phone", "msisdn", "company_id", "created_at"],
    "required_columns": ["customer_id"],
    "sync_to_leads": true,
    "lead_mapping": {
      "city": "city"
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema,
  handler_type = EXCLUDED.handler_type,
  handler_config = EXCLUDED.handler_config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 5. UPDATE_CUSTOMER_STATE - Atualiza estado/UF
-- Sincroniza: customers.state → leads.state
INSERT INTO tools_catalog (
  key,
  name,
  category,
  description,
  schema,
  handler_type,
  handler_config,
  is_active,
  created_at,
  updated_at
) VALUES (
  'update_customer_state',
  'update_customer_state',
  'CUSTOM',
  'Atualiza o estado (UF) do cliente. Sincroniza automaticamente com a tabela leads.',
  '{
    "type": "object",
    "required": ["customer_id", "state"],
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "UUID do cliente (obter do contexto da conversa)"
      },
      "state": {
        "type": "string",
        "description": "Sigla do estado (UF) - Ex: SP, RJ, MG",
        "pattern": "^[A-Z]{2}$"
      }
    }
  }'::jsonb,
  'INTERNAL_DB',
  '{
    "table": "customers",
    "action": "update",
    "allowed_columns": {
      "read": ["id", "name", "phone", "city", "state", "company_id"],
      "write": ["state"]
    },
    "restricted_columns": ["phone", "msisdn", "company_id", "created_at"],
    "required_columns": ["customer_id"],
    "sync_to_leads": true,
    "lead_mapping": {
      "state": "state"
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema,
  handler_type = EXCLUDED.handler_type,
  handler_config = EXCLUDED.handler_config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 6. UPDATE_CUSTOMER_ZIP_CODE - Atualiza CEP
-- Sincroniza: customers.zip_code → leads.cep
INSERT INTO tools_catalog (
  key,
  name,
  category,
  description,
  schema,
  handler_type,
  handler_config,
  is_active,
  created_at,
  updated_at
) VALUES (
  'update_customer_zip_code',
  'update_customer_zip_code',
  'CUSTOM',
  'Atualiza o CEP do cliente. Sincroniza com a coluna cep na tabela leads.',
  '{
    "type": "object",
    "required": ["customer_id", "zip_code"],
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "UUID do cliente (obter do contexto da conversa)"
      },
      "zip_code": {
        "type": "string",
        "description": "CEP no formato 00000-000 ou 00000000",
        "pattern": "^\\d{5}-?\\d{3}$"
      }
    }
  }'::jsonb,
  'INTERNAL_DB',
  '{
    "table": "customers",
    "action": "update",
    "allowed_columns": {
      "read": ["id", "name", "phone", "zip_code", "company_id"],
      "write": ["zip_code"]
    },
    "restricted_columns": ["phone", "msisdn", "company_id", "created_at"],
    "required_columns": ["customer_id"],
    "sync_to_leads": true,
    "lead_mapping": {
      "zip_code": "cep"
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema,
  handler_type = EXCLUDED.handler_type,
  handler_config = EXCLUDED.handler_config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 7. UPDATE_CUSTOMER_BIRTH_DATE - Atualiza data de nascimento
-- Sincroniza: customers.birth_date → leads.birthDate
INSERT INTO tools_catalog (
  key,
  name,
  category,
  description,
  schema,
  handler_type,
  handler_config,
  is_active,
  created_at,
  updated_at
) VALUES (
  'update_customer_birth_date',
  'update_customer_birth_date',
  'CUSTOM',
  'Atualiza a data de nascimento do cliente. Sincroniza com a coluna birthDate na tabela leads.',
  '{
    "type": "object",
    "required": ["customer_id", "birth_date"],
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "UUID do cliente (obter do contexto da conversa)"
      },
      "birth_date": {
        "type": "string",
        "format": "date",
        "description": "Data de nascimento no formato YYYY-MM-DD ou DD/MM/YYYY"
      }
    }
  }'::jsonb,
  'INTERNAL_DB',
  '{
    "table": "customers",
    "action": "update",
    "allowed_columns": {
      "read": ["id", "name", "phone", "birth_date", "company_id"],
      "write": ["birth_date"]
    },
    "restricted_columns": ["phone", "msisdn", "company_id", "created_at"],
    "required_columns": ["customer_id"],
    "sync_to_leads": true,
    "lead_mapping": {
      "birth_date": "birthDate"
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema,
  handler_type = EXCLUDED.handler_type,
  handler_config = EXCLUDED.handler_config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Listar todas as ferramentas criadas
SELECT 
  id,
  name,
  description,
  handler_type,
  is_active,
  handler_config->>'table' as table_name,
  handler_config->'allowed_columns'->>'write' as writable_columns,
  handler_config->'lead_mapping' as lead_sync_mapping
FROM tools_catalog
WHERE name IN (
  'update_customer_name',
  'update_customer_email',
  'update_customer_address',
  'update_customer_city',
  'update_customer_state',
  'update_customer_zip_code',
  'update_customer_birth_date'
)
ORDER BY name;

-- Contar ferramentas ativas
SELECT 
  COUNT(*) as total_tools,
  COUNT(*) FILTER (WHERE is_active = true) as active_tools,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_tools
FROM tools_catalog
WHERE name LIKE 'update_customer_%';

