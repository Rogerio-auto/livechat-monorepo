// backend/src/jobs/check-general-tasks.job.ts

import { supabaseAdmin } from "../lib/supabase.ts";
import { NotificationService } from "../services/NotificationService.ts";
import { notifyTaskDueToday, notifyTaskDueTomorrow, notifyTaskOverdue } from "../services/notification-triggers.service.ts";

/**
 * Job para verificar prazos de tarefas gerais (tabela 'tasks')
 */
export async function checkGeneralTaskDeadlines() {
  console.log('[Job] Checking general task deadlines...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split('T')[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().split('T')[0];

  // 1. TAREFAS VENCENDO HOJE
  const { data: dueTodayTasks } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .not('status', 'eq', 'COMPLETED')
    .not('status', 'eq', 'CANCELLED')
    .gte('due_date', todayISO)
    .lt('due_date', tomorrowISO);

  if (dueTodayTasks) {
    for (const task of dueTodayTasks) {
      if (task.assigned_to) {
        // Verificar se já notificamos hoje para esta tarefa
        // Como o task_id na tabela notificações tem FK para project_tasks, as tarefas gerais usam esse campo como NULL
        // e guardamos o ID original no JSONB 'data'
        const { count } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .contains('data', { taskId: task.id })
          .eq('type', 'TASK_DUE_TODAY')
          .gte('created_at', todayISO);
        
        if (count && count > 0) {
          console.log(`[Job] Task ${task.id} already notified today, skipping`);
          continue;
        }

        // Notificação Unificada (WebSocket + WhatsApp)
        await NotificationService.create({
          userId: task.assigned_to,
          companyId: task.company_id,
          type: 'TASK_DUE_TODAY',
          title: '⚠️ Tarefa Vence Hoje!',
          message: `A tarefa "${task.title}" vence HOJE.`,
          actionUrl: `/tarefas`,
          priority: 'HIGH',
          data: {
            taskId: task.id,
            task_title: task.title,
            due_date: task.due_date,
          },
        });

        // 2. Disparar Trigger de Automação (Flow Builder)
        await notifyTaskDueToday(task.id, task.title, task.assigned_to, task.company_id, 'TASK');
      }
    }
    console.log(`[Job] Notified ${dueTodayTasks.length} general tasks due today`);
  }

  // 1.1 TAREFAS VENCENDO AMANHÃ
  const { data: dueTomorrowTasks } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .not('status', 'eq', 'COMPLETED')
    .not('status', 'eq', 'CANCELLED')
    .gte('due_date', tomorrowISO)
    .lt('due_date', new Date(tomorrow.getTime() + 86400000).toISOString().split('T')[0]);

  if (dueTomorrowTasks) {
    for (const task of dueTomorrowTasks) {
      if (task.assigned_to) {
        // Verificar se já notificamos hoje
        const { count } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .contains('data', { taskId: task.id })
          .eq('type', 'TASK_DUE_TOMORROW')
          .gte('created_at', todayISO);
        
        if (count && count > 0) continue;

        await NotificationService.create({
          userId: task.assigned_to,
          companyId: task.company_id,
          type: 'TASK_DUE_TOMORROW',
          title: '📅 Tarefa Vence Amanhã',
          message: `A tarefa "${task.title}" vence AMANHÃ.`,
          actionUrl: `/tarefas`,
          priority: 'NORMAL',
          data: {
            taskId: task.id,
            task_title: task.title,
            due_date: task.due_date,
          },
        });

        // 2. Disparar Trigger de Automação (Flow Builder)
        await notifyTaskDueTomorrow(task.id, task.title, task.assigned_to, task.company_id, 'TASK');
      }
    }
    console.log(`[Job] Notified ${dueTomorrowTasks.length} general tasks due tomorrow`);
  }

  // 2. TAREFAS ATRASADAS
  const { data: overdueTasks } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .not('status', 'eq', 'COMPLETED')
    .not('status', 'eq', 'CANCELLED')
    .lt('due_date', todayISO);

  if (overdueTasks) {
    for (const task of overdueTasks) {
      if (task.assigned_to) {
        // Verificar se já notificamos hoje para esta tarefa atrasada
        const { count } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .contains('data', { taskId: task.id })
          .eq('type', 'TASK_OVERDUE')
          .gte('created_at', todayISO);
        
        if (count && count > 0) {
          console.log(`[Job] Task ${task.id} already notified of overdue today, skipping`);
          continue;
        }

        // Notificação Unificada (WebSocket + WhatsApp)
        await NotificationService.create({
          userId: task.assigned_to,
          companyId: task.company_id,
          type: 'TASK_OVERDUE',
          title: '🚨 Tarefa Atrasada!',
          message: `A tarefa "${task.title}" está atrasada.`,
          actionUrl: `/tarefas`,
          priority: 'URGENT',
          data: {
            taskId: task.id,
            task_title: task.title,
            due_date: task.due_date,
          },
        });

        // 2. Disparar Trigger de Automação (Flow Builder)
        await notifyTaskOverdue(task.id, task.title, task.assigned_to, task.company_id, 'TASK');
      }
    }
    console.log(`[Job] Notified ${overdueTasks.length} general tasks overdue`);
  }

  console.log('[Job] ✅ General task deadline check completed');
}
