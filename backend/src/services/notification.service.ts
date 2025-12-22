// backend/src/services/notification.service.ts

import { supabaseAdmin } from "../lib/supabase.ts";

// ==================== TYPES ====================

export type NotificationType =
  // Projetos
  | 'PROJECT_CREATED'
  | 'PROJECT_ASSIGNED'
  | 'PROJECT_DEADLINE_TODAY'
  | 'PROJECT_DEADLINE_TOMORROW'
  | 'PROJECT_DEADLINE_WARNING'
  | 'PROJECT_OVERDUE'
  | 'PROJECT_STAGE_CHANGED'
  | 'PROJECT_COMPLETED'
  | 'PROJECT_COMMENTED'
  // Tarefas
  | 'TASK_ASSIGNED'
  | 'TASK_DUE_TODAY'
  | 'TASK_DUE_TOMORROW'
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE'
  | 'TASK_COMPLETED'
  // Menções
  | 'MENTIONED_IN_COMMENT'
  // Sistema
  | 'SYSTEM_ALERT';

export type NotificationChannel = 'IN_APP' | 'WHATSAPP' | 'EMAIL' | 'SMS';

export type NotificationStatus = 'PENDING' | 'SENT' | 'READ' | 'FAILED' | 'CANCELLED';

export type CreateNotificationInput = {
  userId: string;
  companyId: string;
  type: NotificationType;
  channel?: NotificationChannel;
  title: string;
  message: string;
  actionUrl?: string;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  metadata?: Record<string, any>;
};

// ==================== NOTIFICATION CREATION ====================

/**
 * Cria uma notificação e agenda o envio
 */
export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: input.userId,
      company_id: input.companyId,
      notification_type: input.type,
      channel: input.channel || 'IN_APP',
      title: input.title,
      message: input.message,
      action_url: input.actionUrl,
      project_id: input.projectId,
      task_id: input.taskId,
      comment_id: input.commentId,
      metadata: input.metadata,
      status: 'PENDING',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Notification] Error creating notification:', error);
    throw new Error('Failed to create notification');
  }

  // Agendar envio assíncrono
  scheduleNotificationDelivery(data.id);

  return data.id;
}

/**
 * Cria notificação multi-canal (in-app + WhatsApp)
 */
export async function createMultiChannelNotification(
  input: Omit<CreateNotificationInput, 'channel'>
): Promise<void> {
  // Buscar preferências do usuário
  const prefs = await getUserNotificationPreferences(input.userId);
  
  // Verificar se está em horário de silêncio
  const isQuietHours = checkQuietHours(prefs);

  // In-app sempre cria
  await createNotification({ ...input, channel: 'IN_APP' });

  // WhatsApp apenas se habilitado e fora do horário de silêncio
  if (prefs.whatsapp_enabled && !isQuietHours) {
    const typePrefs = prefs.preferences[input.type as string];
    if (typePrefs?.whatsapp) {
      await createNotification({ ...input, channel: 'WHATSAPP' });
    }
  }

  // Email se habilitado
  if (prefs.email_enabled) {
    const typePrefs = prefs.preferences[input.type as string];
    if (typePrefs?.email) {
      await createNotification({ ...input, channel: 'EMAIL' });
    }
  }
}

// ==================== NOTIFICATION DELIVERY ====================

/**
 * Agenda envio da notificação (via queue ou imediato)
 */
async function scheduleNotificationDelivery(notificationId: string): Promise<void> {
  // Se tiver sistema de fila (Bull, BullMQ), adicionar na fila
  // Caso contrário, enviar imediatamente
  await processNotification(notificationId);
}

/**
 * Processa e envia uma notificação
 */
export async function processNotification(notificationId: string): Promise<void> {
  // Buscar notificação
  const { data: notification, error } = await supabaseAdmin
    .from('notifications')
    .select(`
      *,
      users: user_id (name, phone, email)
    `)
    .eq('id', notificationId)
    .eq('status', 'PENDING')
    .single();

  if (error || !notification) {
    console.error('[Notification] Notification not found:', notificationId);
    return;
  }

  try {
    switch (notification.channel) {
      case 'IN_APP':
        // In-app já está criada, apenas marcar como enviada
        await markAsSent(notificationId);
        break;

      case 'WHATSAPP':
        await sendWhatsAppNotification(notification);
        break;

      case 'EMAIL':
        await sendEmailNotification(notification);
        break;

      case 'SMS':
        await sendSMSNotification(notification);
        break;
    }
  } catch (error: any) {
    console.error('[Notification] Delivery failed:', error);
    await markAsFailed(notificationId, error.message);
  }
}

/**
 * Envia notificação via WhatsApp
 */
async function sendWhatsAppNotification(notification: any): Promise<void> {
  const phone = notification.users?.phone;
  if (!phone) {
    throw new Error('User has no phone number');
  }

  // INTEGRAÇÃO COM SUA API DE WHATSAPP (Exemplo genérico)
  // Ajustar para sua implementação (WAHA, Meta Business, Twilio, etc)
  
  const whatsappMessage = formatWhatsAppMessage(notification);
  
  try {
    // Exemplo com WAHA (ajustar para sua API)
    const response = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WAHA_API_KEY}`,
      },
      body: JSON.stringify({
        chatId: `${phone}@c.us`,
        text: whatsappMessage,
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.statusText}`);
    }

    const result = await response.json();

    // Log de entrega
    await logDelivery(notification.id, 'WHATSAPP', 'SENT', phone, result);
    await markAsSent(notification.id);

  } catch (error: any) {
    await logDelivery(notification.id, 'WHATSAPP', 'FAILED', phone, null, error.message);
    throw error;
  }
}

/**
 * Envia notificação via Email (implementação futura)
 */
async function sendEmailNotification(notification: any): Promise<void> {
  // TODO: Implementar com Resend, SendGrid, etc
  console.log('[Notification] Email delivery not implemented yet');
  await markAsSent(notification.id);
}

/**
 * Envia notificação via SMS (implementação futura)
 */
async function sendSMSNotification(notification: any): Promise<void> {
  // TODO: Implementar com Twilio, etc
  console.log('[Notification] SMS delivery not implemented yet');
  await markAsSent(notification.id);
}

// ==================== FORMATTING ====================

/**
 * Formata mensagem para WhatsApp
 */
function formatWhatsAppMessage(notification: any): string {
  const emoji = getEmojiForType(notification.notification_type);
  
  let message = `${emoji} *${notification.title}*\n\n`;
  message += notification.message;
  
  if (notification.action_url) {
    message += `\n\n🔗 Ver detalhes: ${process.env.FRONTEND_URL}${notification.action_url}`;
  }
  
  return message;
}

function getEmojiForType(type: string): string {
  const emojiMap: Record<string, string> = {
    PROJECT_CREATED: '🎉',
    PROJECT_ASSIGNED: '👤',
    PROJECT_DEADLINE_TODAY: '⚠️',
    PROJECT_DEADLINE_TOMORROW: '📅',
    PROJECT_DEADLINE_WARNING: '⏰',
    PROJECT_OVERDUE: '🚨',
    PROJECT_STAGE_CHANGED: '➡️',
    PROJECT_COMPLETED: '✅',
    PROJECT_COMMENTED: '💬',
    TASK_ASSIGNED: '📝',
    TASK_DUE_TODAY: '⚠️',
    TASK_DUE_TOMORROW: '📅',
    TASK_DUE_SOON: '⏰',
    TASK_OVERDUE: '🚨',
    TASK_COMPLETED: '✅',
    MENTIONED_IN_COMMENT: '💬',
    SYSTEM_ALERT: '🔔',
  };
  return emojiMap[type] || '🔔';
}

// ==================== STATUS UPDATES ====================

async function markAsSent(notificationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ status: 'SENT', sent_at: new Date().toISOString() })
    .eq('id', notificationId);
  
  if (error) {
    console.error(`[Notification] Error marking as sent (${notificationId}):`, error);
    throw error;
  }
}

async function markAsFailed(notificationId: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ status: 'FAILED', failed_reason: reason })
    .eq('id', notificationId);

  if (error) {
    console.error(`[Notification] Error marking as failed (${notificationId}):`, error);
  }
}

export async function markAsRead(notificationId: string): Promise<void> {
  await supabaseAdmin
    .from('notifications')
    .update({ status: 'READ', read_at: new Date().toISOString() })
    .eq('id', notificationId);
}

// ==================== DELIVERY LOG ====================

async function logDelivery(
  notificationId: string,
  channel: NotificationChannel,
  status: NotificationStatus,
  phoneOrEmail: string,
  responseData: any,
  errorMessage?: string
): Promise<void> {
  await supabaseAdmin.from('notification_delivery_log').insert({
    notification_id: notificationId,
    channel,
    status,
    [channel === 'WHATSAPP' || channel === 'SMS' ? 'phone_number' : 'email_address']: phoneOrEmail,
    response_data: responseData,
    error_message: errorMessage,
  });
}

// ==================== PREFERENCES ====================

async function getUserNotificationPreferences(userId: string): Promise<any> {
  const { data } = await supabaseAdmin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Retornar preferências padrão se não existir
  return data || {
    whatsapp_enabled: true,
    email_enabled: false,
    quiet_hours_enabled: false,
    preferences: {},
  };
}

function checkQuietHours(prefs: any): boolean {
  if (!prefs.quiet_hours_enabled) return false;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = (prefs.quiet_hours_start || "22:00").split(':').map(Number);
  const [endHour, endMin] = (prefs.quiet_hours_end || "08:00").split(':').map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  // Handle overnight quiet hours (ex: 22:00 - 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }

  return currentTime >= startTime && currentTime <= endTime;
}

// ==================== BATCH NOTIFICATIONS ====================

/**
 * Busca e processa notificações pendentes (para cron job)
 */
export async function processPendingNotifications(): Promise<void> {
  const { data: pending } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(100);

  if (!pending || pending.length === 0) return;

  console.log(`[Notification] Processing ${pending.length} pending notifications`);

  for (const notification of pending) {
    await processNotification(notification.id);
    // Aguardar 1s entre envios para não sobrecarregar APIs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
