// frontend/src/components/agents/monitoring/ErrorMonitor.tsx
import { useState, useEffect } from 'react';
import { FiAlertCircle, FiClock, FiTerminal } from 'react-icons/fi';
import { api } from '@/lib/api';

export function ErrorMonitor({ agentId }: { agentId: string }) {
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchErrors = async () => {
      try {
        const response = await api.get(`/api/admin/agents/${agentId}/errors`);
        setErrors(response.data);
      } catch (error) {
        console.error('Erro ao buscar logs de erro:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchErrors();
    const interval = setInterval(fetchErrors, 30000);
    return () => clearInterval(interval);
  }, [agentId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[400px]">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiAlertCircle className="text-red-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Monitor de Erros</h3>
        </div>
        <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-full uppercase">
          Tempo Real
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {errors.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <FiAlertCircle size={32} className="mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">Nenhum erro detectado recentemente.</p>
          </div>
        ) : (
          errors.map((err) => (
            <div key={err.id} className="p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <FiTerminal className="text-red-600 dark:text-red-400" size={14} />
                  <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase">
                    {err.tool_name || err.action}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                  <FiClock size={10} />
                  {new Date(err.executed_at).toLocaleTimeString()}
                </div>
              </div>
              <p className="text-xs text-red-800 dark:text-red-200 font-medium">
                {err.error}
              </p>
              {err.params && (
                <div className="mt-2 p-2 bg-black/5 dark:bg-black/20 rounded text-[10px] font-mono text-gray-600 dark:text-gray-400 break-all">
                  Params: {JSON.stringify(err.params)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
