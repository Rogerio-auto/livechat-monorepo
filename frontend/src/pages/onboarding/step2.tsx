import { useState } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import type { OnboardingStep2Data, TeamSize } from "../../types/onboarding";

interface Step2Props {
  onNext: () => void;
  onBack: () => void;
}

export function OnboardingStep2({ onNext, onBack }: Step2Props) {
  const [data, setData] = useState<OnboardingStep2Data>({
    company_name: "",
    city: "",
    state: "",
    team_size: "1-5",
    main_challenge: "",
  });
  const [loading, setLoading] = useState(false);
  const { saveStep2 } = useOnboarding();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await saveStep2(data);
      onNext();
    } catch (error) {
      console.error("Erro ao salvar step 2:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Conte-nos sobre sua empresa</h1>
        <p className="text-gray-600">
          Essas informações nos ajudam a personalizar sua experiência
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-semibold mb-2">
            Nome da Empresa <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.company_name}
            onChange={(e) =>
              setData({ ...data, company_name: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Minha Empresa Ltda"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block font-semibold mb-2">
              Cidade <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.city}
              onChange={(e) => setData({ ...data, city: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: São Paulo"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-2">
              UF <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.state}
              onChange={(e) =>
                setData({ ...data, state: e.target.value.toUpperCase() })
              }
              maxLength={2}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              placeholder="SP"
              required
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2">
            Tamanho da Equipe <span className="text-red-500">*</span>
          </label>
          <select
            value={data.team_size}
            onChange={(e) =>
              setData({ ...data, team_size: e.target.value as TeamSize })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1-5">1-5 pessoas</option>
            <option value="6-15">6-15 pessoas</option>
            <option value="16-50">16-50 pessoas</option>
            <option value="50+">Mais de 50 pessoas</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-2">
            Qual é o seu principal desafio? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={data.main_challenge}
            onChange={(e) =>
              setData({ ...data, main_challenge: e.target.value })
            }
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Melhorar o atendimento ao cliente, organizar agenda, aumentar vendas..."
            required
          />
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
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {loading ? "Salvando..." : "Continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
