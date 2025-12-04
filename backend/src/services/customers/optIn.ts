// src/services/customers/optIn.ts
import { supabaseAdmin } from "../../lib/supabase.js";
import * as db from "../../pg.js";

export interface OptInRecord {
  customer_id: string;
  marketing_opt_in: boolean;
  opt_in_date?: string;
  opt_in_method?: string;
  opt_in_source?: string;
  opt_out_date?: string;
}

/**
 * Registra opt-in de marketing para um cliente
 */
export async function registerOptIn(params: {
  customerId: string;
  method: "whatsapp" | "website" | "checkout" | "import" | "manual";
  source?: string;
}): Promise<OptInRecord> {
  const { error, data } = await supabaseAdmin
    .from("customers")
    .update({
      marketing_opt_in: true,
      opt_in_date: new Date().toISOString(),
      opt_in_method: params.method,
      opt_in_source: params.source,
      opt_out_date: null, // Limpa opt-out anterior
    })
    .eq("id", params.customerId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`[Opt-in] ✅ Cliente ${params.customerId} registrado: ${params.method}`);

  return {
    customer_id: data.id,
    marketing_opt_in: data.marketing_opt_in,
    opt_in_date: data.opt_in_date,
    opt_in_method: data.opt_in_method,
    opt_in_source: data.opt_in_source,
  };
}

/**
 * Registra opt-out (remoção de consentimento)
 */
export async function registerOptOut(customerId: string): Promise<OptInRecord> {
  const { error, data } = await supabaseAdmin
    .from("customers")
    .update({
      marketing_opt_in: false,
      opt_out_date: new Date().toISOString(),
    })
    .eq("id", customerId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`[Opt-out] ✅ Cliente ${customerId} removido de marketing`);

  // Remover de campanhas ativas
  await removeFromActiveCampaigns(customerId);

  return {
    customer_id: data.id,
    marketing_opt_in: data.marketing_opt_in,
    opt_out_date: data.opt_out_date,
  };
}

/**
 * Verifica status de opt-in de um cliente
 */
export async function getOptInStatus(customerId: string): Promise<OptInRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, marketing_opt_in, opt_in_date, opt_in_method, opt_in_source, opt_out_date")
    .eq("id", customerId)
    .single();

  if (error) return null;

  return {
    customer_id: data.id,
    marketing_opt_in: data.marketing_opt_in,
    opt_in_date: data.opt_in_date,
    opt_in_method: data.opt_in_method,
    opt_in_source: data.opt_in_source,
    opt_out_date: data.opt_out_date,
  };
}

/**
 * Verifica opt-in por telefone
 */
export async function getOptInStatusByPhone(phone: string): Promise<OptInRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, marketing_opt_in, opt_in_date, opt_in_method, opt_in_source, opt_out_date")
    .eq("phone", phone)
    .single();

  if (error) return null;

  return {
    customer_id: data.id,
    marketing_opt_in: data.marketing_opt_in,
    opt_in_date: data.opt_in_date,
    opt_in_method: data.opt_in_method,
    opt_in_source: data.opt_in_source,
    opt_out_date: data.opt_out_date,
  };
}

/**
 * Remove cliente de todas as campanhas ativas
 */
async function removeFromActiveCampaigns(customerId: string): Promise<void> {
  // Buscar phone do cliente
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("phone")
    .eq("id", customerId)
    .single();

  if (!customer?.phone) return;

  // Buscar campanhas ativas
  const { data: activeCampaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .in("status", ["SCHEDULED", "RUNNING"]);

  if (!activeCampaigns || activeCampaigns.length === 0) return;

  const campaignIds = activeCampaigns.map(c => c.id);

  // Remover de recipients de campanhas ativas
  const { error } = await supabaseAdmin
    .from("campaign_recipients")
    .delete()
    .eq("phone", customer.phone)
    .in("campaign_id", campaignIds);

  if (error) {
    console.error(`[Opt-out] Erro ao remover de campanhas:`, error);
  } else {
    console.log(`[Opt-out] Cliente ${customerId} removido de ${campaignIds.length} campanhas ativas`);
  }
}

/**
 * Conta quantos recipients de uma campanha NÃO têm opt-in
 */
export async function countRecipientsWithoutOptIn(campaignId: string): Promise<number> {
  // Usar SQL direto (bypassa cache do PostgREST)
  const result = await db.oneOrNone<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM campaign_recipients
     WHERE campaign_id = $1
       AND (marketing_opt_in IS NULL OR marketing_opt_in = false)`,
    [campaignId]
  );

  return parseInt(result?.count || "0", 10);
}

/**
 * Registra opt-in em massa para múltiplos telefones
 */
export async function bulkRegisterOptIn(params: {
  phones: string[];
  method: "whatsapp" | "website" | "checkout" | "import" | "manual";
  source?: string;
  companyId: string;
}): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const phone of params.phones) {
    try {
      // Buscar ou criar customer
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .eq("company_id", params.companyId)
        .single();

      if (customer) {
        await registerOptIn({
          customerId: customer.id,
          method: params.method,
          source: params.source,
        });
        result.success++;
      } else {
        result.failed++;
        result.errors.push(`Customer não encontrado: ${phone}`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Erro ao registrar ${phone}: ${(error as Error).message}`);
    }
  }

  console.log(`[Opt-in Bulk] ✅ ${result.success} registrados, ❌ ${result.failed} falharam`);

  return result;
}
