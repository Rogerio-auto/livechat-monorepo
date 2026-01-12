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
          onClick={() => {
            if (toast.actionUrl) {
              window.location.href = toast.actionUrl;
            }
          }}
          className={`
            ${toastStyles[toast.type]}
            px-4 py-3 rounded-lg shadow-xl
            flex items-start gap-3
            min-w-[320px] max-w-[450px]
            animate-[slideIn_0.3s_ease-out]
            border border-white/20
            ${toast.actionUrl ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''}
            transition-all duration-200
          `}
        >
          <span className="text-xl font-bold mt-0.5">{toastIcons[toast.type]}</span>
          <div className="flex flex-col gap-0.5 flex-1">
            {toast.title && <span className="font-bold text-sm uppercase tracking-wider">{toast.title}</span>}
            <span className="text-sm opacity-95 leading-relaxed">{toast.message}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeToast(toast.id);
            }}
            className="text-xl leading-none hover:bg-black/10 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
