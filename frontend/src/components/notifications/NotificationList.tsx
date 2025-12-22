import React, { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/fetch';
import { Notification } from '@/types/notifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

interface NotificationListProps {
  onClose: () => void;
  onMarkRead: () => void;
}

export function NotificationList({ onClose, onMarkRead }: NotificationListProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await fetchJson<{ notifications: Notification[] }>(`${API}/notifications`);
      setNotifications(data.notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetchJson(`${API}/notifications/read-all`, { method: 'PUT' });
      onMarkRead();
      fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleViewAll = () => {
    onClose();
    navigate('/notifications');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[500px]">
      <div className="flex items-center justify-between p-4 border-b">
        <h4 className="font-semibold">Notificações</h4>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs h-8"
          onClick={handleMarkAllRead}
          disabled={!notifications?.some(n => !n.is_read)}
        >
          <CheckCheck className="h-3 w-3 mr-1" />
          Marcar todas como lidas
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {notifications?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications?.map((notification) => (
              <NotificationItem 
                key={notification.id} 
                notification={notification} 
                onClose={onClose}
                onRead={() => {
                  onMarkRead();
                  fetchNotifications();
                }}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-2 border-t bg-muted/50">
        <Button 
          variant="ghost" 
          className="w-full text-xs h-8"
          onClick={handleViewAll}
        >
          Ver todas as notificações
        </Button>
      </div>
    </div>
  );
}
