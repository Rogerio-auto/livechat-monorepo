import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Zap, Rocket, Check, Loader2, AlertTriangle, X } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  display_name?: string;
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
}

const planIcons: Record<string, any> = {
  starter: Zap,
  professional: Crown,
  business: Rocket,
};

const planColors: Record<string, string> = {
  starter: "from-blue-500 to-blue-600",
  professional: "from-purple-500 to-purple-600",
  business: "from-amber-500 to-amber-600",
};

const usageLabels: Record<string, string> = {
  users: "Usuários",
  ai_agents: "Agentes IA",
  messages_per_month: "Mensagens/Mês",
  inboxes: "Inboxes",
  contacts: "Contatos",
  storage_mb: "Armazenamento (MB)",
  campaigns_per_month: "Campanhas/Mês",
};

interface PlansSectionProps {
  onClose?: () => void;
}

export function PlansSection({ onClose }: PlansSectionProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subRes, plansRes] = await Promise.all([
        fetch("/api/subscriptions/current", { credentials: "include" }),
        fetch("/api/subscriptions/plans", { credentials: "include" }),
      ]);

      const plansData = plansRes.ok ? await plansRes.json() : [];
      const subData = subRes.ok ? await subRes.json() : null;

      if (Array.isArray(plansData)) {
        setPlans(plansData.sort((a: Plan, b: Plan) => a.sort_order - b.sort_order));
      }
      if (subData) {
        setSubscription(subData);
      }
    } catch (err) {
      console.error("Failed to load plans:", err);
      setError("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (!confirm("Deseja selecionar este plano?")) return;

    setUpgrading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (res.ok) {
        alert("Plano atualizado com sucesso!");
        await loadData();
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Erro ao atualizar plano");
      }
    } catch (err) {
      setError("Erro ao atualizar plano. Tente novamente.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleViewDetails = () => {
    navigate("/subscription");
    onClose?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const trialDaysRemaining = subscription?.status === "trial" && subscription.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      {subscription ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Plano Atual: {subscription.plan?.display_name || subscription.plan?.name || "Plano"}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    subscription.status === "trial"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : subscription.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  }`}
                >
                  {subscription.status === "trial"
                    ? `Trial (${trialDaysRemaining}d restantes)`
                    : subscription.status === "active"
                    ? "Ativo"
                    : subscription.status === "expired"
                    ? "Expirado"
                    : "Cancelado"}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Gerencie sua assinatura e veja detalhes de uso
              </p>
            </div>
            <button
              onClick={handleViewDetails}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Ver Detalhes
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Nenhum plano ativo
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selecione um plano abaixo para começar a usar todas as funcionalidades
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = planIcons[plan.name.toLowerCase()] || Crown;
          const gradientClass = planColors[plan.name.toLowerCase()] || planColors.professional;
          const isCurrent = subscription?.plan_id === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 transition-all ${
                isCurrent
                  ? "border-blue-500 shadow-lg shadow-blue-500/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-semibold">
                  Plano Atual
                </div>
              )}

              <div className="text-center mb-6">
                <div
                  className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center`}
                >
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    R$ {plan.price_monthly}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 text-sm">/mês</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {Object.entries(plan.limits).slice(0, 5).map(([key, value]) => (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {usageLabels[key] || key}:{" "}
                      <span className="font-semibold">
                        {value === -1 ? "Ilimitado" : value.toLocaleString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium cursor-not-allowed"
                >
                  Plano Atual
                </button>
              ) : (
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={upgrading}
                  className={`w-full py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    gradientClass
                      ? `bg-gradient-to-r ${gradientClass} hover:opacity-90 text-white`
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {upgrading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </span>
                  ) : subscription ? (
                    "Mudar para este plano"
                  ) : (
                    "Selecionar Plano"
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <button
          onClick={handleViewDetails}
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
        >
          Ver comparação completa de planos e recursos →
        </button>
      </div>
    </div>
  );
}
