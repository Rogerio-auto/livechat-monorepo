import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaWhatsapp, FaCloud, FaServer, FaCheck, FaArrowRight, FaArrowLeft } from "react-icons/fa";
import { SiMeta } from "react-icons/si";

type Provider = "META_CLOUD" | "WAHA" | null;

interface FirstInboxWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const STEPS: WizardStep[] = [
  { id: 1, title: "Escolher Provider", description: "Selecione como você quer conectar seu WhatsApp" },
  { id: 2, title: "Configurar Conexão", description: "Preencha os dados de conexão" },
  { id: 3, title: "Testar & Ativar", description: "Verificar conexão e ativar inbox" }
];

export function FirstInboxWizard({ onComplete, onSkip }: FirstInboxWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<Provider>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Estados do formulário META
  const [metaForm, setMetaForm] = useState({
    name: "WhatsApp Principal",
    phone_number: "",
    access_token: "",
    phone_number_id: "",
    waba_id: "",
    webhook_verify_token: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  });

  // Estados do formulário WAHA
  const [wahaForm, setWahaForm] = useState({
    name: "WhatsApp Principal",
    sessionId: "", // Session ID gerado após criar sessão WAHA
  });

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    console.log("[FirstInboxWizard] Componente montado");
    return () => console.log("[FirstInboxWizard] Componente desmontado");
  }, []);

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    setCurrentStep(2);
  };

  const handleBack = () => {
    if (currentStep === 2 && selectedProvider) {
      setSelectedProvider(null);
      setCurrentStep(1);
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNextFromConfig = async () => {
    if (selectedProvider === "META_CLOUD") {
      // Validação básica
      if (!metaForm.access_token || !metaForm.phone_number_id || !metaForm.waba_id) {
        setErrorMessage("Preencha todos os campos obrigatórios");
        return;
      }
      setCurrentStep(3);
    } else if (selectedProvider === "WAHA") {
      // Validação WAHA - só precisa do nome!
      if (!wahaForm.name.trim()) {
        setErrorMessage("Digite um nome para a inbox");
        return;
      }
      
      // CRIAR SESSÃO WAHA ANTES DE AVANÇAR
      setConnectionStatus("connecting");
      setErrorMessage("");
      
      try {
        const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
        
        console.log("[FirstInboxWizard] 🔄 Buscando company_id...");
        const userProfile = await fetch(`${API}/me/profile`, {
          credentials: "include"
        }).then(res => res.json());

        const companyId = userProfile.companyId || "COMPANY";
        console.log("[FirstInboxWizard] ✅ Company ID:", companyId);
        
        // Gerar session ID - usar apenas últimos 8 chars do company_id para manter limite de 54 chars
        const safeName = (wahaForm.name || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_")
          .replace(/[^A-Z0-9_]/g, "") || "WAHA";
        
        // Pegar apenas últimos 8 caracteres do company_id
        const safeCompany = (companyId || "COMPANY")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(-8) || "COMPANY";
        
        const random = Math.random().toString(36).slice(2, 8).toUpperCase();
        const sessionId = `${safeName}_${safeCompany}_${random}`;
        
        console.log("[FirstInboxWizard] 🔑 Session ID gerado:", sessionId, "| Tamanho:", sessionId.length);
        
        // Criar sessão na API WAHA
        console.log("[FirstInboxWizard] 📡 Criando sessão WAHA...");
        const sessionResponse = await fetch(`${API}/waha/sessions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: sessionId, start: true })
        });

        if (!sessionResponse.ok) {
          const error = await sessionResponse.json().catch(() => ({ error: "Erro ao criar sessão WAHA" }));
          throw new Error(error.error || "Erro ao criar sessão WAHA");
        }

        const sessionResult = await sessionResponse.json();
        console.log("[FirstInboxWizard] ✅ Sessão WAHA criada:", sessionResult);

        // Obter QR Code
        console.log("[FirstInboxWizard] 📷 Obtendo QR Code...");
        const qrResponse = await fetch(
          `${API}/waha/sessions/${encodeURIComponent(sessionId)}/auth/qr?format=image`,
          { credentials: "include" }
        );

        if (qrResponse.ok) {
          const qrData = await qrResponse.json();
          console.log("[FirstInboxWizard] ✅ QR Code obtido");
          
          if (qrData?.ok && qrData?.result) {
            // Extrair base64 do resultado
            let qrBase64 = null;
            if (typeof qrData.result === "string" && qrData.result.startsWith("data:")) {
              qrBase64 = qrData.result;
            } else if (qrData.result?.base64) {
              qrBase64 = qrData.result.base64;
            } else if (qrData.result?.data && qrData.result?.mimetype) {
              qrBase64 = `data:${qrData.result.mimetype};base64,${qrData.result.data}`;
            }
            
            if (qrBase64) {
              setQrCode(qrBase64);
              console.log("[FirstInboxWizard] ✅ QR Code pronto para exibição");
            } else {
              console.warn("[FirstInboxWizard] ⚠️ QR Code em formato inesperado:", qrData.result);
            }
          }
        } else {
          console.warn("[FirstInboxWizard] ⚠️ Não foi possível obter QR Code");
        }

        // Salvar sessionId no estado para usar no Step 3
        setWahaForm(prev => ({ ...prev, sessionId }));
        
        setConnectionStatus("idle");
        setCurrentStep(3);
        
      } catch (error: any) {
        console.error("[FirstInboxWizard] ❌ Erro ao criar sessão WAHA:", error);
        setConnectionStatus("error");
        setErrorMessage(error.message || "Erro ao criar sessão WAHA");
      }
    }
  };

  const handleCreateInbox = async () => {
    setIsCreating(true);
    setConnectionStatus("connecting");
    setErrorMessage("");

    try {
      const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
      
      console.log("[FirstInboxWizard] 💾 Iniciando criação da inbox no banco de dados...");
      
      let payload: any = {
        channel: "WHATSAPP",
        is_active: true,
      };

      if (selectedProvider === "META_CLOUD") {
        console.log("[FirstInboxWizard] 📋 Preparando payload META_CLOUD");
        payload = {
          ...payload,
          name: metaForm.name,
          phone_number: metaForm.phone_number,
          provider: "META_CLOUD",
          phone_number_id: metaForm.phone_number_id,
          webhook_url: `${API}/integrations/meta/webhook`,
          provider_config: {
            meta: {
              access_token: metaForm.access_token,
              phone_number_id: metaForm.phone_number_id,
              waba_id: metaForm.waba_id,
              webhook_verify_token: metaForm.webhook_verify_token,
              provider_api_key: metaForm.access_token,
              refresh_token: ""
            }
          }
        };
      } else if (selectedProvider === "WAHA") {
        console.log("[FirstInboxWizard] 📋 Preparando payload WAHA");
        
        // Usar o sessionId que já foi criado no Step 2
        const sessionId = wahaForm.sessionId;
        
        if (!sessionId) {
          throw new Error("Session ID não encontrado. A sessão WAHA não foi criada corretamente.");
        }

        console.log("[FirstInboxWizard] 🔑 Usando Session ID:", sessionId);

        payload = {
          ...payload,
          name: wahaForm.name,
          phone_number: `PENDING_${sessionId.slice(0, 20)}`,
          provider: "WAHA",
          instance_id: sessionId,
          phone_number_id: sessionId,
          webhook_url: null,
          base_url: null,
          api_version: null,
          provider_config: undefined
        };
      }

      console.log("[FirstInboxWizard] 📤 Enviando payload para criação da inbox:", payload);

      const response = await fetch(`${API}/settings/inboxes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Erro ao criar inbox" }));
        console.error("[FirstInboxWizard] ❌ Erro na resposta do backend:", error);
        throw new Error(error.error || "Erro ao criar inbox");
      }

      const result = await response.json();
      console.log("[FirstInboxWizard] ✅ Inbox criada com sucesso:", result);

      setConnectionStatus("success");
      
      // Aguardar 2 segundos e fechar
      setTimeout(() => {
        console.log("[FirstInboxWizard] 🎉 Finalizando wizard");
        onComplete();
      }, 2000);

    } catch (error: any) {
      console.error("[FirstInboxWizard] ❌ Erro ao criar inbox:", error);
      setConnectionStatus("error");
      setErrorMessage(error.message || "Erro ao criar inbox");
    } finally {
      setIsCreating(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaWhatsapp className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Conectar seu primeiro WhatsApp
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Escolha como você quer se conectar ao WhatsApp Business
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* META Cloud API */}
        <button
          onClick={() => handleProviderSelect("META_CLOUD")}
          className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 
                   hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 
                          group-hover:scale-110 transition-transform">
              <SiMeta className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 dark:text-white mb-1">Meta Cloud API</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                API oficial do WhatsApp Business
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                  ✓ Oficial
                </span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  ✓ Cloud
                </span>
                <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                  ✓ Escalável
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* WAHA */}
        <button
          onClick={() => handleProviderSelect("WAHA")}
          className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 dark:hover:border-green-400 
                   hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0 
                          group-hover:scale-110 transition-transform">
              <FaServer className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 dark:text-white mb-1">WAHA (WhatsApp HTTP API)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Servidor próprio, mais controle
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                  ✓ Self-hosted
                </span>
                <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                  ✓ QR Code
                </span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  ✓ Flexível
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (selectedProvider === "META_CLOUD") {
      return (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <SiMeta className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Configurar Meta Cloud API
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Você precisa de uma conta Meta Business e um número aprovado
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome da Inbox *
              </label>
              <input
                type="text"
                value={metaForm.name}
                onChange={(e) => setMetaForm({ ...metaForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: WhatsApp Principal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Número de Telefone (opcional)
              </label>
              <input
                type="text"
                value={metaForm.phone_number}
                onChange={(e) => setMetaForm({ ...metaForm, phone_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: +5511999999999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Access Token *
              </label>
              <input
                type="password"
                value={metaForm.access_token}
                onChange={(e) => setMetaForm({ ...metaForm, access_token: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="EAAxxxxxxxxxxxxx..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone Number ID *
              </label>
              <input
                type="text"
                value={metaForm.phone_number_id}
                onChange={(e) => setMetaForm({ ...metaForm, phone_number_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123456789012345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                WhatsApp Business Account ID (WABA ID) *
              </label>
              <input
                type="text"
                value={metaForm.waba_id}
                onChange={(e) => setMetaForm({ ...metaForm, waba_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123456789012345"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>💡 Onde encontrar esses dados:</strong><br />
                1. Acesse o Meta Business Manager<br />
                2. Vá em "WhatsApp" → "API Setup"<br />
                3. Copie o Access Token e os IDs necessários
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800
                       transition-colors flex items-center justify-center gap-2"
            >
              <FaArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleNextFromConfig}
              disabled={!metaForm.access_token || !metaForm.phone_number_id || !metaForm.waba_id}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg
                       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
            >
              Continuar
              <FaArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    if (selectedProvider === "WAHA") {
      return (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <FaServer className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Configurar WAHA
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Digite um nome para sua conexão
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome da Conexão *
              </label>
              <input
                type="text"
                value={wahaForm.name}
                onChange={(e) => setWahaForm({ ...wahaForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: WhatsApp Atendimento"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Uma sessão será criada automaticamente com base neste nome
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>💡 Dica:</strong><br />
                No próximo passo você vai escanear um QR Code com seu WhatsApp para conectar.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800
                       transition-colors flex items-center justify-center gap-2"
            >
              <FaArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleNextFromConfig}
              disabled={!wahaForm.name || wahaForm.name.trim().length === 0}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg
                       hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
            >
              Continuar
              <FaArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        {connectionStatus === "idle" && (
          <>
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <FaCheck className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Pronto para conectar!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vamos criar sua inbox e ativar a conexão
            </p>
          </>
        )}

        {connectionStatus === "connecting" && (
          <>
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Conectando...
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Aguarde enquanto criamos sua inbox
            </p>
          </>
        )}

        {connectionStatus === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <FaCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
              ✓ Inbox criada com sucesso!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Redirecionando para o livechat...
            </p>
          </>
        )}

        {connectionStatus === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
              Erro ao conectar
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          </>
        )}
      </div>

      {qrCode && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Escaneie este QR Code com seu WhatsApp:
          </p>
          <img 
            src={qrCode} 
            alt="QR Code"
            className="mx-auto max-w-xs rounded-lg border-2 border-gray-200 dark:border-gray-700"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Abra o WhatsApp → Menu → Aparelhos conectados → Conectar um aparelho
          </p>
        </div>
      )}

      {connectionStatus === "idle" && (
        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800
                     transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handleCreateInbox}
            disabled={isCreating}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg
                     hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <FaCheck className="w-4 h-4" />
                Criar & Conectar
              </>
            )}
          </button>
        </div>
      )}

      {connectionStatus === "error" && (
        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800
                     transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handleCreateInbox}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg
                     hover:bg-green-600 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      )}
    </div>
  );

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" 
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header com Progress */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Configuração Rápida
            </h2>
            {onSkip && currentStep === 1 && (
              <button
                onClick={onSkip}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Pular por agora
              </button>
            )}
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      currentStep > step.id 
                        ? "bg-green-500 text-white" 
                        : currentStep === step.id 
                        ? "bg-blue-500 text-white" 
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {currentStep > step.id ? <FaCheck className="w-4 h-4" /> : step.id}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {step.title}
                    </p>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div 
                    className={`h-1 flex-1 mx-2 rounded transition-colors ${
                      currentStep > step.id ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
