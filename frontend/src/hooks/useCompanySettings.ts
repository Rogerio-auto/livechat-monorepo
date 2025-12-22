import { useState, useEffect, useCallback } from "react";
import { API, fetchJson } from "../utils/api";

export type CompanyForm = {
  empresa: string;
  endereco: string;
  cidade: string;
  uf: string;
  logoUrl: string;
};

export function useCompanySettings() {
  const [form, setForm] = useState<CompanyForm>({
    empresa: "",
    endereco: "",
    cidade: "",
    uf: "",
    logoUrl: "",
  });
  const [baseline, setBaseline] = useState<CompanyForm>({
    empresa: "",
    endereco: "",
    cidade: "",
    uf: "",
    logoUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchCompanyData = useCallback(async () => {
    try {
      setLoading(true);
      const [profile, companyData] = await Promise.all([
        fetchJson<any>(`${API}/auth/me`),
        fetchJson<any>(`${API}/companies/me`),
      ]);

      setUserRole(profile.role);

      const company = {
        empresa: companyData.name || "",
        endereco: companyData.address || "",
        cidade: companyData.city || "",
        uf: companyData.state || "",
        logoUrl: companyData.logo || "",
      };

      setForm(company);
      setBaseline(company);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados da empresa");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  const onSaved = (next: CompanyForm) => {
    setForm(next);
    setBaseline(next);
  };

  return {
    form,
    setForm,
    baseline,
    loading,
    error,
    userRole,
    onSaved,
    refetch: fetchCompanyData,
  };
}
