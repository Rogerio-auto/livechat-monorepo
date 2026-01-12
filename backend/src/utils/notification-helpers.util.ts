import { NotificationService } from "../services/notification.service.js";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * Envia notificação de alerta do sistema para todos os admins da empresa
 */
export async function notifySystemAlert(params: {
  title: string;
  message: string;
  companyId: string;
  priority?: "HIGH" | "URGENT";
  data?: Record<string, any>;
  actionUrl?: string;
}) {
  try {
    // Buscar todos os admins da empresa
    const { data: admins } = await supabaseAdmin
      .from("users")
      .select("user_id, id")
      .eq("company_id", params.companyId)
      .eq("role", "ADMIN");

    if (!admins || admins.length === 0) {
      console.warn("[notifySystemAlert] ⚠️ Nenhum admin encontrado para company:", params.companyId);
      return;
    }

    // Enviar notificação para todos os admins
    const promises = admins.map((admin) =>
      NotificationService.create({
        title: params.title,
        message: params.message,
        type: "SYSTEM_ALERT",
        priority: params.priority || "URGENT",
        userId: admin.user_id,
        companyId: params.companyId,
        data: params.data || undefined,
        actionUrl: params.actionUrl || "/dashboard",
      })
    );

    await Promise.allSettled(promises);
    console.log(`[notifySystemAlert] 🔔 ${promises.length} notificações SYSTEM_ALERT enviadas`);
  } catch (error) {
    console.error("[notifySystemAlert] ❌ Erro ao enviar alertas:", error);
  }
}

/**
 * Notifica sobre erro crítico em integração (Meta API, WAHA, etc)
 */
export async function notifyIntegrationError(params: {
  integration: string;
  error: string;
  companyId: string;
  inboxId?: string;
  details?: Record<string, any>;
}) {
  await notifySystemAlert({
    title: `🚨 Erro em ${params.integration}`,
    message: `Falha na integração: ${params.error}`,
    companyId: params.companyId,
    priority: "URGENT",
    data: {
      integration: params.integration,
      error: params.error,
      inboxId: params.inboxId,
      ...params.details,
    },
    actionUrl: params.inboxId ? `/dashboard/inboxes/${params.inboxId}` : "/dashboard/inboxes",
  });
}

/**
 * Notifica sobre limite de API atingido
 */
export async function notifyApiLimitReached(params: {
  api: string;
  usage: number;
  limit: number;
  companyId: string;
}) {
  const percentage = Math.round((params.usage / params.limit) * 100);
  
  await notifySystemAlert({
    title: "⚠️ Limite de API Atingido",
    message: `${params.api}: ${percentage}% do limite mensal usado (${params.usage}/${params.limit})`,
    companyId: params.companyId,
    priority: percentage >= 95 ? "URGENT" : "HIGH",
    data: {
      api: params.api,
      usage: params.usage,
      limit: params.limit,
      percentage,
    },
  });
}

/**
 * Notifica sobre falha em campanha
 */
export async function notifyCampaignFailure(params: {
  campaignId: string;
  campaignName: string;
  error: string;
  companyId: string;
  userId: string;
}) {
  await NotificationService.create({
    title: "❌ Campanha Falhou",
    message: `"${params.campaignName}" não pôde ser concluída: ${params.error}`,
    type: "CAMPAIGN_FAILED",
    priority: "HIGH",
    userId: params.userId,
    companyId: params.companyId,
    data: {
      campaignId: params.campaignId,
      error: params.error,
    },
    actionUrl: `/dashboard/campanhas/${params.campaignId}`,
  });
}

/**
 * Notifica sobre conclusão de campanha
 */
export async function notifyCampaignCompleted(params: {
  campaignId: string;
  campaignName: string;
  totalSent: number;
  companyId: string;
  userId: string;
}) {
  await NotificationService.create({
    title: "📢 Campanha Finalizada",
    message: `"${params.campaignName}" enviada para ${params.totalSent} contatos`,
    type: "CAMPAIGN_COMPLETED",
    priority: "NORMAL",
    userId: params.userId,
    companyId: params.companyId,
    data: {
      campaignId: params.campaignId,
      totalSent: params.totalSent,
    },
    actionUrl: `/dashboard/campanhas/${params.campaignId}`,
  });
}

/**
 * Notifica usuário sobre nova mensagem recebida
 */
export async function notifyNewMessage(params: {
  chatId: string;
  messageBody: string;
  companyId?: string;
  senderName?: string;
  senderPhone?: string;
}) {
  try {
    // 1. Buscar chat para saber quem é o dono (owner_id)
    const { data: chat } = await supabaseAdmin
      .from("chats")
      .select("owner_id, company_id")
      .eq("id", params.chatId)
      .single();

    if (!chat || !chat.owner_id) {
      return;
    }

    const userId = chat.owner_id;
    const companyId = params.companyId || chat.company_id;

    if (!companyId) return;

    // 2. Criar notificação
    await NotificationService.create({
      title: `Nova mensagem de ${params.senderName || params.senderPhone || "Cliente"}`,
      message: params.messageBody.substring(0, 100) + (params.messageBody.length > 100 ? "..." : ""),
      type: "USER_MESSAGE",
      priority: "HIGH",
      userId: userId,
      companyId: companyId,
      data: {
        chatId: params.chatId,
        senderPhone: params.senderPhone
      },
      actionUrl: `/dashboard/chats/${params.chatId}`,
      category: "chat"
    });

  } catch (error) {
    console.error("[notifyNewMessage] ❌ Erro ao notificar nova mensagem:", error);
  }
}
