import { useState, useEffect } from 'react';
import { Agent } from '@/types/agent';
import { FiSmartphone, FiCheck } from 'react-icons/fi';

interface Inbox {
  id: string;
  name: string;
  phone_number: string;
  channel: string;
  provider: string;
}

interface Props {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function InboxSelector({ agent, onUpdate }: Props) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInboxes = async () => {
      try {
        const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';
        const res = await fetch(`${API}/livechat/inboxes`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setInboxes(data);
        }
      } catch (error) {
        console.error('Erro ao carregar inboxes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInboxes();
  }, []);

  const toggleInbox = (inboxId: string) => {
    const currentIds = agent.enabled_inbox_ids || [];
    const newIds = currentIds.includes(inboxId)
      ? currentIds.filter(id => id !== inboxId)
      : [...currentIds, inboxId];
    
    onUpdate({ enabled_inbox_ids: newIds });
  };

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-6">
        <FiSmartphone className="text-blue-600" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Canais Ativos</h3>
      </div>

      <div className="space-y-2">
        {inboxes.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Nenhuma inbox configurada.</p>
        ) : (
          inboxes.map((inbox) => {
            const isActive = agent.enabled_inbox_ids?.includes(inbox.id);
            return (
              <button
                key={inbox.id}
                onClick={() => toggleInbox(inbox.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <FiSmartphone size={14} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{inbox.name}</p>
                    <p className="text-[10px] opacity-70">{inbox.phone_number} • {inbox.provider}</p>
                  </div>
                </div>
                {isActive && <FiCheck className="text-blue-600" />}
              </button>
            );
          })
        )}
      </div>
      <p className="mt-4 text-[10px] text-gray-500">
        O agente responderá automaticamente apenas nas inboxes selecionadas acima.
      </p>
    </div>
  );
}
