import { getIO } from "../lib/io.js";
import { getTasksWithPendingReminders, markReminderAsSent, type TaskWithContext } from "../repos/tasks.repo.js";

/**
 * Verifica e envia lembretes de tarefas
 * Executado a cada 5 minutos via worker
 */
export async function checkAndSendReminders(): Promise<void> {
  try {
    console.log("[taskReminders] Checking for pending reminders...");

    const tasks = await getTasksWithPendingReminders();

    if (tasks.length === 0) {
      console.log("[taskReminders] No pending reminders found");
      return;
    }

    console.log(`[taskReminders] Found ${tasks.length} tasks with pending reminders`);

    const io = getIO();

    for (const task of tasks) {
      try {
        await sendTaskReminder(task, io);
        await markReminderAsSent(task.id);
        console.log(`[taskReminders] Reminder sent for task ${task.id}: ${task.title}`);
      } catch (error) {
        console.error(`[taskReminders] Failed to send reminder for task ${task.id}:`, error);
      }
    }

    console.log(`[taskReminders] Processed ${tasks.length} reminders`);
  } catch (error) {
    console.error("[taskReminders] Error checking reminders:", error);
  }
}

/**
 * Envia lembrete de uma tarefa via Socket.io
 */
async function sendTaskReminder(task: TaskWithContext, io: any): Promise<void> {
  const channels = parseReminderChannels(task.reminder_channels);

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

  // Enviar notificação in-app via Socket.io
  if (channels.includes("IN_APP")) {
    // Emitir para a empresa toda
    io.to(`company:${task.company_id}`).emit("notification", notification);

    // Se tem responsável, emitir para ele especificamente
    if (task.assigned_to) {
      io.to(`user:${task.assigned_to}`).emit("notification", notification);
    }

    // Emitir evento específico de lembrete de tarefa
    io.to(`company:${task.company_id}`).emit("task:reminder", {
      task,
      notification,
      companyId: task.company_id,
    });
  }

  // TODO: Implementar envio de email
  if (channels.includes("EMAIL")) {
    console.log(`[taskReminders] Email reminder for task ${task.id} (not implemented yet)`);
    // Aqui você pode integrar com serviço de email (nodemailer, sendgrid, etc)
  }

  // TODO: Implementar envio de WhatsApp
  if (channels.includes("WHATSAPP")) {
    console.log(`[taskReminders] WhatsApp reminder for task ${task.id} (not implemented yet)`);
    // Aqui você pode integrar com WAHA ou outro serviço de WhatsApp
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
