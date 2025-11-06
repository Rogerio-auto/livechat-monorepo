-- 012_update_query_knowledge_base.sql
-- Atualiza a ferramenta query_knowledge_base com descrição melhorada

UPDATE public.tools_catalog
SET 
  description = 'Busca informações na base de conhecimento da empresa (FAQs, documentação, políticas, procedimentos). Use esta ferramenta SEMPRE que precisar consultar informações sobre produtos, serviços, políticas da empresa ou responder perguntas que possam estar documentadas. A busca utiliza full-text search com ranking inteligente.',
  schema = '{
    "type": "function",
    "function": {
      "name": "query_knowledge_base",
      "description": "Busca informações na base de conhecimento da empresa usando full-text search. Retorna os resultados mais relevantes ordenados por prioridade e relevância. Use esta ferramenta sempre que precisar de informações sobre: produtos, serviços, preços, políticas, procedimentos, casos de uso, suporte técnico, migração ou qualquer informação documentada.",
      "parameters": {
        "type": "object",
        "properties": {
          "query_text": { 
            "type": "string", 
            "description": "Texto da busca. Pode ser uma pergunta completa ou palavras-chave. Exemplos: \"Como funciona a IA?\", \"preços planos\", \"integrar whatsapp\", \"migração de plataforma\"."
          },
          "category": { 
            "type": "string", 
            "description": "Filtro opcional por categoria. Valores possíveis: Produto, Preços, Suporte, Segurança, Casos de Uso, Técnico, Migração. Use quando souber a categoria específica da informação."
          },
          "max_results": { 
            "type": "integer", 
            "description": "Número máximo de resultados (padrão: 5, máximo: 10). Aumente se precisar de mais informações."
          }
        },
        "required": ["query_text"]
      }
    }
  }'::jsonb,
  updated_at = NOW()
WHERE key = 'query_knowledge_base';

-- Verificar atualização
SELECT 
  key,
  name,
  category,
  description,
  handler_type,
  is_active,
  updated_at
FROM public.tools_catalog
WHERE key = 'query_knowledge_base';
