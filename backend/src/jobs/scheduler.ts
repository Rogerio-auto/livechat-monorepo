// backend/src/jobs/scheduler.ts

import cron from 'node-cron';
import { checkProjectDeadlines, checkTaskDeadlines } from './check-project-deadlines.job.ts';
import { processPendingNotifications } from '../services/notification.service.ts';
import { supabaseAdmin } from '../lib/supabase.ts';
import { queueNextStep } from '../services/flow.engine.js';

export function startScheduler() {
  console.log('[Scheduler] Starting notification scheduler...');

  // ==================== VERIFICAR PRAZOS (Diariamente às 8h) ====================
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Running daily deadline check...');
    try {
      await checkProjectDeadlines();
      await checkTaskDeadlines();
    } catch (error) {
      console.error('[Scheduler] Error in deadline check:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo' // Ajustar para seu timezone
  });

  // ==================== PROCESSAR NOTIFICAÇÕES PENDENTES (A cada 5 minutos) ====================
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Processing pending notifications...');
    try {
      await processPendingNotifications();
    } catch (error) {
      console.error('[Scheduler] Error processing notifications:', error);
    }
  });

  // ==================== PROCESSAR FLOWS AGUARDANDO (A cada minuto) ====================
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString();
      const { data: waitingExecutions } = await supabaseAdmin
        .from('flow_executions')
        .select('id')
        .eq('status', 'WAITING')
        .lte('next_step_at', now);

      if (waitingExecutions && waitingExecutions.length > 0) {
        console.log(`[Scheduler] Waking up ${waitingExecutions.length} flows...`);
        for (const exec of waitingExecutions) {
          await supabaseAdmin
            .from('flow_executions')
            .update({ status: 'RUNNING', next_step_at: null })
            .eq('id', exec.id);
          
          await queueNextStep(exec.id);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error waking up flows:', error);
    }
  });

  // ==================== LIMPEZA DE NOTIFICAÇÕES ANTIGAS (Semanalmente) ====================
  cron.schedule('0 3 * * 0', async () => {
    console.log('[Scheduler] Cleaning up old notifications...');
    try {
      await cleanupOldNotifications();
    } catch (error) {
      console.error('[Scheduler] Error cleaning notifications:', error);
    }
  });

  console.log('[Scheduler] ✅ Notification scheduler started');
}

// ==================== CLEANUP ====================

async function cleanupOldNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Deletar notificações lidas com mais de 30 dias
  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('status', 'READ')
    .lt('created_at', thirtyDaysAgo.toISOString());

  if (error) {
    console.error('[Cleanup] Error deleting old notifications:', error);
  } else {
    console.log('[Cleanup] ✅ Old notifications cleaned up');
  }
}
