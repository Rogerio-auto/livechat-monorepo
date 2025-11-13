import { useState, useEffect } from "react";
import type {
  OnboardingStatus,
  OnboardingStep1Data,
  OnboardingStep2Data,
  OnboardingStep3Data,
  IndustryConfig,
  OnboardingCompleteResponse,
  Industry,
} from "../types/onboarding";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

function withDevCompany(init: RequestInit = {}): RequestInit {
  const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
  if (!import.meta.env.DEV || !devCompany) return init;

  const headers = new Headers(init.headers || {});
  if (!headers.has("X-Company-Id")) headers.set("X-Company-Id", devCompany);
  return { ...init, headers };
}

export function useOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch status do onboarding
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/onboarding/status`,
        withDevCompany({ credentials: "include" })
      );

      if (!res.ok) {
        throw new Error("Erro ao buscar status do onboarding");
      }

      const data = await res.json();
      setStatus(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Salvar Step 1
  const saveStep1 = async (data: OnboardingStep1Data) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/onboarding/step/1`,
        withDevCompany({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        })
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao salvar step 1");
      }

      const result = await res.json();
      await fetchStatus(); // Atualiza o status
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Salvar Step 2
  const saveStep2 = async (data: OnboardingStep2Data) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/onboarding/step/2`,
        withDevCompany({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        })
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao salvar step 2");
      }

      const result = await res.json();
      await fetchStatus();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Salvar Step 3
  const saveStep3 = async (data: OnboardingStep3Data) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/onboarding/step/3`,
        withDevCompany({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        })
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao salvar step 3");
      }

      const result = await res.json();
      await fetchStatus();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Completar onboarding
  const complete = async (): Promise<OnboardingCompleteResponse> => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/onboarding/complete`,
        withDevCompany({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        })
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao completar onboarding");
      }

      const result = await res.json();
      await fetchStatus();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const savePlan = async (planId: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/onboarding/save-plan`,
        withDevCompany({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ plan_id: planId }),
        })
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Erro ao salvar plano");
      }

      return await res.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Buscar configuração de um nicho específico
  const fetchIndustryConfig = async (
    industry: Industry
  ): Promise<IndustryConfig | null> => {
    try {
      const res = await fetch(
        `${API_BASE}/api/onboarding/industry-config/${industry}`,
        withDevCompany({
          credentials: "include",
        })
      );

      if (!res.ok) {
        throw new Error("Erro ao buscar configuração do nicho");
      }

      return await res.json();
    } catch (err: any) {
      console.error(err);
      return null;
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return {
    status,
    loading,
    error,
    fetchStatus,
    saveStep1,
    saveStep2,
    saveStep3,
    complete,
    savePlan,
    fetchIndustryConfig,
  };
}
