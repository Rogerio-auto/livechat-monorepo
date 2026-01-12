// backend/src/jobs/sync-openai-usage.job.ts

import { supabaseAdmin } from "../lib/supabase.js";
import { 
  consolidateMonthlyBill, 
  syncUsageFromOpenAI,
  syncBillToStripe
} from "../services/openai-usage.service.js";

/**
 * Job para consolidar faturas mensais
 * Deve rodar DIARIAMENTE às 2h da manhã
 */
export async function dailyConsolidationJob() {
  console.log('[Job] Starting daily usage consolidation...');
  
  try {
    // Buscar todas as empresas ativas
    const { data: companies, error } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .eq("is_active", true);

    if (error) throw error;
    if (! companies || companies.length === 0) {
      console.log('[Job] No active companies found');
      return;
    }

    const currentMonth = new Date();
    let successCount = 0;
    let errorCount = 0;

    for (const company of companies) {
      try {
        await consolidateMonthlyBill(company.id, currentMonth);
        successCount++;
        console.log(`[Job] ✅ Consolidated ${company.name}`);
      } catch (error:  any) {
        errorCount++;
        console.error(`[Job] ❌ Failed to consolidate ${company.name}:`, error.message);
      }
    }

    console.log(`[Job] Consolidation complete:  ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    console.error('[Job] Fatal error in consolidation job:', error);
    throw error;
  }
}

/**
 * Job para sincronizar com OpenAI Usage API
 * Deve rodar SEMANALMENTE (aos domingos às 3h)
 */
export async function weeklyOpenAISyncJob() {
  console.log('[Job] Starting OpenAI usage sync...');
  
  try {
    // Buscar todas as integrações auto-geradas
    const { data: integrations, error } = await supabaseAdmin
      .from("integrations_openai")
      .select("id, company_id, openai_project_id, name")
      .eq("is_active", true)
      .eq("auto_generated", true)
      .not("openai_project_id", "is", null);

    if (error) throw error;
    if (! integrations || integrations.length === 0) {
      console.log('[Job] No auto-generated integrations found');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const integration of integrations) {
      try {
        await syncUsageFromOpenAI(
          integration.company_id,
          integration.id,
          integration.openai_project_id! 
        );
        successCount++;
        console.log(`[Job] ✅ Synced ${integration.name}`);
        
        // Aguardar 1s entre requests para não estourar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        errorCount++;
        console.error(`[Job] ❌ Failed to sync ${integration.name}:`, error.message);
      }
    }

    console.log(`[Job] Sync complete: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    console.error('[Job] Fatal error in sync job:', error);
    throw error;
  }
}

/**
 * Job para sincronizar faturas consolidadas com o Stripe
 * Roda periodicamente para garantir que o uso seja cobrado
 */
export async function stripeSyncJob() {
  console.log('[Job] Starting Stripe usage sync...');
  
  try {
    // Buscar faturas 'pending' que tenham custo > 0
    const { data: bills, error } = await supabaseAdmin
      .from("company_monthly_bills")
      .select("company_id, billing_month, total_cost_usd")
      .eq("status", "pending")
      .gt("total_cost_usd", 0);

    if (error) throw error;
    if (!bills || bills.length === 0) {
      console.log('[Job] No pending bills to sync to Stripe');
      return;
    }

    for (const bill of bills) {
      try {
        await syncBillToStripe(bill.company_id, bill.billing_month);
      } catch (err) {
        console.error(`[Job] Failed to sync bill for ${bill.company_id}:`, err);
      }
    }
  } catch (error) {
    console.error('[Job] Fatal error in stripe sync job:', error);
  }
}

/**
 * Job para limpar logs antigos (> 90 dias)
 * Deve rodar MENSALMENTE (dia 1 às 4h)
 */
export async function monthlyCleanupJob() {
  console.log('[Job] Starting monthly cleanup...');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 dias atrás

    const { error, count } = await supabaseAdmin
      .from("openai_usage_logs")
      .delete()
      .lt("created_at", cutoffDate.toISOString());

    if (error) throw error;

    console.log(`[Job] ✅ Cleaned up ${count || 0} old usage logs`);
  } catch (error) {
    console.error('[Job] Error in cleanup job:', error);
    throw error;
  }
}
