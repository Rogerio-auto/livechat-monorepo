-- Update da ferramenta add_contact_tag para usar a estrutura correta de tags

UPDATE public.tools_catalog
SET 
  name = 'Adicionar Tag ao Cliente/Contato',
  description = 'Adiciona uma tag a um cliente (customer) ou contato. Busca tags existentes na empresa ou cria uma nova se necessário.',
  schema = '{
    "type": "function",
    "function": {
      "name": "add_contact_tag",
      "description": "Adiciona uma tag a um cliente/contato. Pode buscar tags existentes ou criar novas.",
      "parameters": {
        "type": "object",
        "properties": {
          "customer_id": { 
            "type": "string", 
            "description": "ID do cliente/contato (UUID)" 
          },
          "tag_name": { 
            "type": "string", 
            "description": "Nome da tag a ser adicionada (ex: interessado, qualificado, vip, lead-quente). Se não existir, será criada automaticamente." 
          },
          "tag_color": { 
            "type": "string", 
            "description": "Cor hexadecimal da tag (opcional, só usado se criar nova tag). Ex: #FF0000, #00FF00. Padrão: #6B7280" 
          }
        },
        "required": ["customer_id", "tag_name"]
      }
    }
  }'::jsonb,
  handler_type = 'WORKFLOW',
  handler_config = '{
    "workflow_type": "tag_management",
    "steps": [
      {
        "step": "find_or_create_tag",
        "description": "Busca tag existente na empresa ou cria uma nova",
        "query": "SELECT id FROM tags WHERE company_id = $1 AND LOWER(name) = LOWER($2)",
        "if_not_found": {
          "action": "insert",
          "table": "tags",
          "columns": ["name", "color", "company_id"],
          "defaults": { "color": "#6B7280" }
        }
      },
      {
        "step": "assign_tag_to_customer",
        "description": "Associa tag ao cliente na tabela customer_tags",
        "table": "customer_tags",
        "action": "upsert",
        "columns": ["customer_id", "tag_id"],
        "conflict_target": ["customer_id", "tag_id"],
        "on_conflict": "do_nothing"
      }
    ],
    "response_format": "Tag ''{tag_name}'' adicionada ao cliente com sucesso!"
  }'::jsonb,
  updated_at = now()
WHERE key = 'add_contact_tag';

-- Verificar se funcionou
SELECT 
  key, 
  name, 
  handler_type,
  schema->>'type' as schema_type,
  handler_config->'workflow_type' as workflow_type
FROM public.tools_catalog 
WHERE key = 'add_contact_tag';
