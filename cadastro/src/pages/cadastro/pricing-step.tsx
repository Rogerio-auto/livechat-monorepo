import { useState } from "react";
import { FaCheck, FaTimes, FaArrowRight, FaArrowLeft, FaCrown } from "react-icons/fa";

interface PricingStepProps {
  onNext: (planId: string) => void;
  onBack: () => void;
  teamSize?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  notIncluded?: string[];
  highlight?: boolean;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    period: "mês",
    description: "Ideal para atendimento focado em conversão",
    features: [
      "2 usuários",
      "2.000 mensagens/mês",
      "5 campanhas ativas",
      "Acesso ao Livechat",
      "Catálogo de produtos",
      "Suporte por email",
    ],
    notIncluded: [
      "Agentes de IA",
      "Tarefas e Calendário",
      "Galeria de Mídia",
      "Geração de Documentos",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 197,
    period: "mês",
    description: "Organização e automação inicial",
    features: [
      "4 usuários",
      "1 agente de IA",
      "10.000 mensagens/mês",
      "10 campanhas ativas",
      "Tarefas e Calendário",
      "Acesso ao Livechat",
      "Catálogo de produtos",
    ],
    notIncluded: [
      "Galeria de Mídia",
      "Geração de Documentos",
      "API e Webhooks",
    ],
    highlight: true,
  },
  {
    id: "professional",
    name: "Professional",
    price: 247,
    period: "mês",
    description: "Gestão completa para times em crescimento",
    features: [
      "Até 6 usuários",
      "3 agentes de IA",
      "20.000 mensagens/mês",
      "5.000 contatos",
      "Campanhas ilimitadas",
      "Tarefas e Calendário",
      "Galeria de Mídia",
      "Geração de Documentos",
      "Relatórios avançados",
    ],
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    price: 497,
    period: "mês",
    description: "Potência máxima para grandes operações",
    features: [
      "15 usuários",
      "8 agentes de IA",
      "100.000 mensagens/mês",
      "20.000 contatos",
      "Campanhas ilimitadas",
      "Tudo do Professional",
      "Webhooks e API",
      "Gerente de sucesso",
      "Suporte Prioritário",
    ],
  },
];

export function PricingStep({ onNext, onBack, teamSize }: PricingStepProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sugerir plano baseado no tamanho da equipe
  const getSuggestedPlan = () => {
    if (!teamSize) return "professional";
    if (teamSize === "1-5") return "starter";
    if (teamSize === "6-15") return "professional";
    return "business";
  };

  const handleSubmit = () => {
    if (!selected) return;
    setLoading(true);
    onNext(selected);
  };

  const suggestedPlan = getSuggestedPlan();

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(47, 180, 99, 0.1)", color: "#2fb463" }}>
          <FaCrown className="text-2xl" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900">Escolha seu plano</h1>
        <p className="text-sm text-slate-500">Comece com 30 dias grátis e altere de nível quando quiser.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <div
              key={plan.id}
              className="relative cursor-pointer rounded-2xl border p-5 transition-all hover:shadow-md"
              style={{
                borderColor: isSelected
                  ? "#2fb463"
                  : plan.highlight
                  ? "#e2e8f0"
                  : "#e2e8f0",
                backgroundColor: isSelected
                  ? "#f0fdf4"
                  : "white",
                boxShadow: isSelected ? "0 10px 15px -3px rgba(47, 180, 99, 0.1)" : "none",
              }}
              onClick={() => setSelected(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 flex -translate-x-1/2">
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: "#2fb463" }}
                  >
                    Mais popular
                  </span>
                </div>
              )}

              {plan.id === suggestedPlan && (
                <div className="absolute -top-3 right-4">
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: "#3b82f6" }}
                  >
                    Recomendado
                  </span>
                </div>
              )}

              <div className="mb-4 text-center">
                <h3 className="mb-1 text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="mb-1 flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-slate-900">R$ {plan.price}</span>
                  <span className="text-xs text-slate-500">/{plan.period}</span>
                </div>
                <p className="text-[10px] leading-tight text-slate-500">{plan.description}</p>
              </div>

              <ul className="mb-4 space-y-2 text-xs text-slate-600">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <FaCheck className="mt-0.5 text-[#2fb463]" size={10} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.notIncluded && (
                <ul className="space-y-2 border-t pt-2 text-[10px] text-slate-400" style={{ borderColor: "#f1f5f9" }}>
                  {plan.notIncluded.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <FaTimes className="mt-0.5" size={10} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-xl border px-4 py-4 text-center"
        style={{
          borderColor: "color-mix(in srgb, #2fb463 28%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, #2fb463 10%, white), color-mix(in srgb, #2fb463 5%, white))",
          color: "#1f8b49",
        }}
      >
        <p className="mb-1 text-sm font-semibold">
          <FaCheck className="mr-2 inline" /> 30 dias de teste grátis
        </p>
        <p className="text-xs opacity-80">
          Explore todos os recursos sem compromisso e cancele se não fizer sentido.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
        >
          <FaArrowLeft /> Voltar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold uppercase tracking-wide text-white transition-all disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: "#2fb463",
            boxShadow: "0 10px 15px -3px rgba(47, 180, 99, 0.2)",
          }}
        >
          {loading ? "Processando..." : `Continuar com ${PLANS.find((p) => p.id === selected)?.name ?? "plano"}`}
          {!loading && <FaArrowRight />}
        </button>
      </div>
    </div>
  );
}
