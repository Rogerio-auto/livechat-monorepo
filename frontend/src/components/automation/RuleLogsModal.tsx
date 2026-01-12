import { useState, useEffect } from "react";
import { X, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { useAutomationRules } from "../../hooks/useAutomationRules";
import { AutomationRule, AutomationLog } from "@livechat/shared";

interface RuleLogsModalProps {
  rule: AutomationRule;
  onClose: () => void;
}

export function RuleLogsModal({ rule, onClose }: RuleLogsModalProps) {
  const { getRuleLogs } = useAutomationRules();
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [rule.id]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRuleLogs(rule.id, 100);
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: AutomationLog["status"]) => {
    switch (status) {
      case "SUCCESS":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "FAILED":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "SKIPPED":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusLabel = (status: AutomationLog["status"]) => {
    switch (status) {
      case "SUCCESS":
        return "Sucesso";
      case "FAILED":
        return "Falha";
      case "SKIPPED":
        return "Ignorado";
    }
  };

  const getStatusColor = (status: AutomationLog["status"]) => {
    switch (status) {
      case "SUCCESS":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "FAILED":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "SKIPPED":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    }
  };

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.status === "SUCCESS").length,
    failed: logs.filter((l) => l.status === "FAILED").length,
    skipped: logs.filter((l) => l.status === "SKIPPED").length,
    totalTasksCreated: logs.reduce((sum, l) => sum + l.tasks_created, 0),
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Logs de Execução
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rule.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.success}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Sucesso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.failed}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Falhas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.skipped}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Ignorados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalTasksCreated}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Tasks Criadas</div>
            </div>
          </div>
        </div>

        {/* Logs List */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Carregando logs...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                Nenhuma execução registrada ainda
              </p>
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                            log.status
                          )}`}
                        >
                          {getStatusLabel(log.status)}
                        </span>
                        {log.tasks_created > 0 && (
                          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                            {log.tasks_created} {log.tasks_created === 1 ? "task criada" : "tasks criadas"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                      <div>{new Date(log.created_at).toLocaleDateString("pt-BR")}</div>
                      <div>{new Date(log.created_at).toLocaleTimeString("pt-BR")}</div>
                    </div>
                  </div>

                  {log.error_message && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-400">
                      <strong>Erro:</strong> {log.error_message}
                    </div>
                  )}

                  {log.execution_time_ms !== undefined && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Tempo de execução: {log.execution_time_ms}ms
                    </div>
                  )}

                  {log.trigger_context && (
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                        Ver contexto
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.trigger_context, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
