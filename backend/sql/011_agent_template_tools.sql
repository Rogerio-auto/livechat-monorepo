-- Migration 011: Agent Template Tools
-- Tabela para associar ferramentas padrão aos templates de agentes

-- Drop se existir (para desenvolvimento)
DROP TABLE IF EXISTS public.agent_template_tools CASCADE;

-- Criar tabela agent_template_tools
CREATE TABLE public.agent_template_tools (
  template_id uuid NOT NULL REFERENCES public.agent_templates(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.tools_catalog(id) ON DELETE CASCADE,
  required boolean DEFAULT false,
  overrides jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  PRIMARY KEY (template_id, tool_id)
);

-- Comentários
COMMENT ON TABLE public.agent_template_tools IS 'Ferramentas padrão associadas aos templates de agentes';
COMMENT ON COLUMN public.agent_template_tools.template_id IS 'ID do template de agente';
COMMENT ON COLUMN public.agent_template_tools.tool_id IS 'ID da ferramenta do catálogo';
COMMENT ON COLUMN public.agent_template_tools.required IS 'Se true, a ferramenta será automaticamente habilitada em novos agentes criados com este template';
COMMENT ON COLUMN public.agent_template_tools.overrides IS 'Overrides específicos para este template (ex: default values, allowed_columns customizados)';

-- Índices
CREATE INDEX agent_template_tools_template_id_idx ON public.agent_template_tools(template_id);
CREATE INDEX agent_template_tools_tool_id_idx ON public.agent_template_tools(tool_id);

-- Trigger para updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.agent_template_tools
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.agent_template_tools ENABLE ROW LEVEL SECURITY;

-- Policy: Admin pode tudo
CREATE POLICY agent_template_tools_admin_all
  ON public.agent_template_tools
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
      AND u.role = 'ADMIN'
    )
  );

-- Policy: Usuários podem ler tools de templates da sua empresa
CREATE POLICY agent_template_tools_company_read
  ON public.agent_template_tools
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_templates t
      INNER JOIN public.users u ON u.company_id = t.company_id
      WHERE t.id = agent_template_tools.template_id
      AND u.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.agent_templates t
      WHERE t.id = agent_template_tools.template_id
      AND t.company_id IS NULL -- Templates globais
    )
  );
