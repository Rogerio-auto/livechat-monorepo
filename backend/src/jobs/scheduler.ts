// backend/src/jobs/scheduler.ts

import cron from 'node-cron';
import { checkProjectDeadlines, checkTaskDeadlines } from './check-project-deadlines.job.ts';
import { processPendingNotifications } from '../services/notification.service.ts';
import { supabaseAdmin } from '../lib/supabase.ts';

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
