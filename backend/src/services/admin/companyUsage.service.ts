// backend/src/services/admin/companyUsage.service.ts
import { supabaseAdmin } from "../../lib/supabase.js";

interface UsagePeriod {
  metric: string;
  value: number;
  period_start: string;
}

export class CompanyUsageService {
  async getUsageByCompany(companyId: string, metric?: string) {
    let query = supabaseAdmin
      .from("usage_tracking")
      .select("*")
      .eq("company_id", companyId)
      .order("period_start", { ascending: true });

    if (metric) {
      query = query.eq("metric", metric);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Grouping for charts if needed
    const metrics = ['messages_sent', 'ai_calls', 'storage_mb'];
    const stats: any = {};
    
    metrics.forEach(m => {
      stats[m] = data?.filter(d => d.metric === m) || [];
    });

    return {
      history: data,
      grouped: stats,
      current: {
        messages: data?.filter(d => d.metric === 'messages_sent').pop()?.value || 0,
        ai: data?.filter(d => d.metric === 'ai_calls').pop()?.value || 0,
        storage: data?.filter(d => d.metric === 'storage_mb').pop()?.value || 0,
      }
    };
  }
}

export const companyUsageService = new CompanyUsageService();
