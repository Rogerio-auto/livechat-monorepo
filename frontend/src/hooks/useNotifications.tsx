import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { cleanupService } from '../services/cleanupService';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  sound_type: string;
  category: string;
  user_id: string;
  company_id: string;
  action_url?: string;
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

// Função auxiliar para obter token de autenticação
function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const socketRef = useRef<Socket | null>(null);
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Inicializar Socket.IO
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      console.warn('[useNotifications] No access token found');
      return;
    }

    const socketInstance = io(API, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('[useNotifications] Socket connected:', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      console.log('[useNotifications] Socket disconnected');
    });

    // Listener para novas notificações
    socketInstance.on('notification', (notification: Notification & { isNew?: boolean }) => {
      console.log('[useNotifications] New notification received:', notification);

      setNotifications(prev => {
        // Evitar duplicatas
        if (prev.some(n => n.id === notification.id)) {
          return prev;
        }
        return [notification, ...prev];
      });

      if (!notification.is_read) {
        setUnreadCount(prev => prev + 1);
      }

      // Reproduzir som
      if (notification.sound_type && notification.sound_type !== 'silent') {
        playSound(notification.sound_type);
      }

      // Mostrar notificação do navegador
      if (permission === 'granted' && notification.isNew !== false) {
        showBrowserNotification(notification);
      }
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [permission]);

  // Registrar socket no cleanupService para desconectar no logout
  useEffect(() => {
    if (socketRef.current) {
      cleanupService.registerSocket(socketRef.current);
    }
  }, [socketRef.current]);

  // Escutar evento de logout e limpar estados
  useEffect(() => {
    const handleLogout = () => {
      console.log('[useNotifications] 🧹 Cleaning up on logout');
      
      // Limpar estados
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      
      // Limpar cache de áudio
      audioCache.current.clear();
      
      // Desconectar socket (redundante mas seguro)
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      console.log('[useNotifications] ✅ Cleanup completed');
    };

    window.addEventListener('user:logout', handleLogout);
    
    return () => {
      window.removeEventListener('user:logout', handleLogout);
    };
  }, []);

  // Buscar notificações ao montar
  useEffect(() => {
    fetchAllNotifications();
    fetchUnreadCount();
  }, []);

  // Verificar permissão de notificações do navegador
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const fetchAllNotifications = async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API}/api/notifications?limit=50`, {
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[useNotifications] Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API}/api/notifications/unread/count`, {
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setUnreadCount(data?.count || 0);
    } catch (error) {
      console.error('[useNotifications] Error fetching count:', error);
      setUnreadCount(0);
    }
  };

  const markAsRead = useCallback(async (id: string) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API}/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[useNotifications] Error marking as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API}/api/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('[useNotifications] Error marking all as read:', error);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API}/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const wasUnread = notifications.find(n => n.id === id && !n.is_read);
      
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('[useNotifications] Error deleting notification:', error);
    }
  }, [notifications]);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        console.log('[useNotifications] Notification permission:', perm);
      } catch (error) {
        console.error('[useNotifications] Error requesting permission:', error);
      }
    }
  }, []);

  const playSound = useCallback((soundType: string) => {
    try {
      // Mapeamento de sound_type para arquivos reais
      const SOUND_MAP: Record<string, string> = {
        default: 'notification-default',
        message: 'notification-message',
        success: 'notification-success',
        warning: 'notification-warning',
        error: 'notification-error',
        urgent: 'notification-urgent',
        silent: '', // sem som
      };

      // Mapear para arquivo real
      const soundFile = SOUND_MAP[soundType] || SOUND_MAP.default;
      
      if (!soundFile) {
        console.log('[useNotifications] Silent notification (no sound)');
        return; // silent
      }

      // Usar cache de áudio para melhor performance
      let audio = audioCache.current.get(soundType);
      
      if (!audio) {
        audio = new Audio(`/sounds/${soundFile}.mp3`);
        audio.volume = 0.5;
        audioCache.current.set(soundType, audio);
      }

      // Reset para tocar novamente
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('[useNotifications] Could not play sound:', err);
      });
    } catch (error) {
      console.warn('[useNotifications] Error playing sound:', error);
    }
  }, []);

  const showBrowserNotification = useCallback((notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotif = new Notification(notification.title, {
          body: notification.message,
          icon: '/icon.png',
          tag: notification.id,
          badge: '/icon.png',
          requireInteraction: notification.priority === 'URGENT' || notification.priority === 'HIGH',
        });

        // Clicar na notificação do navegador
        browserNotif.onclick = () => {
          window.focus();
          if (notification.action_url) {
            window.location.href = notification.action_url;
          }
          browserNotif.close();
        };

        // Auto-fechar após 10 segundos (exceto URGENT)
        if (notification.priority !== 'URGENT') {
          setTimeout(() => {
            browserNotif.close();
          }, 10000);
        }
      } catch (error) {
        console.warn('[useNotifications] Error showing browser notification:', error);
      }
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPermission,
    permission,
    refresh: fetchAllNotifications,
  };
}
