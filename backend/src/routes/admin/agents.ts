// backend/src/routes/admin/agents.ts

import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { runAgentReply } from '../../services/agents-runtime.service.js';
import { db } from '../../pg.js';

const router = Router();

// Middleware para verificar se é ADMIN
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    // O role está em req.profile.role, não em req.user.role
    const role = String(req.profile?.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: "Erro ao verificar permissões" });
  }
};

// Mensagens de uma conversa específica (Admin)
// Definida ANTES de /agents/:agentId para evitar conflito de rota
router.get('/agents/chats/:chatId/messages', requireAuth, requireAdmin, async (req, res) => {
  const { chatId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select(`
        id,
        content,
        is_from_customer,
        sender_id,
        sender_name,
        created_at,
        type,
        media_url
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar agentes de uma empresa
router.get('/companies/:companyId/agents', requireAuth, requireAdmin, async (req, res) => {
  const { companyId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter detalhes de um agente
router.get('/agents/:agentId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar configuração do agente
router.patch('/agents/:agentId', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const updates = req.body;
  
  try {
    const { data, error } = await supabaseAdmin
      .from('agents')
      .update(updates)
      .eq('id', agentId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter métricas de um agente
router.get('/agents/:agentId/metrics', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const { period = 'day' } = req.query;
  
  try {
    // 1. Total de conversas (Real-time from chats table)
    const { count: totalConversations } = await supabaseAdmin
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('ai_agent_id', agentId);

    // 2. Conversas ativas
    const { count: activeConversations } = await supabaseAdmin
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('ai_agent_id', agentId)
      .eq('status', 'OPEN');

    // 3. Conversas resolvidas (para taxa de sucesso)
    const { count: resolvedConversations } = await supabaseAdmin
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('ai_agent_id', agentId)
      .eq('status', 'RESOLVED');

    // 4. Buscar métricas agregadas da tabela agent_metrics para dados históricos
    const { data: historicalMetrics } = await supabaseAdmin
      .from('agent_metrics')
      .select('*')
      .eq('agent_id', agentId)
      .eq('period_type', period)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    const successRate = totalConversations ? (resolvedConversations || 0) / totalConversations * 100 : 0;

    // Retornar mix de dados real-time e históricos
    res.json({
      agent_id: agentId,
      period,
      total_conversations: totalConversations || 0,
      active_conversations: activeConversations || 0,
      avg_response_time_ms: historicalMetrics?.avg_response_time_ms || 12500,
      success_rate: Math.round(successRate) || historicalMetrics?.success_rate || 0,
      escalation_rate: historicalMetrics?.escalation_rate || 0,
      avg_satisfaction: historicalMetrics?.avg_satisfaction || 4.5,
      error_rate: historicalMetrics?.error_rate || 0.5,
      timeout_count: historicalMetrics?.timeout_count || 0,
      api_errors: historicalMetrics?.api_error_count || 0,
      total_tokens: historicalMetrics?.total_tokens || 0,
      total_cost: historicalMetrics?.total_cost || 0,
      avg_cost_per_conversation: historicalMetrics?.avg_cost_per_conversation || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Histórico de conversas
router.get('/agents/:agentId/conversations', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('chats')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        customer:customers(id, name, phone)
      `)
      .eq('ai_agent_id', agentId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const formatted = (data || []).map((chat: any) => ({
      id: chat.id,
      customer_name: chat.customer?.name || 'Desconhecido',
      last_message: '', // Precisaria de outra query ou join complexo
      status: chat.status === 'OPEN' ? 'active' : 'resolved',
      timestamp: chat.updated_at || chat.created_at,
      unread: false
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Playground: Testar agente
router.post('/agents/:agentId/test', requireAuth, requireAdmin, async (req: any, res: any) => {
  const { agentId } = req.params;
  const { message, context = [] } = req.body;

  try {
    // Buscar o agente primeiro para descobrir o company_id real dele
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('company_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ error: "Agente não encontrado" });
    }

    const companyId = agent.company_id;

    // Usamos um chatId temporário para o playground para não poluir o histórico real
    // Mas precisa ser um UUID válido para não quebrar as queries do banco
    const userId = req.profile?.id || req.user?.id || 'anonymous';
    
    // Gerar um UUID determinístico para o playground baseado no agentId e userId
    // para manter o histórico durante a sessão de teste
    const seed = `playground-${agentId}-${userId}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    const playgroundChatId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    
    // Garantir que existe um registro de chat para o playground para evitar erros de FK
    // e permitir que as ferramentas que buscam dados do chat funcionem
    try {
      const { data: firstCustomer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('company_id', companyId)
        .limit(1)
        .maybeSingle();

      if (firstCustomer) {
        await supabaseAdmin.from('chats').upsert({
          id: playgroundChatId,
          company_id: companyId,
          customer_id: firstCustomer.id,
          ai_agent_id: agentId,
          status: 'OPEN',
          kind: 'DIRECT',
          metadata: { is_playground: true }
        }, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn("[Playground] Erro ao criar chat de teste:", e);
    }

    const result = await runAgentReply({
      companyId,
      agentId,
      userMessage: message,
      chatId: playgroundChatId,
      isPlayground: true,
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Playground Error]:", error);
    res.status(500).json({ error: error.message || "Erro ao processar teste do agente" });
  }
});

// Obter logs de erro de um agente
router.get('/agents/:agentId/errors', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  try {
    const logs = await db.any(
      `SELECT l.*, t.name as tool_name 
       FROM public.agent_tool_logs l
       LEFT JOIN public.tools_catalog t ON l.tool_id = t.id
       WHERE l.agent_id = $1 AND l.error IS NOT NULL
       ORDER BY l.executed_at DESC
       LIMIT 20`,
      [agentId]
    );
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter analytics de um agente
router.get('/agents/:agentId/analytics', requireAuth, requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  
  try {
    // 1. Resumo Geral
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE error IS NULL) as success_count,
        COUNT(DISTINCT chat_id) as total_chats
      FROM public.agent_tool_logs
      WHERE agent_id = $1
    `;
    const summary = await db.one(summaryQuery, [agentId]);

    // 2. Uso por Dia (últimos 7 dias)
    const usageByDayQuery = `
      SELECT 
        to_char(executed_at, 'Dy') as name,
        COUNT(*) as value
      FROM public.agent_tool_logs
      WHERE agent_id = $1 AND executed_at > NOW() - INTERVAL '7 days'
      GROUP BY to_char(executed_at, 'Dy'), date_trunc('day', executed_at)
      ORDER BY date_trunc('day', executed_at)
    `;
    const usageByDay = await db.any(usageByDayQuery, [agentId]);

    // 3. Uso de Ferramentas
    const toolUsageQuery = `
      SELECT 
        COALESCE(t.name, l.action) as name,
        COUNT(*) as value
      FROM public.agent_tool_logs l
      LEFT JOIN public.tools_catalog t ON l.tool_id = t.id
      WHERE l.agent_id = $1
      GROUP BY COALESCE(t.name, l.action)
      ORDER BY value DESC
      LIMIT 5
    `;
    const toolUsage = await db.any(toolUsageQuery, [agentId]);

    // 4. Performance por Horário
    const performanceQuery = `
      SELECT 
        to_char(executed_at, 'HH24:00') as time,
        COUNT(*) FILTER (WHERE error IS NULL) as success,
        COUNT(*) FILTER (WHERE error IS NOT NULL) as error
      FROM public.agent_tool_logs
      WHERE agent_id = $1 AND executed_at > NOW() - INTERVAL '24 hours'
      GROUP BY to_char(executed_at, 'HH24:00')
      ORDER BY time
    `;
    const performance = await db.any(performanceQuery, [agentId]);

    const total = parseInt(summary.total_executions) || 0;
    const success = parseInt(summary.success_count) || 0;

    res.json({
      summary: {
        totalExecutions: total,
        successRate: total > 0 ? ((success / total) * 100).toFixed(1) : 0,
        avgResponseTime: '1.2s', // Mock por enquanto
        totalTokens: '---'
      },
      usageByDay: usageByDay.length > 0 ? usageByDay : [
        { name: 'Seg', value: 0 }, { name: 'Ter', value: 0 }, { name: 'Qua', value: 0 },
        { name: 'Qui', value: 0 }, { name: 'Sex', value: 0 }, { name: 'Sab', value: 0 }, { name: 'Dom', value: 0 }
      ],
      toolUsage: toolUsage.length > 0 ? toolUsage : [{ name: 'Nenhuma', value: 0 }],
      performance: performance.length > 0 ? performance : [
        { time: '00:00', success: 0, error: 0 }, { time: '12:00', success: 0, error: 0 }
      ]
    });
  } catch (error: any) {
    console.error('Erro ao buscar analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
