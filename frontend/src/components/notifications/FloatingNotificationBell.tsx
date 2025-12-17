import { useState, useEffect } from "react";
import { NotificationBell } from "./NotificationBell";
import { useNotifications } from "../../hooks/useNotifications";

interface FloatingNotificationBellProps {
  className?: string;
}

export function FloatingNotificationBell({ className = "" }: FloatingNotificationBellProps) {
  const { unreadCount } = useNotifications();
  const [showForNotification, setShowForNotification] = useState(false);

  useEffect(() => {
    if (unreadCount > 0) {
      setShowForNotification(true);
      const timer = setTimeout(() => {
        setShowForNotification(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  return (
    <div 
      className={`fixed bottom-4 z-50 transition-all duration-300 
        ${showForNotification ? 'opacity-100' : 'opacity-40 hover:opacity-100'} 
        bg-white dark:bg-gray-800 rounded-full shadow-lg p-1 border border-gray-200 dark:border-gray-700
        ${className}`}
    >
      <NotificationBell placement="top" />
    </div>
  );
}
