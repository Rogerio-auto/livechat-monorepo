// src/services/campaigns/validation.ts
import { supabaseAdmin } from "../../lib/supabase.js";
import { isInboxHealthy } from "../meta/health.service.js";
import { countRecipientsWithoutOptIn } from "../customers/opt-in.service.js";

export interface ValidationResult {
  safe: boolean;
  critical_issues: string[];
  warnings: string[];
  stats: {
    recipient_count: number;
    tier_limit: number;
    recipients_without_opt_in: number;
    quality_rating: string;
    tier: string;
    template_status: string;
    template_category?: string;
  };
}

/**
 * Valida se campanha está segura para ativar/enviar
 */
export async function validateCampaignSafety(campaignId: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    safe: true,
    critical_issues: [],
    warnings: [],
    stats: {
      recipient_count: 0,
      tier_limit: 0,
      recipients_without_opt_in: 0,
      quality_rating: "UNKNOWN",
      tier: "UNKNOWN",
      template_status: "UNKNOWN",
    },
  };

  // 1. Buscar campanha com template
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from("campaigns")
    .select(`
      id,
      name,
      inbox_id,
      status,
      daily_limit,
      campaign_steps (
        id,
        template_id,
        message_templates (
          id,
          kind,
          payload
        )
      )
    `)
    .eq("id", campaignId)
    .maybeSingle();

  if (campErr) {
    console.error("[Campaign Validation] ❌ Erro SQL ao buscar campanha:", {
      campaignId,
      error: campErr,
      code: campErr.code,
      message: campErr.message,
      details: campErr.details,
      hint: campErr.hint,
    });
    result.safe = false;
    result.critical_issues.push(`Erro ao buscar campanha: ${campErr.message || campErr.code}`);
    return result;
  }

  if (!campaign) {
    console.error("[Campaign Validation] ❌ Campanha não encontrada:", campaignId);
    result.safe = false;
    result.critical_issues.push("Campanha não encontrada");
    return result;
  }

  console.log("[Campaign Validation] ✅ Campanha encontrada:", {
    id: campaign.id,
    name: campaign.name,
    inbox_id: campaign.inbox_id,
    has_steps: !!campaign.campaign_steps?.length,
    steps_count: campaign.campaign_steps?.length || 0,
  });

  // 2. Contar recipients
  const { count: recipientCount } = await supabaseAdmin
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  result.stats.recipient_count = recipientCount || 0;

  if (result.stats.recipient_count === 0) {
    result.warnings.push("Campanha sem recipients");
  }

  // 3. Verificar health da inbox
  try {
    const health = await isInboxHealthy(campaign.inbox_id);
    result.stats.quality_rating = health.quality_rating;
    result.stats.tier = health.tier;
    result.stats.tier_limit = health.tier_limit;

    if (!health.healthy) {
      result.safe = false;
      result.critical_issues.push(health.reason || "Inbox não saudável");
    }

    if (health.quality_rating === "YELLOW") {
      result.warnings.push("Quality rating YELLOW - envios restritos, monitorar de perto");
    }

    // 4. Verificar tier limit vs recipient count
    if (result.stats.recipient_count > result.stats.tier_limit) {
      result.safe = false;
      result.critical_issues.push(
        `Recipients (${result.stats.recipient_count}) excedem tier limit (${result.stats.tier_limit})`
      );
    }

    // Warning se > 80% do limite
    if (result.stats.recipient_count > result.stats.tier_limit * 0.8) {
      result.warnings.push(
        `Recipients próximos do tier limit (${Math.round((result.stats.recipient_count / result.stats.tier_limit) * 100)}%)`
      );
    }
  } catch (error) {
    console.error("[Campaign Validation] Erro ao verificar health:", error);
    result.warnings.push("Não foi possível verificar health da inbox");
  }

  // 5. Verificar template
  const step = campaign.campaign_steps?.[0];
  const template = step?.message_templates;

  console.log("[Campaign Validation] 📝 Verificando template:", {
    has_steps: !!campaign.campaign_steps?.length,
    steps_count: campaign.campaign_steps?.length || 0,
    has_template: !!template,
    step_id: step?.id,
    template_id: step?.template_id,
  });

  if (!campaign.campaign_steps || campaign.campaign_steps.length === 0) {
    result.safe = false;
    result.critical_issues.push("Campanha sem steps configurados - configure uma mensagem no wizard");
    console.error("[Campaign Validation] ❌ Campanha sem campaign_steps");
    return result;
  }

  if (!template) {
    result.safe = false;
    result.critical_issues.push("Template não encontrado - selecione um template no Step 2 do wizard");
    console.error("[Campaign Validation] ❌ Step existe mas sem template:", {
      step_id: step?.id,
      template_id: step?.template_id,
    });
    return result;
  }

  // Template status é opcional (nem todos os templates têm esse campo)
  result.stats.template_status = "UNKNOWN";
  console.log("[Campaign Validation] ✅ Template encontrado:", {
    template_id: (template as any).id,
    kind: (template as any).kind,
    payload_preview: JSON.stringify((template as any).payload || {}).substring(0, 100),
  });

  // Nota: Validação do status do template Meta foi removida
  // pois o campo meta_template_status não existe na tabela message_templates
  // Templates são validados no momento da criação via API do Meta


  // 6. Verificar opt-in (se template é MARKETING)
  const payload = (template as any).payload as any;
  const templateCategory = payload?.category || (template as any).kind;
  result.stats.template_category = templateCategory;

  const isMarketingTemplate = templateCategory === "MARKETING";

  if (isMarketingTemplate) {
    try {
      const withoutOptIn = await countRecipientsWithoutOptIn(campaignId);
      result.stats.recipients_without_opt_in = withoutOptIn;

      if (withoutOptIn > 0) {
        result.safe = false;
        result.critical_issues.push(
          `${withoutOptIn} recipients sem opt-in para MARKETING (violação LGPD)`
        );
      }
    } catch (error) {
      console.error("[Campaign Validation] Erro ao contar opt-ins:", error);
      result.warnings.push("Não foi possível validar opt-ins (assumindo UNSAFE)");
      result.safe = false;
      result.critical_issues.push("Validação de opt-in falhou - campanha bloqueada por segurança");
    }
  }

  // 7. Verificar daily limit (se configurado)
  if (campaign.daily_limit && campaign.daily_limit > 0) {
    if (result.stats.recipient_count > campaign.daily_limit) {
      result.warnings.push(
        `Recipients (${result.stats.recipient_count}) excedem daily limit configurado (${campaign.daily_limit})`
      );
    }
  }

  return result;
}

/**
 * Verifica se pode enviar mais mensagens hoje (daily limit)
 */
export async function checkDailyLimit(campaignId: string): Promise<{
  allowed: boolean;
  sent_today: number;
  limit: number;
  remaining: number;
}> {
  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("messages_sent_today, daily_limit, last_reset_at")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return { allowed: false, sent_today: 0, limit: 0, remaining: 0 };
  }

  // Reset se último reset foi há mais de 24h
  const lastReset = campaign.last_reset_at ? new Date(campaign.last_reset_at) : new Date();
  const now = new Date();
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  if (hoursSinceReset >= 24) {
    await supabaseAdmin
      .from("campaigns")
      .update({
        messages_sent_today: 0,
        last_reset_at: now.toISOString(),
      })
      .eq("id", campaignId);

    return {
      allowed: true,
      sent_today: 0,
      limit: campaign.daily_limit || 1000,
      remaining: campaign.daily_limit || 1000,
    };
  }

  const sentToday = campaign.messages_sent_today || 0;
  const limit = campaign.daily_limit || 1000;
  const remaining = Math.max(0, limit - sentToday);

  return {
    allowed: sentToday < limit,
    sent_today: sentToday,
    limit,
    remaining,
  };
}

/**
 * Incrementa contador de mensagens enviadas hoje
 */
export async function incrementDailyMessageCount(campaignId: string, count: number = 1): Promise<void> {
  const { error } = await supabaseAdmin.rpc("increment_campaign_messages_sent", {
    p_campaign_id: campaignId,
    p_increment: count,
  });

  if (error) {
    // Se função não existe, fazer update manual
    console.warn("[Daily Limit] RPC não encontrado, usando UPDATE manual");
    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("messages_sent_today")
      .eq("id", campaignId)
      .single();

    if (campaign) {
      await supabaseAdmin
        .from("campaigns")
        .update({
          messages_sent_today: (campaign.messages_sent_today || 0) + count,
        })
        .eq("id", campaignId);
    }
  }
}

/**
 * Pausa campanha (manual ou automática)
 */
export async function pauseCampaign(
  campaignId: string,
  reason: string,
  durationSeconds: number = -1
): Promise<void> {
  console.warn(`[Campaign Pause] Pausando campanha ${campaignId}: ${reason}`);

  const updateData: any = {
    status: "PAUSED",
    paused_at: new Date().toISOString(),
    pause_reason: reason,
  };

  if (durationSeconds > 0) {
    const resumeAt = new Date(Date.now() + durationSeconds * 1000);
    updateData.resume_at = resumeAt.toISOString();
  }

  await supabaseAdmin
    .from("campaigns")
    .update(updateData)
    .eq("id", campaignId);

  console.log(`[Campaign Pause] ✅ Campanha ${campaignId} pausada${durationSeconds > 0 ? ` por ${durationSeconds}s` : " (manual)"}`);
}

/**
 * Calcula taxa de bloqueio de uma campanha
 */
export async function getBlockRate(campaignId: string): Promise<number> {
  const { data: deliveries } = await supabaseAdmin
    .from("campaign_deliveries")
    .select("status, error_message")
    .eq("campaign_id", campaignId);

  if (!deliveries || deliveries.length === 0) return 0;

  const total = deliveries.length;
  const blocked = deliveries.filter(
    d => d.status === "FAILED" && d.error_message?.includes("131051")
  ).length;

  return (blocked / total) * 100;
}

/**
 * Calcula taxa de entrega de uma campanha
 */
export async function getDeliveryRate(campaignId: string): Promise<number> {
  const { data: deliveries } = await supabaseAdmin
    .from("campaign_deliveries")
    .select("status")
    .eq("campaign_id", campaignId);

  if (!deliveries || deliveries.length === 0) return 0;

  const total = deliveries.length;
  const delivered = deliveries.filter(
    d => d.status === "DELIVERED" || d.status === "READ"
  ).length;

  return (delivered / total) * 100;
}
