-- 014_fix_agents_nullable_columns.sql
-- Garantir que colunas opcionais em agents permitam NULL

-- aggregation_window_sec deve permitir NULL (já era assim, mas garantindo)
ALTER TABLE public.agents 
  ALTER COLUMN aggregation_window_sec DROP NOT NULL;

-- max_batch_messages deve permitir NULL
ALTER TABLE public.agents 
  ALTER COLUMN max_batch_messages DROP NOT NULL;

-- reply_if_idle_sec deve permitir NULL
ALTER TABLE public.agents 
  ALTER COLUMN reply_if_idle_sec DROP NOT NULL;

-- media_config deve permitir NULL e remover default
ALTER TABLE public.agents 
  ALTER COLUMN media_config DROP NOT NULL,
  ALTER COLUMN media_config DROP DEFAULT;

-- tools_policy deve permitir NULL e remover default
ALTER TABLE public.agents 
  ALTER COLUMN tools_policy DROP NOT NULL,
  ALTER COLUMN tools_policy DROP DEFAULT;

-- model_params deve remover default (já permite NULL)
ALTER TABLE public.agents 
  ALTER COLUMN model_params DROP DEFAULT;

-- updated_at deve permitir NULL
ALTER TABLE public.agents 
  ALTER COLUMN updated_at DROP NOT NULL,
  ALTER COLUMN updated_at DROP DEFAULT;

-- Verificar constraints
DO $$ 
BEGIN
  RAISE NOTICE 'Colunas opcionais configuradas para permitir NULL e defaults removidos';
END $$;
