import { useState } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import { FaCheckCircle, FaWhatsapp, FaBox, FaRobot, FaPlay } from "react-icons/fa";

interface Step4Props {
  onBack: () => void;
  onComplete: () => void;
}

export function OnboardingStep4({ onBack, onComplete }: Step4Props) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { complete } = useOnboarding();

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    
    try {
      await complete();
      onComplete();
    } catch (err: any) {
      console.error("Erro ao completar onboarding:", err);
      setError(err.message || "Erro ao finalizar onboarding");
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(34, 197, 94, 0.18)", color: "#22c55e" }}
          >
            <FaCheckCircle className="text-3xl" />
          </span>
        </div>
        <h1 className="text-3xl font-semibold theme-heading">Tudo pronto!</h1>
        <p className="text-sm theme-text-muted">Seu ambiente foi configurado com sucesso. Veja os próximos passos recomendados.</p>
      </div>

      <div
        className="rounded-2xl border px-8 py-10"
        style={{
          borderColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 16%, transparent), color-mix(in srgb, var(--color-highlight) 12%, transparent))",
        }}
      >
        <h2 className="mb-6 text-center text-lg font-semibold uppercase tracking-wide theme-heading">
          Próximos passos para potencializar a ativação
        </h2>
        <ul className="mx-auto flex max-w-xl flex-col gap-3">
          {[
            {
              icon: <FaWhatsapp size={18} />,
              title: "Conecte seu WhatsApp",
              description: "Configure a conta Business para centralizar atendimentos e disparos.",
            },
            {
              icon: <FaBox size={16} />,
              title: "Cadastre produtos e serviços",
              description: "Monte um catálogo organizado para compartilhar com leads em segundos.",
            },
            {
              icon: <FaRobot size={16} />,
              title: "Personalize o agente de IA",
              description: "Ajuste tom de voz, respostas e playbooks específicos para o seu time.",
            },
            {
              icon: <FaPlay size={14} />,
              title: "Inicie suas campanhas",
              description: "Utilize templates prontos e dashboards para monitorar os primeiros resultados.",
            },
          ].map((item, index) => (
            <li
              key={index}
              className="rounded-xl border px-5 py-4 transition-all"
              style={{
                borderColor: "color-mix(in srgb, var(--color-border) 70%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--color-surface) 96%, transparent)",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 22%, transparent)", color: "var(--color-primary)" }}
                >
                  {item.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold theme-heading">{item.title}</p>
                  <p className="text-xs theme-text-muted">{item.description}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "color-mix(in srgb, #ef4444 32%, transparent)",
            backgroundColor: "color-mix(in srgb, #ef4444 18%, transparent)",
            color: "#fee2e2",
          }}
        >
          <p className="font-semibold">Erro ao finalizar:</p>
          <p>{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={completing}
          className="config-btn flex-1 rounded-lg py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
        >
          Voltar
        </button>
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex-1 rounded-lg py-3 text-sm font-semibold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
            boxShadow: "0 16px 32px -18px color-mix(in srgb, var(--color-primary) 55%, transparent)",
          }}
        >
          {completing ? "Finalizando..." : "Selecionar plano"}
        </button>
      </div>
    </div>
  );
}
