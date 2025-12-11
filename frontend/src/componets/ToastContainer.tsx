import { useToast, type Toast } from '../hooks/useToast';

const toastStyles: Record<Toast['type'], string> = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-blue-500 text-white',
  warning: 'bg-yellow-500 text-black',
};

const toastIcons: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            ${toastStyles[toast.type]}
            px-4 py-3 rounded-lg shadow-lg
            flex items-center gap-3
            min-w-[300px] max-w-[500px]
            animate-[slideIn_0.3s_ease-out]
          `}
        >
          <span className="text-xl font-bold">{toastIcons[toast.type]}</span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-xl leading-none hover:opacity-70"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
