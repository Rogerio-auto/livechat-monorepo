import { useState, useCallback, useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  actionUrl?: string; // Link opcional para redirecionamento
};

let toastIdCounter = 0;

let toastListeners: Array<(toast: Toast) => void> = [];

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      
      // Auto-remove após 5 segundos para notificações mais longas
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    };

    toastListeners.push(listener);

    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, removeToast };
}

// Função global para disparar toast de qualquer lugar
export function showToast(message: string, type: ToastType = 'info', actionUrl?: string, title?: string) {
  const toastObj: Toast = {
    id: `toast-${++toastIdCounter}`,
    title,
    message,
    type,
    actionUrl
  };
  
  toastListeners.forEach((listener) => listener(toastObj));
}

// Helpers
export const toast = {
  success: (message: string, actionUrl?: string, title?: string) => showToast(message, 'success', actionUrl, title),
  error: (message: string, actionUrl?: string, title?: string) => showToast(message, 'error', actionUrl, title),
  info: (message: string, actionUrl?: string, title?: string) => showToast(message, 'info', actionUrl, title),
  warning: (message: string, actionUrl?: string, title?: string) => showToast(message, 'warning', actionUrl, title),
};
