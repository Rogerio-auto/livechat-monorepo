import { useEffect, useMemo, useState } from "react";
import { useCadastro } from "../../hooks/useCadastro";
import { CombinedSignupStep, CombinedSignupData } from "./combined-signup-step";
import { PricingStep } from "./pricing-step";
import { FaSpinner } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function CadastroPage() {
  const { status, loading } = useCadastro();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Forçar tema claro nesta parte do sistema conforme solicitado pelo usuário
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
  }, []);

  // Passo 1: Seleção de Plano
  const handlePlanSelection = (planId: string) => {
    setSelectedPlan(planId);
    setCurrentStep(2);
  };

  // Passo 2: Criar usuário + empresa com todos os dados + plano
  const handleCombinedSignup = async (data: CombinedSignupData) => {
    setIsCreatingAccount(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/cadastro/signup-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          // Dados do usuário
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone,
          // Dados da empresa
          company_name: data.company_name,
          cnpj: data.cnpj,
          company_phone: data.company_phone || data.phone,
          city: data.city,
          state: data.state,
          team_size: data.team_size,
          // Plano selecionado
          plan_id: selectedPlan,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao criar conta");
      }

      console.log("✅ Conta criada com sucesso:", result);
      
      // Redirecionar para a raiz - React Router fará o redirecionamento correto
      window.location.href = "https://app.7sion.com/";
    } catch (err: any) {
      console.error("❌ Erro ao criar conta:", err);
      setError(err.message);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const steps = useMemo(
    () => [
      { number: 1, label: "Escolha seu Plano" },
      { number: 2, label: "Cadastro" },
    ],
    [],
  );

  const containerBackground = "bg-slate-50 text-slate-900";

  const badgeStyles = {
    backgroundColor: "rgba(47, 180, 99, 0.1)",
    color: "#2fb463",
    borderColor: "rgba(47, 180, 99, 0.2)",
  } as const;

  if (loading && currentStep === 1 && !status) {
    return (
      <div className={`min-h-screen ${containerBackground} flex items-center justify-center`}>
        <div className="text-center">
          <FaSpinner
            className="mx-auto mb-4 animate-spin text-[#2fb463]"
            size={56}
          />
          <p className="text-sm text-slate-500">Preparando sua experiência...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${containerBackground}`}>
      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400">
              Cadastro Simplificado
            </span>
            <h1 className="text-4xl font-bold leading-tight text-slate-900">
              Comece sua jornada com a 7Sion
            </h1>
            <p className="max-w-xl text-sm text-slate-500">
              Escolha o plano ideal para o seu negócio e ative seu período de 30 dias grátis agora mesmo.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-wide"
              style={badgeStyles}
            >
              Etapa {currentStep} de {steps.length}
            </span>
          </div>
        </header>

        {error && (
          <div
            className="mb-6 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: "color-mix(in srgb, #ef4444 32%, transparent)",
              backgroundColor: "color-mix(in srgb, #ef4444 18%, transparent)",
              color: "#fee2e2",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Ocorreu um erro</p>
                <p>{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="rounded px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: "color-mix(in srgb, #ef4444 35%, transparent)",
                  color: "#fee2e2",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-10">
          {currentStep === 1 && (
            <PricingStep onNext={handlePlanSelection} onBack={() => {}} />
          )}

          {currentStep === 2 && (
            <CombinedSignupStep
              onSubmit={handleCombinedSignup}
              loading={isCreatingAccount}
              error={error}
            />
          )}
        </div>

        <footer className="mt-16 text-center text-xs theme-text-muted">
          <p>Precisa de ajuda? Nosso time está disponível por chat e e-mail em horário comercial.</p>
        </footer>
      </div>
    </div>
  );
}
