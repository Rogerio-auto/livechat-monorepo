import { useState } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import type { OnboardingStep2Data, TeamSize } from "../../types/onboarding";

interface Step2Props {
  onNext: (challenge: string) => void;
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
      onNext(data.main_challenge); // Passa o desafio principal
    } catch (error) {
      console.error("Erro ao salvar step 2:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold theme-heading">Conte-nos sobre sua empresa</h1>
        <p className="text-sm theme-text-muted">
          Usamos esses dados para personalizar métricas, funis e comunicações automáticas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
            Nome da empresa
          </label>
          <input
            type="text"
            value={data.company_name}
            onChange={(e) => setData({ ...data, company_name: e.target.value })}
            className="config-input w-full rounded-lg px-4 py-2.5 text-sm"
            placeholder="Ex: Minha Empresa Ltda"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
              Cidade
            </label>
            <input
              type="text"
              value={data.city}
              onChange={(e) => setData({ ...data, city: e.target.value })}
              className="config-input w-full rounded-lg px-4 py-2.5 text-sm"
              placeholder="Ex: São Paulo"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
              UF
            </label>
            <input
              type="text"
              value={data.state}
              onChange={(e) => setData({ ...data, state: e.target.value.toUpperCase() })}
              maxLength={2}
              className="config-input w-full rounded-lg px-4 py-2.5 text-sm uppercase"
              placeholder="SP"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
            Tamanho da equipe
          </label>
          <select
            value={data.team_size}
            onChange={(e) => setData({ ...data, team_size: e.target.value as TeamSize })}
            className="config-input w-full appearance-none rounded-lg px-4 py-2.5 text-sm"
          >
            <option value="1-5">1-5 pessoas</option>
            <option value="6-15">6-15 pessoas</option>
            <option value="16-50">16-50 pessoas</option>
            <option value="50+">Mais de 50 pessoas</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
            Qual é o seu principal desafio?
          </label>
          <textarea
            value={data.main_challenge}
            onChange={(e) =>
              setData({ ...data, main_challenge: e.target.value })
            }
            rows={4}
            className="config-input w-full rounded-lg px-4 py-3 text-sm"
            placeholder="Ex: Melhorar o atendimento ao cliente, organizar agenda, aumentar vendas..."
            required
          />
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
            type="submit"
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
      </form>
    </div>
  );
}
