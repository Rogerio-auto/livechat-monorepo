import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { useNotifications, type Notification } from '../../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NOTIFICATION_ICONS: Record<string, string> = {
  chat: "💬",
  lead: "🎯",
  proposal: "📄",
  task: "✅",
  campaign: "📢",
  system: "⚙️",
  payment: "💰",
  general: "🔔",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-500",
  NORMAL: "bg-blue-500",
  HIGH: "bg-orange-500",
  URGENT: "bg-red-500",
};

interface NotificationBellProps {
  placement?: 'top' | 'bottom';
  onOpenChange?: (isOpen: boolean) => void;
}

export function NotificationBell({ placement = 'bottom', onOpenChange }: NotificationBellProps) {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPermission,
    refresh,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'chat' | 'system'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Notificar pai sobre mudança de estado
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Recarregar notificações e solicitar permissão ao abrir
  useEffect(() => {
    if (isOpen) {
      refresh();
      requestPermission();
    }
  }, [isOpen, refresh, requestPermission]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      window.location.href = notification.action_url;
    }

    setIsOpen(false);
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await markAllAsRead();
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'chat') return n.category === 'chat';
    if (activeTab === 'system') return n.category !== 'chat';
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sino */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
        title="Notificações"
      >
        <Bell size={24} />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className={`absolute left-0 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 z-9999 max-h-[600px] flex flex-col
            ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
          `}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Notificações {unreadCount > 0 && `(${unreadCount})`}
              </h3>
              
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                    title="Marcar todas como lidas"
                  >
                    <Check size={16} />
                    Marcar todas
                  </button>
                )}
                
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  activeTab === 'all'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                Mensagens
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  activeTab === 'system'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                Sistema
              </button>
            </div>
          </div>

          {/* Lista de notificações */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                Carregando...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell size={48} className="mx-auto mb-2 opacity-30" />
                <p>Nenhuma notificação {activeTab !== 'all' ? 'nesta categoria' : ''}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    onDelete={(e) => handleDelete(e, notification.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="block w-full text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-1"
            >
              Ver todas as notificações
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function NotificationItem({ notification, onClick, onDelete }: NotificationItemProps) {
  const icon = NOTIFICATION_ICONS[notification.category] || NOTIFICATION_ICONS.general;
  const priorityColor = PRIORITY_COLORS[notification.priority] || PRIORITY_COLORS.NORMAL;

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
        !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
      }`}
    >
      <div className="flex gap-3">
        {/* Ícone da categoria */}
        <div className="text-2xl shrink-0">{icon}</div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
              {notification.title}
            </h4>
            
            {/* Indicador de prioridade */}
            {notification.priority !== "NORMAL" && (
              <span className={`${priorityColor} text-white text-xs px-2 py-0.5 rounded-full shrink-0`}>
                {notification.priority}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
            {notification.message}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>

            {/* Botão deletar */}
            <button
              onClick={onDelete}
              className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
              title="Deletar notificação"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Badge "não lida" */}
          {!notification.is_read && (
            <div className="mt-2">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
