import { useState, useEffect, useMemo } from "react";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useSignup } from "../../hooks/useSignup";
import { SignupStep, SignupData } from "./signup-step";
import { CompanyStep, CompanyData } from "./company-step";
import { PricingStep } from "./pricing-step";
import { OnboardingStep1 } from "./step1";
import { OnboardingStep2 } from "./step2";
import { OnboardingStep3 } from "./step3";
import { OnboardingStep4 } from "./step4";
import { FaSpinner } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";

export function OnboardingPage() {
  const { status, loading } = useOnboarding();
  const { signup } = useSignup();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const containerBackground = theme === "dark"
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
    : "bg-gradient-to-br from-indigo-50 via-white to-blue-50 text-slate-900";

  useEffect(() => {
    if (status) {
      // Se já completou, redireciona para o dashboard
      if (status.completed) {
        window.location.href = "/";
        return;
      }
      // Se já tem industry selecionada, pula para os steps de configuração
      if (status.industry && currentStep < 5) {
        setCurrentStep(5);
      }
    }
  }, [status, currentStep]);

  const handleSignup = async (data: SignupData) => {
    setSignupData(data);
    setCurrentStep(2);
  };

  const handleCompanyData = async (data: CompanyData) => {
    setCompanyData(data);
    setCurrentStep(3);
  };

  const handlePlanSelection = async (planId: string) => {
    setSelectedPlan(planId);
    
    // Agora que temos todos os dados, criar a conta
    if (signupData && companyData) {
      try {
        await signup({
          ...signupData,
          ...companyData,
          plan_id: planId,
        });
        
        // Sucesso! Avançar para o onboarding de nicho
        setCurrentStep(4);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  if (loading && currentStep === 1) {
    return (
      <div className={`min-h-screen ${containerBackground} flex items-center justify-center`}>
        <div className="text-center">
          <FaSpinner className="mx-auto mb-4 animate-spin text-(--color-primary)" size={64} />
          <p className="text-sm theme-text-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  const steps = useMemo(
    () => [
      { number: 1, label: "Conta" },
      { number: 2, label: "Empresa" },
      { number: 3, label: "Plano" },
      { number: 4, label: "Nicho" },
      { number: 5, label: "Desafio" },
      { number: 6, label: "Recursos" },
      { number: 7, label: "Finalizar" },
    ],
    [],
  );

  const badgeStyles = {
    backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
    color: "var(--color-primary)",
    borderColor: "color-mix(in srgb, var(--color-primary) 28%, transparent)",
  } as const;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${containerBackground}`}>
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] theme-text-muted">
              Bem-vindo
            </span>
            <h1 className="text-4xl font-semibold leading-tight theme-heading">
              Configure sua plataforma em poucos minutos
            </h1>
            <p className="max-w-xl text-sm theme-text-muted">
              Centralize seu relacionamento com clientes, equipe e automações em uma única experiência.
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
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        <div className="space-y-10">
          {currentStep === 1 && <SignupStep onNext={handleSignup} />}

          {currentStep === 2 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <CompanyStep onNext={handleCompanyData} onBack={() => setCurrentStep(1)} />
            </div>
          )}

          {currentStep === 3 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <PricingStep
                onNext={handlePlanSelection}
                onBack={() => setCurrentStep(2)}
                teamSize={companyData?.team_size}
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <OnboardingStep1 onNext={() => setCurrentStep(5)} />
            </div>
          )}

          {currentStep === 5 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <OnboardingStep2 onNext={() => setCurrentStep(6)} onBack={() => setCurrentStep(4)} />
            </div>
          )}

          {currentStep === 6 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <OnboardingStep3 onNext={() => setCurrentStep(7)} onBack={() => setCurrentStep(5)} />
            </div>
          )}

          {currentStep === 7 && (
            <div className="config-card rounded-2xl px-8 py-10 shadow-xl">
              <OnboardingStep4 onBack={() => setCurrentStep(6)} />
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
