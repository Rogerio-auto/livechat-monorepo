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
      console.log("[AppLayout] 🔌 Global Socket connected", { socketId: socket.id });
      // Forçar entrada na sala da empresa para receber eventos globais
      // Assumindo que o profile tem company_id (ou que o backend infere pelo user_id)
      if ((profile as any).company_id) {
        socket.emit("join", { companyId: (profile as any).company_id });
        
        // Confirmar join após um delay
        setTimeout(() => {
          console.log("[AppLayout] ✅ Socket rooms check:", {
            companyId: (profile as any).company_id,
            socketId: socket.id,
          });
        }, 500);
      }
    });

    socket.on("chat:updated", (data: any) => {
      console.log("[AppLayout] 🔔 chat:updated received:", {
        chatId: data.chatId,
        last_message: data.last_message?.substring(0, 30),
        last_message_from: data.last_message_from,
        customer_name: data.customer_name,
        currentPath: location.pathname,
        currentSearch: location.search,
      });
      
      // Lógica de Notificação:
      // 1. Usuário NÃO está visualizando ESTE CHAT específico
      // 2. Evento indica nova mensagem de cliente
      
      const isOnLiveChat = location.pathname.startsWith("/livechat");
      const urlParams = new URLSearchParams(location.search);
      const currentChatId = urlParams.get("chatId") || urlParams.get("chat");
      const isViewingThisChat = isOnLiveChat && currentChatId === data.chatId;
      
      // Se usuário está visualizando exatamente este chat, não notificar
      if (isViewingThisChat) {
        console.log("[AppLayout] ⏭️  Skipping notification: user is viewing this chat");
        return;
      }

      // Verifica se é uma atualização relevante (nova mensagem de cliente)
      // Usa last_message_from ao invés de is_from_me (que não existe no payload)
      if (data && data.last_message && data.last_message_from === "CUSTOMER") {
         console.log("[AppLayout] 📢 Showing notification for chat:", data.chatId);
         
         // Tocar som
         try {
           const audio = new Audio(`${import.meta.env.BASE_URL || '/'}sounds/notification-message.mp3`);
           // Tenta tocar (pode falhar se não houve interação do usuário ainda)
           audio.play().catch((err) => {
             console.warn("[AppLayout] ⚠️  Audio play failed:", err);
           }); 
         } catch (e) {
           console.warn("[AppLayout] ⚠️  Audio error:", e);
         }

         // Mostrar notificação nativa do navegador
         if ("Notification" in window && Notification.permission === "granted") {
            const notif = new Notification("Nova mensagem", {
              body: `${data.customer_name || 'Cliente'}: ${data.last_message}`,
              icon: "/icon.png",
              tag: `chat-${data.chatId}` // Evita spam de notificações para o mesmo chat
            });
            
            notif.onclick = () => {
              window.focus();
              // Navegar para o chat quando clicar na notificação
              window.location.href = `/livechat?chatId=${data.chatId}`;
              notif.close();
            };
            
            console.log("[AppLayout] ✅ Browser notification shown");
         } else if ("Notification" in window && Notification.permission === "default") {
            console.log("[AppLayout] 🔔 Requesting notification permission...");
            Notification.requestPermission();
         } else {
            console.log("[AppLayout] ⚠️  Notifications not available or denied");
         }
      } else {
        console.log("[AppLayout] ⏭️  Skipping notification: not a customer message", {
          has_message: !!data?.last_message,
          from: data?.last_message_from
        });
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
