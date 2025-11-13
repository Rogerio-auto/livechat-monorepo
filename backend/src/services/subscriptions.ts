import db from "../pg.ts";

// ========== TYPES ==========
export interface Plan {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  price_monthly: number;
  price_yearly?: number | null;
  limits: PlanLimits;
  features: PlanFeatures;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_yearly?: string | null;
  stripe_product_id?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string | null;
}

export interface PlanLimits {
  users: number;              // -1 = ilimitado
  inboxes: number;
  ai_agents: number;
  messages_per_month: number;
  storage_mb: number;
  contacts: number;
  campaigns_per_month: number;
}

export interface PlanFeatures {
  basic_templates?: boolean;
  basic_reports?: boolean;
  email_support?: boolean;
  api_access?: boolean;
  webhooks?: boolean;
  white_label?: boolean;
  priority_support?: boolean;
  custom_templates?: boolean;
  advanced_reports?: boolean;
  dedicated_manager?: boolean;
  custom_integrations?: boolean;
  "24_7_support"?: boolean;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: "monthly" | "yearly";
  trial_ends_at?: string | null;
  trial_used: boolean;
  current_period_start?: string | null;
  current_period_end?: string | null;
  next_billing_date?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_latest_invoice_id?: string | null;
  stripe_payment_method_id?: string | null;
  cancel_at_period_end: boolean;
  canceled_at?: string | null;
  cancel_reason?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
}

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "expired";

export interface SubscriptionWithPlan extends Subscription {
  plan: Plan;
}

export interface UsageTracking {
  id: string;
  company_id: string;
  metric: UsageMetric;
  value: number;
  period_start: string;  // DATE
  period_end: string;    // DATE
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
}

export type UsageMetric = "messages_sent" | "ai_calls" | "storage_mb" | "api_calls" | "campaigns_sent";

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  isUnlimited: boolean;
  warningLevel?: "none" | "warning" | "critical";  // 80% = warning, 100% = critical
}

// ========== SUBSCRIPTION QUERIES ==========

/**
 * Obter subscription atual da empresa (com dados do plano)
 */
export async function getSubscription(companyId: string): Promise<SubscriptionWithPlan | null> {
  const row = await db.oneOrNone<Subscription & { plan: string }>(
    `SELECT 
      s.*,
      row_to_json(p.*) as plan
    FROM public.subscriptions s
    INNER JOIN public.plans p ON p.id = s.plan_id
    WHERE s.company_id = $1
    LIMIT 1`,
    [companyId]
  );

  if (!row) return null;

  return {
    ...row,
    plan: typeof row.plan === "string" ? JSON.parse(row.plan) : row.plan,
  } as SubscriptionWithPlan;
}

/**
 * Obter limites do plano atual da empresa
 */
export async function getPlanLimits(companyId: string): Promise<PlanLimits | null> {
  const row = await db.oneOrNone<{ limits: PlanLimits }>(
    `SELECT p.limits
    FROM public.subscriptions s
    INNER JOIN public.plans p ON p.id = s.plan_id
    WHERE s.company_id = $1
    LIMIT 1`,
    [companyId]
  );

  return row?.limits ?? null;
}

/**
 * Obter features do plano atual da empresa
 */
export async function getPlanFeatures(companyId: string): Promise<PlanFeatures | null> {
  const row = await db.oneOrNone<{ features: PlanFeatures }>(
    `SELECT p.features
    FROM public.subscriptions s
    INNER JOIN public.plans p ON p.id = s.plan_id
    WHERE s.company_id = $1
    LIMIT 1`,
    [companyId]
  );

  return row?.features ?? null;
}

/**
 * Obter todos os planos ativos
 */
export async function getActivePlans(): Promise<Plan[]> {
  return db.any<Plan>(
    `SELECT * FROM public.plans 
    WHERE is_active = TRUE 
    ORDER BY sort_order, price_monthly`
  );
}

/**
 * Obter plano por ID
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  return db.oneOrNone<Plan>(
    `SELECT * FROM public.plans WHERE id = $1`,
    [planId]
  );
}

/**
 * Obter plano por nome
 */
export async function getPlanByName(name: string): Promise<Plan | null> {
  return db.oneOrNone<Plan>(
    `SELECT * FROM public.plans WHERE name = $1 AND is_active = TRUE`,
    [name]
  );
}

// ========== USAGE TRACKING ==========

/**
 * Obter uso atual de uma métrica no período de billing atual
 */
export async function getCurrentUsage(companyId: string, metric: UsageMetric): Promise<number> {
  // Buscar período de billing atual da subscription
  const sub = await getSubscription(companyId);
  if (!sub || !sub.current_period_start || !sub.current_period_end) {
    return 0;
  }

  const periodStart = sub.current_period_start.split("T")[0]; // DATE
  const periodEnd = sub.current_period_end.split("T")[0];

  const row = await db.oneOrNone<{ value: number }>(
    `SELECT value FROM public.usage_tracking
    WHERE company_id = $1 
      AND metric = $2 
      AND period_start = $3
      AND period_end = $4
    LIMIT 1`,
    [companyId, metric, periodStart, periodEnd]
  );

  return row?.value ?? 0;
}

/**
 * Incrementar uso de uma métrica
 */
export async function incrementUsage(
  companyId: string,
  metric: UsageMetric,
  increment: number = 1
): Promise<void> {
  // Buscar período de billing atual
  const sub = await getSubscription(companyId);
  if (!sub || !sub.current_period_start || !sub.current_period_end) {
    console.warn(`[subscription] No active period for company ${companyId}, skipping usage increment`);
    return;
  }

  const periodStart = sub.current_period_start.split("T")[0];
  const periodEnd = sub.current_period_end.split("T")[0];

  await db.none(
    `INSERT INTO public.usage_tracking (company_id, metric, value, period_start, period_end)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (company_id, metric, period_start)
    DO UPDATE SET 
      value = usage_tracking.value + $3,
      updated_at = NOW()`,
    [companyId, metric, increment, periodStart, periodEnd]
  );
}

// ========== LIMIT CHECKING ==========

/**
 * Verificar se empresa pode criar mais de um recurso (users, inboxes, ai_agents)
 */
export async function checkLimit(
  companyId: string,
  resource: keyof PlanLimits
): Promise<LimitCheckResult> {
  const limits = await getPlanLimits(companyId);
  
  if (!limits) {
    return {
      allowed: false,
      limit: 0,
      current: 0,
      remaining: 0,
      isUnlimited: false,
      warningLevel: "critical",
    };
  }

  const limit = limits[resource];
  
  // -1 = ilimitado
  if (limit === -1) {
    return {
      allowed: true,
      limit: -1,
      current: 0,
      remaining: -1,
      isUnlimited: true,
      warningLevel: "none",
    };
  }

  // Contar quantos recursos a empresa já tem
  let current = 0;

  switch (resource) {
    case "users":
      current = await db.one<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM public.users WHERE company_id = $1`,
        [companyId]
      ).then(r => r.count);
      break;

    case "inboxes":
      current = await db.one<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM public.inboxes WHERE company_id = $1`,
        [companyId]
      ).then(r => r.count);
      break;

    case "ai_agents":
      current = await db.one<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM public.agents WHERE company_id = $1 AND status != 'ARCHIVED'`,
        [companyId]
      ).then(r => r.count);
      break;

    case "messages_per_month":
      current = await getCurrentUsage(companyId, "messages_sent");
      break;

    case "campaigns_per_month":
      current = await getCurrentUsage(companyId, "campaigns_sent");
      break;

    default:
      // Para outros recursos, assumir 0
      current = 0;
  }

  const remaining = Math.max(0, limit - current);
  const allowed = current < limit;
  
  // Calcular warning level
  let warningLevel: "none" | "warning" | "critical" = "none";
  if (limit > 0) {
    const percentage = (current / limit) * 100;
    if (percentage >= 100) {
      warningLevel = "critical";
    } else if (percentage >= 80) {
      warningLevel = "warning";
    }
  }

  return {
    allowed,
    limit,
    current,
    remaining,
    isUnlimited: false,
    warningLevel,
  };
}

/**
 * Verificar se empresa tem acesso a uma feature
 */
export async function checkFeatureAccess(companyId: string, feature: keyof PlanFeatures): Promise<boolean> {
  const features = await getPlanFeatures(companyId);
  if (!features) return false;
  return features[feature] === true;
}

// ========== TRIAL & EXPIRATION ==========

/**
 * Calcular dias restantes de trial
 */
export function getTrialDaysRemaining(subscription: Subscription): number | null {
  if (subscription.status !== "trial" || !subscription.trial_ends_at) {
    return null;
  }

  const now = new Date();
  const trialEnd = new Date(subscription.trial_ends_at);
  const diffMs = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Expirar trials que passaram da data (executar via cron job)
 */
export async function expireTrials(): Promise<number> {
  const result: any = await db.query(
    `UPDATE public.subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'trial' AND trial_ends_at < NOW()`
  );

  return result.rowCount || 0;
}

// ========== ADMIN FUNCTIONS ==========

/**
 * Criar/Atualizar plano (admin only)
 */
export async function upsertPlan(plan: Partial<Plan>): Promise<Plan> {
  if (plan.id) {
    // Update
    return db.one<Plan>(
      `UPDATE public.plans
      SET display_name = COALESCE($2, display_name),
          description = COALESCE($3, description),
          price_monthly = COALESCE($4, price_monthly),
          price_yearly = COALESCE($5, price_yearly),
          limits = COALESCE($6, limits),
          features = COALESCE($7, features),
          is_active = COALESCE($8, is_active),
          sort_order = COALESCE($9, sort_order),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        plan.id,
        plan.display_name,
        plan.description,
        plan.price_monthly,
        plan.price_yearly,
        plan.limits ? JSON.stringify(plan.limits) : null,
        plan.features ? JSON.stringify(plan.features) : null,
        plan.is_active,
        plan.sort_order,
      ]
    );
  } else {
    // Create
    return db.one<Plan>(
      `INSERT INTO public.plans (name, display_name, description, price_monthly, price_yearly, limits, features, is_active, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        plan.name,
        plan.display_name,
        plan.description,
        plan.price_monthly,
        plan.price_yearly,
        JSON.stringify(plan.limits),
        JSON.stringify(plan.features),
        plan.is_active ?? true,
        plan.sort_order ?? 0,
      ]
    );
  }
}

/**
 * Mudar plano da empresa
 */
export async function changePlan(companyId: string, newPlanId: string): Promise<void> {
  await db.none(
    `INSERT INTO public.subscriptions (
      company_id,
      plan_id,
      status,
      billing_cycle,
      trial_ends_at,
      trial_used,
      current_period_start,
      current_period_end,
      next_billing_date,
      cancel_at_period_end,
      metadata
    )
    VALUES (
      $2,
      $1,
      'trial',
      'monthly',
      NOW() + INTERVAL '14 days',
      FALSE,
      NOW(),
      NOW() + INTERVAL '30 days',
      NOW() + INTERVAL '30 days',
      FALSE,
      '{}'::jsonb
    )
    ON CONFLICT (company_id)
    DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      updated_at = NOW(),
      cancel_at_period_end = FALSE;`,
    [newPlanId, companyId]
  );
}

/**
 * Deletar plano (admin only)
 */
export async function deletePlan(planId: string): Promise<void> {
  await db.none(`DELETE FROM public.plans WHERE id = $1`, [planId]);
}
