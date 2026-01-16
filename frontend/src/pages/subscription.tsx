import { useEffect, useState, type ReactNode } from "react";
import { getAccessToken } from "../utils/api";
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
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Activity,
  Sparkles,
  Globe,
  Clock,
  CheckCircle2,
  Settings
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
  bi_reports: "BI & Relatórios Customizados",
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

const PLAN_ICONS: Record<string, ReactNode> = {
  starter: <Zap className="w-6 h-6" />,
  growth: <TrendingUp className="w-6 h-6" />,
  professional: <Rocket className="w-6 h-6" />,
  business: <Crown className="w-6 h-6" />,
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
      const token = getAccessToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const [subRes, plansRes, usageRes] = await Promise.all([
        fetch("/api/subscriptions/current", { headers, credentials: "include" }),
        fetch("/api/subscriptions/plans", { headers, credentials: "include" }),
        fetch("/api/subscriptions/usage", { headers, credentials: "include" }),
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
      const token = getAccessToken();
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch("/api/checkout/session", {
        method: "POST",
        credentials: "include",
        headers,
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
      const token = getAccessToken();
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch("/api/checkout/portal", {
        method: "POST",
        credentials: "include",
        headers,
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
    if (value === -1) return `Ilimitado`;
    if (key === 'storage_mb') {
        return `${value >= 1024 ? value / 1024 + 'GB' : value + 'MB'}`;
    }
    return `${value.toLocaleString()}`;
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={14} />
            Planos e Preços
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl tracking-tight">
            Escolha o plano ideal para o seu negócio
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg text-gray-500 dark:text-gray-400">
            Escale seu atendimento, organize sua equipe e venda mais com nossos planos flexíveis e transparentes.
          </p>
        </div>

        {/* Current Subscription Status */}
        {subscription && (
          <div className="mb-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 sm:p-8 flex flex-col lg:flex-row gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Sua Assinatura Atual
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        {subscription.plan?.display_name || subscription.plan?.name}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        subscription.status === 'active' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {subscription.status === 'active' ? 'Ativa' : subscription.status === 'trial' ? 'Período de Teste' : subscription.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium uppercase mb-1">
                      <Clock size={14} />
                      Próxima Cobrança
                    </div>
                    <div className="text-gray-900 dark:text-white font-semibold">
                      {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium uppercase mb-1">
                      <CreditCard size={14} />
                      Ciclo de Faturamento
                    </div>
                    <div className="text-gray-900 dark:text-white font-semibold capitalize">
                      {subscription.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                    </div>
                  </div>
                </div>

                {subscription.status === 'active' && (
                  <button 
                    onClick={handlePortal}
                    disabled={managing}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    {managing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings size={16} />}
                    Gerenciar faturamento e métodos de pagamento
                  </button>
                )}
              </div>

              <div className="lg:w-1/3 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-700 pt-8 lg:pt-0 lg:pl-8">
                <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Activity size={16} />
                  Uso do Período
                </h3>
                <div className="space-y-6">
                  <UsageBar 
                    label="Mensagens" 
                    current={usage.messages_per_month?.current || 0} 
                    limit={usage.messages_per_month?.limit} 
                  />
                  <UsageBar 
                    label="Contatos" 
                    current={usage.contacts?.current || 0} 
                    limit={usage.contacts?.limit} 
                  />
                  <UsageBar 
                    label="Conexões" 
                    current={usage.inboxes?.current || 0} 
                    limit={usage.inboxes?.limit} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan_id === plan.id;
            const isPopular = plan.id === 'professional';
            
            return (
              <div 
                key={plan.id} 
                className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm transition-all duration-300 hover:shadow-xl border ${
                  isCurrentPlan 
                    ? 'border-blue-500 ring-1 ring-blue-500' 
                    : isPopular 
                      ? 'border-purple-500 dark:border-purple-400 shadow-purple-500/5' 
                      : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {isPopular && !isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-bold bg-purple-600 text-white shadow-lg">
                      MAIS POPULAR
                    </span>
                  </div>
                )}

                <div className="p-8 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${
                    isCurrentPlan ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                    isPopular ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {PLAN_ICONS[plan.id] || <Globe className="w-6 h-6" />}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {plan.display_name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 min-h-[40px]">
                    {PLAN_DESCRIPTIONS[plan.id] || "Plano flexível para sua empresa"}
                  </p>
                  
                  <div className="mt-8 flex items-baseline">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                      R$ {plan.price_monthly}
                    </span>
                    <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                      /mês
                    </span>
                  </div>

                  <div className="mt-8 space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Limites Inclusos
                    </h4>
                    <ul className="space-y-3">
                      {['users', 'inboxes', 'ai_agents', 'messages_per_month', 'contacts'].map(key => (
                          <li key={key} className="flex items-center justify-between text-sm">
                              <span className="text-gray-500 dark:text-gray-400">{LIMIT_LABELS[key]}</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {formatLimit(key, plan.limits ? plan.limits[key] : undefined)}
                              </span>
                          </li>
                      ))}
                    </ul>
                  </div>

                  <div className="my-8 border-t border-gray-100 dark:border-gray-700"></div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Recursos
                    </h4>
                    <ul className="space-y-3">
                      {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                          const hasFeature = plan.features ? plan.features[key] : false;
                          const isKeyDifferentiator = ['tasks_module', 'calendar_module', 'media_library', 'document_generation', 'api_access'].includes(key);
                          
                          if (!hasFeature && !isKeyDifferentiator) return null;

                          return (
                              <li key={key} className="flex items-start gap-3">
                                  {hasFeature ? (
                                      <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                                  ) : (
                                      <X className="h-5 w-5 text-gray-300 dark:text-gray-600 shrink-0" />
                                  )}
                                  <span className={`text-sm ${hasFeature ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                                      {label}
                                  </span>
                              </li>
                          );
                      })}
                    </ul>
                  </div>
                </div>

                <div className="p-8 pt-0">
                  <button
                    onClick={() => !isCurrentPlan && handleUpgrade(plan.id)}
                    disabled={isCurrentPlan || upgrading === plan.id}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-default dark:bg-gray-800 dark:text-gray-600 border border-gray-200 dark:border-gray-700'
                        : isPopular
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 hover:-translate-y-0.5'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 hover:-translate-y-0.5'
                    }`}
                  >
                    {upgrading === plan.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isCurrentPlan ? (
                      "Plano Atual"
                    ) : (
                      <>
                        Assinar Agora
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Section */}
        <div className="mt-24 p-8 rounded-2xl bg-gray-900 dark:bg-black border border-gray-800 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Precisa de algo personalizado?</h3>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                Oferecemos soluções sob medida para grandes empresas com necessidades específicas de volume e segurança.
            </p>
            <button className="inline-flex items-center gap-2 px-8 py-3 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors">
                Falar com Especialista
                <ArrowRight size={18} />
            </button>
        </div>
      </div>
    </div>
  );
}

function UsageBar({ label, current, limit }: { label: string; current: number | undefined; limit: number | undefined }) {
  const safeCurrent = current ?? 0;
  const safeLimit = limit ?? 0;
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : safeLimit > 0 ? Math.min(100, (safeCurrent / safeLimit) * 100) : 0;
  const isWarning = percentage > 80;
  const isDanger = percentage > 95;

  return (
    <div>
      <div className="flex justify-between text-xs font-bold mb-2">
        <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-gray-900 dark:text-white">
          {safeCurrent.toLocaleString()} / {isUnlimited ? '∞' : safeLimit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 rounded-full ${
            isUnlimited ? 'bg-blue-400' :
            isDanger ? 'bg-red-500' :
            isWarning ? 'bg-amber-500' :
            'bg-blue-600'
          }`}
          style={{ width: isUnlimited ? '100%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
}


