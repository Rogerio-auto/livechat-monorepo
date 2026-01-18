// backend/src/services/admin/companyBilling.service.ts
import { supabaseAdmin } from "../../lib/supabase.js";

export class CompanyBillingService {
  async getBillingByCompany(companyId: string) {
    const { data: history, error: historyError } = await supabaseAdmin
      .from("payment_history")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (historyError) throw historyError;

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select(`
        *,
        plans (
          name,
          display_name,
          price_monthly,
          limits,
          features
        )
      `)
      .eq("company_id", companyId)
      .single();

    if (subError && subError.code !== 'PGRST116') throw subError;

    return {
      history,
      subscription,
      stats: {
        total_paid: history?.filter(p => p.status === 'paid').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0,
        last_payment: history?.find(p => p.status === 'paid'),
        pending_count: history?.filter(p => p.status === 'pending').length || 0
      }
    };
  }
}

export const companyBillingService = new CompanyBillingService();
