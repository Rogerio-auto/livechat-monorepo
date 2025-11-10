import React, { useEffect, useState } from "react";
import { FiX, FiFileText, FiImage, FiVideo, FiFile, FiCreditCard, FiUser, FiCalendar, FiSend, FiInbox } from "react-icons/fi";

type TemplateDetail = {
  id: string;
  name: string;
  kind: string;
  payload: any;
  company_id: string;
  created_at: string;
  updated_at: string;
  // Dados enriquecidos
  creator?: { id: string; name: string; email: string };
  inbox?: { id: string; name: string; provider?: string; is_official_api?: boolean };
  campaigns?: Array<{ id: string; name: string; status: string }>;
  stats?: {
    total_sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
};

type Props = {
  apiBase: string;
  templateId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (id: string) => void;
};

export default function TemplateDetailModal({ apiBase, templateId, open, onClose, onEdit }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);

  useEffect(() => {
    if (!open || !templateId) {
      setTemplate(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`${apiBase}/livechat/campaigns/templates/${templateId}/details`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setTemplate(data))
      .catch((err) => {
        console.error("[TemplateDetail] Load failed:", err);
        setError("Não foi possível carregar os detalhes do template.");
      })
      .finally(() => setLoading(false));
  }, [apiBase, templateId, open]);

  const getKindIcon = (kind: string) => {
    switch (kind?.toUpperCase()) {
      case "IMAGE":
        return <FiImage className="w-5 h-5" />;
      case "VIDEO":
        return <FiVideo className="w-5 h-5" />;
      case "DOCUMENT":
        return <FiFile className="w-5 h-5" />;
      case "PAYMENT":
        return <FiCreditCard className="w-5 h-5" />;
      default:
        return <FiFileText className="w-5 h-5" />;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-[720px] max-w-[95vw] bg-white dark:bg-[#161616] rounded-xl border border-(--color-border) shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-(--color-border) flex items-center justify-between">
          <h3 className="text-base font-semibold text-(--color-heading)">Detalhes do Template</h3>
          <button
            aria-label="Fechar"
            className="text-[12px] px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-bg)"
            onClick={onClose}
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 max-h-[80vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-(--color-text-muted)">Carregando...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && template && (
            <div className="space-y-4">
              {/* Template Info */}
              <div className="bg-(--color-bg) border border-(--color-border) rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-1 text-(--color-primary)">
                    {getKindIcon(template.kind)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-(--color-heading) mb-1">
                      {template.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-(--color-text-muted)">
                      <span className="px-2 py-0.5 rounded bg-(--color-primary)/10 text-(--color-primary)">
                        {template.kind}
                      </span>
                      {template.payload?._meta?.original_kind && (
                        <span className="text-[10px]">
                          (Original: {template.payload._meta.original_kind})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="mt-3 pt-3 border-t border-(--color-border)">
                  {template.payload?.text && (
                    <div className="mb-2">
                      <div className="text-xs text-(--color-text-muted) mb-1">Texto:</div>
                      <div className="text-sm text-(--color-heading) bg-white dark:bg-[#1a1a1a] rounded p-2 border border-(--color-border) whitespace-pre-wrap">
                        {template.payload.text}
                      </div>
                    </div>
                  )}
                  {template.payload?.mediaUrl && (
                    <div className="mb-2">
                      <div className="text-xs text-(--color-text-muted) mb-1">Mídia:</div>
                      <div className="text-xs text-(--color-primary) truncate">
                        {template.payload.mediaUrl}
                      </div>
                    </div>
                  )}
                  {template.payload?.buttons?.length > 0 && (
                    <div>
                      <div className="text-xs text-(--color-text-muted) mb-1">Botões:</div>
                      <div className="space-y-1">
                        {template.payload.buttons.map((btn: any, idx: number) => (
                          <div
                            key={idx}
                            className="text-xs px-2 py-1 rounded border border-(--color-primary) text-(--color-primary)"
                          >
                            {btn.label || "Botão"}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Creator */}
                <div className="bg-(--color-bg) border border-(--color-border) rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-(--color-text-muted) mb-1">
                    <FiUser className="w-3 h-3" />
                    <span>Criado por</span>
                  </div>
                  <div className="text-sm text-(--color-heading) font-medium">
                    {template.creator?.name || "Desconhecido"}
                  </div>
                  {template.creator?.email && (
                    <div className="text-xs text-(--color-text-muted) truncate">
                      {template.creator.email}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="bg-(--color-bg) border border-(--color-border) rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-(--color-text-muted) mb-1">
                    <FiCalendar className="w-3 h-3" />
                    <span>Criado em</span>
                  </div>
                  <div className="text-sm text-(--color-heading)">
                    {formatDate(template.created_at)}
                  </div>
                  {template.updated_at !== template.created_at && (
                    <div className="text-xs text-(--color-text-muted) mt-1">
                      Atualizado: {formatDate(template.updated_at)}
                    </div>
                  )}
                </div>

                {/* Inbox & Provider */}
                <div className="bg-(--color-bg) border border-(--color-border) rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-(--color-text-muted) mb-1">
                    <FiInbox className="w-3 h-3" />
                    <span>Inbox / Provider</span>
                  </div>
                  {template.inbox ? (
                    <div className="space-y-1">
                      <div className="text-sm text-(--color-heading) font-medium">
                        {template.inbox.name}
                      </div>
                      <div className="text-xs flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-(--color-primary)/10 text-(--color-primary)">
                          {template.inbox.provider || 'N/D'}
                        </span>
                        {template.inbox.is_official_api !== undefined && (
                          <span className={`px-2 py-0.5 rounded text-xs ${template.inbox.is_official_api ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'}`}> 
                            {template.inbox.is_official_api ? 'API Oficial' : 'WAHA'}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-(--color-text-muted)">Nenhuma inbox associada</div>
                  )}
                </div>

                {/* Stats */}
                {template.stats && (
                  <div className="bg-(--color-bg) border border-(--color-border) rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-(--color-text-muted) mb-1">
                      <FiSend className="w-3 h-3" />
                      <span>Mensagens enviadas</span>
                    </div>
                    <div className="text-lg text-(--color-heading) font-bold">
                      {template.stats.total_sent.toLocaleString("pt-BR")}
                    </div>
                    <div className="flex gap-2 text-xs text-(--color-text-muted) mt-1">
                      <span>✓ {template.stats.delivered}</span>
                      <span>👁 {template.stats.read}</span>
                      {template.stats.failed > 0 && <span className="text-red-500">✗ {template.stats.failed}</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Campaigns using this template */}
              {template.campaigns && template.campaigns.length > 0 && (
                <div className="bg-(--color-bg) border border-(--color-border) rounded-lg p-3">
                  <div className="text-xs text-(--color-text-muted) mb-2">
                    Campanhas usando este template ({template.campaigns.length}):
                  </div>
                  <div className="space-y-1">
                    {template.campaigns.map((camp) => (
                      <div
                        key={camp.id}
                        className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-white dark:hover:bg-[#1a1a1a]"
                      >
                        <span className="text-(--color-heading)">{camp.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-(--color-primary)/10 text-(--color-primary)">
                          {camp.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && template && (
          <div className="px-4 py-3 border-t border-(--color-border) flex items-center justify-end gap-2">
            <button
              className="text-sm px-3 py-1.5 rounded border border-(--color-border) hover:bg-(--color-bg)"
              onClick={onClose}
            >
              Fechar
            </button>
            {onEdit && (
              <button
                className="text-sm px-3 py-1.5 rounded bg-(--color-primary) text-white hover:opacity-90"
                onClick={() => {
                  onClose();
                  onEdit(template.id);
                }}
              >
                Editar Template
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
