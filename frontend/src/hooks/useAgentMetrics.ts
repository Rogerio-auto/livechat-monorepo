// frontend/src/hooks/useAgentMetrics.ts

import { useState, useEffect } from 'react';
import { AgentMetrics } from '@/types/agent';

export function useAgentMetrics(agentId:  string, period: 'hour' | 'day' | 'week' | 'month') {
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';
        const res = await fetch(
          `${API}/api/admin/agents/${agentId}/metrics?period=${period}`,
          { credentials: 'include' }
        );
        
        if (!res.ok) throw new Error('Erro ao carregar métricas');
        
        const data = await res.json();
        setMetrics(data);
        setError(null);
      } catch (err:  any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [agentId, period]);

  return { metrics, loading, error };
}
