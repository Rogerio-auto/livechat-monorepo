import { useState } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import { INDUSTRIES } from "../../types/onboarding";
import type { Industry } from "../../types/onboarding";
import { FaGraduationCap, FaChartLine, FaHospital, FaSolarPanel, FaHardHat, FaHome, FaCalendarAlt, FaBalanceScale, FaCheck } from "react-icons/fa";

interface Step1Props {
  onNext: () => void;
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
      onNext();
    } catch (error) {
      console.error("Erro ao salvar step 1:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Qual é o seu nicho?</h1>
        <p className="text-gray-600">
          Vamos personalizar o sistema para o seu tipo de negócio
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {INDUSTRIES.map((industry) => {
          const IconComponent = iconMap[industry.icon as keyof typeof iconMap];
          return (
            <button
              key={industry.id}
              onClick={() => setSelected(industry.id)}
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                selected === industry.id
                  ? "border-blue-600 bg-blue-50 shadow-md"
                  : "border-gray-200 hover:border-blue-300 hover:shadow"
              }`}
            >
              <div className="text-4xl mb-3" style={{ color: industry.color }}>
                {IconComponent && <IconComponent />}
              </div>
              <h3 className="font-bold text-lg mb-2">{industry.name}</h3>
              <p className="text-sm text-gray-600 mb-3">
                {industry.description}
              </p>
              <ul className="text-xs space-y-1">
                {industry.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-green-500 mr-1 shrink-0">
                      <FaCheck size={10} className="mt-0.5" />
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
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
      >
        {loading ? "Salvando..." : "Continuar"}
      </button>
    </div>
  );
}
