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
    id: "growth",
    name: "Growth",
    price: 197,
    period: "mês",
    description: "Para empresas em expansão",
    features: [
      "Até 3 usuários",
      "2 agentes de IA",
      "2.000 mensagens/mês",
      "Catálogo de produtos",
      "Templates personalizados",
      "Campanhas básicas",
      "Suporte prioritário",
    ],
    highlight: true,
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
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaCrown className="text-purple-600 text-2xl" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Escolha seu plano</h1>
        <p className="text-gray-600">
          Comece com 14 dias grátis, cancele quando quiser
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative border-2 rounded-lg p-6 transition-all cursor-pointer ${
              selected === plan.id
                ? "border-blue-600 bg-blue-50 shadow-lg"
                : plan.highlight
                ? "border-purple-300 shadow-md"
                : "border-gray-200 hover:border-blue-300 hover:shadow"
            }`}
            onClick={() => setSelected(plan.id)}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  MAIS POPULAR
                </span>
              </div>
            )}

            {plan.id === suggestedPlan && (
              <div className="absolute -top-3 right-4">
                <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  RECOMENDADO
                </span>
              </div>
            )}

            <div className="text-center mb-4">
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-2">
                <span className="text-4xl font-bold">R$ {plan.price}</span>
                <span className="text-gray-600">/{plan.period}</span>
              </div>
              <p className="text-sm text-gray-600">{plan.description}</p>
            </div>

            <ul className="space-y-2 mb-4">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start text-sm">
                  <FaCheck className="text-green-500 mr-2 mt-0.5 shrink-0" size={12} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {plan.notIncluded && (
              <ul className="space-y-2 pt-2 border-t border-gray-200">
                {plan.notIncluded.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm text-gray-400">
                    <FaTimes className="text-gray-300 mr-2 mt-0.5 shrink-0" size={12} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}

            {selected === plan.id && (
              <div className="absolute inset-0 border-2 border-blue-600 rounded-lg pointer-events-none"></div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-linear-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 mb-6 text-center">
        <p className="font-semibold text-green-700 mb-1">
          <FaCheck className="inline mr-2" />
          14 dias de teste grátis
        </p>
        <p className="text-sm text-gray-600">
          Experimente todos os recursos sem compromisso. Cancele quando quiser.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center"
        >
          <FaArrowLeft className="mr-2" />
          Voltar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          {loading ? "Processando..." : "Continuar com " + PLANS.find(p => p.id === selected)?.name || "plano selecionado"}
          {!loading && <FaArrowRight className="ml-2" />}
        </button>
      </div>
    </div>
  );
}
