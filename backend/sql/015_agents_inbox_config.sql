-- 015_agents_inbox_config.sql
-- Adicionar configurações de inboxes e grupos ao agente

-- Adicionar campo para ignorar mensagens de grupos (padrão TRUE)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS ignore_group_messages BOOLEAN NOT NULL DEFAULT TRUE;

-- Adicionar campo para inboxes habilitadas (array de UUIDs, vazio = todas)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS enabled_inbox_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Criar índice GIN para busca eficiente no array de inboxes
CREATE INDEX IF NOT EXISTS agents_enabled_inboxes_idx 
  ON public.agents USING gin(enabled_inbox_ids);

-- Comentários para documentação
COMMENT ON COLUMN public.agents.ignore_group_messages IS 
  'Se TRUE, agente não responde em chats de grupo. Se FALSE, responde normalmente em grupos.';

COMMENT ON COLUMN public.agents.enabled_inbox_ids IS 
  'Array de UUIDs das inboxes onde o agente está habilitado. Se vazio, agente responde em todas as inboxes.';
