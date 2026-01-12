import React from 'react';
import { FiAlertTriangle, FiArrowUpCircle, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

interface LimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  resource?: string;
  limit?: number;
  current?: number;
}

export const LimitModal: React.FC<LimitModalProps> = ({
  isOpen,
  onClose,
  title = "Limite Atingido",
  message,
  resource,
  limit,
  current
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FiAlertTriangle size={24} />
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>

          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {title}
          </h3>
          
          <div className="text-gray-600 dark:text-gray-300 mb-6">
            {message || (
              <>
                Você atingiu o limite de <strong>{resource}</strong> permitido no seu plano atual
                {limit && (
                  <span> ({current || limit}/{limit})</span>
                )}.
              </>
            )}
            <p className="mt-2">
              Faça o upgrade para continuar utilizando todos os recursos sem interrupções.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                onClose();
                navigate('/configuracoes/assinatura');
              }}
              className="w-full py-3 px-4 bg-primary text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <FiArrowUpCircle size={18} />
              Ver Planos e Upgrade
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 px-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
