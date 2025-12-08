import { FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { Alert } from "../../types/dashboard";

interface AlertsPanelProps {
  alerts: Alert[];
  loading?: boolean;
  onDismiss?: (alertId: string) => void;
}

export function AlertsPanel({ alerts, loading = false, onDismiss }: AlertsPanelProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-[var(--color-surface-muted)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FiInfo className="w-12 h-12 text-[var(--color-text-muted)] mb-3" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Nenhum alerta no momento
        </p>
      </div>
    );
  }

  const getIcon = (type: Alert["type"]) => {
    switch (type) {
      case "error":
        return <FiAlertCircle className="w-5 h-5" />;
      case "warning":
        return <FiAlertTriangle className="w-5 h-5" />;
      default:
        return <FiInfo className="w-5 h-5" />;
    }
  };

  const getColor = (type: Alert["type"]) => {
    switch (type) {
      case "error":
        return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      case "warning":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
      default:
        return "text-[#1f8b49] dark:text-[#74e69e] bg-[rgba(47,180,99,0.12)] dark:bg-[rgba(27,58,41,0.6)] border-[rgba(47,180,99,0.28)] dark:border-[rgba(116,230,158,0.18)]";
    }
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`relative flex items-start gap-3 rounded-lg border p-3 transition-all ${getColor(
            alert.type
          )}`}
        >
          <div className="mt-0.5">{getIcon(alert.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">{alert.title}</h4>
              {alert.count !== undefined && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-current/10">
                  {alert.count}
                </span>
              )}
            </div>
            <p className="text-xs mt-1 opacity-90">{alert.description}</p>
            {alert.link && (
              <button
                onClick={() => navigate(alert.link!)}
                className="text-xs font-medium mt-2 underline hover:no-underline"
              >
                Ver detalhes →
              </button>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={() => onDismiss(alert.id)}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              aria-label="Dismiss alert"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
