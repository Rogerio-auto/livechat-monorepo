-- seed_knowledge_base_7sion.sql
-- FAQs de exemplo para a empresa 7 Sion
-- Execute após ter criado a tabela knowledge_base
-- IMPORTANTE: Substitua os UUIDs abaixo pelos corretos do seu banco:
-- SELECT id FROM companies WHERE name ILIKE '%sion%';
-- SELECT user_id FROM users WHERE email = 'rogerio@gmail.com';

-- ===== CATEGORIA: PRODUTO =====

INSERT INTO knowledge_base (
  company_id, title, content, category, tags, keywords, priority, status, visible_to_agents, created_by
) VALUES
(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'O que é a plataforma 7 Sion?',
  'A 7 Sion é uma plataforma completa de atendimento ao cliente com IA. Oferecemos agentes virtuais inteligentes que podem atender seus clientes 24/7 via WhatsApp, chat web e outros canais. Nossa IA aprende com suas conversas e melhora continuamente o atendimento.',
  'Produto',
  ARRAY['plataforma', 'ia', 'atendimento', 'whatsapp'],
  ARRAY['7sion', 'sion', 'plataforma', 'ia', 'inteligencia artificial', 'atendimento'],
  10,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),
(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Quais canais de atendimento são suportados?',
  'Atualmente suportamos WhatsApp (via Meta Business API e WAHA), Chat Web embarcado em seu site, e em breve teremos integração com Instagram, Telegram e Facebook Messenger. Todos os canais são gerenciados em uma única plataforma unificada.',
  'Produto',
  ARRAY['canais', 'whatsapp', 'chat', 'integracao'],
  ARRAY['whatsapp', 'chat', 'canais', 'instagram', 'telegram', 'messenger'],
  9,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),
(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Como funciona a IA dos agentes?',
  'Nossos agentes de IA utilizam modelos avançados da OpenAI (GPT-4) treinados especificamente para seu negócio. A IA pode: responder perguntas frequentes, qualificar leads, agendar reuniões, buscar informações em sua base de conhecimento, e transferir para humanos quando necessário. Quanto mais interage, mais aprende sobre seu negócio.',
  'Produto',
  ARRAY['ia', 'agentes', 'gpt', 'openai', 'machine-learning'],
  ARRAY['inteligencia artificial', 'agente', 'bot', 'chatbot', 'gpt', 'openai', 'aprendizado'],
  10,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),

-- ===== CATEGORIA: PREÇOS =====

(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Quais são os planos disponíveis?',
  'Oferecemos 3 planos principais:

Starter (R$ 297/mês): 1 agente de IA, 1.000 conversas/mês, 2 canais (WhatsApp + Chat Web), Suporte por email.

Professional (R$ 697/mês): 5 agentes de IA, 5.000 conversas/mês, Canais ilimitados, Base de conhecimento, Suporte prioritário.

Enterprise (sob consulta): Agentes ilimitados, Conversas ilimitadas, API dedicada, Customizações, Suporte 24/7 com SLA.

Todos os planos incluem 14 dias de teste grátis.',
  'Preços',
  ARRAY['planos', 'precos', 'valores', 'assinatura'],
  ARRAY['plano', 'preco', 'valor', 'quanto custa', 'mensalidade', 'assinatura'],
  9,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),
(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Tem período de teste gratuito?',
  'Sim! Oferecemos 14 dias de teste totalmente grátis em qualquer plano, sem necessidade de cartão de crédito. Durante o período de teste você tem acesso completo a todas as funcionalidades do plano escolhido. Após o teste, você decide se quer continuar.',
  'Preços',
  ARRAY['teste', 'trial', 'gratis', 'gratuito'],
  ARRAY['teste gratis', 'trial', 'periodo de teste', 'free trial', 'demonstracao'],
  8,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),

-- ===== CATEGORIA: SUPORTE =====

(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Como faço para integrar o WhatsApp?',
  'A integração do WhatsApp é simples e pode ser feita de 2 formas:

Opção 1 - Meta Business API (recomendado): 1. Acesse Configurações > Inboxes, 2. Clique em Conectar WhatsApp, 3. Faça login com sua conta Meta Business, 4. Selecione o número de telefone, 5. Pronto! Seu WhatsApp está conectado.

Opção 2 - WAHA (via QR Code): 1. Configure um servidor WAHA, 2. Em Configurações > Inboxes adicione via WAHA, 3. Escaneie o QR Code com seu WhatsApp, 4. Conexão estabelecida.

Recomendamos a Meta Business API para empresas com alto volume.',
  'Suporte',
  ARRAY['whatsapp', 'integracao', 'conectar', 'setup'],
  ARRAY['integrar whatsapp', 'conectar whatsapp', 'whatsapp business', 'meta business'],
  10,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),
(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Como criar um agente de IA personalizado?',
  'Para criar um agente personalizado: 1. Vá em Configurações > IA, 2. Clique em Novo Agente, 3. Escolha um template (Vendas, Suporte, Atendimento) ou crie do zero, 4. Personalize o prompt com informações do seu negócio, 5. Configure as ferramentas que o agente pode usar, 6. Defina em quais canais ele vai atuar, 7. Teste o agente antes de ativar, 8. Ative e monitore o desempenho. Dica: Comece com um template e vá ajustando conforme necessário.',
  'Suporte',
  ARRAY['agente', 'criar', 'personalizar', 'configurar'],
  ARRAY['criar agente', 'novo agente', 'configurar ia', 'personalizar bot'],
  8,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),
(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'O agente pode transferir para atendimento humano?',
  'Sim! Os agentes de IA são configurados para identificar quando é necessário escalação humana. Isso acontece automaticamente em casos como: Cliente solicita explicitamente falar com humano, Pergunta fora do escopo do agente, Situação complexa que requer decisão humana, Reclamação ou problema crítico, Venda de alto valor. Quando isso ocorre o agente transfere a conversa para a fila de atendimento humano mantendo todo o histórico e contexto da conversa.',
  'Suporte',
  ARRAY['transferencia', 'humano', 'escalacao', 'handoff'],
  ARRAY['transferir', 'passar para humano', 'atendente humano', 'escalar', 'handoff'],
  9,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),

-- ===== CATEGORIA: SEGURANÇA =====

(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Meus dados estão seguros na plataforma?',
  'Absolutamente! Levamos segurança muito a sério: Criptografia - Todos os dados são criptografados em trânsito (SSL/TLS) e em repouso (AES-256). Conformidade LGPD - 100% em conformidade com a Lei Geral de Proteção de Dados. Backup - Backups automáticos diários com retenção de 30 dias. Isolamento - Dados de cada empresa são isolados e nunca compartilhados. Auditoria - Log completo de todas as ações para rastreabilidade. Certificações - ISO 27001 e SOC 2 Type II em processo. Seus dados nunca são usados para treinar modelos de IA.',
  'Segurança',
  ARRAY['seguranca', 'privacidade', 'lgpd', 'dados'],
  ARRAY['seguro', 'protecao', 'privacidade', 'lgpd', 'criptografia', 'dados'],
  7,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),

-- ===== CATEGORIA: CASOS DE USO =====

(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Posso usar para qualificação de leads?',
  'Sim! A qualificação de leads é um dos casos de uso mais comuns. Nosso agente de IA pode: Capturar informações (Nome, email, telefone, empresa, cargo), Identificar necessidades (Fazer perguntas para entender o interesse), Pontuar leads (Classificar como quente, morno ou frio), Agendar reuniões (Integrar com seu calendário e marcar demos), Nutrir leads (Enviar materiais relevantes e fazer follow-up), CRM (Integrar com Pipedrive, RD Station, HubSpot). Taxa média de qualificação: 85% vs 45% manual.',
  'Casos de Uso',
  ARRAY['leads', 'vendas', 'qualificacao', 'crm'],
  ARRAY['lead', 'qualificar', 'venda', 'prospecção', 'comercial'],
  8,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),
(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Funciona para e-commerce?',
  'Perfeitamente! Nossos clientes de e-commerce usam para: Atendimento pré-venda (Tirar dúvidas sobre produtos, tamanhos, prazos), Rastreio de pedidos (Consultar status de entrega automaticamente), Recomendações (Sugerir produtos baseado no perfil do cliente), Carrinho abandonado (Reengajar clientes que não finalizaram compra), Pós-venda (Coletar feedback e resolver problemas), Upsell/Cross-sell (Oferecer produtos complementares). Resultado médio: +35% conversão, -60% tempo de resposta.',
  'Casos de Uso',
  ARRAY['ecommerce', 'loja', 'vendas', 'produtos'],
  ARRAY['e-commerce', 'loja virtual', 'venda online', 'produto'],
  7,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),

-- ===== CATEGORIA: TÉCNICO =====

(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Preciso saber programar para usar?',
  'Não! A plataforma foi desenhada para ser usada sem conhecimento técnico: Interface visual (Tudo por drag-and-drop e cliques), Templates prontos (Agentes pré-configurados por segmento), Assistente de criação (Wizard guiado passo a passo), Integração simples (Conectores nativos, sem código). Para casos avançados oferecemos: API REST completa, Webhooks para eventos, SDK em JavaScript/Python, Documentação técnica detalhada. 90% dos clientes usam sem escrever uma linha de código.',
  'Técnico',
  ARRAY['programacao', 'codigo', 'tecnico', 'api'],
  ARRAY['programar', 'codigo', 'desenvolvedor', 'tecnico', 'api'],
  6,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
),

-- ===== CATEGORIA: MIGRAÇÃO =====

(
  'd56a5396-22df-486a-8fea-a82138e1f614'::uuid,
  'Posso migrar de outra plataforma?',
  'Sim! Oferecemos migração assistida. Dados suportados: Histórico de conversas, Base de contatos, Agentes e configurações, Integrações existentes. Processo: 1. Análise da plataforma atual, 2. Exportação dos dados, 3. Importação na 7 Sion, 4. Testes de validação, 5. Cutover planejado. Prazo: 3-7 dias úteis. Custo: Gratuito para planos Professional e Enterprise. Plataformas que já migramos: Zendesk, Intercom, Manychat, Chatfuel, Landbot.',
  'Migração',
  ARRAY['migracao', 'importar', 'transferir', 'mudar'],
  ARRAY['migrar', 'mudar plataforma', 'importar dados', 'transferir'],
  6,
  'ACTIVE',
  true,
  '721ea6a1-6963-4873-9d6e-e5a6774aed9e'::uuid
);

-- Verificar inserção
SELECT 
  category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'ACTIVE') as ativos
FROM knowledge_base 
WHERE company_id = 'd56a5396-22df-486a-8fea-a82138e1f614'
GROUP BY category
ORDER BY category;
