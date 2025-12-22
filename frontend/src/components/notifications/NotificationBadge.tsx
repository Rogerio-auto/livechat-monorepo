import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { fetchJson } from '@/lib/fetch';
import { NotificationList } from '@/components/notifications/NotificationList';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';

const API = import.meta.env.VITE_API_URL;

export function NotificationBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const data = await fetchJson<{ count: number }>(`${API}/notifications/unread-count`);
      setUnreadCount(data.count);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative px-2">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <NotificationList 
          onClose={() => setIsOpen(false)} 
          onMarkRead={() => {
            fetchUnreadCount();
            setUnreadCount(Math.max(0, unreadCount - 1));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
