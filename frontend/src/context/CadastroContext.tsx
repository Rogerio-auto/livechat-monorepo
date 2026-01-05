import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  OnboardingStatus,
  OnboardingStep1Data,
  OnboardingStep2Data,
  OnboardingStep3Data,
  OnboardingCompleteResponse,
} from "../types/cadastro";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

function withDevCompany(init: RequestInit = {}): RequestInit {
  const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
  if (!import.meta.env.DEV || !devCompany) return init;

  const headers = new Headers(init.headers || {});
  if (!headers.has("X-Company-Id")) headers.set("X-Company-Id", devCompany);
  return { ...init, headers };
}

interface CadastroContextType {
  status: OnboardingStatus | null;
  loading: boolean;
  needsOnboarding: boolean;
  checkStatus: (showLoading?: boolean) => Promise<OnboardingStatus | null>;
  markCompleted: () => void;
  saveStep1: (data: OnboardingStep1Data) => Promise<any>;
  saveStep2: (data: OnboardingStep2Data) => Promise<any>;
  saveStep3: (data: OnboardingStep3Data) => Promise<any>;
  complete: () => Promise<OnboardingCompleteResponse>;
  savePlan: (planId: string) => Promise<any>;
  fetchIndustryConfig: (industry: string) => Promise<any>;
}

const CadastroContext = createContext<CadastroContextType | undefined>(undefined);

export function CadastroProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const checkStatus = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/cadastro/status`,
        withDevCompany({ credentials: "include" })
      );

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setNeedsOnboarding(!data.completed);
        return data;
      } else {
        setNeedsOnboarding(false);
        return null;
      }
    } catch (error) {
      console.error("Erro ao verificar status do onboarding:", error);
      setNeedsOnboarding(false);
      return null;
    } finally {
      if (showLoading) setLoading(false);
      setHasChecked(true);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const markCompleted = useCallback(() => {
    setNeedsOnboarding(false);
    setStatus((prev) => (prev ? { ...prev, completed: true } : null));
  }, []);

  const saveStep1 = async (data: OnboardingStep1Data) => {
    const res = await fetch(
      `${API_BASE}/api/cadastro/step/1`,
      withDevCompany({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      })
    );
    if (!res.ok) throw new Error("Erro ao salvar step 1");
    return checkStatus(false); // Não mostrar loading global ao salvar step
  };

  const saveStep2 = async (data: OnboardingStep2Data) => {
    const res = await fetch(
      `${API_BASE}/api/cadastro/step/2`,
      withDevCompany({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      })
    );
    if (!res.ok) throw new Error("Erro ao salvar step 2");
    return checkStatus();
  };

  const saveStep3 = async (data: OnboardingStep3Data) => {
    const res = await fetch(
      `${API_BASE}/api/cadastro/step/3`,
      withDevCompany({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      })
    );
    if (!res.ok) throw new Error("Erro ao salvar step 3");
    return checkStatus();
  };

  const complete = async (): Promise<OnboardingCompleteResponse> => {
    const res = await fetch(
      `${API_BASE}/api/cadastro/complete`,
      withDevCompany({
        method: "POST",
        credentials: "include",
      })
    );
    if (!res.ok) throw new Error("Erro ao completar onboarding");
    const result = await res.json();
    markCompleted();
    return result;
  };

  const savePlan = async (planId: string) => {
    const res = await fetch(
      `${API_BASE}/api/cadastro/save-plan`,
      withDevCompany({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_id: planId }),
      })
    );
    if (!res.ok) throw new Error("Erro ao salvar plano");
    return res.json();
  };

  const fetchIndustryConfig = async (industry: string) => {
    const res = await fetch(
      `${API_BASE}/api/cadastro/industry-config/${industry}`,
      withDevCompany({ credentials: "include" })
    );
    if (!res.ok) throw new Error("Erro ao buscar configuração do nicho");
    return res.json();
  };

  return (
    <CadastroContext.Provider value={{ 
      status, 
      loading, 
      needsOnboarding, 
      checkStatus, 
      markCompleted,
      saveStep1,
      saveStep2,
      saveStep3,
      complete,
      savePlan,
      fetchIndustryConfig
    }}>
      {children}
    </CadastroContext.Provider>
  );
}

export function useCadastro() {
  const context = useContext(CadastroContext);
  if (context === undefined) {
    throw new Error('useCadastro must be used within a CadastroProvider');
  }
  return context;
}
