import { useState, useEffect, useRef } from "react";
import { FaWhatsapp, FaSpinner, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";

interface Props {
  onConnected: (sessionId: string, phoneNumber?: string) => void;
}

export function WahaStep({ onConnected }: Props) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "qr" | "connected" | "error">("loading");
  const statusRef = useRef<string>("loading");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar ref com o estado
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

  const fetchQrCode = async (sid: string) => {
    if (!isMountedRef.current) return;
    try {
      const res = await fetch(`${API}/waha/sessions/${encodeURIComponent(sid)}/auth/qr?format=image`, {
        credentials: "include"
      });
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        if (data?.ok && data?.result) {
          let qrBase64 = null;
          if (typeof data.result === "string" && data.result.startsWith("data:")) {
            qrBase64 = data.result;
          } else if (data.result?.base64) {
            qrBase64 = data.result.base64;
          } else if (data.result?.data && data.result?.mimetype) {
            qrBase64 = `data:${data.result.mimetype};base64,${data.result.data}`;
          }
          
          if (qrBase64 && isMountedRef.current) {
            setQrCode(qrBase64);
            setStatus("qr");
          }
        }
      }
    } catch (err) {
      console.error("Error fetching QR Code", err);
    }
  };

  const checkStatus = async (sid: string) => {
    if (!isMountedRef.current) return;
    try {
      const res = await fetch(`${API}/waha/sessions/${encodeURIComponent(sid)}`, {
        credentials: "include"
      });
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        const wahaStatus = data?.result?.status;
        
        if (["WORKING", "CONNECTED", "READY", "OPEN", "RUNNING"].includes(wahaStatus)) {
          if (statusRef.current !== "connected" && isMountedRef.current) {
            setStatus("connected");
            
            // Tentar buscar o número de telefone (me)
            let phone = undefined;
            try {
              const meRes = await fetch(`${API}/waha/sessions/${encodeURIComponent(sid)}/me`, {
                credentials: "include"
              });
              if (meRes.ok) {
                const meData = await meRes.json();
                phone = meData?.result?.id?.split("@")[0];
              }
            } catch (err) {
              console.error("Error fetching me info", err);
            }

            onConnected(sid, phone);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        } else if (wahaStatus === "SCAN_QR_CODE" || wahaStatus === "INITIALIZING") {
          if (statusRef.current !== "qr" && isMountedRef.current) {
            fetchQrCode(sid);
          }
        }
      }
    } catch (err) {
      console.error("Error checking status", err);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    const initSession = async () => {
      try {
        // Gerar um ID de sessão único para o onboarding
        const random = Math.random().toString(36).slice(2, 10).toUpperCase();
        const sid = `ONBOARDING_${random}`;
        if (!isMountedRef.current) return;
        setSessionId(sid);

        const res = await fetch(`${API}/waha/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: sid, start: true })
        });

        if (!res.ok) throw new Error("Falha ao iniciar sessão WhatsApp");
        
        if (!isMountedRef.current) return;

        // Iniciar polling de status
        intervalRef.current = setInterval(() => {
          if (!isMountedRef.current || statusRef.current === "connected") {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
          }
          checkStatus(sid);
        }, 5000);
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err.message);
          setStatus("error");
        }
      }
    };

    initSession();
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-10 text-center">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">Conecte seu WhatsApp</h2>
        <p className="text-slate-500">Escaneie o QR Code abaixo para começar a receber mensagens.</p>
      </div>
      
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="aspect-square w-full rounded-2xl bg-slate-50 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
          {status === "loading" && (
            <>
              <FaSpinner className="mb-4 animate-spin text-[#2fb463]" size={40} />
              <p className="text-xs text-slate-400 font-medium">Iniciando sessão...</p>
            </>
          )}

          {status === "qr" && qrCode && (
            <img src={qrCode} alt="WhatsApp QR Code" className="h-full w-full object-contain p-4" />
          )}

          {status === "connected" && (
            <div className="text-center p-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <FaCheckCircle size={32} />
              </div>
              <p className="font-bold text-slate-900">WhatsApp Conectado!</p>
              <p className="text-xs text-slate-500 mt-1">Tudo pronto para o próximo passo.</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center p-6">
              <FaExclamationTriangle className="mx-auto mb-4 text-red-500" size={40} />
              <p className="text-sm font-medium text-red-600">{error || "Erro ao carregar QR Code"}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 text-xs font-bold text-[#2fb463] uppercase"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
        
        {status === "qr" && (
          <div className="mt-8 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold">1</div>
              <p className="text-xs text-slate-600">Abra o WhatsApp no seu celular</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold">2</div>
              <p className="text-xs text-slate-600">Toque em Aparelhos Conectados e Conectar um Aparelho</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold">3</div>
              <p className="text-xs text-slate-600">Aponte a câmera para esta tela</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
