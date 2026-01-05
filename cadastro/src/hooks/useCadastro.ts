import { useState } from "react";
import type {
  CadastroStatus,
  OnboardingStep1Data,
  OnboardingStep2Data,
  OnboardingStep3Data,
  IndustryConfig,
  OnboardingCompleteResponse,
  Industry,
} from "../types/cadastro";

// Use relative path so Vite dev server proxy handles the request and cookie headers
// (avoids cross-origin cookie issues during local development).
const API_BASE = import.meta.env.VITE_API_URL || "";

export function useCadastro() {
  const [status, setStatus] = useState<CadastroStatus | null>(null);
  const [loading, setLoading] = useState(false); // Começa false, só fica true quando faz request
  const [error, setError] = useState<string | null>(null);

  // Fetch status do cadastro
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/cadastro/status`, {
        credentials: "include",
      });

      // Se não estiver autenticado, ignora o erro
      if (res.status === 401) {
        setLoading(false);
        return null;
      }

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
      const res = await fetch(`${API_BASE}/api/cadastro/step/1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

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
      const res = await fetch(`${API_BASE}/api/cadastro/step/2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

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
      const res = await fetch(`${API_BASE}/api/cadastro/step/3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

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
      const res = await fetch(`${API_BASE}/api/cadastro/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

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

  // Buscar configuração de um nicho específico
  const fetchIndustryConfig = async (
    industry: Industry
  ): Promise<IndustryConfig | null> => {
    try {
      const res = await fetch(
        `${API_BASE}/api/cadastro/industry-config/${industry}`,
        {
          credentials: "include",
        }
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

  // Não chama automaticamente o fetchStatus
  // O componente deve chamar manualmente após o signup

  return {
    status,
    loading,
    error,
    fetchStatus,
    saveStep1,
    saveStep2,
    saveStep3,
    complete,
    fetchIndustryConfig,
  };
}
