import React from 'react';
import { Notification } from '@/types/notifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Flag,
  Info
} from 'lucide-react';
import { fetchJson } from '../../lib/fetch';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
  onRead?: () => void;
}

export function NotificationItem({ notification, onClose, onRead }: NotificationItemProps) {
  const navigate = useNavigate();

  const handleClick = async () => {
    if (!notification.is_read) {
      try {
        await fetchJson(`${API}/notifications/${notification.id}/read`, { method: 'PUT' });
        onRead?.();
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    }
    if (notification.link) {
      navigate(notification.link);
      onClose?.();
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'project_deadline':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'task_assigned':
        return <Flag className="h-4 w-4 text-blue-500" />;
      case 'task_completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'mention':
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case 'system_alert':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div 
      className={cn(
        "flex gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors",
        !notification.is_read && "bg-blue-50/50 dark:bg-blue-950/10"
      )}
      onClick={handleClick}
    >
      <div className="mt-1 shrink-0">
        {getIcon()}
      </div>
      <div className="flex-1 space-y-1">
        <p className={cn("text-sm font-medium leading-none", !notification.is_read && "font-semibold")}>
          {notification.title}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), { 
            addSuffix: true,
            locale: ptBR 
          })}
        </p>
      </div>
      {!notification.is_read && (
        <div className="shrink-0 self-center">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
      )}
    </div>
  );
}
