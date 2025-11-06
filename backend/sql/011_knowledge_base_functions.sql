-- 011_knowledge_base_functions.sql
-- Funções auxiliares para Knowledge Base

-- Função para busca semântica com full-text search
CREATE OR REPLACE FUNCTION search_knowledge_base(
  p_company_id UUID,
  p_query TEXT,
  p_category TEXT DEFAULT NULL,
  p_max_results INTEGER DEFAULT 5
)
RETURNS SETOF knowledge_base
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT kb.*
  FROM knowledge_base kb
  WHERE kb.company_id = p_company_id
    AND kb.status = 'ACTIVE'
    AND kb.visible_to_agents = true
    AND (p_category IS NULL OR kb.category = p_category)
    AND (
      to_tsvector('portuguese', kb.title || ' ' || kb.content) @@ plainto_tsquery('portuguese', p_query)
      OR kb.tags && ARRAY[p_query]::TEXT[]
      OR kb.keywords && ARRAY[p_query]::TEXT[]
    )
  ORDER BY 
    kb.priority DESC,
    ts_rank(to_tsvector('portuguese', kb.title || ' ' || kb.content), plainto_tsquery('portuguese', p_query)) DESC,
    kb.helpful_count DESC,
    kb.usage_count DESC
  LIMIT p_max_results;
END;
$$;

-- Função para incrementar contador de uso
CREATE OR REPLACE FUNCTION increment_kb_usage(
  p_company_id UUID,
  p_kb_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE knowledge_base
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE company_id = p_company_id
    AND id = p_kb_id;
END;
$$;

-- Função para incrementar feedback (helpful/unhelpful)
CREATE OR REPLACE FUNCTION increment_kb_feedback(
  p_company_id UUID,
  p_kb_id UUID,
  p_field TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_field = 'helpful_count' THEN
    UPDATE knowledge_base
    SET helpful_count = helpful_count + 1
    WHERE company_id = p_company_id AND id = p_kb_id;
  ELSIF p_field = 'unhelpful_count' THEN
    UPDATE knowledge_base
    SET unhelpful_count = unhelpful_count + 1
    WHERE company_id = p_company_id AND id = p_kb_id;
  END IF;
END;
$$;

-- Função para obter estatísticas da knowledge base
CREATE OR REPLACE FUNCTION get_kb_stats(
  p_company_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE status = 'ACTIVE'),
    'draft', COUNT(*) FILTER (WHERE status = 'DRAFT'),
    'archived', COUNT(*) FILTER (WHERE status = 'ARCHIVED'),
    'total_usage', COALESCE(SUM(usage_count), 0),
    'avg_helpful_rate', CASE 
      WHEN SUM(helpful_count + unhelpful_count) > 0 
      THEN ROUND(SUM(helpful_count)::NUMERIC / SUM(helpful_count + unhelpful_count), 2)
      ELSE 0 
    END
  )
  INTO v_result
  FROM knowledge_base
  WHERE company_id = p_company_id;
  
  RETURN v_result;
END;
$$;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_kb_timestamp ON knowledge_base;
CREATE TRIGGER trigger_update_kb_timestamp
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_updated_at();

-- Índice GIN para busca full-text otimizada
CREATE INDEX IF NOT EXISTS idx_kb_fulltext 
  ON knowledge_base 
  USING gin(to_tsvector('portuguese', title || ' ' || content));

COMMENT ON FUNCTION search_knowledge_base IS 'Busca semântica na knowledge base com ranking por relevância';
COMMENT ON FUNCTION increment_kb_usage IS 'Incrementa contador de uso e atualiza last_used_at';
COMMENT ON FUNCTION increment_kb_feedback IS 'Incrementa contador de feedback (helpful ou unhelpful)';
COMMENT ON FUNCTION get_kb_stats IS 'Retorna estatísticas agregadas da knowledge base';
