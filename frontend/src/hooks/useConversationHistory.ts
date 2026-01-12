// frontend/src/hooks/useConversationHistory.ts
import { useState, useEffect } from 'react';
import { Conversation } from '@livechat/shared';

export function useConversationHistory(agentId: string, limit: number = 10) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';
        const res = await fetch(
          `${API}/api/admin/agents/${agentId}/conversations?limit=${limit}`,
          { credentials: 'include' }
        );
        
        if (!res.ok) throw new Error('Erro ao carregar histórico');
        
        const data = await res.json();
        setConversations(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (agentId) fetchHistory();
  }, [agentId, limit]);

  return { conversations, loading, error };
}
