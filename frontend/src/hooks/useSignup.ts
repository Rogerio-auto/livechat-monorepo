import { useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

function withDevCompany(init: RequestInit = {}): RequestInit {
  const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
  if (!import.meta.env.DEV || !devCompany) return init;
  const headers = new Headers(init.headers || {});
  if (!headers.has("X-Company-Id")) headers.set("X-Company-Id", devCompany);
  return { ...init, headers };
}

interface SignupPayload {
  [key: string]: any;
}

export function useSignup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = async (payload: SignupPayload) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API_BASE}/api/cadastro/signup`,
        withDevCompany({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar conta");
      }

      const result = await res.json();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    signup,
    loading,
    error,
  };
}
