-- Script para executar a migration 023_add_lid_columns.sql manualmente
-- Execute este script no banco de dados para adicionar as colunas lid

\echo '=========================================='
\echo 'Migration 023: Adicionar colunas lid'
\echo '=========================================='
\echo ''

-- Verificar se as colunas já existem
\echo 'Verificando se as colunas já existem...'
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'leads')
  AND column_name = 'lid';

\echo ''
\echo 'Executando migration...'

-- Executar a migration
\i backend/sql/023_add_lid_columns.sql

\echo ''
\echo 'Migration concluída!'
\echo ''
\echo 'Verificando resultado...'

-- Verificar resultado
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'leads')
  AND column_name = 'lid';

\echo ''
\echo 'Verificando índices criados...'

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'leads')
  AND indexname LIKE '%lid%';

\echo ''
\echo '=========================================='
\echo 'Migration 023 concluída com sucesso!'
\echo '=========================================='
