-- Tabela agents ATUALIZADA com todas as colunas (incluindo transcription_model e vision_model)

CREATE TABLE IF NOT EXISTS public.agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text NULL,
  status public.agent_status NOT NULL DEFAULT 'ACTIVE'::agent_status,
  integration_openai_id uuid NULL,
  model text NULL,
  model_params jsonb NULL,
  aggregation_enabled boolean NOT NULL DEFAULT true,
  aggregation_window_sec integer NULL DEFAULT 20,
  max_batch_messages integer NULL DEFAULT 20,
  reply_if_idle_sec integer NULL,
  media_config jsonb NULL,
  tools_policy jsonb NULL,
  allow_handoff boolean NOT NULL DEFAULT true,
  ignore_group_messages boolean NOT NULL DEFAULT true,
  enabled_inbox_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  transcription_model text NULL,  -- Modelo de transcrição (ex: whisper-1)
  vision_model text NULL,          -- Modelo de visão (ex: gpt-4-vision-preview, gpt-4o)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NULL,
  CONSTRAINT agents_pkey PRIMARY KEY (id),
  CONSTRAINT agents_integration_openai_id_fkey FOREIGN KEY (integration_openai_id) 
    REFERENCES integrations_openai (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Índices
CREATE INDEX IF NOT EXISTS idx_agents_company ON public.agents USING btree (company_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS agents_enabled_inboxes_idx ON public.agents USING gin (enabled_inbox_ids) TABLESPACE pg_default;

-- Trigger para updated_at
CREATE TRIGGER trg_agents_updated 
  BEFORE UPDATE ON agents 
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Comentários nas novas colunas
COMMENT ON COLUMN public.agents.transcription_model IS 'OpenAI model for audio transcription (e.g., whisper-1)';
COMMENT ON COLUMN public.agents.vision_model IS 'OpenAI model for image analysis (e.g., gpt-4-vision-preview, gpt-4o)';
