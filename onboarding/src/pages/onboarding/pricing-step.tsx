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
    description: "Ideal para pequenos negócios começando",
    features: [
      "1 usuário",
      "1 agente de IA",
      "500 mensagens/mês",
      "Catálogo de produtos",
      "Templates básicos",
      "Suporte por email",
    ],
    notIncluded: [
      "Múltiplos usuários",
      "Campanhas automáticas",
      "Relatórios avançados",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 247,
    period: "mês",
    description: "Para empresas em crescimento",
    features: [
      "Até 5 usuários",
      "3 agentes de IA",
      "5.000 mensagens/mês",
      "Catálogo ilimitado",
      "Templates personalizados",
      "Campanhas automáticas",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
    highlight: true,
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    price: 497,
    period: "mês",
    description: "Para empresas estabelecidas",
    features: [
      "Usuários ilimitados",
      "10 agentes de IA",
      "Mensagens ilimitadas",
      "Tudo do Professional",
      "API integrada",
      "Webhooks personalizados",
      "Gerente de sucesso dedicado",
      "Suporte 24/7",
      "White label",
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(147, 51, 234, 0.16)", color: "#a855f7" }}>
          <FaCrown className="text-2xl" />
        </div>
        <h1 className="text-3xl font-semibold theme-heading">Escolha seu plano</h1>
        <p className="text-sm theme-text-muted">Comece com 14 dias grátis e altere de nível quando quiser.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <div
              key={plan.id}
              className="relative cursor-pointer rounded-2xl border-2 p-6 transition-all"
              style={{
                borderColor: isSelected
                  ? "color-mix(in srgb, var(--color-primary) 55%, transparent)"
                  : plan.highlight
                  ? "color-mix(in srgb, #a855f7 45%, transparent)"
                  : "color-mix(in srgb, var(--color-border) 80%, transparent)",
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--color-primary) 16%, var(--color-surface))"
                  : "color-mix(in srgb, var(--color-surface) 96%, transparent)",
                boxShadow: isSelected || plan.highlight ? "0 18px 32px -24px color-mix(in srgb, var(--color-primary) 45%, transparent)" : "none",
              }}
              onClick={() => setSelected(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 flex -translate-x-1/2">
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: "#a855f7" }}
                  >
                    Mais popular
                  </span>
                </div>
              )}

              {plan.id === suggestedPlan && (
                <div className="absolute -top-3 right-4">
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: "#22c55e" }}
                  >
                    Recomendado
                  </span>
                </div>
              )}

              <div className="mb-4 text-center">
                <h3 className="mb-2 text-xl font-semibold theme-heading">{plan.name}</h3>
                <div className="mb-2 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold theme-heading">R$ {plan.price}</span>
                  <span className="text-sm theme-text-muted">/{plan.period}</span>
                </div>
                <p className="text-xs theme-text-muted">{plan.description}</p>
              </div>

              <ul className="mb-4 space-y-2 text-sm theme-text-muted">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <FaCheck className="mt-0.5 text-green-500" size={12} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.notIncluded && (
                <ul className="space-y-2 border-t pt-2 text-sm" style={{ borderColor: "color-mix(in srgb, var(--color-border) 80%, transparent)", color: "color-mix(in srgb, var(--color-text-muted) 70%, transparent)" }}>
                  {plan.notIncluded.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <FaTimes className="mt-0.5" size={12} />
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
          borderColor: "color-mix(in srgb, #22c55e 28%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, #22c55e 18%, transparent), color-mix(in srgb, var(--color-primary) 10%, transparent))",
          color: "#f0fdf4",
        }}
      >
        <p className="mb-1 text-sm font-semibold">
          <FaCheck className="mr-2 inline" /> 14 dias de teste grátis
        </p>
        <p className="text-xs opacity-80">
          Explore todos os recursos sem compromisso e cancele se não fizer sentido.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="config-btn flex flex-1 items-center justify-center rounded-lg py-3 text-sm font-semibold transition-all"
        >
          <span className="flex items-center justify-center gap-2">
            <FaArrowLeft /> Voltar
          </span>
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
            boxShadow: "0 16px 32px -18px color-mix(in srgb, var(--color-primary) 55%, transparent)",
          }}
        >
          {loading ? "Processando..." : `Continuar com ${PLANS.find((p) => p.id === selected)?.name ?? "plano"}`}
          {!loading && <FaArrowRight />}
        </button>
      </div>
    </div>
  );
}
