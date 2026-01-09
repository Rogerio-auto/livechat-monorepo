// backend/src/jobs/check-project-deadlines.job.ts

import { supabaseAdmin } from "../lib/supabase.ts";
import { NotificationService } from "../services/NotificationService.ts";
import { notifyProjectDueToday, notifyProjectDueTomorrow, notifyProjectWarning, notifyProjectOverdue, notifyTaskDueToday, notifyTaskDueTomorrow, notifyTaskOverdue } from "../services/notification-triggers.service.ts";

/**
 * Job para verificar prazos de projetos
 * Deve rodar DIARIAMENTE às 8h da manhã
 */
export async function checkProjectDeadlines() {
  console.log('[Job] Checking project deadlines...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  // ==================== 1. PROJETOS VENCENDO HOJE ====================
  const { data: dueTodayProjects } = await supabaseAdmin
    .from('projects')
    .select('id, title, owner_user_id, assigned_users, company_id, estimated_end_date')
    .eq('status', 'active')
    .gte('estimated_end_date', today.toISOString().split('T')[0])
    .lt('estimated_end_date', tomorrow.toISOString().split('T')[0]);

  if (dueTodayProjects) {
    for (const project of dueTodayProjects) {
      // Verificar se já notificamos hoje
      const { count } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('type', 'PROJECT_DEADLINE_TODAY')
        .gte('created_at', today.toISOString().split('T')[0]);

      if (count && count > 0) continue;

      const usersToNotify = [
        project.owner_user_id,
        ...(project.assigned_users || [])
      ].filter((v, i, a) => a.indexOf(v) === i);

      for (const userId of usersToNotify) {
        await NotificationService.create({
          userId,
          companyId: project.company_id,
          type: 'PROJECT_DEADLINE_TODAY',
          title: '⚠️ Projeto Vence Hoje!',
          message: `O projeto "${project.title}" tem prazo para HOJE (${formatDate(project.estimated_end_date)}).`,
          actionUrl: `/projects/${project.id}`,
          projectId: project.id,
          data: {
            project_title: project.title,
            deadline: project.estimated_end_date,
          },
        });
      }

      // Disparar Trigger de Automação (Flow Builder) para o dono do projeto
      if (project.owner_user_id) {
        await notifyProjectDueToday(project.id, project.title, project.owner_user_id, project.company_id);
      }
    }
    console.log(`[Job] Notified ${dueTodayProjects.length} projects due today`);
  }

  // ==================== 2. PROJETOS VENCENDO AMANHÃ ====================
  const { data: dueTomorrowProjects } = await supabaseAdmin
    .from('projects')
    .select('id, title, owner_user_id, assigned_users, company_id, estimated_end_date')
    .eq('status', 'active')
    .gte('estimated_end_date', tomorrow.toISOString().split('T')[0])
    .lt('estimated_end_date', threeDaysFromNow.toISOString().split('T')[0]);

  if (dueTomorrowProjects) {
    for (const project of dueTomorrowProjects) {
      // Verificar se já notificamos hoje
      const { count } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('type', 'PROJECT_DEADLINE_TOMORROW')
        .gte('created_at', today.toISOString().split('T')[0]);

      if (count && count > 0) continue;

      const usersToNotify = [
        project.owner_user_id,
        ...(project.assigned_users || [])
      ].filter((v, i, a) => a.indexOf(v) === i);

      for (const userId of usersToNotify) {
        await NotificationService.create({
          userId,
          companyId: project.company_id,
          type: 'PROJECT_DEADLINE_TOMORROW',
          title: '📅 Projeto Vence Amanhã',
          message: `O projeto "${project.title}" tem prazo para AMANHÃ (${formatDate(project.estimated_end_date)}).`,
          actionUrl: `/projects/${project.id}`,
          projectId: project.id,
          data: {
            project_title: project.title,
            deadline: project.estimated_end_date,
          },
        });
      }

      // Disparar Trigger de Automação (Flow Builder) para o dono do projeto
      if (project.owner_user_id) {
        await notifyProjectDueTomorrow(project.id, project.title, project.owner_user_id, project.company_id);
      }
    }
    console.log(`[Job] Notified ${dueTomorrowProjects.length} projects due tomorrow`);
  }

  // ==================== 3. PROJETOS COM PRAZO EM 3 DIAS ====================
  const { data: warningProjects } = await supabaseAdmin
    .from('projects')
    .select('id, title, owner_user_id, assigned_users, company_id, estimated_end_date')
    .eq('status', 'active')
    .eq('estimated_end_date', threeDaysFromNow.toISOString().split('T')[0]);

  if (warningProjects) {
    for (const project of warningProjects) {
       // Verificar se já notificamos hoje
      const { count } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('type', 'PROJECT_DEADLINE_WARNING')
        .gte('created_at', today.toISOString().split('T')[0]);

      if (count && count > 0) continue;

      const usersToNotify = [
        project.owner_user_id,
        ...(project.assigned_users || [])
      ].filter((v, i, a) => a.indexOf(v) === i);

      for (const userId of usersToNotify) {
        await NotificationService.create({
          userId,
          companyId: project.company_id,
          type: 'PROJECT_DEADLINE_WARNING',
          title: '⏰ Alerta de Prazo',
          message: `O projeto "${project.title}" vence em 3 dias (${formatDate(project.estimated_end_date)}).`,
          actionUrl: `/projects/${project.id}`,
          projectId: project.id,
          data: {
            project_title: project.title,
            deadline: project.estimated_end_date,
            days_remaining: 3,
          },
        });
      }

      // Disparar Trigger de Automação (Flow Builder) para o dono do projeto
      if (project.owner_user_id) {
        await notifyProjectWarning(project.id, project.title, project.owner_user_id, project.company_id, 3);
      }
    }
    console.log(`[Job] Notified ${warningProjects.length} projects with 3-day warning`);
  }

  // ==================== 4. PROJETOS ATRASADOS ====================
  const { data: overdueProjects } = await supabaseAdmin
    .from('projects')
    .select('id, title, owner_user_id, assigned_users, company_id, estimated_end_date')
    .eq('status', 'active')
    .lt('estimated_end_date', today.toISOString().split('T')[0]);

  if (overdueProjects) {
    for (const project of overdueProjects) {
      // Verificar se já notificamos hoje
      const { count } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('type', 'PROJECT_OVERDUE')
        .gte('created_at', today.toISOString().split('T')[0]);

      if (count && count > 0) continue;

      const usersToNotify = [
        project.owner_user_id,
        ...(project.assigned_users || [])
      ].filter((v, i, a) => a.indexOf(v) === i);

      const daysOverdue = Math.floor(
        (today.getTime() - new Date(project.estimated_end_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      for (const userId of usersToNotify) {
        await NotificationService.create({
          userId,
          companyId: project.company_id,
          type: 'PROJECT_OVERDUE',
          title: '🚨 Projeto Atrasado!',
          message: `O projeto "${project.title}" está atrasada há ${daysOverdue} dia(s). Prazo era ${formatDate(project.estimated_end_date)}.`,
          actionUrl: `/projects/${project.id}`,
          projectId: project.id,
          data: {
            project_title: project.title,
            deadline: project.estimated_end_date,
            days_overdue: daysOverdue,
          },
        });
      }

      // Disparar Trigger de Automação (Flow Builder) para o dono do projeto
      if (project.owner_user_id) {
        await notifyProjectOverdue(project.id, project.title, project.owner_user_id, project.company_id);
      }
    }
    console.log(`[Job] Notified ${overdueProjects.length} overdue projects`);
  }

  console.log('[Job] ✅ Project deadline check completed');
}

/**
 * Job para verificar prazos de tarefas
 */
export async function checkTaskDeadlines() {
  console.log('[Job] Checking task deadlines...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  // ==================== 1. TAREFAS VENCENDO HOJE ====================
  const { data: dueTodayTasks } = await supabaseAdmin
    .from('project_tasks')
    .select(`
      id,
      title,
      assigned_to,
      due_date,
      project_id,
      projects (
        title,
        company_id,
        owner_user_id
      )
    `)
    .eq('is_completed', false)
    .gte('due_date', today.toISOString().split('T')[0])
    .lt('due_date', tomorrow.toISOString().split('T')[0]);

  if (dueTodayTasks) {
    for (const task of dueTodayTasks) {
      if (task.assigned_to) {
        // Verificar se já notificamos hoje
        const { count } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('task_id', task.id)
          .eq('type', 'TASK_DUE_TODAY')
          .gte('created_at', today.toISOString().split('T')[0]);

        if (count && count > 0) continue;

        const project = task.projects as any;
        await NotificationService.create({
          userId: task.assigned_to,
          companyId: project.company_id,
          type: 'TASK_DUE_TODAY',
          title: '⚠️ Tarefa Vence Hoje!',
          message: `A tarefa "${task.title}" (projeto: ${project.title}) vence HOJE.`,
          actionUrl: `/projects/${task.project_id}?tab=tasks`,
          projectId: task.project_id,
          taskId: task.id,
          data: {
            task_title: task.title,
            project_title: project.title,
            due_date: task.due_date,
          },
        });

        // Disparar Trigger de Automação (Flow Builder)
        await notifyTaskDueToday(task.id, task.title, task.assigned_to, project.company_id, 'PROJECT_TASK');
      }
    }
    console.log(`[Job] Notified ${dueTodayTasks.length} tasks due today`);
  }

  // ==================== 2. TAREFAS VENCENDO AMANHÃ ====================
  const { data: dueTomorrowTasks } = await supabaseAdmin
    .from('project_tasks')
    .select(`
      id,
      title,
      assigned_to,
      due_date,
      project_id,
      projects (
        title,
        company_id
      )
    `)
    .eq('is_completed', false)
    .gte('due_date', tomorrow.toISOString().split('T')[0])
    .lt('due_date', twoDaysFromNow.toISOString().split('T')[0]);

  if (dueTomorrowTasks) {
    for (const task of dueTomorrowTasks) {
      if (task.assigned_to) {
        // Verificar se já notificamos hoje
        const { count } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('task_id', task.id)
          .eq('type', 'TASK_DUE_TOMORROW')
          .gte('created_at', today.toISOString().split('T')[0]);

        if (count && count > 0) continue;

        const project = task.projects as any;
        await NotificationService.create({
          userId: task.assigned_to,
          companyId: project.company_id,
          type: 'TASK_DUE_TOMORROW',
          title: '📅 Tarefa Vence Amanhã',
          message: `A tarefa "${task.title}" (projeto: ${project.title}) vence AMANHÃ.`,
          actionUrl: `/projects/${task.project_id}?tab=tasks`,
          projectId: task.project_id,
          taskId: task.id,
          data: {
            task_title: task.title,
            project_title: project.title,
            due_date: task.due_date,
          },
        });

        // Disparar Trigger de Automação (Flow Builder)
        await notifyTaskDueTomorrow(task.id, task.title, task.assigned_to, project.company_id, 'PROJECT_TASK');
      }
    }
    console.log(`[Job] Notified ${dueTomorrowTasks.length} tasks due tomorrow`);
  }

  // ==================== 3. TAREFAS ATRASADAS ====================
  const { data: overdueTasks } = await supabaseAdmin
    .from('project_tasks')
    .select(`
      id,
      title,
      assigned_to,
      due_date,
      project_id,
      projects (
        title,
        company_id
      )
    `)
    .eq('is_completed', false)
    .lt('due_date', today.toISOString().split('T')[0]);

  if (overdueTasks) {
    for (const task of overdueTasks) {
      if (task.assigned_to) {
        // Verificar se já notificamos hoje
        const { count } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('task_id', task.id)
          .eq('type', 'TASK_OVERDUE')
          .gte('created_at', today.toISOString().split('T')[0]);

        if (count && count > 0) continue;

        const project = task.projects as any;
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        await NotificationService.create({
          userId: task.assigned_to,
          companyId: project.company_id,
          type: 'TASK_OVERDUE',
          title: '🚨 Tarefa Atrasada!',
          message: `A tarefa "${task.title}" está atrasada há ${daysOverdue} dia(s).`,
          actionUrl: `/projects/${task.project_id}?tab=tasks`,
          projectId: task.project_id,
          taskId: task.id,
          data: {
            task_title: task.title,
            project_title: project.title,
            due_date: task.due_date,
            days_overdue: daysOverdue,
          },
        });

        // Disparar Trigger de Automação (Flow Builder)
        await notifyTaskOverdue(task.id, task.title, task.assigned_to, project.company_id, 'PROJECT_TASK');
      }
    }
    console.log(`[Job] Notified ${overdueTasks.length} overdue tasks`);
  }

  console.log('[Job] ✅ Task deadline check completed');
}

// ==================== HELPERS ====================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
