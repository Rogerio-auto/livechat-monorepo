import { useEffect, useMemo, useState } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import { CombinedSignupStep, CombinedSignupData } from "./combined-signup-step";
import { PricingStep } from "./pricing-step";
import { OnboardingStep1 } from "./step1";
import { OnboardingStep2 } from "./step2";
import { OnboardingStep3 } from "./step3";
import { OnboardingStep4 } from "./step4";
import { FaSpinner } from "react-icons/fa";
import type { TeamSize } from "../../types/onboarding";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function OnboardingPage() {
  const { status, loading, saveStep1, saveStep2, saveStep3 } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSystemDark, setIsSystemDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (matches: boolean) => {
      setIsSystemDark(matches);
      document.documentElement.classList.toggle("dark", matches);
      document.documentElement.dataset.theme = matches ? "dark" : "light";
    };
    applyTheme(media.matches);
    const handler = (event: MediaQueryListEvent) => applyTheme(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  // Step 1: Criar usuário + empresa com todos os dados
  const handleCombinedSignup = async (data: CombinedSignupData) => {
    setIsCreatingAccount(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/onboarding/signup-complete`, {
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

  // Steps 2-5: Onboarding (nicho, desafio, recursos, finalizar)
  const handleOnboardingStep1 = async (industry: string) => {
    try {
      await saveStep1({ industry: industry as any });
      setCurrentStep(3);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOnboardingStep2 = async (challenge: string) => {
    try {
      await saveStep2({
        company_name: "", // Já foi enviado no signup-complete
        city: "",
        state: "",
        team_size: (status?.team_size ?? "1-5") as TeamSize,
        main_challenge: challenge,
      });
      setCurrentStep(4);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOnboardingStep3 = async (preferences: any) => {
    try {
      await saveStep3(preferences);
      setCurrentStep(5);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOnboardingComplete = () => {
    setCurrentStep(6);
  };

  // Step 6: Seleção de plano (APÓS onboarding)
  const handlePlanSelection = async (planId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/save-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_id: planId }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar plano");
      }

      await res.json();
      
      // Redirecionar para a raiz - React Router fará o redirecionamento correto
      window.location.href = "https://app.7sion.com/";
    } catch (err: any) {
      setError(err.message);
    }
  };

  const steps = useMemo(
    () => [
      { number: 1, label: "Cadastro" },
      { number: 2, label: "Nicho" },
      { number: 3, label: "Desafio" },
      { number: 4, label: "Recursos" },
      { number: 5, label: "Finalizar" },
      { number: 6, label: "Plano" },
    ],
    [],
  );

  const containerBackground = isSystemDark
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
    : "bg-gradient-to-br from-indigo-50 via-white to-blue-50 text-slate-900";

  const badgeStyles = {
    backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
    color: "var(--color-primary)",
    borderColor: "color-mix(in srgb, var(--color-primary) 28%, transparent)",
  } as const;

  if (loading && currentStep === 1 && !status) {
    return (
      <div className={`min-h-screen ${containerBackground} flex items-center justify-center`}>
        <div className="text-center">
          <FaSpinner
            className="mx-auto mb-4 animate-spin"
            style={{ color: "var(--color-primary)" }}
            size={56}
          />
          <p className="text-sm theme-text-muted">Preparando sua experiência...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${containerBackground}`}>
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] theme-text-muted">
              Onboarding guiado
            </span>
            <h1 className="text-4xl font-semibold leading-tight theme-heading">
              Configure seu espaço de trabalho com recomendações da 7Sion
            </h1>
            <p className="max-w-xl text-sm theme-text-muted">
              Preencha cada etapa para liberar agentes inteligentes, templates e integrações alinhados ao seu tipo de negócio.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide"
              style={badgeStyles}
            >
              Etapa {currentStep} de {steps.length}
            </span>
          </div>
        </header>

        {error && currentStep !== 1 && (
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
            <CombinedSignupStep
              onSubmit={handleCombinedSignup}
              loading={isCreatingAccount}
              error={currentStep === 1 ? error : null}
            />
          )}

          {currentStep === 2 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <OnboardingStep1 onNext={handleOnboardingStep1} />
            </div>
          )}

          {currentStep === 3 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <OnboardingStep2 onNext={handleOnboardingStep2} onBack={() => setCurrentStep(2)} />
            </div>
          )}

          {currentStep === 4 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <OnboardingStep3 onNext={handleOnboardingStep3} onBack={() => setCurrentStep(3)} />
            </div>
          )}

          {currentStep === 5 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <OnboardingStep4 onComplete={handleOnboardingComplete} onBack={() => setCurrentStep(4)} />
            </div>
          )}

          {currentStep === 6 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <PricingStep onNext={handlePlanSelection} onBack={() => setCurrentStep(5)} teamSize={status?.team_size} />
            </div>
          )}
        </div>

        <footer className="mt-16 text-center text-xs theme-text-muted">
          <p>Precisa de ajuda? Nosso time está disponível por chat e e-mail em horário comercial.</p>
        </footer>
      </div>
    </div>
  );
}
