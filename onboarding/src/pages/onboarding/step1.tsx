import { useState } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import { INDUSTRIES } from "../../types/onboarding";
import type { Industry } from "../../types/onboarding";
import {
  FaGraduationCap,
  FaChartLine,
  FaHospital,
  FaSolarPanel,
  FaHardHat,
  FaHome,
  FaCalendarAlt,
  FaBalanceScale,
  FaCheck,
} from "react-icons/fa";

interface Step1Props {
  onNext: (industry: string) => void;
}

const iconMap = {
  FaGraduationCap,
  FaChartLine,
  FaHospital,
  FaSolarPanel,
  FaHardHat,
  FaHome,
  FaCalendarAlt,
  FaBalanceScale,
};

export function OnboardingStep1({ onNext }: Step1Props) {
  const [selected, setSelected] = useState<Industry | null>(null);
  const [loading, setLoading] = useState(false);
  const { saveStep1 } = useOnboarding();

  const handleSubmit = async () => {
    if (!selected) return;
    
    try {
      setLoading(true);
      await saveStep1({ industry: selected });
      onNext(selected); // Passa a indústria selecionada
    } catch (error) {
      console.error("Erro ao salvar step 1:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold theme-heading">Qual é o seu nicho?</h1>
        <p className="text-sm theme-text-muted">Usaremos essa informação para aplicar templates, agentes e fluxos específicos.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((industry) => {
          const IconComponent = iconMap[industry.icon as keyof typeof iconMap];
          const isSelected = selected === industry.id;
          return (
            <button
              key={industry.id}
              onClick={() => setSelected(industry.id)}
              className="rounded-xl border-2 px-6 py-6 text-left transition-all"
              style={{
                borderColor: isSelected
                  ? "color-mix(in srgb, var(--color-primary) 55%, transparent)"
                  : "color-mix(in srgb, var(--color-border) 85%, transparent)",
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--color-primary) 16%, var(--color-surface))"
                  : "color-mix(in srgb, var(--color-surface) 92%, transparent)",
                boxShadow: isSelected ? "0 18px 32px -24px color-mix(in srgb, var(--color-primary) 55%, transparent)" : "none",
              }}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: `${industry.color}33`, color: industry.color }}>
                {IconComponent && <IconComponent />}
              </div>
              <h3 className="mb-2 text-lg font-semibold theme-heading">{industry.name}</h3>
              <p className="mb-3 text-sm theme-text-muted">{industry.description}</p>
              <ul className="space-y-1 text-xs theme-text-muted">
                {industry.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)", color: "var(--color-primary)" }}>
                      <FaCheck size={10} />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selected || loading}
        className="w-full rounded-lg py-3 text-sm font-semibold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          backgroundColor: "var(--color-primary)",
          color: "var(--color-on-primary)",
          boxShadow: "0 16px 32px -18px color-mix(in srgb, var(--color-primary) 55%, transparent)",
        }}
      >
        {loading ? "Salvando..." : "Continuar"}
      </button>
    </div>
  );
}
