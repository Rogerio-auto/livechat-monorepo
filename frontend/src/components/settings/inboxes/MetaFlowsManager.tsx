import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiFileText, FiActivity } from 'react-icons/fi';
import { Button } from '../../ui';
import { fetchJson, API } from '../../../utils/api';

interface MetaFlow {
  id: string;
  meta_flow_id: string;
  name: string;
  status: string;
  categories: string[];
}

interface MetaFlowsManagerProps {
  inboxId: string;
  apiBase?: string;
}

export default function MetaFlowsManager({ inboxId, apiBase = API }: MetaFlowsManagerProps) {
  const [flows, setFlows] = useState<MetaFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<any>(`${apiBase}/api/meta/flows/${inboxId}`);
      setFlows(data.data || []);
    } catch (err) {
      console.error("Error fetching flows:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetchJson(`${apiBase}/api/meta/flows/${inboxId}/sync`, {
        method: 'POST'
      });
      await fetchFlows();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (inboxId) {
      fetchFlows();
    }
  }, [inboxId]);

  return (
    <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FiFileText className="text-cyan-500" />
            Meta Flows (Formulários)
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Gerencie os formulários interativos que podem ser enviados nesta Inbox.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync} 
            disabled={syncing || loading}
            className="flex items-center gap-2"
          >
            <FiRefreshCw className={syncing ? 'animate-spin' : ''} />
            Sincronizar
          </Button>
        </div>
      </div>

      {loading && flows.length === 0 ? (
        <div className="text-center py-8">
          <FiActivity className="animate-spin text-gray-300 mx-auto mb-2" size={24} />
          <p className="text-xs text-gray-500">Carregando formulários...</p>
        </div>
      ) : flows.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
          <FiFileText className="text-gray-200 mx-auto mb-2" size={32} />
          <p className="text-xs text-gray-500">Nenhum formulário sincronizado para esta Inbox.</p>
          <Button variant="ghost" size="sm" onClick={handleSync} className="mt-2 underline text-primary">
            Sincronizar agora
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {flows.map(flow => (
            <div 
              key={flow.id} 
              className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg flex items-center justify-between group hover:border-cyan-500/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <FiFileText size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{flow.name}</div>
                  <div className="text-[10px] text-gray-500 font-mono">{flow.meta_flow_id}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  flow.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {flow.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
