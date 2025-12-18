import 'dotenv/config';
import { db } from '../src/pg.ts';

const migrationSql = `
-- =====================================================
-- MIGRATION: Agent Templates Management System
-- Descrição: Tabelas para gerenciar templates de agentes
-- Data: 2025-12-18
-- =====================================================

-- 0. Backup e Limpeza se necessário
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agent_templates' AND column_name = 'prompt_template') THEN
        ALTER TABLE agent_templates RENAME TO agent_templates_old;
    END IF;
END $$;

-- 1. Tabela de Templates de Agentes
CREATE TABLE IF NOT EXISTS agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'CUSTOMER_SERVICE', 'SALES', 'SUPPORT', 'CUSTOM'
  
  -- Configuração do template
  system_prompt TEXT NOT NULL,
  model_config JSONB NOT NULL DEFAULT '{"provider": "openai", "model": "gpt-4o", "temperature": 0.7, "max_tokens": 2048}'::jsonb,
  
  -- Comportamento
  behavior_config JSONB DEFAULT '{}'::jsonb, -- Regras, limites, personalidade
  knowledge_base_config JSONB DEFAULT '{}'::jsonb, -- URLs, documentos padrão
  
  -- Metadata
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE, -- Se pode ser usado por todas as empresas
  company_id UUID, -- NULL = template global da plataforma
  
  -- Uso e popularidade
  usage_count INT DEFAULT 0,
  rating DECIMAL(3,2), -- Avaliação média 1.00-5.00
  
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_agent_templates_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_templates_creator FOREIGN KEY (created_by) 
    REFERENCES users(id) ON DELETE SET NULL
);

-- Migrar dados se a tabela antiga existir
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_templates_old') THEN
        INSERT INTO agent_templates (id, name, description, category, system_prompt, model_config, company_id, created_at, updated_at)
        SELECT 
            id, 
            name, 
            description, 
            category, 
            COALESCE(prompt_template, ''), 
            jsonb_build_object(
                'provider', 'openai',
                'model', COALESCE(default_model, 'gpt-4o'),
                'temperature', 0.7,
                'max_tokens', 2048
            ),
            company_id,
            created_at,
            updated_at
        FROM agent_templates_old
        ON CONFLICT (id) DO NOTHING;
        
        -- DROP TABLE agent_templates_old; -- Opcional: manter por segurança por enquanto
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_templates_category ON agent_templates(category) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_templates_company ON agent_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_public ON agent_templates(is_public) WHERE is_public = TRUE;


-- 2. Tabela de Testes de Templates
CREATE TABLE IF NOT EXISTS agent_template_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  tester_id UUID NOT NULL, -- Admin que fez o teste
  
  -- Cenário de teste
  test_name VARCHAR(255) NOT NULL,
  test_scenario TEXT NOT NULL, -- Descrição do cenário
  test_messages JSONB NOT NULL, -- Array de mensagens de teste
  
  -- Resultados
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'PASSED', 'FAILED')),
  agent_responses JSONB, -- Array de respostas do agente
  execution_time_ms INT,
  
  -- Validações
  validations JSONB, -- Regras de validação aplicadas
  validation_results JSONB, -- Resultados de cada validação
  
  -- Métricas
  total_tokens INT DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  tools_called JSONB, -- Ferramentas que foram chamadas
  
  -- Avaliação manual
  manual_score INT CHECK (manual_score BETWEEN 1 AND 5),
  manual_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_template_tests_template FOREIGN KEY (template_id) 
    REFERENCES agent_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_template_tests_tester FOREIGN KEY (tester_id) 
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_tests_template ON agent_template_tests(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_tests_status ON agent_template_tests(status);


-- 3. Tabela de Cenários de Teste (reutilizáveis)
CREATE TABLE IF NOT EXISTS agent_test_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'GREETING', 'FAQ', 'COMPLAINT', 'COMPLEX_QUERY'
  
  -- Mensagens do cenário
  messages JSONB NOT NULL, -- Array:  [{ role: 'user', content:  '...' }, ...]
  expected_behavior TEXT, -- Descrição do comportamento esperado
  
  -- Validações automáticas
  validation_rules JSONB, -- Regras para validar resposta
  
  -- Metadata
  difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('EASY', 'MEDIUM', 'HARD', 'EXPERT')),
  is_public BOOLEAN DEFAULT FALSE,
  company_id UUID,
  
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_test_scenarios_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_scenarios_category ON agent_test_scenarios(category);
CREATE INDEX IF NOT EXISTS idx_test_scenarios_company ON agent_test_scenarios(company_id);


-- 4. Tabela de Validações de Template
CREATE TABLE IF NOT EXISTS agent_template_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  validation_type VARCHAR(50) NOT NULL, -- 'PROMPT_QUALITY', 'TOOL_COMPATIBILITY', 'PERFORMANCE', 'SAFETY'
  
  -- Resultado da validação
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASSED', 'FAILED', 'WARNING')),
  score DECIMAL(5,2), -- 0-100
  
  -- Detalhes
  issues JSONB, -- Array de problemas encontrados
  suggestions JSONB, -- Array de sugestões de melhoria
  details JSONB, -- Informações detalhadas
  
  validated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_template_validations_template FOREIGN KEY (template_id) 
    REFERENCES agent_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_validations_template ON agent_template_validations(template_id, validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_validations_status ON agent_template_validations(status);


-- 5. Tabela de Versões de Templates (histórico)
CREATE TABLE IF NOT EXISTS agent_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  version INT NOT NULL,
  
  -- Snapshot completo da configuração
  config JSONB NOT NULL, -- Todo o template naquela versão
  
  -- Mudanças
  changes_summary TEXT,
  changed_fields TEXT[],
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_template_versions_template FOREIGN KEY (template_id) 
    REFERENCES agent_templates(id) ON DELETE CASCADE,
  CONSTRAINT unique_template_version UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON agent_template_versions(template_id, version DESC);


-- 6. Expandir tabela de tools_catalog com campos adicionais (ALTER)
ALTER TABLE tools_catalog ADD COLUMN IF NOT EXISTS icon VARCHAR(50);
ALTER TABLE tools_catalog ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE tools_catalog ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN DEFAULT FALSE;
ALTER TABLE tools_catalog ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0;
ALTER TABLE tools_catalog ADD COLUMN IF NOT EXISTS avg_execution_time_ms INT;
ALTER TABLE tools_catalog ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,2);


-- 7. Tabela de Testes de Ferramentas
CREATE TABLE IF NOT EXISTS tool_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL,
  tester_id UUID NOT NULL,
  
  -- Teste
  test_name VARCHAR(255) NOT NULL,
  test_input JSONB NOT NULL, -- Parâmetros de entrada
  expected_output JSONB, -- Saída esperada (opcional)
  
  -- Resultado
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'ERROR')),
  actual_output JSONB,
  error_message TEXT,
  execution_time_ms INT,
  
  -- Validação
  validation_passed BOOLEAN,
  validation_details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_tool_tests_tool FOREIGN KEY (tool_id) 
    REFERENCES tools_catalog(id) ON DELETE CASCADE,
  CONSTRAINT fk_tool_tests_tester FOREIGN KEY (tester_id) 
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_tests_tool ON tool_tests(tool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_tests_status ON tool_tests(status);


-- =====================================================
-- FUNCTIONS E TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agent_templates_updated_at ON agent_templates;
CREATE TRIGGER update_agent_templates_updated_at BEFORE UPDATE ON agent_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_scenarios_updated_at ON agent_test_scenarios;
CREATE TRIGGER update_test_scenarios_updated_at BEFORE UPDATE ON agent_test_scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Function para criar versão ao atualizar template
CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Só criar versão se campos importantes mudaram
  IF (OLD.system_prompt IS DISTINCT FROM NEW.system_prompt) OR
     (OLD.model_config IS DISTINCT FROM NEW.model_config) OR
     (OLD.behavior_config IS DISTINCT FROM NEW.behavior_config) THEN
    
    INSERT INTO agent_template_versions (
      template_id, 
      version, 
      config, 
      created_by
    )
    VALUES (
      OLD.id,
      OLD.version,
      jsonb_build_object(
        'system_prompt', OLD.system_prompt,
        'model_config', OLD.model_config,
        'behavior_config', OLD.behavior_config,
        'knowledge_base_config', OLD.knowledge_base_config
      ),
      NEW.created_by
    );
    
    -- Incrementar versão
    NEW.version = OLD.version + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_template_version_trigger ON agent_templates;
CREATE TRIGGER create_template_version_trigger BEFORE UPDATE ON agent_templates
  FOR EACH ROW EXECUTE FUNCTION create_template_version();


-- Function para atualizar estatísticas de ferramentas
CREATE OR REPLACE FUNCTION update_tool_statistics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUCCESS' AND NEW.finished_at IS NOT NULL THEN
    UPDATE tools_catalog
    SET 
      usage_count = usage_count + 1,
      avg_execution_time_ms = (
        COALESCE(avg_execution_time_ms, 0) * usage_count + 
        EXTRACT(EPOCH FROM (NEW. finished_at - NEW.started_at)) * 1000
      ) / (usage_count + 1),
      success_rate = (
        SELECT (COUNT(*) FILTER (WHERE status = 'SUCCESS'):: DECIMAL / COUNT(*)) * 100
        FROM tool_invocations
        WHERE tool_id = NEW.tool_id
      )
    WHERE id = NEW.tool_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tool_statistics_trigger ON tool_invocations;
CREATE TRIGGER update_tool_statistics_trigger AFTER INSERT OR UPDATE ON tool_invocations
  FOR EACH ROW EXECUTE FUNCTION update_tool_statistics();


-- =====================================================
-- DADOS INICIAIS (SEED)
-- =====================================================

-- Templates padrão da plataforma
INSERT INTO agent_templates (name, description, category, system_prompt, model_config, is_public, company_id, created_by)
VALUES 
(
  'Atendimento ao Cliente - Padrão',
  'Template genérico para atendimento ao cliente com tom amigável e profissional',
  'CUSTOMER_SERVICE',
  'Você é um assistente virtual de atendimento ao cliente. Seja sempre educado, profissional e prestativo. Responda de forma clara e objetiva.',
  '{"provider": "openai", "model": "gpt-4o", "temperature": 0.7, "max_tokens": 1024, "top_p": 1, "frequency_penalty": 0, "presence_penalty": 0}':: jsonb,
  TRUE,
  NULL,
  NULL
),
(
  'Vendas - Consultivo',
  'Template focado em vendas consultivas, identificando necessidades do cliente',
  'SALES',
  'Você é um consultor de vendas especializado. Seu objetivo é entender as necessidades do cliente e recomendar as melhores soluções. Faça perguntas inteligentes e ouça atentamente antes de sugerir produtos.',
  '{"provider": "openai", "model": "gpt-4o", "temperature": 0.8, "max_tokens": 1536, "top_p": 1, "frequency_penalty": 0, "presence_penalty": 0.3}'::jsonb,
  TRUE,
  NULL,
  NULL
),
(
  'Suporte Técnico - Especializado',
  'Template para suporte técnico com foco em resolução de problemas',
  'SUPPORT',
  'Você é um especialista em suporte técnico. Ajude o usuário a resolver problemas de forma metódica: identifique o problema, faça diagnóstico e forneça soluções passo a passo. Use linguagem técnica quando apropriado, mas explique termos complexos.',
  '{"provider": "openai", "model": "gpt-4o", "temperature": 0.5, "max_tokens": 2048, "top_p": 1, "frequency_penalty": 0, "presence_penalty": 0}'::jsonb,
  TRUE,
  NULL,
  NULL
)
ON CONFLICT DO NOTHING;


-- Cenários de teste padrão
INSERT INTO agent_test_scenarios (name, description, category, messages, expected_behavior, validation_rules, difficulty_level, is_public)
VALUES
(
  'Saudação Inicial',
  'Teste de como o agente responde a uma saudação simples',
  'GREETING',
  '[{"role": "user", "content": "Olá, bom dia!"}]'::jsonb,
  'O agente deve responder de forma amigável, se apresentar e perguntar como pode ajudar',
  '{"must_contain": ["olá", "oi", "bom dia"], "max_length": 200, "sentiment": "positive"}'::jsonb,
  'EASY',
  TRUE
),
(
  'Pergunta sobre Produto',
  'Cliente pergunta sobre características de um produto',
  'FAQ',
  '[{"role": "user", "content": "Quais são as características do produto X?"}]'::jsonb,
  'O agente deve fornecer informações detalhadas sobre o produto ou indicar que vai consultar',
  '{"must_use_tools": ["search_products"], "min_length": 100}'::jsonb,
  'MEDIUM',
  TRUE
),
(
  'Reclamação de Cliente',
  'Cliente insatisfeito com o serviço',
  'COMPLAINT',
  '[{"role": "user", "content": "Estou muito insatisfeito com o atendimento! Meu pedido não chegou e ninguém me ajuda!"}]'::jsonb,
  'O agente deve ser empático, pedir desculpas e oferecer solução imediata',
  '{"must_contain": ["desculpa", "lamento", "vamos resolver"], "sentiment": "empathetic", "must_offer_solution": true}'::jsonb,
  'HARD',
  TRUE
),
(
  'Consulta Complexa Multi-etapas',
  'Cliente com dúvida que requer múltiplas informações',
  'COMPLEX_QUERY',
  '[{"role": "user", "content": "Quero comprar um notebook para trabalhar com design gráfico, qual vocês recomendam e qual a forma de pagamento?"}, {"role": "assistant", "content": "..."}, {"role": "user", "content": "E vocês fazem entrega para todo o Brasil?"}]'::jsonb,
  'O agente deve manter contexto da conversa e responder todas as perguntas de forma organizada',
  '{"must_maintain_context": true, "must_use_tools": ["search_products", "check_shipping"], "min_turns": 3}'::jsonb,
  'EXPERT',
  TRUE
)
ON CONFLICT DO NOTHING;


-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View: Templates com contagem de ferramentas
CREATE OR REPLACE VIEW agent_templates_with_tools AS
SELECT 
  t.*,
  COUNT(att.tool_id) as tools_count,
  ARRAY_AGG(tc.name) FILTER (WHERE tc.name IS NOT NULL) as tool_names
FROM agent_templates t
LEFT JOIN agent_template_tools att ON t.id = att.template_id
LEFT JOIN tools_catalog tc ON att.tool_id = tc.id
GROUP BY t.id;


-- View: Estatísticas de ferramentas
CREATE OR REPLACE VIEW tools_statistics AS
SELECT 
  tc.id,
  tc.name,
  tc.category,
  tc.usage_count,
  tc.avg_execution_time_ms,
  tc.success_rate,
  COUNT(DISTINCT at.agent_id) as agents_using,
  COUNT(DISTINCT att.template_id) as templates_using,
  COUNT(ti.id) FILTER (WHERE ti.created_at >= NOW() - INTERVAL '7 days') as invocations_last_7_days,
  COUNT(ti.id) FILTER (WHERE ti.status = 'FAILED' AND ti.created_at >= NOW() - INTERVAL '7 days') as failures_last_7_days
FROM tools_catalog tc
LEFT JOIN agent_tools at ON tc.id = at.tool_id
LEFT JOIN agent_template_tools att ON tc.id = att.tool_id
LEFT JOIN tool_invocations ti ON tc.id = ti.tool_id
GROUP BY tc.id, tc.name, tc.category, tc.usage_count, tc.avg_execution_time_ms, tc.success_rate;
`;

async function migrate() {
  console.log('Starting migration: Agent Templates Management System...');
  try {
    await db.none(migrationSql);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
