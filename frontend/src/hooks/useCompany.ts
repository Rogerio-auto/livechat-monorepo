import { useState, useEffect } from 'react';
import type { Industry } from '@livechat/shared';

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';

export interface Company {
  id: string;
  name: string;
  industry?: Industry;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  team_size?: string;
  created_at?: string;
}

interface UseCompanyResult {
  company: Company | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para obter informações da empresa do usuário logado
 * Inclui o industry (nicho) para adaptar a interface
 */
export function useCompany(): UseCompanyResult {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompany = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar dados da empresa do usuário logado
      const response = await fetch(`${API}/companies/me`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Não autenticado');
        }
        throw new Error('Erro ao buscar dados da empresa');
      }

      const companyData = await response.json();
      setCompany(companyData);
    } catch (err: any) {
      console.error('Erro ao buscar empresa:', err);
      setError(err.message || 'Erro desconhecido');
      setCompany(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, []);

  return {
    company,
    loading,
    error,
    refetch: fetchCompany,
  };
}
