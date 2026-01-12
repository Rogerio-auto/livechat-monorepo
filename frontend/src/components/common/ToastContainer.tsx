import React from "react";
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi";
import type { Toast } from "../../hooks/useToast";

type Props = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-9999 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = toast.type === "success" 
          ? FiCheckCircle 
          : toast.type === "error" 
          ? FiAlertCircle 
          : FiInfo;

        const bgColor = toast.type === "success"
          ? "bg-green-50 dark:bg-green-900/20 border-green-500"
          : toast.type === "error"
          ? "bg-red-50 dark:bg-red-900/20 border-red-500"
          : toast.type === "warning"
          ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500"
          : "bg-blue-50 dark:bg-blue-900/20 border-blue-500";

        const iconColor = toast.type === "success"
          ? "text-green-600 dark:text-green-400"
          : toast.type === "error"
          ? "text-red-600 dark:text-red-400"
          : toast.type === "warning"
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-blue-600 dark:text-blue-400";

        return (
          <div
            key={toast.id}
            className={`${bgColor} border-l-4 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in-right`}
          >
            <Icon className={`${iconColor} w-5 h-5 shrink-0 mt-0.5`} />
            <p className="flex-1 text-sm text-(--color-heading)">{toast.message}</p>
            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 text-(--color-text-muted) hover:text-(--color-heading)"
              aria-label="Fechar notificação"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
