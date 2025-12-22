import { useState, useEffect, useCallback } from "react";
import { API, fetchJson } from "../utils/api";

export type ProfileForm = {
  nome: string;
  avatarUrl: string;
  senhaAtual: string;
  novaSenha: string;
  confirmarSenha: string;
};

export function useProfileSettings() {
  const [form, setForm] = useState<ProfileForm>({
    nome: "",
    avatarUrl: "",
    senhaAtual: "",
    novaSenha: "",
    confirmarSenha: "",
  });
  const [baseline, setBaseline] = useState<{ nome: string; avatarUrl: string }>({
    nome: "",
    avatarUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await fetchJson<any>(`${API}/auth/me`);

      const data = {
        nome: profile.name || "",
        avatarUrl: profile.avatarUrl || "",
        senhaAtual: "",
        novaSenha: "",
        confirmarSenha: "",
      };

      setForm(data);
      setBaseline({ nome: data.nome, avatarUrl: data.avatarUrl });
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados do perfil");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const onSaved = (next: ProfileForm) => {
    setForm(next);
    setBaseline({ nome: next.nome, avatarUrl: next.avatarUrl });
  };

  return {
    form,
    setForm,
    baseline,
    loading,
    error,
    onSaved,
    refetch: fetchProfileData,
  };
}
