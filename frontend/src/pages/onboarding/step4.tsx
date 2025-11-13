import { useState } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import { FaCheckCircle, FaWhatsapp, FaBox, FaRobot, FaPlay } from "react-icons/fa";

interface Step4Props {
  onBack: () => void;
}

export function OnboardingStep4({ onBack }: Step4Props) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { complete } = useOnboarding();

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    
    try {
      const result = await complete();
      
      // Aguarda 2 segundos para mostrar a mensagem de sucesso
      setTimeout(() => {
        // Redirecionar para o dashboard principal
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      console.error("Erro ao completar onboarding:", err);
      setError(err.message || "Erro ao finalizar onboarding");
      setCompleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4 flex justify-center">
          <FaCheckCircle className="text-green-500 animate-bounce" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Tudo Pronto!</h1>
        <p className="text-gray-600">
          Seu sistema foi configurado e está pronto para uso
        </p>
      </div>

      <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg p-8 mb-8">
        <h2 className="text-xl font-bold mb-6 text-center flex items-center justify-center">
          <FaCheckCircle className="mr-2 text-blue-600" /> Próximos Passos
        </h2>
        <ul className="space-y-4 max-w-md mx-auto">
          <li className="flex items-start bg-white rounded-lg p-4 shadow-sm">
            <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 shrink-0">
              <FaWhatsapp size={18} />
            </span>
            <div>
              <span className="font-semibold">Conecte seu WhatsApp</span>
              <p className="text-sm text-gray-600">Configure sua conta do WhatsApp Business</p>
            </div>
          </li>
          <li className="flex items-start bg-white rounded-lg p-4 shadow-sm">
            <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 shrink-0">
              <FaBox size={16} />
            </span>
            <div>
              <span className="font-semibold">Cadastre seus produtos/serviços</span>
              <p className="text-sm text-gray-600">Monte seu catálogo para enviar aos clientes</p>
            </div>
          </li>
          <li className="flex items-start bg-white rounded-lg p-4 shadow-sm">
            <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 shrink-0">
              <FaRobot size={16} />
            </span>
            <div>
              <span className="font-semibold">Configure seu agente de IA</span>
              <p className="text-sm text-gray-600">Personalize as respostas automáticas</p>
            </div>
          </li>
          <li className="flex items-start bg-white rounded-lg p-4 shadow-sm">
            <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 shrink-0">
              <FaPlay size={14} />
            </span>
            <div>
              <span className="font-semibold">Comece a atender seus clientes!</span>
              <p className="text-sm text-gray-600">Tudo pronto para começar</p>
            </div>
          </li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          <p className="font-semibold">Erro ao finalizar:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {completing && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mb-6 text-center">
          <p className="font-semibold">✓ Configurações aplicadas com sucesso!</p>
          <p className="text-sm">Redirecionando para o sistema...</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={completing}
          className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Voltar
        </button>
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex-1 bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {completing ? "Finalizando..." : "Ir para o Sistema"}
        </button>
      </div>
    </div>
  );
}
