// backend/src/services/notification-triggers.service.ts

import { NotificationService } from "./notification.service.js";
import { supabaseAdmin } from "../lib/supabase.js";
import * as FlowEngine from "./flow-engine.service.js";

// ==================== PROJECT NOTIFICATIONS ====================

/**
 * Notifica quando projeto é criado
 */
export async function notifyProjectCreated(
  projectId: string,
  projectTitle: string,
  ownerUserId: string,
  companyId: string
): Promise<void> {
  // 1. Notificação In-App (Padrão)
  await NotificationService.create({
    userId: ownerUserId,
    companyId,
    type: 'PROJECT_CREATED',
    title: 'Novo Projeto Criado',
    message: `O projeto "${projectTitle}" foi criado com sucesso!`,
    actionUrl: `/projects/${projectId}`,
    projectId,
    data: {
      project_title: projectTitle,
    },
  });

  // 2. Disparar Fluxo de Automação (Gatilho de Sistema)
  try {
    const contactId = await FlowEngine.getContactIdForUser(ownerUserId, companyId);
    await FlowEngine.triggerFlow({
      companyId,
      contactId,
      triggerType: 'SYSTEM_EVENT',
      triggerData: {
        event: 'PROJECT_CREATED',
        entity_type: 'PROJECT',
        entity_id: projectId
      }
    });
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para PROJECT_CREATED:", err);
  }
}

/**
 * Notifica quando projeto é atribuído a um usuário
 */
export async function notifyProjectAssigned(
  projectId: string,
  projectTitle: string,
  assignedUserId: string,
  assignedByUserId: string,
  companyId: string
): Promise<void> {
  // Buscar nome do usuário que atribuiu
  const { data: assignedByUser } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', assignedByUserId)
    .maybeSingle();

  await NotificationService.create({
    userId: assignedUserId,
    companyId,
    type: 'PROJECT_ASSIGNED',
    title: 'Projeto Atribuído a Você',
    message: `${assignedByUser?.name || 'Alguém'} atribuiu o projeto "${projectTitle}" para você.`,
    actionUrl: `/projects/${projectId}`,
    projectId,
    data: {
      project_title: projectTitle,
      assigned_by: assignedByUser?.name,
    },
  });

  // 2. Disparar Fluxo de Automação
  try {
    const contactId = await FlowEngine.getContactIdForUser(assignedUserId, companyId);
    await FlowEngine.triggerFlow({
      companyId,
      contactId,
      triggerType: 'SYSTEM_EVENT',
      triggerData: {
        event: 'PROJECT_ASSIGNED',
        entity_type: 'PROJECT',
        entity_id: projectId
      }
    });
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para PROJECT_ASSIGNED:", err);
  }
}

/**
 * Notifica quando projeto muda de estágio
 */
export async function notifyProjectStageChanged(
  projectId: string,
  projectTitle: string,
  fromStageName: string,
  toStageName: string,
  ownerUserId: string,
  companyId: string
): Promise<void> {
  await NotificationService.create({
    userId: ownerUserId,
    companyId,
    type: 'PROJECT_STAGE_CHANGED',
    title: 'Projeto Mudou de Estágio',
    message: `"${projectTitle}" avançou de "${fromStageName}" para "${toStageName}".`,
    actionUrl: `/projects/${projectId}`,
    projectId,
    data: {
      project_title: projectTitle,
      from_stage: fromStageName,
      to_stage: toStageName,
    },
  });

  // 2. Disparar Fluxo de Automação
  try {
    const contactId = await FlowEngine.getContactIdForUser(ownerUserId, companyId);
    await FlowEngine.triggerFlow({
      companyId,
      contactId,
      triggerType: 'SYSTEM_EVENT',
      triggerData: {
        event: 'PROJECT_STAGE_CHANGED',
        entity_type: 'PROJECT',
        entity_id: projectId
      }
    });
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para PROJECT_STAGE_CHANGED:", err);
  }
}

/**
 * Notifica quando projeto é concluído
 */
export async function notifyProjectCompleted(
  projectId: string,
  projectTitle: string,
  ownerUserId: string,
  assignedUsers: string[],
  companyId: string
): Promise<void> {
  const allUsers = [ownerUserId, ...assignedUsers].filter((v, i, a) => a.indexOf(v) === i);

  for (const userId of allUsers) {
    await NotificationService.create({
      userId,
      companyId,
      type: 'PROJECT_COMPLETED',
      title: 'Projeto Concluído! 🎉',
      message: `O projeto "${projectTitle}" foi concluído com sucesso!`,
      actionUrl: `/projects/${projectId}`,
      projectId,
      data: {
        project_title: projectTitle,
      },
    });
  }
}

/**
 * Notifica quando alguém comenta em um projeto
 */
export async function notifyProjectCommented(
  projectId: string,
  projectTitle: string,
  commentAuthorId: string,
  ownerUserId: string,
  assignedUsers: string[],
  companyId: string,
  commentPreview: string
): Promise<void> {
  // Buscar nome do autor do comentário
  const { data: author } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', commentAuthorId)
    .maybeSingle();

  // Notificar todos exceto o autor
  const usersToNotify = [ownerUserId, ...assignedUsers]
    .filter((v, i, a) => a.indexOf(v) === i)
    .filter(id => id !== commentAuthorId);

  for (const userId of usersToNotify) {
    await NotificationService.create({
      userId,
      companyId,
      type: 'PROJECT_COMMENTED',
      title: 'Novo Comentário',
      message: `${author?.name || 'Alguém'} comentou em "${projectTitle}": ${commentPreview.substring(0, 100)}...`,
      actionUrl: `/projects/${projectId}?tab=comments`,
      projectId,
      data: {
        project_title: projectTitle,
        author_name: author?.name,
        comment_preview: commentPreview,
      },
    });
  }
}

// ==================== TASK NOTIFICATIONS ====================

/**
 * Notifica quando tarefa é criada
 */
export async function notifyTaskCreated(
  taskId: string,
  taskTitle: string,
  ownerUserId: string,
  companyId: string
): Promise<void> {
  console.log(`[NotificationTriggers] 🆕 notifyTaskCreated called for task: ${taskTitle} (${taskId})`);
  // 1. Notificação In-App
  await NotificationService.create({
    userId: ownerUserId,
    companyId,
    type: 'TASK_CREATED',
    title: 'Nova Tarefa Criada',
    message: `A tarefa "${taskTitle}" foi criada com sucesso!`,
    actionUrl: `/tarefas`,
    taskId,
    data: {
      task_title: taskTitle,
    },
  });

  // 2. Disparar Fluxo de Automação
  try {
    const contactId = await FlowEngine.getContactIdForUser(ownerUserId, companyId);
    await FlowEngine.triggerFlow({
      companyId,
      contactId,
      triggerType: 'SYSTEM_EVENT',
      triggerData: {
        event: 'TASK_CREATED',
        entity_type: 'TASK',
        entity_id: taskId
      }
    });
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para TASK_CREATED:", err);
  }
}

/**
 * Notifica quando tarefa é atribuída
 */
export async function notifyTaskAssigned(
  taskId: string,
  taskTitle: string,
  projectId: string,
  projectTitle: string,
  assignedUserId: string,
  companyId: string
): Promise<void> {
  await NotificationService.create({
    userId: assignedUserId,
    companyId,
    type: 'TASK_ASSIGNED',
    title: 'Nova Tarefa Atribuída',
    message: `Você recebeu a tarefa "${taskTitle}" no projeto "${projectTitle}".`,
    actionUrl: `/projects/${projectId}?tab=tasks`,
    projectId,
    taskId,
    data: {
      task_title: taskTitle,
      project_title: projectTitle,
    },
  });

  // 2. Disparar Fluxo de Automação
  try {
    const contactId = await FlowEngine.getContactIdForUser(assignedUserId, companyId);
    await FlowEngine.triggerFlow({
      companyId,
      contactId,
      triggerType: 'SYSTEM_EVENT',
      triggerData: {
        event: 'TASK_ASSIGNED',
        entity_type: 'TASK',
        entity_id: taskId
      }
    });
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para TASK_ASSIGNED:", err);
  }
}

/**
 * Notifica quando tarefa é concluída
 */
export async function notifyTaskCompleted(
  taskId: string,
  taskTitle: string,
  projectId: string,
  projectTitle: string,
  ownerUserId: string,
  companyId: string
): Promise<void> {
  await NotificationService.create({
    userId: ownerUserId,
    companyId,
    type: 'TASK_COMPLETED',
    title: 'Tarefa Concluída',
    message: `A tarefa "${taskTitle}" do projeto "${projectTitle}" foi concluída.`,
    actionUrl: `/projects/${projectId}?tab=tasks`,
    projectId,
    taskId,
    data: {
      task_title: taskTitle,
      project_title: projectTitle,
    },
  });

  // 2. Disparar Fluxo de Automação
  try {
    const contactId = await FlowEngine.getContactIdForUser(ownerUserId, companyId);
    await FlowEngine.triggerFlow({
      companyId,
      contactId,
      triggerType: 'SYSTEM_EVENT',
      triggerData: {
        event: 'TASK_COMPLETED',
        entity_type: 'TASK',
        entity_id: taskId
      }
    });
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para TASK_COMPLETED:", err);
  }
}

/**
 * Notifica quando uma tarefa está vencendo hoje
 */
export async function notifyTaskDueToday(
  taskId: string,
  taskTitle: string,
  assignedUserId: string,
  companyId: string,
  entityType: 'TASK' | 'PROJECT_TASK' = 'TASK'
): Promise<void> {
  try {
    const contactId = await FlowEngine.getContactIdForUser(assignedUserId, companyId);
    if (contactId) {
      await FlowEngine.triggerFlow({
        companyId,
        contactId,
        triggerType: 'SYSTEM_EVENT',
        triggerData: {
          event: 'TASK_DUE_TODAY',
          entity_type: entityType,
          entity_id: taskId
        }
      });
    }
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para TASK_DUE_TODAY:", err);
  }
}

/**
 * Notifica quando uma tarefa está atrasada
 */
export async function notifyTaskOverdue(
  taskId: string,
  taskTitle: string,
  assignedUserId: string,
  companyId: string,
  entityType: 'TASK' | 'PROJECT_TASK' = 'TASK'
): Promise<void> {
  try {
    const contactId = await FlowEngine.getContactIdForUser(assignedUserId, companyId);
    if (contactId) {
      await FlowEngine.triggerFlow({
        companyId,
        contactId,
        triggerType: 'SYSTEM_EVENT',
        triggerData: {
          event: 'TASK_OVERDUE',
          entity_type: entityType,
          entity_id: taskId
        }
      });
    }
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para TASK_OVERDUE:", err);
  }
}

/**
 * Notifica quando uma tarefa vence amanhã
 */
export async function notifyTaskDueTomorrow(
  taskId: string,
  taskTitle: string,
  assignedUserId: string,
  companyId: string,
  entityType: 'TASK' | 'PROJECT_TASK' = 'TASK'
): Promise<void> {
  try {
    const contactId = await FlowEngine.getContactIdForUser(assignedUserId, companyId);
    if (contactId) {
      await FlowEngine.triggerFlow({
        companyId,
        contactId,
        triggerType: 'SYSTEM_EVENT',
        triggerData: {
          event: 'TASK_DUE_TOMORROW',
          entity_type: entityType,
          entity_id: taskId
        }
      });
    }
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para TASK_DUE_TOMORROW:", err);
  }
}

/**
 * Notifica quando um projeto está vencendo hoje
 */
export async function notifyProjectDueToday(
  projectId: string,
  projectTitle: string,
  ownerUserId: string,
  companyId: string
): Promise<void> {
  try {
    const contactId = await FlowEngine.getContactIdForUser(ownerUserId, companyId);
    if (contactId) {
      await FlowEngine.triggerFlow({
        companyId,
        contactId,
        triggerType: 'SYSTEM_EVENT',
        triggerData: {
          event: 'PROJECT_DEADLINE_TODAY',
          entity_type: 'PROJECT',
          entity_id: projectId
        }
      });
    }
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para PROJECT_DEADLINE_TODAY:", err);
  }
}

/**
 * Notifica quando um projeto vence amanhã
 */
export async function notifyProjectDueTomorrow(
  projectId: string,
  projectTitle: string,
  ownerUserId: string,
  companyId: string
): Promise<void> {
  try {
    const contactId = await FlowEngine.getContactIdForUser(ownerUserId, companyId);
    if (contactId) {
      await FlowEngine.triggerFlow({
        companyId,
        contactId,
        triggerType: 'SYSTEM_EVENT',
        triggerData: {
          event: 'PROJECT_DEADLINE_TOMORROW',
          entity_type: 'PROJECT',
          entity_id: projectId
        }
      });
    }
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para PROJECT_DEADLINE_TOMORROW:", err);
  }
}

/**
 * Notifica de aviso de prazo (ex: 3 dias antes)
 */
export async function notifyProjectWarning(
  projectId: string,
  projectTitle: string,
  ownerUserId: string,
  companyId: string,
  daysRemaining: number
): Promise<void> {
  try {
    const contactId = await FlowEngine.getContactIdForUser(ownerUserId, companyId);
    if (contactId) {
      await FlowEngine.triggerFlow({
        companyId,
        contactId,
        triggerType: 'SYSTEM_EVENT',
        triggerData: {
          event: 'PROJECT_DEADLINE_WARNING',
          entity_type: 'PROJECT',
          entity_id: projectId,
          days_remaining: daysRemaining
        }
      });
    }
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para PROJECT_DEADLINE_WARNING:", err);
  }
}

/**
 * Notifica quando um projeto está atrasado
 */
export async function notifyProjectOverdue(
  projectId: string,
  projectTitle: string,
  ownerUserId: string,
  companyId: string
): Promise<void> {
  try {
    const contactId = await FlowEngine.getContactIdForUser(ownerUserId, companyId);
    if (contactId) {
      await FlowEngine.triggerFlow({
        companyId,
        contactId,
        triggerType: 'SYSTEM_EVENT',
        triggerData: {
          event: 'PROJECT_OVERDUE',
          entity_type: 'PROJECT',
          entity_id: projectId
        }
      });
    }
  } catch (err) {
    console.warn("[NotificationTriggers] Erro ao disparar fluxo para PROJECT_OVERDUE:", err);
  }
}

// ==================== MENTION NOTIFICATIONS ====================

/**
 * Notifica usuários mencionados em comentário
 */
export async function notifyMentionedUsers(
  mentionedUserIds: string[],
  commentId: string,
  projectId: string,
  projectTitle: string,
  authorId: string,
  companyId: string,
  commentText: string
): Promise<void> {
  // Buscar nome do autor
  const { data: author } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', authorId)
    .maybeSingle();

  for (const userId of mentionedUserIds) {
    if (userId === authorId) continue; // Não notificar o próprio autor

    await NotificationService.create({
      userId,
      companyId,
      type: 'MENTION',
      title: 'Você foi mencionado',
      message: `${author?.name || 'Alguém'} mencionou você em "${projectTitle}": ${commentText.substring(0, 100)}...`,
      actionUrl: `/projects/${projectId}?tab=comments`,
      projectId,
      commentId,
      data: {
        project_title: projectTitle,
        author_name: author?.name,
        comment_preview: commentText,
      },
    });
  }
}

// ==================== HELPERS ====================

/**
 * Buscar informações de projeto para notificações
 */
export async function getProjectNotificationData(projectId: string) {
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('title, owner_user_id, assigned_users, company_id')
    .eq('id', projectId)
    .single();

  return project;
}

/**
 * Buscar informações de tarefa para notificações
 */
export async function getTaskNotificationData(taskId: string) {
  const { data: task } = await supabaseAdmin
    .from('project_tasks')
    .select(`
      title,
      assigned_to,
      project_id,
      projects (
        title,
        owner_user_id,
        company_id
      )
    `)
    .eq('id', taskId)
    .single();

  return task;
}
