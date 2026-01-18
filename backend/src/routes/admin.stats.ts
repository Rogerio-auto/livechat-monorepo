import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";

// Middleware para verificar se é ADMIN (Duplicado de companies.ts por enquanto)
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

async function requireAdmin(req: any, res: any, next: any) {
  const authUserId = req.user?.id;
  if (!authUserId) return res.status(401).json({ error: "Não autenticado" });
  
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("user_id", authUserId)
    .maybeSingle();
  
  const normalizedRole = String(user?.role || "").toUpperCase();
  if (!ADMIN_ROLES.includes(normalizedRole)) {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores autorizados." });
  }
  
  next();
}

export function registerAdminStatsRoutes(app: express.Application) {
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      // 1. Total Companies
      const { count: totalCompanies, error: companiesError } = await supabaseAdmin
        .from("companies")
        .select("id", { count: "exact", head: true });

      if (companiesError) throw companiesError;

      // 2. Active Companies (assuming is_active = true)
      const { count: activeCompanies, error: activeError } = await supabaseAdmin
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      if (activeError) throw activeError;

      // 3. Total Users
      const { count: totalUsers, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true });

      if (usersError) throw usersError;

      // 4. MRR Calculation
      const { data: activeSubs, error: subsError } = await supabaseAdmin
        .from("subscriptions")
        .select(`
          status,
          billing_cycle,
          plans (
            price_monthly,
            price_yearly
          )
        `)
        .eq("status", "active");

      if (subsError) throw subsError;

      let mrr = 0;
      activeSubs?.forEach((sub: any) => {
        const plan = sub.plans;
        if (!plan) return;

        if (sub.billing_cycle === "monthly") {
          mrr += Number(plan.price_monthly || 0);
        } else {
          // Pro-rate yearly for MRR
          mrr += Number(plan.price_yearly || 0) / 12;
        }
      });

      // 5. Usage stats (Optional for later)
      // 6. Infra Health (Mocked)
      // In a real scenario, we would check Redis/RabbitMQ connections
      const infraHealth = {
        database: "healthy",
        redis: "healthy",
        rabbitmq: "healthy",
        storage: "healthy"
      };

      return res.json({
        kpis: {
          mrr,
          total_companies: totalCompanies || 0,
          active_companies: activeCompanies || 0,
          total_users: totalUsers || 0,
        },
        infra: infraHealth
      });

    } catch (error: any) {
      console.error("Admin Stats Error:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas do sistema" });
    }
  });
}
