import { supabaseAdmin } from "../lib/supabase.ts";
import { getIO, hasIO } from "../lib/io.ts";
import { publish, EX_APP } from "../queue/rabbit.ts";

export type NotificationType = 
  | "SYSTEM"
  | "CHAT_MESSAGE"
  | "NEW_LEAD"
  | "PROPOSAL_VIEWED"
  | "PROPOSAL_ACCEPTED"
  | "PROPOSAL_REJECTED"
  | "PROPOSAL_EXPIRED"
  | "TECHNICAL_VISIT"
  | "SYSTEM_ALERT"
  | "MASS_DISPATCH"
  | "CHAT_ASSIGNED"
  | "CHAT_TRANSFERRED"
  | "CHAT_CLOSED"
  | "LEAD_CONVERTED"
  | "NEW_CUSTOMER"
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_DUE_TODAY"
  | "TASK_DUE_TOMORROW"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "TASK_COMPLETED"
  | "CAMPAIGN_COMPLETED"
  | "CAMPAIGN_FAILED"
  | "MENTION"
  | "TEAM_INVITE"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "USER_MESSAGE"
  | "PROJECT_CREATED"
  | "PROJECT_ASSIGNED"
  | "PROJECT_STAGE_CHANGED"
  | "PROJECT_COMPLETED"
  | "PROJECT_COMMENTED"
  | "PROJECT_OVERDUE"
  | "PROJECT_DEADLINE_TODAY"
  | "PROJECT_DEADLINE_TOMORROW"
  | "PROJECT_DEADLINE_WARNING"
  | "SYSTEM_ALERT";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type SoundType = "default" | "success" | "warning" | "error" | "message" | "urgent" | "silent";

export type NotificationCategory = "chat" | "lead" | "proposal" | "task" | "campaign" | "system" | "payment" | "general" | "project";

interface CreateNotificationInput {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  userId: string;
  companyId: string;
  data?: Record<string, any>;
  soundType?: SoundType;
  actionUrl?: string;
  category?: NotificationCategory;
  projectId?: string;
  taskId?: string;
  commentId?: string;
}

interface NotificationConfig {
  priority: NotificationPriority;
  soundType: SoundType;
  category: NotificationCategory;
}

// Configuração padrão por tipo de notificação
const NOTIFICATION_CONFIG: Record<NotificationType, NotificationConfig> = {
  // Chat
  CHAT_MESSAGE: { priority: "HIGH", soundType: "message", category: "chat" },
  CHAT_ASSIGNED: { priority: "HIGH", soundType: "default", category: "chat" },
  CHAT_TRANSFERRED: { priority: "NORMAL", soundType: "default", category: "chat" },
  CHAT_CLOSED: { priority: "LOW", soundType: "silent", category: "chat" },
  
  // Leads
  NEW_LEAD: { priority: "HIGH", soundType: "success", category: "lead" },
  LEAD_CONVERTED: { priority: "NORMAL", soundType: "success", category: "lead" },
  NEW_CUSTOMER: { priority: "HIGH", soundType: "success", category: "lead" },
  
  // Propostas
  PROPOSAL_VIEWED: { priority: "NORMAL", soundType: "default", category: "proposal" },
  PROPOSAL_ACCEPTED: { priority: "HIGH", soundType: "success", category: "proposal" },
  PROPOSAL_REJECTED: { priority: "NORMAL", soundType: "warning", category: "proposal" },
  PROPOSAL_EXPIRED: { priority: "LOW", soundType: "warning", category: "proposal" },
  
  // Tarefas
  TASK_CREATED: { priority: "NORMAL", soundType: "default", category: "task" },
  TASK_ASSIGNED: { priority: "NORMAL", soundType: "default", category: "task" },
  TASK_DUE_TODAY: { priority: "HIGH", soundType: "warning", category: "task" },
  TASK_DUE_SOON: { priority: "HIGH", soundType: "warning", category: "task" },
  TASK_OVERDUE: { priority: "URGENT", soundType: "urgent", category: "task" },
  TASK_COMPLETED: { priority: "NORMAL", soundType: "success", category: "task" },
  TASK_DUE_TOMORROW: { priority: "NORMAL", soundType: "warning", category: "task" },
  
  // Campanhas
  MASS_DISPATCH: { priority: "NORMAL", soundType: "success", category: "campaign" },
  CAMPAIGN_COMPLETED: { priority: "NORMAL", soundType: "success", category: "campaign" },
  CAMPAIGN_FAILED: { priority: "HIGH", soundType: "error", category: "campaign" },
  
  // Sistema
  SYSTEM: { priority: "NORMAL", soundType: "default", category: "system" },
  SYSTEM_ALERT: { priority: "URGENT", soundType: "urgent", category: "system" },
  TECHNICAL_VISIT: { priority: "HIGH", soundType: "default", category: "system" },
  
  // Social
  MENTION: { priority: "HIGH", soundType: "message", category: "general" },
  TEAM_INVITE: { priority: "NORMAL", soundType: "default", category: "general" },
  USER_MESSAGE: { priority: "NORMAL", soundType: "message", category: "general" },
  
  // Financeiro
  PAYMENT_RECEIVED: { priority: "HIGH", soundType: "success", category: "payment" },
  PAYMENT_OVERDUE: { priority: "URGENT", soundType: "urgent", category: "payment" },

  // Projetos
  PROJECT_CREATED: { priority: "NORMAL", soundType: "default", category: "project" },
  PROJECT_ASSIGNED: { priority: "NORMAL", soundType: "default", category: "project" },
  PROJECT_STAGE_CHANGED: { priority: "NORMAL", soundType: "default", category: "project" },
  PROJECT_COMPLETED: { priority: "HIGH", soundType: "success", category: "project" },
  PROJECT_COMMENTED: { priority: "NORMAL", soundType: "message", category: "project" },
  PROJECT_OVERDUE: { priority: "URGENT", soundType: "urgent", category: "project" },
  PROJECT_DEADLINE_TODAY: { priority: "HIGH", soundType: "warning", category: "project" },
  PROJECT_DEADLINE_TOMORROW: { priority: "NORMAL", soundType: "warning", category: "project" },
  PROJECT_DEADLINE_WARNING: { priority: "NORMAL", soundType: "warning", category: "project" },
};

export class NotificationService {
  /**
   * Cria uma notificação e envia via WebSocket
   */
  static async create(input: CreateNotificationInput) {
    console.log("[NotificationService] 🔔 Creating notification:", {
      type: input.type,
      userId: input.userId,
      companyId: input.companyId,
      title: input.title
    });

    try {
      const config = NOTIFICATION_CONFIG[input.type];
      
      // Heurística para evitar erros de FK: task_id em notificações geralmente aponta para project_tasks.
      // Tarefas gerais (tabela 'tasks') não devem ser inseridas na coluna task_id se houver essa restrição.
      const isProjectTask = !!input.projectId;

      const { data: notification, error } = await supabaseAdmin
        .from("notifications")
        .insert({
          title: input.title,
          message: input.message,
          type: input.type,
          priority: input.priority || config.priority,
          user_id: input.userId,
          company_id: input.companyId,
          data: {
            ...(input.data || {}),
            taskId: input.taskId,
            projectId: input.projectId
          },
          sound_type: input.soundType || config.soundType,
          action_url: input.actionUrl || null,
          category: input.category || config.category,
          project_id: input.projectId || null,
          task_id: isProjectTask ? (input.taskId || null) : null,
          comment_id: input.commentId || null,
        })
        .select()
        .single();

      if (error) {
        console.error("[NotificationService] ❌ Error creating notification in DB:", error);
        throw error;
      }

      // Enviar via WebSocket se disponível
      if (hasIO()) {
        try {
          const io = getIO();
          
          // 1. Enviar para o usuário específico
          const room = `user:${input.userId}`;
          console.log(`[NotificationService] 📡 Emitting socket event to room: ${room}`);
          io.to(room).emit("notification", {
            ...notification,
            isNew: true,
          });

          // 2. Se for um evento global da empresa (Leads, Clientes), enviar para a sala da empresa
          const globalTypes: NotificationType[] = ["NEW_LEAD", "NEW_CUSTOMER", "LEAD_CONVERTED", "SYSTEM_ALERT"];
          if (globalTypes.includes(input.type)) {
            const companyRoom = `company:${input.companyId}`;
            console.log(`[NotificationService] 🏢 Emitting global notification to company room: ${companyRoom}`);
            io.to(companyRoom).emit("notification", {
              ...notification,
              isNew: true,
            });
          }
        } catch (socketError) {
          console.warn("[NotificationService] ⚠️ Failed to emit socket event (IO error):", socketError);
        }
      } else {
        console.log("[NotificationService] ℹ️ Skipping direct socket emit (no IO instance), trying RabbitMQ...");
        try {
          await publish(EX_APP, "socket.notification", {
            kind: "notification",
            userId: input.userId,
            notification: {
              ...notification,
              isNew: true,
            }
          });
          console.log("[NotificationService] ✅ Notification event published to RabbitMQ");
        } catch (mqError) {
          console.warn("[NotificationService] ⚠️ Failed to publish notification event to RabbitMQ:", mqError);
        }
      }

      console.log(`[NotificationService] ✅ Notification created for user ${input.userId}:`, {
        id: notification.id,
        type: input.type,
        title: input.title,
        sound: input.soundType || config.soundType,
      });

      return notification;
    } catch (error) {
      console.error("[NotificationService] 💥 Fatal error in create:", error);
      throw error;
    }
  }

  /**
   * Marca notificação como lida
   */
  static async markAsRead(notificationId: string, userId: string) {
    console.log(`[NotificationService] Marking as read: ${notificationId} for user ${userId}`);
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      console.error("[NotificationService] ❌ Error marking as read:", error);
      throw error;
    }
  }

  /**
   * Marca todas as notificações do usuário como lidas
   */
  static async markAllAsRead(userId: string, companyId: string) {
    console.log(`[NotificationService] Marking ALL as read for user ${userId}`);
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("is_read", false);

    if (error) {
      console.error("[NotificationService] ❌ Error marking all as read:", error);
      throw error;
    }
  }

  /**
   * Busca notificações não lidas do usuário
   */
  static async getUnread(userId: string, companyId: string) {
    // console.log(`[NotificationService] Fetching unread for user ${userId}`);
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[NotificationService] ❌ Error fetching unread:", error);
      throw error;
    }

    return data || [];
  }

  /**
   * Busca todas as notificações do usuário (com paginação)
   */
  static async getAll(userId: string, companyId: string, limit = 50, offset = 0) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[NotificationService] Error fetching all:", error);
      throw error;
    }

    return data || [];
  }

  /**
   * Deleta notificação
   */
  static async delete(notificationId: string, userId: string) {
    const { error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      console.error("[NotificationService] Error deleting:", error);
      throw error;
    }
  }

  /**
   * Conta notificações não lidas
   */
  static async countUnread(userId: string, companyId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("is_read", false);

    if (error) {
      console.error("[NotificationService] ❌ Error counting unread:", error);
      return 0;
    }

    // console.log(`[NotificationService] Unread count for ${userId}: ${count}`);
    return count || 0;
  }
}
