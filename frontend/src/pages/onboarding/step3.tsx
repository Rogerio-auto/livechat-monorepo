import { useState, useEffect } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import type { OnboardingStep3Data, IndustryConfig } from "../../types/onboarding";
import { FaRobot, FaComments, FaBoxOpen, FaMapPin, FaBolt, FaCheck } from "react-icons/fa";

interface Step3Props {
  onNext: () => void;
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
      onNext();
    } catch (error) {
      console.error("Erro ao salvar step 3:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Recursos Iniciais</h1>
        <p className="text-gray-600">
          Escolha os recursos que deseja ativar agora (você pode alterar depois)
        </p>
      </div>

      <div className="space-y-6 mb-8">
        {/* Agente de IA */}
        <div className="border-2 rounded-lg p-6 hover:border-blue-300 transition-colors">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="ai-agent"
              checked={data.wants_ai_agent}
              onChange={(e) =>
                setData({ ...data, wants_ai_agent: e.target.checked })
              }
              className="mt-1 mr-4 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <label htmlFor="ai-agent" className="cursor-pointer">
                <h3 className="font-bold text-lg mb-1 flex items-center">
                  <FaRobot className="mr-2 text-blue-600" /> Agente de IA
                </h3>
                <p className="text-gray-600">
                  <strong className="text-blue-600">{config.agent_name}</strong> - Um assistente virtual
                  treinado especificamente para o seu nicho
                </p>
              </label>
            </div>
          </div>
        </div>

        {/* Templates */}
        <div className="border-2 rounded-lg p-6 hover:border-blue-300 transition-colors">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="templates"
              checked={data.wants_templates}
              onChange={(e) =>
                setData({ ...data, wants_templates: e.target.checked })
              }
              className="mt-1 mr-4 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <label htmlFor="templates" className="cursor-pointer">
                <h3 className="font-bold text-lg mb-1 flex items-center">
                  <FaComments className="mr-2 text-green-600" /> Templates de Mensagem
                </h3>
                <p className="text-gray-600">
                  {config.templates_count} templates prontos para o seu nicho, economize tempo em
                  respostas comuns
                </p>
              </label>
            </div>
          </div>
        </div>

        {/* Catálogo */}
        <div className="border-2 rounded-lg p-6 hover:border-blue-300 transition-colors">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="catalog"
              checked={data.wants_catalog}
              onChange={(e) =>
                setData({ ...data, wants_catalog: e.target.checked })
              }
              className="mt-1 mr-4 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <label htmlFor="catalog" className="cursor-pointer">
                <h3 className="font-bold text-lg mb-1 flex items-center">
                  <FaBoxOpen className="mr-2 text-amber-600" /> Catálogo de Produtos/Serviços
                </h3>
                <p className="text-gray-600">
                  Sistema para gerenciar seus produtos e serviços, com preços e descrições
                </p>
              </label>
            </div>
          </div>
        </div>

        {/* Campos Personalizados */}
        <div className="bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold mb-3 flex items-center">
            <FaMapPin className="mr-2 text-blue-600" />
            Campos Personalizados Inclusos
          </h4>
          <p className="text-sm text-gray-700 mb-3">
            Vamos adicionar automaticamente estes campos aos seus leads:
          </p>
          <ul className="text-sm space-y-2">
            {config.custom_fields.map((field, idx) => (
              <li key={idx} className="flex items-center">
                <FaCheck className="mr-2 text-green-500" size={14} />
                <span className="font-medium">{field.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Módulos Habilitados */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold mb-3 flex items-center">
            <FaBolt className="mr-2 text-yellow-600" />
            Módulos que serão habilitados
          </h4>
          <div className="flex flex-wrap gap-2">
            {config.enabled_modules.map((module, idx) => (
              <span
                key={idx}
                className="bg-white border border-gray-300 rounded-full px-4 py-1 text-sm"
              >
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
          className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {loading ? "Salvando..." : "Continuar"}
        </button>
      </div>
    </div>
  );
}
