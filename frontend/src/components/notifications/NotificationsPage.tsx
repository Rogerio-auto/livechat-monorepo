import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../../lib/fetch";
import type { Notification } from "@livechat/shared";
import { Button } from "../ui";

const API = import.meta.env.VITE_API_URL;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filter, typeFilter, notifications]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ notifications: Notification[]; total: number }>(
        `${API}/api/notifications?limit=100`
      );
      setNotifications(data.notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...notifications];

    // Filtro por status
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.read_at);
    } else if (filter === 'read') {
      filtered = filtered.filter(n => n.read_at);
    }

    // Filtro por tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter(n => n.type.startsWith(typeFilter));
    }

    setFilteredNotifications(filtered);
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Marcar como lida
    if (!notification.read_at) {
      try {
        await fetchJson(`${API}/notifications/${notification.id}/read`, {
          method: "PUT",
        });
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? { ...n, read_at: new Date().toISOString(), is_read: true }
              : n
          )
        );
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    }

    // Navegar
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetchJson(`${API}/notifications/read-all`, {
        method: "PUT",
      });
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: new Date().toISOString(), is_read: true }))
      );
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!confirm('Deseja excluir esta notificação?')) return;

    try {
      await fetchJson(`${API}/notifications/${notificationId}`, {
        method: "DELETE",
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🔔 Notificações
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Todas as notificações estão lidas'}
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Status Filter */}
            <div className="flex gap-2">
              <FilterButton
                active={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                Todas ({notifications.length})
              </FilterButton>
              <FilterButton
                active={filter === 'unread'}
                onClick={() => setFilter('unread')}
              >
                Não Lidas ({unreadCount})
              </FilterButton>
              <FilterButton
                active={filter === 'read'}
                onClick={() => setFilter('read')}
              >
                Lidas ({notifications.length - unreadCount})
              </FilterButton>
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">Todos os tipos</option>
              <option value="project">Projetos</option>
              <option value="task">Tarefas</option>
              <option value="mention">Menções</option>
            </select>

            {/* Actions */}
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button onClick={handleMarkAllRead} variant="ghost" size="sm">
                  Marcar Todas como Lidas
                </Button>
              )}
              <Button onClick={() => navigate('/notifications/preferences')} variant="ghost" size="sm">
                ⚙️ Preferências
              </Button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Nenhuma notificação
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === 'unread'
                  ? 'Você está em dia! Não há notificações não lidas.'
                  : 'Nenhuma notificação encontrada com os filtros aplicados.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                onDelete={() => handleDelete(notification.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== FILTER BUTTON ====================

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

// ==================== NOTIFICATION CARD ====================

function NotificationCard({
  notification,
  onClick,
  onDelete,
}: {
  notification: Notification;
  onClick: () => void;
  onDelete: () => void;
}) {
  const isUnread = !notification.read_at;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl p-5 border-2 transition-all hover:shadow-lg ${
        isUnread
          ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="text-4xl shrink-0">
          {getEmojiForType(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3
              className={`font-semibold text-lg ${
                isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {notification.title}
            </h3>
            {isUnread && (
              <span className="ml-2 w-3 h-3 bg-indigo-600 rounded-full shrink-0"></span>
            )}
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
            {notification.message}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{formatDateTime(notification.created_at)}</span>
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs">
                {formatNotificationType(notification.type)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {notification.link && (
                <button
                  onClick={onClick}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Ver Detalhes →
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Excluir"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== HELPERS ====================

function getEmojiForType(type: string): string {
  const emojiMap: Record<string, string> = {
    project_created: '🎉',
    project_assigned: '👤',
    project_deadline: '⚠️',
    project_overdue: '🚨',
    project_completed: '✅',
    task_assigned: '📝',
    task_completed: '✅',
    mention: '💬',
    system_alert: '🔔',
  };
  return emojiMap[type] || '🔔';
}

function formatNotificationType(type: string): string {
  const labels: Record<string, string> = {
    project_created: 'Projeto Criado',
    project_assigned: 'Projeto Atribuído',
    project_deadline: 'Prazo do Projeto',
    project_overdue: 'Projeto Atrasado',
    project_completed: 'Projeto Concluído',
    task_assigned: 'Tarefa Atribuída',
    task_completed: 'Tarefa Concluída',
    mention: 'Menção',
    system_alert: 'Alerta do Sistema',
  };
  return labels[type] || type;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `Há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
