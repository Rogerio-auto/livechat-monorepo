import React, { useState, useEffect } from "react";
import { FiCheckCircle, FiAlertCircle, FiClock, FiX, FiUpload, FiRefreshCw } from "react-icons/fi";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";

type Props = {
  apiBase: string;
  open: boolean;
  templateId?: string | null;
  inboxId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
};

const categories = [
  { value: "MARKETING", label: "Marketing", description: "Promoções, novidades, ofertas" },
  { value: "UTILITY", label: "Utilidade", description: "Notificações transacionais, atualizações" },
  { value: "AUTHENTICATION", label: "Autenticação", description: "Códigos de verificação, OTPs" },
];

const languages = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en_US", label: "Inglês (EUA)" },
  { value: "es_ES", label: "Espanhol (Espanha)" },
  { value: "es_MX", label: "Espanhol (México)" },
];

export default function MetaTemplateSubmitModal({ apiBase, open, templateId, inboxId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [metaName, setMetaName] = useState("");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [language, setLanguage] = useState("pt_BR");
  const [template, setTemplate] = useState<any>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    if (!open || !templateId) {
      setError(null);
      setSuccess(false);
      setMetaName("");
      setTemplate(null);
      return;
    }

    // Carrega template local
    setLoadingTemplate(true);
    fetch(`${apiBase}/livechat/campaigns/templates/${templateId}/preview`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => {
        setTemplate(data);
        // Sugere nome normalizado (apenas lowercase, números e underscore)
        const normalizedName = data.name
          ?.toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "") || "";
        setMetaName(normalizedName);
      })
      .catch((err) => setError("Erro ao carregar template"))
      .finally(() => setLoadingTemplate(false));
  }, [open, templateId, apiBase]);

  const handleSubmit = async () => {
    if (!metaName.trim()) {
      setError("Nome do template é obrigatório");
      return;
    }

    // Valida formato do nome
    if (!/^[a-z0-9_]+$/.test(metaName)) {
      setError("Nome deve conter apenas letras minúsculas, números e underscore (_)");
      return;
    }

    if (!inboxId) {
      setError("Inbox não especificada");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Monta componentes do template baseado no tipo
      const components: any[] = [];

      // BODY é obrigatório
      const bodyText = template.payload?.text || template.payload?.caption || "";
      if (bodyText) {
        components.push({
          type: "BODY",
          text: bodyText,
        });
      }

      // Header para mídia
      if (template.kind === "IMAGE" || template.kind === "MEDIA_TEXT") {
        if (template.payload?.mediaUrl) {
          components.unshift({
            type: "HEADER",
            format: "IMAGE",
            example: {
              header_text: [template.payload.mediaUrl],
            },
          });
        }
      }

      // Botões
      if (template.payload?.buttons && Array.isArray(template.payload.buttons)) {
        const buttons = template.payload.buttons.map((btn: any) => ({
          type: btn.type || "URL",
          text: btn.label || btn.text || "Ver mais",
          url: btn.url || undefined,
          phone_number: btn.phone_number || undefined,
        }));

        if (buttons.length > 0) {
          components.push({
            type: "BUTTONS",
            buttons,
          });
        }
      }

      const body = {
        inboxId,
        name: metaName,
        category,
        language,
        components,
      };

      const res = await fetch(`${apiBase}/api/meta/templates/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const result = await res.json();
      setSuccess(true);
      
      // Atualiza template local com meta_template_id
      await fetch(`${apiBase}/livechat/campaigns/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          payload: {
            ...template.payload,
            meta_template_id: result.template?.id,
            meta_template_name: metaName,
            status: result.template?.status || "PENDING",
          },
        }),
      });

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar template para Meta");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-[600px] max-w-[95vw]">
        <Card gradient>
          <div className="absolute top-4 right-4">
            <Button aria-label="Fechar" size="sm" variant="ghost" onClick={onClose}>
              <FiX className="w-4 h-4" />
            </Button>
          </div>

          <CardHeader
            title="Enviar Template para Meta"
            subtitle="Criar template no WhatsApp Business"
            icon={<FiUpload className="w-5 h-5" />}
            iconColor="blue"
          />

          {loadingTemplate ? (
            <div className="text-center py-12 text-gray-500">Carregando template...</div>
          ) : success ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <FiCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Template Enviado!</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  O template foi enviado para aprovação da Meta.<br />
                  Status inicial: <strong>PENDING</strong>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  A aprovação pode levar de algumas horas a dias.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
                  <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nome do Template na Meta *
                </label>
                <Input
                  value={metaName}
                  onChange={(e) => setMetaName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="exemplo_template_boas_vindas"
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">
                  Apenas letras minúsculas, números e underscore (_)
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoria *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label} - {cat.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Idioma *
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {languages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-400">
                  <FiClock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Aguarde aprovação da Meta</p>
                    <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                      Templates precisam ser aprovados pela Meta antes de serem usados.
                      O processo pode levar de algumas horas a dias.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={onClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button variant="gradient" onClick={handleSubmit} disabled={loading || !metaName.trim()}>
                  {loading ? (
                    <>
                      <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <FiUpload className="w-4 h-4 mr-2" />
                      Enviar para Meta
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
