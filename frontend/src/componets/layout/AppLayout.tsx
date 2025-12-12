import { useEffect, useState, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../Sidbars/sidebar";
import { TopBar } from "./TopBar";
import { useUserProfile } from "../../hooks/useUserProfile";
import { io, Socket } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { profile } = useUserProfile(); // Hook para pegar dados do usuário (incluindo company_id)
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Solicitar permissão de notificação ao carregar o layout
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Conexão Socket Global para Notificações
  useEffect(() => {
    // Só conecta se tivermos o perfil carregado (para saber o company_id)
    // Se o profile ainda for null, aguarda.
    if (!profile?.id) return;

    // Evitar conectar se já estiver conectado
    if (socketRef.current?.connected) return;

    const socket = io(API, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[AppLayout] Global Socket connected");
      // Forçar entrada na sala da empresa para receber eventos globais
      // Assumindo que o profile tem company_id (ou que o backend infere pelo user_id)
      if ((profile as any).company_id) {
        socket.emit("join", { companyId: (profile as any).company_id });
      }
    });

    socket.on("chat:updated", (data: any) => {
      // Lógica de Notificação:
      // 1. Usuário NÃO está na página de livechat
      // 2. Evento indica nova mensagem (unread_count > 0 ou last_message presente)
      
      const isOnLiveChat = location.pathname.startsWith("/livechat");
      
      // Se estiver no livechat, deixamos a própria página lidar (ou ignoramos)
      if (isOnLiveChat) return;

      // Verifica se é uma atualização relevante (nova mensagem)
      // Geralmente 'chat:updated' vem com last_message quando há nova msg
      if (data && data.last_message && !data.is_from_me) {
         // Tocar som
         try {
           const audio = new Audio("/sounds/notification-message.mp3");
           // Tenta tocar (pode falhar se não houve interação do usuário ainda)
           audio.play().catch(() => {}); 
         } catch (e) {}

         // Mostrar notificação nativa do navegador
         if ("Notification" in window && Notification.permission === "granted") {
            const notif = new Notification("Nova mensagem", {
              body: `${data.customer_name || 'Cliente'}: ${data.last_message}`,
              icon: "/icon.png", // Ajuste o caminho do ícone se necessário
              tag: `chat-${data.id}` // Evita spam de notificações para o mesmo chat
            });
            
            notif.onclick = () => {
              window.focus();
              // Opcional: navegar para o chat
              // window.location.href = `/livechat?chatId=${data.id}`;
              notif.close();
            };
         }
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [profile, location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <Sidebar mobileOpen={mobileOpen} onRequestClose={() => setMobileOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-[var(--sidebar-expanded-width,18rem)]">
        <TopBar onMenuClick={() => setMobileOpen(true)} />

        <main className="app-shell flex-1 py-6">
          <div className="app-shell__inner space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
