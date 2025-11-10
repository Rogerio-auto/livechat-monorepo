-- Reseta o recipient para poder reprocessar
-- Substitua os IDs conforme necessário

-- 1. Limpa deliveries existentes (se houver)
DELETE FROM campaign_deliveries 
WHERE campaign_id = '8214a8e9-9244-4e52-886e-1ca4bf894914';

-- 2. Reseta o recipient para reprocessar
UPDATE campaign_recipients 
SET last_step_sent = NULL, 
    last_sent_at = NULL
WHERE campaign_id = '8214a8e9-9244-4e52-886e-1ca4bf894914';

-- 3. Coloca campanha em RUNNING de novo (caso esteja COMPLETED)
UPDATE campaigns 
SET status = 'RUNNING' 
WHERE id = '8214a8e9-9244-4e52-886e-1ca4bf894914';

-- 4. Verifica estado atual
SELECT 
  'recipients' as tipo,
  id,
  phone,
  last_step_sent,
  last_sent_at
FROM campaign_recipients 
WHERE campaign_id = '8214a8e9-9244-4e52-886e-1ca4bf894914'

UNION ALL

SELECT 
  'deliveries' as tipo,
  id::text,
  status,
  queued_at::text,
  sent_at::text
FROM campaign_deliveries 
WHERE campaign_id = '8214a8e9-9244-4e52-886e-1ca4bf894914'

UNION ALL

SELECT 
  'campaign' as tipo,
  id::text,
  status,
  NULL,
  NULL
FROM campaigns 
WHERE id = '8214a8e9-9244-4e52-886e-1ca4bf894914';
