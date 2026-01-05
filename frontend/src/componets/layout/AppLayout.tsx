import { useEffect, useState, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../Sidbars/sidebar";
import { TopBar } from "./TopBar";
import { useUserProfile } from "../../hooks/useUserProfile";
import { io, Socket } from "socket.io-client";
import { FloatingNotificationBell } from "../../components/notifications/FloatingNotificationBell";
import { cleanupService } from "../../services/cleanupService";

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { profile } = useUserProfile(); // Hook para pegar dados do usuário (incluindo company_id)
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Cron a cada 15 minutos para validar sessão
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Usar o mesmo endpoint de validação do RequireAuth
        const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
        const headers = devCompany && import.meta.env.DEV ? { 'X-Company-Id': devCompany } : undefined;
        const res = await fetch(`${API}/auth/me`, { credentials: 'include', headers });
        
        if (res.status === 401) {
          console.warn("[AppLayout] 🔒 Sessão expirada (401), desconectando usuário...");
          await cleanupService.cleanup();
          window.location.href = "/login";
        }
      } catch (err) {
        console.error("[AppLayout] ❌ Erro ao validar sessão:", err);
      }
    };

    // Executa a cada 15 minutos (15 * 60 * 1000 ms)
    const interval = setInterval(checkSession, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Solicitar permissão de notificação ao carregar o layout
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Conexão Socket Global (Static)
  useEffect(() => {
    // Só conecta se tivermos o perfil carregado (para saber o company_id)
    if (!profile?.id) return;

    // Evitar conectar se já estiver conectado
    if (socketRef.current?.connected) return;

    const socket = io(API, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Forçar entrada na sala da empresa para receber eventos globais
      if ((profile as any).company_id) {
        socket.emit("join", { companyId: (profile as any).company_id });
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [profile?.id]); // Depende apenas do ID do perfil

  // Listeners Globais (Dynamic)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onChatUpdated = (data: any) => {
      // Lógica de Notificação:
      // 1. Usuário NÃO está visualizando ESTE CHAT específico
      // 2. Evento indica nova mensagem de cliente
      
      const isOnLiveChat = location.pathname.startsWith("/livechat");
      const urlParams = new URLSearchParams(location.search);
      const currentChatId = urlParams.get("chatId") || urlParams.get("chat");
      const isViewingThisChat = isOnLiveChat && currentChatId === data.chatId;
      
      // Se usuário está visualizando exatamente este chat, não notificar
      if (isViewingThisChat) {
        return;
      }

      // Verifica se é uma atualização relevante (nova mensagem de cliente)
      // Usa last_message_from ao invés de is_from_me (que não existe no payload)
      if (data && data.last_message && data.last_message_from === "CUSTOMER") {
         // Tocar som
         try {
           const audio = new Audio(`${import.meta.env.BASE_URL || '/'}sounds/notification-message.mp3`);
           // Tenta tocar (pode falhar se não houve interação do usuário ainda)
           audio.play().catch(() => {}); 
         } catch (e) {}

         // Mostrar notificação nativa do navegador
         if ("Notification" in window && Notification.permission === "granted") {
            const cleanMessage = (data.last_message || "")
              .replace(/\?\?\s*audio/gi, "🎤 Áudio")
              .replace(/\?\?\s*Documento/gi, "📄 Documento")
              .replace(/\?\?\s*Imagem/gi, "📷 Imagem")
              .replace(/\?\?\s*Vídeo/gi, "🎥 Vídeo")
              .replace(/\?\?\s*Sticker/gi, "🎨 Sticker")
              .replace(/\[AUDIO\]/gi, "🎤 Áudio")
              .replace(/\[IMAGE\]/gi, "📷 Imagem")
              .replace(/\[VIDEO\]/gi, "🎥 Vídeo")
              .replace(/\[DOCUMENT\]/gi, "📄 Documento")
              .replace(/\[STICKER\]/gi, "🎨 Sticker");

            const notif = new Notification("Nova mensagem", {
              body: `${data.customer_name || 'Cliente'}: ${cleanMessage}`,
              icon: "/icon.png",
              tag: `chat-${data.chatId}` // Evita spam de notificações para o mesmo chat
            });
            
            notif.onclick = () => {
              window.focus();
              // Navegar para o chat quando clicar na notificação
              window.location.href = `/livechat/${data.chatId}`;
              notif.close();
            };
         } else if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
         }
      }
    };

    socket.on("chat:updated", onChatUpdated);

    return () => {
      socket.off("chat:updated", onChatUpdated);
    };
  }, [location.pathname, location.search]); // Re-attach listener when location changes

  const isLiveChat = location.pathname.startsWith("/livechat");
  const isDashboard = location.pathname === "/dashboard";
  const isProjects = location.pathname.startsWith("/projects");
  const isCalendar = location.pathname.startsWith("/calendario");
  const isFunil = location.pathname.startsWith("/funil");
  const isFullWidthPage = isLiveChat || isDashboard || isProjects || isCalendar || isFunil;

  return (
    <div className="h-screen flex overflow-hidden bg-(--color-bg) text-(--color-text)">
      <Sidebar mobileOpen={mobileOpen} onRequestClose={() => setMobileOpen(false)} className="peer" />
      
      <div className="flex-1 flex flex-col min-w-0 relative md:pl-16 overflow-hidden">
        <main className={`flex-1 overflow-y-auto custom-scrollbar ${!isFullWidthPage ? "py-6" : ""}`}>
          {isFullWidthPage ? (
            <Outlet context={{ setMobileOpen }} />
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <Outlet context={{ setMobileOpen }} />
            </div>
          )}
        </main>
        <FloatingNotificationBell className="left-20 peer-hover:left-76" />
      </div>
    </div>
  );
}
