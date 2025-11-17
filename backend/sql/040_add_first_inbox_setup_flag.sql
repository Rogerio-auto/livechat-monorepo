-- ========================================
-- 040_add_first_inbox_setup_flag.sql
-- Adiciona flag para controlar wizard de primeira inbox
-- ========================================

-- Adicionar coluna first_inbox_setup (primeiro setup de inbox concluído)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS first_inbox_setup BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN companies.first_inbox_setup IS 'Indica se a primeira inbox foi configurada (esconde wizard de primeira inbox)';

-- Criar índice para queries que filtram por esta flag
CREATE INDEX IF NOT EXISTS idx_companies_first_inbox_setup 
ON companies(first_inbox_setup) 
WHERE first_inbox_setup = FALSE;

-- Atualizar empresas existentes que já têm inboxes configuradas
-- Marcar first_inbox_setup = TRUE para empresas que já têm pelo menos 1 inbox
UPDATE companies c
SET first_inbox_setup = TRUE
WHERE EXISTS (
  SELECT 1 FROM inboxes i 
  WHERE i.company_id = c.id
)
AND (first_inbox_setup IS NULL OR first_inbox_setup = FALSE);

-- Log
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM companies
  WHERE first_inbox_setup = TRUE;
  
  RAISE NOTICE 'Migration 040 completed: Added first_inbox_setup flag';
  RAISE NOTICE '  - Updated % existing companies with inboxes', updated_count;
END $$;
