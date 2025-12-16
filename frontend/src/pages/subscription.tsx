import { useEffect, useState } from "react";
import {
  Crown,
  Zap,
  Rocket,
  Check,
  X,
  TrendingUp,
  Users,
  MessageSquare,
  Database,
  Mail,
  Calendar,
  AlertTriangle,
  Loader2,
  Briefcase,
  FileText,
  Image as ImageIcon,
  Layout,
  Headphones,
  Server,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly?: number;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  sort_order: number;
  description?: string;
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

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: "Ideal para atendimento focado em conversão",
  growth: "Organização e automação inicial para pequenas equipes",
  professional: "Gestão completa para times em crescimento",
  business: "Potência máxima para grandes operações",
};

const FEATURE_LABELS: Record<string, string> = {
  tasks_module: "Gestão de Tarefas",
  calendar_module: "Calendário e Agendamento",
  media_library: "Galeria de Mídia",
  document_generation: "Gerador de Documentos",
  api_access: "API de Integração",
  webhooks: "Webhooks",
  priority_support: "Suporte Prioritário",
  dedicated_manager: "Gerente de Sucesso",
  custom_integrations: "Integrações Customizadas",
  "24_7_support": "Suporte 24/7",
  white_label: "White Label",
  advanced_reports: "Relatórios Avançados",
  custom_templates: "Templates Personalizados",
};

const LIMIT_LABELS: Record<string, string> = {
  users: "usuários",
  inboxes: "conexões de WhatsApp",
  ai_agents: "agentes de IA",
  messages_per_month: "mensagens/mês",
  contacts: "contatos",
  campaigns_per_month: "campanhas ativas",
  storage_mb: "MB de armazenamento",
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Usage>({});
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

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
    setUpgrading(planId);
    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval: "monthly" }),
      });

      if (res.ok) {
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
        } else {
          alert("Erro ao iniciar checkout: URL não recebida.");
        }
      } else {
        const error = await res.json();
        alert(`Erro ao iniciar checkout: ${error.error || "Tente novamente"}`);
      }
    } catch (error) {
      alert("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setUpgrading(null);
    }
  };

  const handlePortal = async () => {
    setManaging(true);
    try {
      const res = await fetch("/api/checkout/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
        }
      } else {
        alert("Erro ao abrir portal de assinatura.");
      }
    } catch (error) {
      alert("Erro ao abrir portal.");
    } finally {
      setManaging(false);
    }
  };

  const formatLimit = (key: string, value: number | undefined) => {
    if (value === undefined || value === null) return "Indisponível";
    if (value === -1) return `Ilimitado ${LIMIT_LABELS[key] || key}`;
    if (key === 'storage_mb') {
        return `${value >= 1024 ? value / 1024 + 'GB' : value + 'MB'} de armazenamento`;
    }
    return `${value.toLocaleString()} ${LIMIT_LABELS[key] || key}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
            Escolha o plano ideal para o seu negócio
          </h1>
          <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500 dark:text-gray-400">
            Escale seu atendimento, organize sua equipe e venda mais com nossos planos flexíveis.
          </p>
        </div>

        {/* Current Subscription Status (if active) */}
        {subscription && (
          <div className="mb-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900 p-6 flex flex-col sm:flex-row items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sua assinatura atual: <span className="text-blue-600">{subscription.plan?.display_name || subscription.plan?.name || "Plano Desconhecido"}</span>
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Status: <span className={`font-medium ${subscription.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
                  {subscription.status === 'active' ? 'Ativa' : subscription.status === 'trial' ? 'Período de Teste' : subscription.status}
                </span>
                {subscription.trial_ends_at && subscription.status === 'trial' && (
                   ` • Expira em ${new Date(subscription.trial_ends_at).toLocaleDateString()}`
                )}
              </p>
              {subscription.status === 'active' && (
                <button 
                  onClick={handlePortal}
                  disabled={managing}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  {managing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Gerenciar Assinatura e Faturas
                </button>
              )}
            </div>
            {/* Usage Summary Mini-Bar */}
            <div className="mt-4 sm:mt-0 flex gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex flex-col items-center">
                    <span className="font-bold">{usage.messages_per_month?.current || 0} / {usage.messages_per_month?.limit === -1 ? '∞' : usage.messages_per_month?.limit}</span>
                    <span className="text-xs">Mensagens</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold">{usage.contacts?.current || 0} / {usage.contacts?.limit === -1 ? '∞' : usage.contacts?.limit}</span>
                    <span className="text-xs">Contatos</span>
                </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 xl:gap-x-8">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan_id === plan.id;
            const isPopular = plan.id === 'professional';
            
            return (
              <div 
                key={plan.id} 
                className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl border ${
                  isCurrentPlan 
                    ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' 
                    : isPopular 
                      ? 'border-purple-500 dark:border-purple-400' 
                      : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {isPopular && !isCurrentPlan && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-bold bg-purple-500 text-white shadow-sm">
                      Mais Popular
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-bold bg-blue-600 text-white shadow-sm">
                      Plano Atual
                    </span>
                  </div>
                )}

                <div className="p-6 flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {plan.display_name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 min-h-[40px]">
                    {PLAN_DESCRIPTIONS[plan.id] || "Plano flexível para sua empresa"}
                  </p>
                  
                  <div className="mt-6 flex items-baseline">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                      R$ {plan.price_monthly}
                    </span>
                    <span className="ml-1 text-xl font-medium text-gray-500 dark:text-gray-400">
                      /mês
                    </span>
                  </div>

                  {/* Limits List */}
                  <ul className="mt-6 space-y-4">
                    {['users', 'inboxes', 'ai_agents', 'messages_per_month', 'contacts', 'campaigns_per_month'].map(key => (
                        <li key={key} className="flex items-start">
                            <div className="flex-shrink-0">
                                <Check className="h-5 w-5 text-green-500" />
                            </div>
                            <p className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                                {formatLimit(key, plan.limits ? plan.limits[key] : undefined)}
                            </p>
                        </li>
                    ))}
                  </ul>

                  <div className="my-6 border-t border-gray-100 dark:border-gray-700"></div>

                  {/* Features List */}
                  <ul className="space-y-3">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                        const hasFeature = plan.features ? plan.features[key] : false;
                        // Only show features that are relevant differentiators or enabled
                        // If it's disabled, we might want to show it as crossed out ONLY if it's a key differentiator for higher plans
                        const isKeyDifferentiator = ['tasks_module', 'calendar_module', 'media_library', 'document_generation', 'api_access'].includes(key);
                        
                        if (!hasFeature && !isKeyDifferentiator) return null;

                        return (
                            <li key={key} className="flex items-start">
                                <div className="flex-shrink-0">
                                    {hasFeature ? (
                                        <Check className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <X className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                                    )}
                                </div>
                                <p className={`ml-3 text-sm ${hasFeature ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                                    {label}
                                </p>
                            </li>
                        );
                    })}
                  </ul>
                </div>

                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => !isCurrentPlan && handleUpgrade(plan.id)}
                    disabled={isCurrentPlan || upgrading === plan.id}
                    className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm transition-colors duration-200 ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-default dark:bg-gray-700 dark:text-gray-500'
                        : isPopular
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {upgrading === plan.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isCurrentPlan ? (
                      "Plano Atual"
                    ) : (
                      `Assinar ${plan.display_name}`
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ or Trust Section could go here */}
        <div className="mt-20 text-center">
            <p className="text-gray-500 dark:text-gray-400">
                Dúvidas sobre os planos? <a href="#" className="text-blue-600 hover:underline">Fale com nosso time de vendas</a>.
            </p>
        </div>
      </div>
    </div>
  );
}
