-- 017_update_tools_hide_customer_id.sql
-- Estratégia B: Remover customer_id do schema (parameters) das ferramentas de update de customers
-- Mantemos handler_config.required_columns com 'customer_id' para o executor injetar via contexto
-- Execução idempotente e segura

BEGIN;

-- Lista de chaves das ferramentas a ajustar
WITH tool_keys AS (
  SELECT unnest(ARRAY[
    'update_customer_name',
    'update_customer_email',
    'update_customer_address',
    'update_customer_city',
    'update_customer_state',
    'update_customer_zip_code',
    'update_customer_birth_date'
  ]) AS key
)
UPDATE tools_catalog t
SET schema = (
  -- Remover propriedade customer_id
  jsonb_set(
    -- Primeiro: atualiza 'properties'
    jsonb_set(
      t.schema,
      '{properties}',
      COALESCE(t.schema->'properties', '{}'::jsonb) - 'customer_id',
      true
    ),
    -- Depois: atualiza 'required' removendo 'customer_id'
    '{required}',
    COALESCE(
      (
        SELECT jsonb_agg(elem)
        FROM (
          SELECT to_jsonb(e) AS elem
          FROM jsonb_array_elements_text(COALESCE(t.schema->'required', '[]'::jsonb)) AS e
          WHERE e <> 'customer_id'
        ) s
      ),
      '[]'::jsonb
    ),
    true
  )
),
updated_at = NOW()
FROM tool_keys k
WHERE t.key = k.key;

COMMIT;
