// backend/src/services/openai.usage.service.ts

import { supabaseAdmin } from "../lib/supabase.ts";
import { stripe } from "../lib/stripe.ts";

// Preços por modelo (USD por 1K tokens) - Atualizado em 2025
const MODEL_PRICING = {
  "gpt-4o": { input: 0.0025, output: 0.010 },
  "gpt-4o-mini": { input:  0.00015, output: 0.0006 },
  "gpt-4-turbo": { input:  0.01, output: 0.03 },
  "gpt-4":  { input: 0.03, output: 0.06 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "o1":  { input: 0.015, output: 0.060 },
  "o1-mini": { input: 0.003, output: 0.012 },
  "o3-mini": { input: 0.0011, output: 0.0044 },
  "whisper-1": { per_minute: 0.006 },
  "tts-1": { per_char: 0.000015 },
  "tts-1-hd": { per_char: 0.00003 },
  "dall-e-3": { per_image: 0.04 },
  "text-embedding-3-large": { input: 0.00013, output: 0 },
  "text-embedding-3-small": { input: 0.00002, output: 0 },
} as const;

// ==================== TYPES ====================

type UsageLogInput = {
  companyId: string;
  integrationId?:  string;
  agentId?: string;
  chatId?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  requestType?:  'chat' | 'transcription' | 'vision' | 'embedding' | 'tts';
  requestMetadata?: Record<string, any>;
};

// ==================== LOGGING ====================

/**
 * Registra uso da OpenAI em tempo real
 * IMPORTANTE: Chamar após cada requisição à OpenAI
 */
export async function logOpenAIUsage(input: UsageLogInput): Promise<void> {
  try {
    const pricing = MODEL_PRICING[input.model as keyof typeof MODEL_PRICING] || 
      { input: 0.001, output: 0.002 }; // Fallback para modelos não listados

    // Calcular custo estimado
    let estimatedCost = 0;
    if ('per_minute' in pricing) {
      estimatedCost = (pricing as any).per_minute * (input.promptTokens / 60); // Aproximação
    } else if ('per_char' in pricing) {
      estimatedCost = (pricing as any).per_char * input.completionTokens;
    } else if ('per_image' in pricing) {
      estimatedCost = (pricing as any).per_image;
    } else {
      estimatedCost = 
        (input.promptTokens / 1000) * ((pricing as any).input || 0) +
        (input.completionTokens / 1000) * ((pricing as any).output || 0);
    }

    // Inserir log
    const { error } = await supabaseAdmin.from("openai_usage_logs").insert({
      company_id: input.companyId,
      integration_id: input.integrationId || null,
      agent_id: input.agentId || null,
      chat_id: input.chatId || null,
      model:  input.model,
      prompt_tokens: input.promptTokens,
      completion_tokens: input.completionTokens,
      total_tokens: input.promptTokens + input.completionTokens,
      estimated_cost: estimatedCost,
      request_type: input.requestType || 'chat',
      request_metadata: input.requestMetadata || null,
    });

    if (error) {
      console.error('[Usage] Failed to log usage:', error);
      // Não throw - não queremos quebrar o fluxo principal
    }
  } catch (error) {
    console.error('[Usage] Error logging usage:', error);
  }
}

// ==================== CONSOLIDATION ====================

/**
 * Consolida custos mensais para uma empresa
 * Deve ser executado por job agendado (diário ou semanal)
 */
export async function consolidateMonthlyBill(
  companyId: string,
  month: Date
): Promise<void> {
  try {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

    // Buscar todos os logs do mês
    const { data: logs, error } = await supabaseAdmin
      .from("openai_usage_logs")
      .select("*")
      .eq("company_id", companyId)
      .gte("created_at", startOfMonth.toISOString())
      .lte("created_at", endOfMonth.toISOString());

    if (error) throw error;
    if (! logs || logs.length === 0) {
      console.log(`[Usage] No logs found for company ${companyId} in ${month.toISOString().slice(0, 7)}`);
      return;
    }

    // Calcular totais
    const totalRequests = logs.length;
    const totalTokens = logs.reduce((sum, log) => sum + log.total_tokens, 0);
    const totalCost = logs.reduce((sum, log) => sum + parseFloat(log.estimated_cost || 0), 0);

    // Agregar por modelo
    const usageByModel:  Record<string, any> = {};
    logs.forEach(log => {
      if (! usageByModel[log.model]) {
        usageByModel[log.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      usageByModel[log.model].requests += 1;
      usageByModel[log.model].tokens += log.total_tokens;
      usageByModel[log.model].cost += parseFloat(log.estimated_cost || 0);
    });

    // Agregar por agente
    const usageByAgent: Record<string, any> = {};
    logs.forEach(log => {
      if (!log.agent_id) return;
      if (!usageByAgent[log.agent_id]) {
        usageByAgent[log.agent_id] = { requests: 0, tokens: 0, cost:  0 };
      }
      usageByAgent[log.agent_id].requests += 1;
      usageByAgent[log.agent_id].tokens += log.total_tokens;
      usageByAgent[log.agent_id].cost += parseFloat(log.estimated_cost || 0);
    });

    // Upsert na tabela de faturas
    const { error: upsertError } = await supabaseAdmin
      .from("company_monthly_bills")
      .upsert({
        company_id:  companyId,
        billing_month: startOfMonth.toISOString().split('T')[0],
        total_requests: totalRequests,
        total_tokens: totalTokens,
        total_cost_usd: totalCost.toFixed(2),
        usage_by_model: usageByModel,
        usage_by_agent: usageByAgent,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }, {
        onConflict:  'company_id,billing_month'
      });

    if (upsertError) throw upsertError;

    console.log(`[Usage] ✅ Consolidated bill for company ${companyId}:  $${totalCost.toFixed(2)}`);
  } catch (error) {
    console.error('[Usage] Error consolidating monthly bill:', error);
    throw error;
  }
}

/**
 * Sincroniza dados da OpenAI Usage API (quando disponível)
 */
export async function syncUsageFromOpenAI(
  companyId: string,
  integrationId:  string,
  projectId: string
): Promise<void> {
  try {
    const { getProjectUsage } = await import('./openai.admin.service.ts');
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const today = new Date();

    const usageData = await getProjectUsage(projectId, startOfMonth, today);

    // Atualizar a fatura com dados reais da OpenAI
    const { error } = await supabaseAdmin
      .from("company_monthly_bills")
      .update({
        openai_usage_data: usageData.breakdown,
        total_cost_usd: usageData.totalCost.toFixed(2),
        total_tokens: usageData.totalTokens,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("billing_month", startOfMonth.toISOString().split('T')[0]);

    if (error) throw error;

    // Atualizar última sincronização
    await supabaseAdmin
      .from("integrations_openai")
      .update({ last_usage_sync_at: new Date().toISOString() })
      .eq("id", integrationId);

    console.log(`[Usage] ✅ Synced OpenAI usage for company ${companyId}`);
  } catch (error) {
    console.error('[Usage] Error syncing usage from OpenAI:', error);
    throw error;
  }
}

// ==================== QUERIES ====================

/**
 * Busca logs de uso de uma empresa
 */
export async function getCompanyUsageLogs(
  companyId: string,
  options?:  {
    startDate?: Date;
    endDate?: Date;
    agentId?: string;
    limit?: number;
  }
) {
  let query = supabaseAdmin
    .from("openai_usage_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending:  false });

  if (options?.startDate) {
    query = query.gte("created_at", options.startDate.toISOString());
  }
  if (options?.endDate) {
    query = query.lte("created_at", options.endDate.toISOString());
  }
  if (options?.agentId) {
    query = query.eq("agent_id", options.agentId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Busca faturas mensais de uma empresa
 */
export async function getCompanyMonthlyBills(
  companyId:  string,
  limit: number = 12
) {
  const { data, error } = await supabaseAdmin
    .from("company_monthly_bills")
    .select("*")
    .eq("company_id", companyId)
    .order("billing_month", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Verifica se a empresa tem permissão para usar IA
 * Baseado no status da assinatura e faturas pendentes
 */
export async function checkAIUsagePermission(companyId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // 1. Verificar status da assinatura
    const { data: sub, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("company_id", companyId)
      .single();

    if (subError || !sub) {
      return { allowed: false, reason: "Assinatura não encontrada" };
    }

    if (sub.status === "canceled" || sub.status === "expired") {
      return { allowed: false, reason: `Assinatura ${sub.status}` };
    }

    // 2. Verificar faturas de IA vencidas (past_due)
    const { data: bills, error: billError } = await supabaseAdmin
      .from("company_monthly_bills")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "past_due")
      .limit(1);

    if (billError) throw billError;

    if (bills && bills.length > 0) {
      return { allowed: false, reason: "Fatura de uso de IA pendente de pagamento" };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[Usage] Error checking permission:", error);
    return { allowed: true }; // Em caso de erro no check, permitimos para não travar o bot
  }
}

/**
 * Sincroniza uma fatura pendente com o Stripe
 * Adiciona o custo como um item na próxima fatura do cliente
 */
export async function syncBillToStripe(companyId: string, billingMonth: string): Promise<void> {
  try {
    // 1. Buscar dados da fatura e do cliente Stripe
    const { data: bill, error: billError } = await supabaseAdmin
      .from("company_monthly_bills")
      .select("*, companies(stripe_customer_id)")
      .eq("company_id", companyId)
      .eq("billing_month", billingMonth)
      .single();

    if (billError || !bill) throw new Error("Fatura não encontrada");
    
    const stripeCustomerId = (bill.companies as any)?.stripe_customer_id;
    if (!stripeCustomerId) {
      console.log(`[Usage] Company ${companyId} has no Stripe Customer ID. Skipping sync.`);
      return;
    }

    const costUsd = parseFloat(bill.total_cost_usd);
    if (costUsd <= 0) return;

    // 2. Converter para BRL se necessário
    const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
    const rate = parseFloat(process.env.USD_TO_BRL_RATE || '1.0');
    
    let finalAmount = costUsd;
    let description = `Uso de IA - Período ${billingMonth} (USD ${costUsd.toFixed(2)})`;

    if (currency === 'brl' && rate > 1) {
      finalAmount = costUsd * rate;
      description = `Uso de IA - Período ${billingMonth} (USD ${costUsd.toFixed(2)} @ R$ ${rate.toFixed(2)})`;
    }

    // 3. Criar Invoice Item no Stripe (será cobrado na próxima fatura da assinatura)
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      amount: Math.round(finalAmount * 100), // Stripe usa centavos
      currency: currency,
      description: description,
      metadata: {
        company_id: companyId,
        billing_month: billingMonth,
        type: 'openai_usage',
        cost_usd: costUsd.toFixed(4),
        exchange_rate: rate.toFixed(2)
      }
    });

    // 4. Marcar como 'billed' no banco
    await supabaseAdmin
      .from("company_monthly_bills")
      .update({ status: 'billed', billed_at: new Date().toISOString() })
      .eq("id", bill.id);

    console.log(`[Usage] ✅ Bill for ${companyId} (${billingMonth}) synced to Stripe: $${costUsd}`);
  } catch (error) {
    console.error("[Usage] Error syncing to Stripe:", error);
    throw error;
  }
}
