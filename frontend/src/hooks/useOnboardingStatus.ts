import { useState, useEffect } from "react";

interface OnboardingStatus {
  completed: boolean;
  current_step: number;
  industry?: string;
}

export function useOnboardingStatus() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const checkStatus = async () => {
    try {
      setLoading(true);
      // Usar URL relativa - o proxy do Vite vai encaminhar para http://localhost:5000
      const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
      const headers = devCompany && import.meta.env.DEV ? { "X-Company-Id": devCompany } : undefined;
      const res = await fetch("/api/onboarding/status", {
        credentials: "include",
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setNeedsOnboarding(!data.completed);
      } else {
        // Se der 401, usuário não está autenticado
        // Se der 404, pode ser que ainda não tenha empresa
        setNeedsOnboarding(false);
      }
    } catch (error) {
      console.error("Erro ao verificar status do onboarding:", error);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const markCompleted = () => {
    setNeedsOnboarding(false);
    setStatus((prev) => (prev ? { ...prev, completed: true } : null));
  };

  return {
    status,
    loading,
    needsOnboarding,
    checkStatus,
    markCompleted,
  };
}
