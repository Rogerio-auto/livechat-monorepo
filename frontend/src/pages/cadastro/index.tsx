import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaRocket, 
  FaArrowRight,
  FaArrowLeft,
  FaSpinner,
  FaCheck
} from "react-icons/fa";
import { useCadastro } from "../../hooks/useCadastro";
import { useCadastroStatus } from "../../hooks/useCadastroStatus";
import { useSubscription } from "../../context/SubscriptionContext";
import { Industry } from "../../types/cadastro";
import { toast } from "../../hooks/useToast";

// Steps
import { IndustryStep } from "./steps/IndustryStep";
import { WahaStep } from "./steps/WahaStep";
import { DepartmentsStep } from "./steps/DepartmentsStep";
import { ToolsStep } from "./steps/ToolsStep";
import { AIStep } from "./steps/AIStep";
import { TeamStep } from "./steps/TeamStep";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

export function CadastroPage() {
  const navigate = useNavigate();
  const { status, loading: statusLoading, saveStep1, complete } = useCadastro();
  const { needsOnboarding, markCompleted } = useCadastroStatus();
  const { subscription } = useSubscription();
  
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);

  // State for all steps
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [wahaConnected, setWahaConnected] = useState(false);
  const [wahaSessionId, setWahaSessionId] = useState<string | null>(null);
  const [wahaPhoneNumber, setWahaPhoneNumber] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [tools, setTools] = useState({ calendar: true, pipeline: true });
  const [aiConfig, setAiConfig] = useState({ template: "", training: "", answers: {} as Record<string, any>, isComplete: false });
  const [teamEmails, setTeamEmails] = useState<string[]>([]);

  // Se o onboarding já foi concluído, redireciona para o dashboard
  useEffect(() => {
    if (!statusLoading && !needsOnboarding) {
      navigate("/dashboard");
    }
  }, [needsOnboarding, statusLoading, navigate]);

  // Sincronizar estado inicial com o status do backend
  useEffect(() => {
    if (status?.industry) {
      setIndustry(status.industry as Industry);
    }
  }, [status]);

  const planName = subscription?.plan?.name?.toUpperCase() || "STARTER";

  const steps = useMemo(() => {
    const baseSteps = [
      { id: "industry", title: "Nicho", component: <IndustryStep onSelect={setIndustry} selected={industry} /> },
      { id: "whatsapp", title: "WhatsApp", component: <WahaStep onConnected={(sid, phone) => {
        setWahaConnected(true);
        setWahaSessionId(sid);
        if (phone) setWahaPhoneNumber(phone);
      }} /> },
      { id: "departments", title: "Setores", component: <DepartmentsStep industry={industry} onSave={setDepartments} /> },
    ];

    if (planName !== "STARTER") {
      baseSteps.push({ id: "tools", title: "Ferramentas", component: <ToolsStep onSave={setTools} /> });
    }

    if (["PROFESSIONAL", "BUSINESS"].includes(planName)) {
      baseSteps.push({ id: "ai", title: "IA", component: <AIStep onSave={(config) => setAiConfig({
        template: config.template,
        training: config.training,
        answers: config.answers || {},
        isComplete: config.isComplete || false
      })} /> });
    }

    baseSteps.push({ id: "team", title: "Equipe", component: <TeamStep onSave={setTeamEmails} /> });

    return baseSteps;
  }, [planName, industry]);

  const progress = ((currentStepIdx + 1) / steps.length) * 100;

  const handleNext = async () => {
    if (currentStepIdx === 0 && industry) {
      try {
        setIsSavingStep(true);
        await saveStep1({ industry });
      } catch (err: any) {
        console.error("Erro ao salvar nicho:", err);
        toast.error(err.message || "Erro ao salvar sua escolha. Tente novamente.");
        return; // Interrompe o avanço se der erro
      } finally {
        setIsSavingStep(false);
      }
    }

    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinish = async () => {
    try {
      setIsFinishing(true);
      
      // 1. Salvar Departamentos
      if (departments.length > 0) {
        for (const dept of departments) {
          const res = await fetch(`${API_BASE}/api/departments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: dept }),
            credentials: "include"
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Erro ao criar setor ${dept}`);
          }
        }
      }

      // 1.1 Criar Inbox do WhatsApp (se conectado)
      if (wahaConnected && wahaSessionId) {
        const res = await fetch(`${API_BASE}/settings/inboxes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "WhatsApp Principal",
            phone_number: wahaPhoneNumber || `PENDING_${wahaSessionId.slice(0, 10)}`,
            provider: "WAHA",
            instance_id: wahaSessionId,
            channel: "WHATSAPP",
            is_active: true
          }),
          credentials: "include"
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Erro ao criar inbox:", err);
          // Não vamos travar o onboarding por causa da inbox, mas vamos logar
        }
      }

      // 2. Salvar Configuração de IA (se aplicável)
      if (["PROFESSIONAL", "BUSINESS"].includes(planName) && aiConfig.template) {
        const res = await fetch(`${API_BASE}/api/agents/from-template`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: aiConfig.template,
            answers: aiConfig.answers || {}
          }),
          credentials: "include"
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao criar agente de IA");
        }
      }

      // 3. Convidar Equipe
      if (teamEmails.length > 0) {
        for (const email of teamEmails) {
          const res = await fetch(`${API_BASE}/settings/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, name: email.split("@")[0], role: "AGENT" }),
            credentials: "include"
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Erro ao convidar ${email}`);
          }
        }
      }

      // 4. Finalizar Onboarding no Backend
      await complete();
      markCompleted();
      
      // 5. Redirecionar
      navigate("/dashboard");
      toast.success("Configuração concluída com sucesso!");
    } catch (error: any) {
      console.error("Erro ao finalizar onboarding:", error);
      toast.error("Ocorreu um erro ao finalizar sua configuração. Por favor, tente novamente.");
    } finally {
      setIsFinishing(false);
    }
  };

  const isNextDisabled = useMemo(() => {
    const stepId = steps[currentStepIdx].id;
    if (stepId === "industry") return !industry;
    if (stepId === "whatsapp") return !wahaConnected;
    if (stepId === "ai") return !aiConfig.isComplete;
    return false;
  }, [currentStepIdx, steps, industry, wahaConnected, aiConfig.isComplete]);

  const canSkip = useMemo(() => {
    return ["whatsapp", "ai"].includes(steps[currentStepIdx].id);
  }, [currentStepIdx, steps]);

  if (statusLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <FaSpinner className="mx-auto mb-4 animate-spin text-[#2fb463]" size={40} />
          <p className="text-slate-500 font-medium">Carregando sua configuração...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2fb463] text-white shadow-lg shadow-[#2fb463]/20">
              <FaRocket size={20} />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">
              7SION
            </span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            {steps.map((step, idx) => (
              <div 
                key={step.id}
                className={`flex items-center gap-2 transition-all ${
                  idx <= currentStepIdx ? "text-slate-900" : "text-slate-400"
                }`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold border-2 ${
                  idx < currentStepIdx 
                    ? "bg-[#2fb463] border-[#2fb463] text-white" 
                    : idx === currentStepIdx 
                      ? "border-[#2fb463] text-[#2fb463]" 
                      : "border-slate-200 text-slate-400"
                }`}>
                  {idx < currentStepIdx ? <FaCheck /> : idx + 1}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">{step.title}</span>
              </div>
            ))}
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Progresso</p>
            <p className="text-sm font-black text-slate-900">{Math.round(progress)}%</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-100">
          <div 
            className="h-full bg-[#2fb463] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 pt-32 pb-40">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {steps[currentStepIdx].component}
        </div>
      </main>

      {/* Footer Actions */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStepIdx === 0 || isFinishing || isSavingStep}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all ${
              currentStepIdx === 0 || isFinishing || isSavingStep ? "opacity-0 pointer-events-none" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <FaArrowLeft /> Voltar
          </button>

          <div className="flex items-center gap-4">
            {canSkip && (
              <button
                onClick={() => {
                  if (steps[currentStepIdx].id === "ai") {
                    setAiConfig(prev => ({ ...prev, template: "" }));
                  }
                  setCurrentStepIdx(prev => prev + 1);
                }}
                className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-all"
              >
                Pular por enquanto
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={isNextDisabled || isFinishing || isSavingStep}
              className={`flex items-center gap-3 rounded-2xl bg-slate-900 px-10 py-4 text-sm font-bold text-white shadow-xl transition-all hover:bg-slate-800 hover:shadow-slate-900/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none`}
            >
            {isFinishing || isSavingStep ? (
              <>
                <FaSpinner className="animate-spin" />
                {isFinishing ? "Configurando tudo..." : "Salvando..."}
              </>
            ) : currentStepIdx === steps.length - 1 ? (
              <>Finalizar Configuração <FaRocket /></>
            ) : (
              <>Próximo Passo <FaArrowRight /></>
            )}
          </button>
        </div>
      </div>
    </footer>
  </div>
  );
}
