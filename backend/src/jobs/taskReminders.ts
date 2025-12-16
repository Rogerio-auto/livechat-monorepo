import { getIO } from "../lib/io.js";
import { NotificationService } from "../services/NotificationService.js";
import { getTasksWithPendingReminders, markReminderAsSent, type TaskWithContext } from "../repos/tasks.repo.js";
import { sendTaskReminderEmail } from "../services/emailService.js";
import { publish, EX_APP } from "../queue/rabbit.js";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * Verifica e envia lembretes de tarefas
 * Executado a cada 5 minutos via worker
 */
export async function checkAndSendReminders(): Promise<void> {
  try {
    console.log(`[taskReminders] ⏰ Checking for pending reminders at ${new Date().toISOString()}...`);

    const tasks = await getTasksWithPendingReminders();

    if (tasks.length === 0) {
      console.log("[taskReminders] 💤 No pending reminders found");
      return;
    }

    console.log(`[taskReminders] 📋 Found ${tasks.length} tasks with pending reminders`);

    let io;
    try {
      io = getIO();
      console.log("[taskReminders] ✅ Socket.IO instance retrieved");
    } catch (e) {
      console.warn("[taskReminders] ⚠️ Socket.IO not available, skipping IN_APP notifications");
    }

    for (const task of tasks) {
      try {
        console.log(`[taskReminders] ▶️ Processing task ${task.id} (${task.title})`);
        await sendTaskReminder(task, io);
        await markReminderAsSent(task.id);
        console.log(`[taskReminders] ✅ Reminder sent and marked as done for task ${task.id}`);
      } catch (error) {
        console.error(`[taskReminders] ❌ Failed to send reminder for task ${task.id}:`, error);
      }
    }

    console.log(`[taskReminders] 🏁 Processed ${tasks.length} reminders`);
  } catch (error) {
    console.error("[taskReminders] 💥 Error checking reminders:", error);
  }
}


async function getChatInfoForTask(task: TaskWithContext) {
  // 1. Se tiver chat vinculado, usa ele (para notificar cliente)
  if (task.related_chat_id) {
    const { data } = await supabaseAdmin
      .from('chats')
      .select('id, inbox_id, customers(phone)')
      .eq('id', task.related_chat_id)
      .single();
    
    if (data) {
      return {
        id: data.id,
        inbox_id: data.inbox_id,
        customer_phone: (data.customers as any)?.phone
      };
    }
    return null;
  }
  
  // 2. Se tiver cliente vinculado, tenta achar chat recente (para notificar cliente)
  if (task.related_customer_id) {
    const { data } = await supabaseAdmin
      .from('chats')
      .select('id, inbox_id, customers(phone)')
      .eq('customer_id', task.related_customer_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (data) {
      return {
        id: data.id,
        inbox_id: data.inbox_id,
        customer_phone: (data.customers as any)?.phone
      };
    }
    return null;
  }
  
  return null;
}

async function getUserPhoneInfo(userId: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('phone, company_id')
    .eq('id', userId)
    .single();
  return data;
}

async function getDefaultInboxForCompany(companyId: string) {
  const { data } = await supabaseAdmin
    .from('inboxes')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Envia lembrete de uma tarefa via Socket.io
 */
async function sendTaskReminder(task: TaskWithContext, io: any): Promise<void> {
  const channels = parseReminderChannels(task.reminder_channels);
  console.log(`[taskReminders] 📢 Sending reminder for task ${task.id} via channels: ${channels.join(", ")}`);

  // Preparar notificação
  const notification = {
    id: `task-reminder-${task.id}-${Date.now()}`,
    type: "task_reminder",
    title: "⏰ Lembrete de Tarefa",
    message: task.title,
    data: {
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      taskPriority: task.priority,
      taskType: task.type,
      taskDueDate: task.due_date,
      assignedToName: task.assigned_to_name,
      relatedLeadName: task.lead_name,
      relatedCustomerName: task.customer_name,
    },
    timestamp: new Date().toISOString(),
    read: false,
    companyId: task.company_id,
  };

  // Enviar notificação in-app via NotificationService
  if (channels.includes("IN_APP")) {
    if (task.assigned_to) {
      try {
        await NotificationService.create({
          type: "TASK_DUE_SOON",
          title: "⏰ Lembrete de Tarefa",
          message: `A tarefa "${task.title}" vence em breve.`,
          userId: task.assigned_to,
          companyId: task.company_id,
          priority: task.priority === "HIGH" ? "HIGH" : "NORMAL",
          category: "task",
          data: {
            taskId: task.id,
            taskTitle: task.title,
            taskDueDate: task.due_date,
          },
          actionUrl: `/tarefas?taskId=${task.id}`
        });
        console.log(`[taskReminders] ✅ Notification created for user ${task.assigned_to}`);
      } catch (err) {
        console.error(`[taskReminders] ❌ Failed to create notification for task ${task.id}:`, err);
      }
    } else {
       console.warn(`[taskReminders] ⚠️ Task ${task.id} has no assigned user for IN_APP notification`);
    }

    // Emitir evento específico de lembrete de tarefa (Legacy support)
    if (io) {
      io.to(`company:${task.company_id}`).emit("task:reminder", {
        task,
        notification,
        companyId: task.company_id,
      });
    }
  }

  // Envio de email
  if (channels.includes("EMAIL")) {
    if (task.assigned_to_email) {
      console.log(`[taskReminders] 📧 Sending EMAIL to ${task.assigned_to_email}`);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const actionUrl = `${frontendUrl}/tasks?taskId=${task.id}`;
      
      await sendTaskReminderEmail(
        task.assigned_to_email,
        task.title,
        task.description,
        task.due_date,
        actionUrl
      );
    } else {
      console.warn(`[taskReminders] ⚠️ Cannot send email reminder for task ${task.id}: No assigned user email`);
    }
  }

  // Envio de WhatsApp via WAHA
  if (channels.includes("WHATSAPP")) {
    console.log(`[taskReminders] 💬 Processing WHATSAPP reminder`);
    try {
      const message = `⏰ *Lembrete de Tarefa*\n\n*${task.title}*\n${task.description ? `_${task.description}_\n` : ''}${task.due_date ? `📅 Vencimento: ${new Date(task.due_date).toLocaleString('pt-BR')}` : ''}`;

      // 1. Tentar enviar para o USUÁRIO RESPONSÁVEL (Prioridade)
      if (task.assigned_to) {
        const userInfo = await getUserPhoneInfo(task.assigned_to);
        if (userInfo?.phone) {
          // Precisa de uma inbox para enviar. Pega a primeira ativa da empresa.
          const defaultInbox = await getDefaultInboxForCompany(task.company_id);
          
          if (defaultInbox?.id) {
            // Formatar telefone para JID (assumindo BR 55...)
            let userPhone = userInfo.phone.replace(/\D/g, "");
            if (!userPhone.startsWith("55")) userPhone = "55" + userPhone; // Fallback simples
            const userJid = `${userPhone}@s.whatsapp.net`;

            console.log(`[taskReminders] 📤 Sending WhatsApp to user ${userJid} via inbox ${defaultInbox.id}`);
            await publish(EX_APP, "outbound.request", {
              jobType: "message.send",
              provider: "WAHA",
              inboxId: defaultInbox.id,
              payload: {
                chatId: userJid,
                content: `[Lembrete para Você]\n${message}`,
              },
              companyId: task.company_id,
              createdAt: new Date().toISOString(),
            });
            console.log(`[taskReminders] ✅ WhatsApp reminder sent to ASSIGNED USER ${task.assigned_to} (${userJid})`);
          } else {
            console.warn(`[taskReminders] ⚠️ Cannot send WA to user: No active inbox found for company ${task.company_id}`);
          }
        } else {
            console.warn(`[taskReminders] ⚠️ User ${task.assigned_to} has no phone number configured`);
        }
      }

      // 2. Tentar enviar para o CLIENTE (se houver chat vinculado)
      // Isso mantém o comportamento anterior caso seja desejado notificar o cliente também
      const chatInfo = await getChatInfoForTask(task);
      if (chatInfo && chatInfo.inbox_id) {
        await publish(EX_APP, "outbound.request", {
          jobType: "message.send",
          provider: "WAHA",
          inboxId: chatInfo.inbox_id,
          chatId: chatInfo.id,
          payload: {
            content: message,
          },
          companyId: task.company_id,
          createdAt: new Date().toISOString(),
        });
        console.log(`[taskReminders] WhatsApp reminder sent to CUSTOMER chat ${chatInfo.id}`);
      }

    } catch (error) {
      console.error(`[taskReminders] Failed to send WhatsApp reminder for task ${task.id}:`, error);
    }
  }
}

/**
 * Parse dos canais de lembrete
 */
function parseReminderChannels(channels: any): string[] {
  if (!channels) return ["IN_APP"];

  if (typeof channels === "string") {
    try {
      return JSON.parse(channels);
    } catch {
      return ["IN_APP"];
    }
  }

  if (Array.isArray(channels)) {
    return channels;
  }

  return ["IN_APP"];
}
