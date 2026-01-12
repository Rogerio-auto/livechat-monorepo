import { FiCpu, FiUsers, FiArrowRight } from "react-icons/fi";

type TransferNotificationProps = {
  type: "ai-to-ai" | "ai-to-human" | "human-to-ai";
  fromAgent?: string;
  toAgent?: string;
  reason?: string;
  timestamp: Date;
};

export function TransferNotification({
  type,
  fromAgent,
  toAgent,
  reason,
  timestamp,
}: TransferNotificationProps) {
  const getIcon = () => {
    if (type === "ai-to-ai") return <FiCpu className="text-purple-600" />;
    if (type === "ai-to-human") return <FiUsers className="text-blue-600" />;
    return <FiCpu className="text-green-600" />;
  };

  const getMessage = () => {
    if (type === "ai-to-ai") {
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-purple-800 dark:text-purple-300">
            {fromAgent || "Agente IA"}
          </span>
          <FiArrowRight style={{ color: "var(--color-text-muted)" }} />
          <span className="font-medium text-purple-800 dark:text-purple-300">
            {toAgent || "Outro Agente IA"}
          </span>
        </div>
      );
    }

    if (type === "ai-to-human") {
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-blue-800 dark:text-blue-300">
            {fromAgent || "Agente IA"}
          </span>
          <FiArrowRight style={{ color: "var(--color-text-muted)" }} />
          <span className="font-medium text-blue-800 dark:text-blue-300">
            Atendimento Humano
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-green-800 dark:text-green-300">
          Atendimento Humano
        </span>
        <FiArrowRight style={{ color: "var(--color-text-muted)" }} />
        <span className="font-medium text-green-800 dark:text-green-300">
          {toAgent || "Agente IA"}
        </span>
      </div>
    );
  };

  const getBgColor = () => {
    if (type === "ai-to-ai") return "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800";
    if (type === "ai-to-human") return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
    return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
  };

  return (
    <div className="flex justify-center my-4">
      <div
        className={`max-w-md px-4 py-3 rounded-lg border ${getBgColor()} transition-colors duration-200`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{getIcon()}</div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text)" }}
              >
                Transferência de Atendimento
              </span>
            </div>
            {getMessage()}
            {reason && (
              <p
                className="text-xs mt-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {reason}
              </p>
            )}
            <p
              className="text-xs mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {timestamp.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
