// backend/src/services/notification-triggers.service.ts

import { createMultiChannelNotification } from "./notification.service.ts";
import { supabaseAdmin } from "../lib/supabase.ts";

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
  await createMultiChannelNotification({
    userId: ownerUserId,
    companyId,
    type: 'PROJECT_CREATED',
    title: 'Novo Projeto Criado',
    message: `O projeto "${projectTitle}" foi criado com sucesso!`,
    actionUrl: `/projects/${projectId}`,
    projectId,
    metadata: {
      project_title: projectTitle,
    },
  });
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

  await createMultiChannelNotification({
    userId: assignedUserId,
    companyId,
    type: 'PROJECT_ASSIGNED',
    title: 'Projeto Atribuído a Você',
    message: `${assignedByUser?.name || 'Alguém'} atribuiu o projeto "${projectTitle}" para você.`,
    actionUrl: `/projects/${projectId}`,
    projectId,
    metadata: {
      project_title: projectTitle,
      assigned_by: assignedByUser?.name,
    },
  });
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
  await createMultiChannelNotification({
    userId: ownerUserId,
    companyId,
    type: 'PROJECT_STAGE_CHANGED',
    title: 'Projeto Mudou de Estágio',
    message: `"${projectTitle}" avançou de "${fromStageName}" para "${toStageName}".`,
    actionUrl: `/projects/${projectId}`,
    projectId,
    metadata: {
      project_title: projectTitle,
      from_stage: fromStageName,
      to_stage: toStageName,
    },
  });
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
    await createMultiChannelNotification({
      userId,
      companyId,
      type: 'PROJECT_COMPLETED',
      title: 'Projeto Concluído! 🎉',
      message: `O projeto "${projectTitle}" foi concluído com sucesso!`,
      actionUrl: `/projects/${projectId}`,
      projectId,
      metadata: {
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
    await createMultiChannelNotification({
      userId,
      companyId,
      type: 'PROJECT_COMMENTED',
      title: 'Novo Comentário',
      message: `${author?.name || 'Alguém'} comentou em "${projectTitle}": ${commentPreview.substring(0, 100)}...`,
      actionUrl: `/projects/${projectId}?tab=comments`,
      projectId,
      metadata: {
        project_title: projectTitle,
        author_name: author?.name,
        comment_preview: commentPreview,
      },
    });
  }
}

// ==================== TASK NOTIFICATIONS ====================

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
  await createMultiChannelNotification({
    userId: assignedUserId,
    companyId,
    type: 'TASK_ASSIGNED',
    title: 'Nova Tarefa Atribuída',
    message: `Você recebeu a tarefa "${taskTitle}" no projeto "${projectTitle}".`,
    actionUrl: `/projects/${projectId}?tab=tasks`,
    projectId,
    taskId,
    metadata: {
      task_title: taskTitle,
      project_title: projectTitle,
    },
  });
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
  await createMultiChannelNotification({
    userId: ownerUserId,
    companyId,
    type: 'TASK_COMPLETED',
    title: 'Tarefa Concluída',
    message: `A tarefa "${taskTitle}" do projeto "${projectTitle}" foi concluída.`,
    actionUrl: `/projects/${projectId}?tab=tasks`,
    projectId,
    taskId,
    metadata: {
      task_title: taskTitle,
      project_title: projectTitle,
    },
  });
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

    await createMultiChannelNotification({
      userId,
      companyId,
      type: 'MENTIONED_IN_COMMENT',
      title: 'Você Foi Mencionado',
      message: `${author?.name || 'Alguém'} mencionou você em "${projectTitle}": ${commentText.substring(0, 100)}...`,
      actionUrl: `/projects/${projectId}?tab=comments`,
      projectId,
      commentId,
      metadata: {
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
