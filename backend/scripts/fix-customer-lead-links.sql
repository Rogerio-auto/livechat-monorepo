-- Script para vincular customers aos seus leads correspondentes
-- Executa UPDATE apenas onde lead_id está NULL e existe um lead com o mesmo phone

UPDATE customers c
SET lead_id = l.id,
    updated_at = now()
FROM leads l
WHERE c.lead_id IS NULL
  AND c.company_id = l.company_id
  AND c.phone = l.phone;

-- Verificar quantos registros foram atualizados
SELECT 
  COUNT(*) FILTER (WHERE lead_id IS NOT NULL) as customers_with_lead,
  COUNT(*) FILTER (WHERE lead_id IS NULL) as customers_without_lead,
  COUNT(*) as total_customers
FROM customers;
