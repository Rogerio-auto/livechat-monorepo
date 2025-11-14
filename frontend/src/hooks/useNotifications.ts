import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type NotificationType = 
  | "SYSTEM"
  | "CHAT_MESSAGE"
  | "NEW_LEAD"
  | "PROPOSAL_VIEWED"
  | "PROPOSAL_ACCEPTED"
  | "PROPOSAL_REJECTED"
  | "PROPOSAL_EXPIRED"
  | "TECHNICAL_VISIT"
  | "SYSTEM_ALERT"
  | "MASS_DISPATCH"
  | "CHAT_ASSIGNED"
  | "CHAT_TRANSFERRED"
  | "CHAT_CLOSED"
  | "LEAD_CONVERTED"
  | "TASK_ASSIGNED"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "CAMPAIGN_COMPLETED"
  | "CAMPAIGN_FAILED"
  | "MENTION"
  | "TEAM_INVITE"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "USER_MESSAGE";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SoundType = "default" | "success" | "warning" | "error" | "message" | "urgent" | "silent";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  is_read: boolean;
  read_at: string | null;
  data: Record<string, any> | null;
  company_id: string;
  user_id: string;
  created_at: string;
  sound_type: SoundType;
  action_url: string | null;
  category: string;
  isNew?: boolean;
}

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

// Cache de áudio para melhor performance
const audioCache: Record<SoundType, HTMLAudioElement> = {} as any;
let audioInitialized = false;

function preloadSound(type: SoundType) {
  if (audioCache[type]) return;
  
  try {
    const audio = new Audio(`/sounds/notification-${type}.mp3`);
    audio.preload = "auto";
    audio.volume = 0.7; // Volume um pouco mais baixo
    
    // Verificar se o áudio carregou corretamente
    audio.addEventListener('canplaythrough', () => {
      console.log(`[Notifications] ✅ Som ${type} carregado com sucesso`);
    });
    
    audio.addEventListener('error', (e) => {
      console.error(`[Notifications] ❌ Erro ao carregar som ${type}:`, e);
    });
    
    audioCache[type] = audio;
  } catch (err) {
    console.error(`[Notifications] ❌ Erro ao criar áudio ${type}:`, err);
  }
}

function playSound(type: SoundType) {
  if (type === "silent") return;
  
  try {
    if (!audioCache[type]) {
      console.log(`[Notifications] Carregando som ${type}...`);
      preloadSound(type);
    }
    
    const audio = audioCache[type];
    if (!audio) {
      console.warn(`[Notifications] ⚠️ Áudio ${type} não disponível`);
      return;
    }
    
    audio.currentTime = 0;
    
    // Tentar reproduzir com tratamento de erro melhorado
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`[Notifications] 🔊 Som ${type} reproduzido com sucesso`);
        })
        .catch(err => {
          // Se falhar por permissão, avisar usuário
          if (err.name === 'NotAllowedError') {
            console.warn("[Notifications] ⚠️ Usuário precisa interagir com a página para permitir sons");
          } else {
            console.warn("[Notifications] ⚠️ Não foi possível reproduzir som:", err);
          }
        });
    }
  } catch (err) {
    console.warn("[Notifications] ❌ Erro ao reproduzir som:", err);
  }
}

// Função para inicializar áudio após interação do usuário
function initializeAudio() {
  if (audioInitialized) return;
  
  try {
    // Criar um áudio silencioso para desbloquear
    const silentAudio = new Audio();
    silentAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    silentAudio.play().then(() => {
      audioInitialized = true;
      console.log("[Notifications] 🔊 Áudio inicializado com sucesso");
    }).catch(() => {
      console.log("[Notifications] ⚠️ Aguardando interação do usuário para habilitar sons");
    });
  } catch (err) {
    console.warn("[Notifications] Erro ao inicializar áudio:", err);
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Preload dos sons mais comuns e inicializar áudio
  useEffect(() => {
    // Inicializar áudio após primeira interação
    const handleFirstInteraction = () => {
      initializeAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    
    // Preload dos sons
    ["default", "message", "success", "warning", "error", "urgent"].forEach(type => {
      preloadSound(type as SoundType);
    });
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  // Buscar notificações não lidas
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/unread`, {
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Erro ao buscar notificações");
      
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.length);
    } catch (error) {
      console.error("[useNotifications] Erro ao buscar não lidas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar todas as notificações
  const fetchAll = useCallback(async (limit = 50, offset = 0) => {
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=${limit}&offset=${offset}`, {
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Erro ao buscar notificações");
      
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("[useNotifications] Erro ao buscar todas:", error);
      return [];
    }
  }, []);

  // Marcar como lida
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Erro ao marcar como lida");
      
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      ));
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("[useNotifications] Erro ao marcar como lida:", error);
    }
  }, []);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "POST",
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Erro ao marcar todas como lidas");
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error("[useNotifications] Erro ao marcar todas como lidas:", error);
    }
  }, []);

  // Deletar notificação
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/${notificationId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Erro ao deletar notificação");
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("[useNotifications] Erro ao deletar notificação:", error);
    }
  }, []);

  // WebSocket: conectar e escutar notificações em tempo real
  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("[useNotifications] 🔌 Socket conectado");
    });

    socketInstance.on("notification", (notification: Notification) => {
      console.log("[useNotifications] 🔔 Nova notificação recebida:", notification);
      
      // Adicionar notificação à lista
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Tocar som
      playSound(notification.sound_type || "default");
      
      // Mostrar notificação do navegador (se permitido)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(notification.title, {
          body: notification.message,
          icon: "/logo.png",
          tag: notification.id,
        });
      }
    });

    socketInstance.on("disconnect", () => {
      console.log("[useNotifications] 🔌 Socket desconectado");
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Buscar notificações iniciais
  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Solicitar permissão de notificações do navegador
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.warn("[useNotifications] Notificações do navegador não suportadas");
      return false;
    }
    
    if (Notification.permission === "granted") {
      return true;
    }
    
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    
    return false;
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    fetchUnread,
    fetchAll,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPermission,
    socket,
  };
}
