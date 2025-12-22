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

  const handleUpgrade = () => {
    onClose();
    navigate('/subscription');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md max-w-md w-full overflow-hidden transform transition-all scale-100">
        {/* Header */}
        <div className="bg-linear-to-r from-amber-500 to-orange-600 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <FiX size={24} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <FiAlertTriangle size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <p className="text-white/90 text-sm">
            Seu plano atual atingiu o limite de uso.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              {message || `Você atingiu o limite de ${resource === 'messages_per_month' ? 'mensagens' : resource === 'campaigns_per_month' ? 'campanhas' : 'recursos'} do seu plano atual.`}
            </p>
            
            {limit !== undefined && current !== undefined && (
              <div className="mt-3 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <span>Uso Atual: {current}</span>
                <span>Limite: {limit}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleUpgrade}
              className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-500/20"
            >
              <FiArrowUpCircle size={20} />
              Fazer Upgrade Agora
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-3 px-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors"
            >
              Talvez depois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

