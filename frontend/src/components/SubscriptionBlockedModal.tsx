import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Clock, CreditCard, XCircle, Zap } from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';

type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'canceled' | 'past_due';

interface BlockedModalProps {
  show?: boolean;
  onClose?: () => void;
}

export const SubscriptionBlockedModal: React.FC<BlockedModalProps> = ({ 
  show: forcedShow, 
  onClose 
}) => {
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Nunca mostrar o modal na página de subscription
    if (location.pathname.startsWith('/subscription')) {
      setShow(false);
      return;
    }

    if (forcedShow !== undefined) {
      setShow(forcedShow);
      return;
    }

    // Auto-mostrar se a assinatura estiver inativa
    if (subscription && !dismissed) {
      const shouldShow = ['expired', 'canceled', 'past_due'].includes(subscription.status);
      setShow(shouldShow);
    }
  }, [subscription, forcedShow, dismissed, location.pathname]);

  if (!show || !subscription) return null;

  const handleClose = () => {
    setShow(false);
    setDismissed(true);
    onClose?.();
  };

  const handleUpgrade = () => {
    navigate('/subscription');
  };

  const getModalContent = () => {
    const status = subscription.status as SubscriptionStatus;

    switch (status) {
      case 'expired':
        return {
          icon: Clock,
          iconColor: 'text-amber-500',
          bgColor: 'bg-amber-50 dark:bg-amber-900/20',
          title: 'Período de Trial Expirado',
          message: 'Seu período de avaliação gratuita terminou. Para continuar usando a plataforma, escolha um plano que atenda suas necessidades.',
          buttonText: 'Ver Planos',
          canDismiss: false,
        };
      
      case 'past_due':
        return {
          icon: CreditCard,
          iconColor: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          title: 'Pagamento Pendente',
          message: 'Seu pagamento está em atraso. Por favor, atualize sua forma de pagamento para continuar usando a plataforma sem interrupções.',
          buttonText: 'Atualizar Pagamento',
          canDismiss: false,
        };
      
      case 'canceled':
        return {
          icon: XCircle,
          iconColor: 'text-gray-500',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          title: 'Assinatura Cancelada',
          message: 'Sua assinatura foi cancelada. Você pode reativar a qualquer momento escolhendo um de nossos planos.',
          buttonText: 'Reativar Assinatura',
          canDismiss: false,
        };
      
      default:
        return {
          icon: AlertCircle,
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          title: 'Ação Necessária',
          message: 'Há um problema com sua assinatura. Por favor, verifique os detalhes da sua conta.',
          buttonText: 'Ver Detalhes',
          canDismiss: true,
        };
    }
  };

  const content = getModalContent();
  const Icon = content.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={content.canDismiss ? handleClose : undefined}
        />
        
        {/* Modal */}
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-2xl transition-all border border-gray-200 dark:border-gray-700">
          {/* Icon */}
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${content.bgColor} mb-6`}>
            <Icon className={`h-8 w-8 ${content.iconColor}`} />
          </div>

          {/* Content */}
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {content.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              {content.message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleUpgrade}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            >
              <Zap className="w-5 h-5" />
              {content.buttonText}
            </button>
            
            {content.canDismiss && (
              <button
                onClick={handleClose}
                className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                Fechar
              </button>
            )}
          </div>

          {/* Info adicional */}
          <p className="mt-6 text-xs text-center text-gray-500 dark:text-gray-400">
            Precisa de ajuda? Entre em contato com nosso suporte
          </p>
        </div>
      </div>
    </div>
  );
};

// Componente de banner de aviso (menos intrusivo)
export const SubscriptionWarningBanner: React.FC = () => {
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Não mostrar na página de subscription
  if (location.pathname.startsWith('/subscription')) return null;
  
  if (dismissed || !subscription || subscription.status !== 'trial') return null;

  const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  if (!trialEnd) return null;

  const now = new Date();
  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Mostrar apenas nos últimos 3 dias
  if (daysRemaining > 3 || daysRemaining < 0) return null;

  return (
    <div className="bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-700">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {daysRemaining === 1 
                  ? 'Seu trial termina amanhã!' 
                  : `Seu trial termina em ${daysRemaining} dias`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Escolha um plano para continuar com todos os recursos
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/subscription')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              Ver Planos
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-2 hover:bg-amber-100 dark:hover:bg-amber-800 rounded-lg transition-colors"
              aria-label="Dispensar"
            >
              <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
