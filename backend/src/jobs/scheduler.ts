// backend/src/jobs/scheduler.ts

import cron from 'node-cron';
import { checkProjectDeadlines, checkTaskDeadlines } from './check-project-deadlines.job.js';
import { checkGeneralTaskDeadlines } from './check-general-tasks.job.js';
import { NotificationService } from '../services/notification.service.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { queueNextStep } from '../services/flow-engine.service.js';

import { dailyConsolidationJob, weeklyOpenAISyncJob } from './sync-openai-usage.job.js';

export function startScheduler() {
  console.log('[Scheduler] Starting notification scheduler...');

  // ==================== BILLING & USAGE JOBS ====================
  // Job de consolidação diária de faturamento (2h da manhã)
  cron.schedule('0 2 * * *', async () => {
    try {
      await dailyConsolidationJob();
    } catch (error) {
      console.error('[Scheduler] Error in dailyConsolidationJob:', error);
    }
  }, { timezone: 'America/Sao_Paulo' });

  // Job de sincronização semanal com OpenAI (Domingo às 3h da manhã)
  cron.schedule('0 3 * * 0', async () => {
    try {
      await weeklyOpenAISyncJob();
    } catch (error) {
      console.error('[Scheduler] Error in weeklyOpenAISyncJob:', error);
    }
  }, { timezone: 'America/Sao_Paulo' });

  // ==================== VERIFICAR PRAZOS (A cada 1 hora para maior responsividade) ====================
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running hourly deadline check...');
    try {
      await checkProjectDeadlines();
      await checkTaskDeadlines();
      await checkGeneralTaskDeadlines();
    } catch (error) {
      console.error('[Scheduler] Error in deadline check:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // Executar uma vez no boot (opcional, para garantir que as notificações do dia sejam enviadas se o server reiniciou)
  checkGeneralTaskDeadlines().catch(err => console.error('[Scheduler] Initial deadline check failed:', err));

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
    .eq('is_read', true)
    .lt('created_at', thirtyDaysAgo.toISOString());

  if (error) {
    console.error('[Cleanup] Error deleting old notifications:', error);
  } else {
    console.log('[Cleanup] ✅ Old notifications cleaned up');
  }
}
