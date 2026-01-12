// backend/src/routes/billing.ts

import type { Application } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { 
  getCompanyUsageLogs, 
  getCompanyMonthlyBills,
  consolidateMonthlyBill 
} from "../services/openai-usage.service.js";

async function resolveCompanyId(req: any): Promise<string> {
  const authId = String(req?. user?.id || "");
  if (!authId) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const companyId = req?. user?.company_id;
  if (!companyId) {
    throw Object.assign(new Error("Usuario sem company_id"), { status: 404 });
  }

  return companyId;
}

export function registerBillingRoutes(app:  Application) {
  
  // GET - Faturas mensais
  app.get("/billing/monthly", requireAuth, async (req:  any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const limit = parseInt(req.query.limit as string) || 12;
      
      const bills = await getCompanyMonthlyBills(companyId, limit);
      
      return res.json(bills);
    } catch (error:  any) {
      return res. status(500).json({ error: error.message });
    }
  });

  // GET - Logs de uso detalhado
  app.get("/billing/usage-logs", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      
      const options:  any = {
        limit: parseInt(req.query.limit as string) || 1000,
      };

      if (req.query.start_date) {
        options.startDate = new Date(req. query.start_date as string);
      }
      if (req.query.end_date) {
        options.endDate = new Date(req.query. end_date as string);
      }
      if (req.query.agent_id) {
        options.agentId = req.query. agent_id as string;
      }

      const logs = await getCompanyUsageLogs(companyId, options);
      
      return res.json(logs);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // GET - Dashboard summary
  app.get("/billing/summary", requireAuth, async (req:  any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      
      // Buscar dados do mês atual
      const currentMonth = new Date();
      const bills = await getCompanyMonthlyBills(companyId, 1);
      const currentBill = bills[0] || null;

      // Buscar logs dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentLogs = await getCompanyUsageLogs(companyId, {
        startDate: sevenDaysAgo,
        limit: 10000,
      });

      // Calcular estatísticas
      const totalRequests = recentLogs.length;
      const totalTokens = recentLogs.reduce((sum, log) => sum + log.total_tokens, 0);
      const totalCost = recentLogs.reduce((sum, log) => sum + parseFloat(log.estimated_cost), 0);

      // Agrupar por dia
      const dailyUsage:  Record<string, any> = {};
      recentLogs.forEach(log => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        if (!dailyUsage[date]) {
          dailyUsage[date] = { requests: 0, tokens: 0, cost: 0 };
        }
        dailyUsage[date].requests += 1;
        dailyUsage[date].tokens += log. total_tokens;
        dailyUsage[date].cost += parseFloat(log.estimated_cost);
      });

      return res.json({
        current_month: {
          month: currentMonth.toISOString().slice(0, 7),
          total_cost: currentBill?.total_cost_usd || 0,
          total_requests: currentBill?.total_requests || 0,
          total_tokens:  currentBill?.total_tokens || 0,
          status: currentBill?.status || 'pending',
        },
        last_7_days: {
          total_requests: totalRequests,
          total_tokens: totalTokens,
          total_cost: totalCost.toFixed(4),
          daily_breakdown: dailyUsage,
        },
      });
    } catch (error:  any) {
      return res. status(500).json({ error: error.message });
    }
  });

  // POST - Consolidar manualmente (força atualização)
  app.post("/billing/consolidate", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const month = req.body.month 
        ? new Date(req. body.month) 
        : new Date(); // Mês atual por padrão
      
      await consolidateMonthlyBill(companyId, month);
      
      return res.json({ 
        success: true, 
        message:  'Billing consolidated successfully' 
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // GET - Exportar CSV de logs
  app.get("/billing/export/csv", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      
      const startDate = req.query.start_date 
        ? new Date(req.query.start_date as string) 
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endDate = req.query.end_date 
        ? new Date(req.query.end_date as string) 
        : new Date();

      const logs = await getCompanyUsageLogs(companyId, {
        startDate,
        endDate,
        limit: 50000,
      });

      // Gerar CSV
      const csvRows = [
        ['Data', 'Agente ID', 'Chat ID', 'Modelo', 'Tokens Prompt', 'Tokens Completion', 'Total Tokens', 'Custo (USD)', 'Tipo']. join(',')
      ];

      logs.forEach(log => {
        csvRows.push([
          new Date(log.created_at).toISOString(),
          log.agent_id || '',
          log.chat_id || '',
          log.model,
          log.prompt_tokens,
          log.completion_tokens,
          log.total_tokens,
          log.estimated_cost,
          log.request_type || 'chat',
        ].join(','));
      });

      const csv = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="usage-export-${startDate.toISOString().slice(0, 10)}-${endDate.toISOString().slice(0, 10)}.csv"`);
      
      return res.send(csv);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });
}
