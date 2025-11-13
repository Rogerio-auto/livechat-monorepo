import { useState } from "react";
import { FaBuilding, FaMapMarkerAlt, FaUsers, FaArrowRight, FaArrowLeft } from "react-icons/fa";

interface CompanyStepProps {
  onNext: (data: CompanyData) => void;
  onBack: () => void;
}

export interface CompanyData {
  company_name: string;
  city: string;
  state: string;
  team_size: string;
}

export function CompanyStep({ onNext, onBack }: CompanyStepProps) {
  const [data, setData] = useState<CompanyData>({
    company_name: "",
    city: "",
    state: "",
    team_size: "1-5",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      onNext(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaBuilding className="text-green-600 text-2xl" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Dados da empresa</h1>
        <p className="text-gray-600">
          Conte-nos um pouco sobre sua empresa
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-2 text-sm">
            Nome da empresa <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FaBuilding className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={data.company_name}
              onChange={(e) => setData({ ...data, company_name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minha Empresa Ltda"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block font-semibold mb-2 text-sm">
              Cidade <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FaMapMarkerAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={data.city}
                onChange={(e) => setData({ ...data, city: e.target.value })}
                className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="São Paulo"
                required
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-2 text-sm">
              UF <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.state}
              onChange={(e) => setData({ ...data, state: e.target.value.toUpperCase() })}
              maxLength={2}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              placeholder="SP"
              required
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2 text-sm">
            Tamanho da equipe <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FaUsers className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={data.team_size}
              onChange={(e) => setData({ ...data, team_size: e.target.value })}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="1-5">1-5 pessoas</option>
              <option value="6-15">6-15 pessoas</option>
              <option value="16-50">16-50 pessoas</option>
              <option value="50+">Mais de 50 pessoas</option>
            </select>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
          <p className="font-semibold mb-1">Por que pedimos isso?</p>
          <p>
            Essas informações nos ajudam a personalizar a experiência e
            recomendar o melhor plano para sua empresa.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            <FaArrowLeft className="mr-2" />
            Voltar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            {loading ? "Salvando..." : "Continuar"}
            {!loading && <FaArrowRight className="ml-2" />}
          </button>
        </div>
      </form>
    </div>
  );
}
