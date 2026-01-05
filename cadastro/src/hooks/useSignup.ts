import { useState } from "react";
import type { CombinedSignupData } from "../pages/cadastro/combined-signup-step";

// Use relative path so Vite dev server proxy handles the request and cookie headers
// (avoids cross-origin cookie issues during local development).
const API_BASE = import.meta.env.VITE_API_URL || "";

interface SignupPayload extends CombinedSignupData {
  plan_id?: string;
}

export function useSignup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = async (payload: SignupPayload) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/api/cadastro/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

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
