// frontend/src/hooks/useAgentConfig.ts
import { useState, useEffect } from 'react';
import { Agent } from '@/types/agent';

export function useAgentConfig(agentId: string) {
  const [config, setConfig] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';
        const res = await fetch(
          `${API}/api/admin/agents/${agentId}`,
          { credentials: 'include' }
        );
        
        if (!res.ok) throw new Error('Erro ao carregar configuração');
        
        const data = await res.json();
        setConfig(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (agentId) fetchConfig();
  }, [agentId]);

  const updateConfig = async (newConfig: Partial<Agent>) => {
    try {
      const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';
      const res = await fetch(
        `${API}/api/admin/agents/${agentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig),
          credentials: 'include'
        }
      );
      
      if (!res.ok) throw new Error('Erro ao atualizar configuração');
      
      const data = await res.json();
      setConfig(data);
      return data;
    } catch (err: any) {
      throw err;
    }
  };

  return { config, loading, error, updateConfig };
}
