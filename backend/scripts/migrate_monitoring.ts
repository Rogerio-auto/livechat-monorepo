import 'dotenv/config';
import { db } from '../src/pg.ts';

const migrationSql = `
-- 0. Ajustes nas tabelas existentes
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- 1. Tabela de Métricas de Agentes
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  company_id UUID NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hour', 'day', 'week', 'month')),
  total_conversations INT DEFAULT 0,
  active_conversations INT DEFAULT 0,
  completed_conversations INT DEFAULT 0,
  abandoned_conversations INT DEFAULT 0,
  escalated_conversations INT DEFAULT 0,
  avg_response_time_ms INT DEFAULT 0,
  min_response_time_ms INT,
  max_response_time_ms INT,
  avg_conversation_length INT DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  escalation_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_satisfaction DECIMAL(3,2),
  positive_feedback_count INT DEFAULT 0,
  negative_feedback_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  error_rate DECIMAL(5,2) DEFAULT 0.00,
  timeout_count INT DEFAULT 0,
  api_error_count INT DEFAULT 0,
  validation_error_count INT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  prompt_tokens BIGINT DEFAULT 0,
  completion_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0.0000,
  avg_cost_per_conversation DECIMAL(10,4) DEFAULT 0.0000,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_agent_metrics_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_metrics_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT unique_agent_period UNIQUE (agent_id, period_start, period_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_period ON agent_metrics(agent_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_company ON agent_metrics(company_id);

-- 2. Tabela de Erros de Agentes
CREATE TABLE IF NOT EXISTS agent_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  company_id UUID NOT NULL,
  chat_id UUID,
  message_id UUID,
  error_type VARCHAR(50) NOT NULL,
  error_code VARCHAR(50),
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  user_message TEXT,
  agent_context JSONB,
  request_payload JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by UUID,
  resolution_notes TEXT,
  severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  is_recurring BOOLEAN DEFAULT FALSE,
  occurrence_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_agent_errors_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_errors_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_errors_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_errors_agent ON agent_errors(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_errors_company ON agent_errors(company_id);

-- 3. Tabela de Feedback de Conversas
CREATE TABLE IF NOT EXISTS conversation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  message_id UUID,
  agent_id UUID NOT NULL,
  company_id UUID NOT NULL,
  user_id UUID,
  feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'neutral')),
  satisfaction_score INT CHECK (satisfaction_score BETWEEN 1 AND 5),
  feedback_category VARCHAR(50),
  feedback_text TEXT,
  requires_review BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_conversation_feedback_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_feedback_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_feedback_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- 4. Tabela de Base de Conhecimento dos Agentes
CREATE TABLE IF NOT EXISTS agent_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  company_id UUID NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  url TEXT,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'ERROR', 'ARCHIVED')),
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  error_message TEXT,
  total_chunks INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  embedding_model VARCHAR(100),
  description TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT fk_agent_knowledge_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_knowledge_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 5. Tabela de Configurações do Agente
CREATE TABLE IF NOT EXISTS agent_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  company_id UUID NOT NULL,
  version INT NOT NULL,
  config JSONB NOT NULL,
  system_prompt TEXT,
  model VARCHAR(100),
  temperature DECIMAL(3,2),
  max_tokens INT,
  changed_by UUID,
  change_notes TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_agent_config_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_config_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT unique_agent_version UNIQUE (agent_id, version)
);

-- 6. Tabela de Testes do Playground
CREATE TABLE IF NOT EXISTS agent_playground_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  company_id UUID NOT NULL,
  tester_id UUID NOT NULL,
  test_message TEXT NOT NULL,
  agent_response TEXT,
  response_time_ms INT,
  config_snapshot JSONB,
  is_satisfactory BOOLEAN,
  feedback_notes TEXT,
  tokens_used INT,
  cost DECIMAL(10,6),
  error_occurred BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_playground_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_playground_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Functions e Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agent_metrics_updated_at ON agent_metrics;
CREATE TRIGGER update_agent_metrics_updated_at BEFORE UPDATE ON agent_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_errors_updated_at ON agent_errors;
CREATE TRIGGER update_agent_errors_updated_at BEFORE UPDATE ON agent_errors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_knowledge_updated_at ON agent_knowledge_base;
CREATE TRIGGER update_agent_knowledge_updated_at BEFORE UPDATE ON agent_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function para calcular métricas agregadas
CREATE OR REPLACE FUNCTION calculate_agent_metrics(
  p_agent_id UUID,
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_period_type VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
  v_company_id UUID;
BEGIN
  -- Buscar company_id do agente
  SELECT company_id INTO v_company_id FROM agents WHERE id = p_agent_id;
  
  -- Inserir ou atualizar métricas
  INSERT INTO agent_metrics (
    agent_id, 
    company_id,
    period_start, 
    period_end, 
    period_type,
    total_conversations,
    active_conversations,
    error_count,
    total_tokens,
    total_cost
  )
  VALUES (
    p_agent_id,
    v_company_id,
    p_period_start,
    p_period_end,
    p_period_type,
    (SELECT COUNT(*) FROM chats WHERE ai_agent_id = p_agent_id AND created_at BETWEEN p_period_start AND p_period_end),
    (SELECT COUNT(*) FROM chats WHERE ai_agent_id = p_agent_id AND status IN ('OPEN', 'ASSIGNED', 'AI') AND created_at BETWEEN p_period_start AND p_period_end),
    (SELECT COUNT(*) FROM agent_errors WHERE agent_id = p_agent_id AND created_at BETWEEN p_period_start AND p_period_end),
    0, 0
  )
  ON CONFLICT (agent_id, period_start, period_type)
  DO UPDATE SET
    total_conversations = EXCLUDED.total_conversations,
    active_conversations = EXCLUDED.active_conversations,
    error_count = EXCLUDED.error_count,
    updated_at = NOW()
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql;
`;

async function migrate() {
  try {
    await db.none(migrationSql);
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
