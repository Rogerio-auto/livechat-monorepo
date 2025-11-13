import { useState, useEffect } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import type { OnboardingStep3Data, IndustryConfig } from "../../types/onboarding";
import { FaRobot, FaComments, FaBoxOpen, FaMapPin, FaBolt, FaCheck, FaSpinner } from "react-icons/fa";

interface Step3Props {
  onNext: (preferences: OnboardingStep3Data) => void;
  onBack: () => void;
}

export function OnboardingStep3({ onNext, onBack }: Step3Props) {
  const [data, setData] = useState<OnboardingStep3Data>({
    wants_ai_agent: true,
    wants_templates: true,
    wants_catalog: true,
  });
  const [config, setConfig] = useState<IndustryConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const { saveStep3, fetchIndustryConfig, status } = useOnboarding();

  useEffect(() => {
    if (status?.industry) {
      fetchIndustryConfig(status.industry).then(setConfig);
    }
  }, [status]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await saveStep3(data);
  onNext(data);
    } catch (error) {
      console.error("Erro ao salvar step 3:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm theme-text-muted">
        <FaSpinner
          className="mb-4 animate-spin"
          style={{ color: "var(--color-primary)" }}
          size={48}
        />
        <p>Carregando configurações do seu nicho...</p>
      </div>
    );
  }

  const cardStyles = (isActive: boolean) => ({
    borderColor: isActive
      ? "color-mix(in srgb, var(--color-primary) 55%, transparent)"
      : "color-mix(in srgb, var(--color-border) 80%, transparent)",
    backgroundColor: isActive
      ? "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))"
      : "color-mix(in srgb, var(--color-surface) 95%, transparent)",
    boxShadow: isActive ? "0 18px 32px -24px color-mix(in srgb, var(--color-primary) 55%, transparent)" : "none",
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold theme-heading">Recursos iniciais</h1>
        <p className="text-sm theme-text-muted">
          Ative agora o que faz sentido. Você poderá ajustar tudo posteriormente no painel de configurações.
        </p>
      </div>

      <div className="space-y-6">
        <div
          className="rounded-xl border-2 p-6 transition-all"
          style={cardStyles(data.wants_ai_agent)}
        >
          <div className="flex items-start gap-4">
            <input
              type="checkbox"
              id="ai-agent"
              checked={data.wants_ai_agent}
              onChange={(e) => setData({ ...data, wants_ai_agent: e.target.checked })}
              className="mt-1 h-5 w-5"
              style={{ accentColor: "var(--color-primary)" }}
            />
            <label htmlFor="ai-agent" className="flex-1 cursor-pointer space-y-1">
              <div className="flex items-center gap-2 text-lg font-semibold theme-heading">
                <FaRobot style={{ color: "var(--color-primary)" }} /> Agente de IA
              </div>
              <p className="text-sm theme-text-muted">
                <strong style={{ color: "var(--color-primary)" }}>{config.agent_name}</strong> responde dúvidas, oferece produtos e automatiza follow-ups com linguagem adaptada ao seu nicho.
              </p>
            </label>
          </div>
        </div>

        <div
          className="rounded-xl border-2 p-6 transition-all"
          style={cardStyles(data.wants_templates)}
        >
          <div className="flex items-start gap-4">
            <input
              type="checkbox"
              id="templates"
              checked={data.wants_templates}
              onChange={(e) => setData({ ...data, wants_templates: e.target.checked })}
              className="mt-1 h-5 w-5"
              style={{ accentColor: "#22c55e" }}
            />
            <label htmlFor="templates" className="flex-1 cursor-pointer space-y-1">
              <div className="flex items-center gap-2 text-lg font-semibold theme-heading" style={{ color: "#22c55e" }}>
                <FaComments /> Templates de mensagem
              </div>
              <p className="text-sm theme-text-muted">
                {config.templates_count} roteiros prontos para nutrição, vendas e sucesso do cliente, traduzidos para a realidade do seu segmento.
              </p>
            </label>
          </div>
        </div>

        <div
          className="rounded-xl border-2 p-6 transition-all"
          style={cardStyles(data.wants_catalog)}
        >
          <div className="flex items-start gap-4">
            <input
              type="checkbox"
              id="catalog"
              checked={data.wants_catalog}
              onChange={(e) => setData({ ...data, wants_catalog: e.target.checked })}
              className="mt-1 h-5 w-5"
              style={{ accentColor: "#f59e0b" }}
            />
            <label htmlFor="catalog" className="flex-1 cursor-pointer space-y-1">
              <div className="flex items-center gap-2 text-lg font-semibold theme-heading" style={{ color: "#f59e0b" }}>
                <FaBoxOpen /> Catálogo de produtos/serviços
              </div>
              <p className="text-sm theme-text-muted">
                Organize itens, valores e descrições para compartilhar em campanhas e conversas com um clique.
              </p>
            </label>
          </div>
        </div>

        <div
          className="rounded-xl border-2 p-6"
          style={{
            borderColor: "color-mix(in srgb, var(--color-primary) 28%, transparent)",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 16%, transparent), color-mix(in srgb, var(--color-highlight) 12%, transparent))",
          }}
        >
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold theme-heading">
            <FaMapPin style={{ color: "var(--color-primary)" }} /> Campos personalizados inclusos
          </h4>
          <p className="mb-3 text-sm theme-text-muted">
            Vamos adicionar automaticamente estes campos aos seus leads:
          </p>
          <ul className="space-y-2 text-sm">
            {config.custom_fields.map((field, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(34, 197, 94, 0.18)", color: "#22c55e" }}>
                  <FaCheck size={12} />
                </span>
                <span className="font-medium theme-heading">{field.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rounded-xl border p-6"
          style={{ borderColor: "color-mix(in srgb, var(--color-border) 75%, transparent)", backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 55%, transparent)" }}
        >
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold theme-heading">
            <FaBolt style={{ color: "#facc15" }} /> Módulos habilitados automaticamente
          </h4>
          <div className="flex flex-wrap gap-2">
            {config.enabled_modules.map((module, idx) => (
              <span key={idx} className="config-chip rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide">
                {module}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="config-btn flex-1 rounded-lg py-3 text-sm font-semibold transition-all"
        >
          Voltar
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 rounded-lg py-3 text-sm font-semibold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
            boxShadow: "0 16px 32px -18px color-mix(in srgb, var(--color-primary) 55%, transparent)",
          }}
        >
          {loading ? "Salvando..." : "Continuar"}
        </button>
      </div>
    </div>
  );
}
