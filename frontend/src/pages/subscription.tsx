import { useEffect, useState } from "react";
import {
  Crown,
  Zap,
  Rocket,
  Check,
  TrendingUp,
  Users,
  MessageSquare,
  Database,
  Mail,
  Calendar,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price_monthly: string;
  price_yearly: string;
  limits: Record<string, number>;
  features: Record<string, boolean | string>;
  sort_order: number;
}

interface Subscription {
  id: string;
  plan_id: string;
  plan: {
    name: string;
    display_name?: string;
  };
  status: "trial" | "active" | "expired" | "canceled";
  trial_ends_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  billing_cycle?: "monthly" | "yearly";
}

interface Usage {
  [key: string]: {
    current: number;
    limit: number;
    percentage: number;
  };
}

const planIcons: Record<string, any> = {
  starter: Zap,
  professional: Crown,
  business: Rocket,
};

const usageIcons: Record<string, any> = {
  users: Users,
  ai_agents: Crown,
  messages_sent: MessageSquare,
  messages_per_month: MessageSquare,
  inboxes: Mail,
  contacts: Users,
  storage_mb: Database,
  campaigns_per_month: TrendingUp,
};

const usageLabels: Record<string, string> = {
  users: "Usuários",
  ai_agents: "Agentes IA",
  messages_sent: "Mensagens Enviadas",
  messages_per_month: "Mensagens/Mês",
  inboxes: "Inboxes",
  contacts: "Contatos",
  storage_mb: "Armazenamento (MB)",
  campaigns_per_month: "Campanhas/Mês",
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Usage>({});
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const [subRes, plansRes, usageRes] = await Promise.all([
        fetch("/api/subscriptions/current", { credentials: "include" }),
        fetch("/api/subscriptions/plans", { credentials: "include" }),
        fetch("/api/subscriptions/usage", { credentials: "include" }),
      ]);

      // Check if responses are OK
      if (!subRes.ok) {
        console.error("Subscription fetch failed:", subRes.status, subRes.statusText);
      }
      if (!plansRes.ok) {
        console.error("Plans fetch failed:", plansRes.status, plansRes.statusText);
      }
      if (!usageRes.ok) {
        console.error("Usage fetch failed:", usageRes.status, usageRes.statusText);
      }

      const [subData, plansData, usageData] = await Promise.all([
        subRes.ok ? subRes.json() : null,
        plansRes.ok ? plansRes.json() : [],
        usageRes.ok ? usageRes.json() : {},
      ]);

      if (subData) setSubscription(subData);
      if (Array.isArray(plansData)) {
        setPlans(plansData.sort((a: Plan, b: Plan) => a.sort_order - b.sort_order));
      }
      if (usageData) setUsage(usageData);
    } catch (error) {
      console.error("Failed to load subscription data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (!confirm("Deseja realmente mudar de plano?")) return;

    setUpgrading(true);
    try {
      const res = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (res.ok) {
        alert("Plano atualizado com sucesso!");
        await loadSubscriptionData();
        setSelectedPlan(null);
      } else {
        const error = await res.json();
        alert(`Erro ao atualizar plano: ${error.error || "Tente novamente"}`);
      }
    } catch (error) {
      alert("Erro ao atualizar plano. Tente novamente.");
    } finally {
      setUpgrading(false);
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600 bg-red-100 dark:bg-red-900/20";
    if (percentage >= 70) return "text-amber-600 bg-amber-100 dark:bg-amber-900/20";
    return "text-green-600 bg-green-100 dark:bg-green-900/20";
  };

  const getUsageBarColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma assinatura encontrada</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.id === subscription.plan_id);
  const trialDaysRemaining = subscription.status === "trial" && subscription.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Assinatura e Uso
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie seu plano e acompanhe o uso dos recursos
          </p>
        </div>

        {/* Current Plan Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {currentPlan && planIcons[currentPlan.name.toLowerCase()] && (
                  <>
                    {(() => {
                      const Icon = planIcons[currentPlan.name.toLowerCase()];
                      return <Icon className="h-8 w-8 text-blue-600" />;
                    })()}
                  </>
                )}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Plano {currentPlan?.name}
                </h2>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span
                  className={`px-3 py-1 rounded-full font-medium ${
                    subscription.status === "trial"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : subscription.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                  }`}
                >
                  {subscription.status === "trial"
                    ? `Trial (${trialDaysRemaining} dias restantes)`
                    : subscription.status === "active"
                    ? "Ativo"
                    : subscription.status === "expired"
                    ? "Expirado"
                    : "Cancelado"}
                </span>
                {subscription.billing_cycle && (
                  <span className="text-gray-600 dark:text-gray-400">
                    Ciclo: {subscription.billing_cycle === "monthly" ? "Mensal" : "Anual"}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                R$ {currentPlan?.price_monthly}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">por mês</div>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Uso dos Recursos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(usage).map(([key, data]) => {
              const Icon = usageIcons[key] || Database;
              const label = usageLabels[key] || key;
              const percentage = data.limit === -1 ? 0 : data.percentage;
              const isUnlimited = data.limit === -1;

              return (
                <div
                  key={key}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {label}
                      </span>
                    </div>
                    {!isUnlimited && (
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${getUsageColor(
                          percentage
                        )}`}
                      >
                        {percentage.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {isUnlimited ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Ilimitado
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {data.current.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          / {data.limit.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getUsageBarColor(
                            percentage
                          )}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Available Plans */}
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Planos Disponíveis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const Icon = planIcons[plan.name.toLowerCase()] || Crown;
              const isCurrent = plan.id === subscription.plan_id;

              return (
                <div
                  key={plan.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 p-6 ${
                    isCurrent
                      ? "border-blue-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="text-center mb-6">
                    <Icon className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {plan.name}
                    </h4>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      R$ {plan.price_monthly}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      por mês
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {Object.entries(plan.limits).map(([key, value]) => (
                      <li key={key} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {usageLabels[key] || key}:{" "}
                          {value === -1 ? "Ilimitado" : value.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 px-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium cursor-not-allowed"
                    >
                      Plano Atual
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgrading}
                      className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {upgrading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        "Selecionar Plano"
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
