import React, { useEffect, useState } from "react";
import { FiX, FiSave, FiPlay, FiPause, FiUsers, FiMessageSquare, FiCheckCircle, FiAlertCircle, FiClock, FiBarChart2, FiTrash2, FiChevronRight, FiChevronLeft, FiUpload } from "react-icons/fi";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { Campaign } from "../../types/types";
import TemplatePicker from "./TemplatePicker";
import CampaignUploadRecipientsModal from "./CampaignUploadRecipientsModal";
import { getAccessToken } from "../../utils/api";

type Inbox = { id: string; name?: string; provider?: string };
type Template = { id: string; name: string; kind: string };

type CampaignStats = {
  total_recipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
};

type Props = {
  apiBase: string;
  campaign: Campaign;
  templates: Template[];
  open: boolean;
  onClose: () => void;
  onSaved: (campaign: Campaign) => void;
  onDeleted?: (id: string) => void;
};

type WizardStep = 1 | 2 | 3;

export default function CampaignModal({ apiBase, campaign, templates, open, onClose, onSaved, onDeleted }: Props) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: campaign.name,
    inbox_id: campaign.inbox_id || "",
    template_id: "",
    rate_limit_per_minute: campaign.rate_limit_per_minute || 30,
    auto_handoff: !!campaign.auto_handoff,
  });

  // Segmentação (opcional)
  const [useSegmentation, setUseSegmentation] = useState(false);
  const [filters, setFilters] = useState({
    age_min: "",
    age_max: "",
    states: "",
    cities: "",
    funnel_columns: "",
    tags: "",
    lead_status: "",
    created_after: "",
    created_before: "",
    limit: 1000,
  });

  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [commitInfo, setCommitInfo] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const fetchWithAuth = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers, credentials: "include" });
  };

  useEffect(() => {
    if (!open) return;
    
    // Carregar inboxes
    fetchWithAuth(`${apiBase}/livechat/inboxes`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => setInboxes(Array.isArray(data) ? data : []))
      .catch(() => setInboxes([]));

    // Carregar estatísticas
    loadStats();
  }, [apiBase, open, campaign.id]);

  const loadStats = async () => {
    try {
      const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn("Não foi possível carregar estatísticas");
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // 1. Atualizar dados básicos da campanha
      const updateRes = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          inbox_id: form.inbox_id || null,
          rate_limit_per_minute: Number(form.rate_limit_per_minute || 30),
          auto_handoff: form.auto_handoff,
        }),
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(errText || `HTTP ${updateRes.status}`);
      }

      const updated = await updateRes.json();

      // 2. Se template foi selecionado, criar/atualizar step
      if (form.template_id) {
        const stepRes = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position: 1,
            template_id: form.template_id,
            delay_sec: 0,
            stop_on_reply: true,
          }),
        });

        if (!stepRes.ok) {
          console.warn("Aviso: Não foi possível salvar o step, mas a campanha foi atualizada.");
        }
      }

      // 3. Gerar audiência automaticamente se tiver inbox
      if (form.inbox_id) {
        try {
          await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/commit`, {
            method: "POST",
          });
        } catch (e) {
          console.warn("Aviso: Não foi possível gerar audiência automaticamente.");
        }
      }

      onSaved(updated);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Falha ao salvar campanha");
    } finally {
      setSaving(false);
    }
  };

  const toArray = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setCommitInfo(null);
    try {
      const body: any = {
        age_min: filters.age_min ? Number(filters.age_min) : undefined,
        age_max: filters.age_max ? Number(filters.age_max) : undefined,
        states: toArray(filters.states),
        cities: toArray(filters.cities),
        funnel_columns: toArray(filters.funnel_columns),
        tags: toArray(filters.tags),
        lead_status: toArray(filters.lead_status),
        created_after: filters.created_after || undefined,
        created_before: filters.created_before || undefined,
        limit: Number(filters.limit || 1000),
      };
      const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/segmentation/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const count = typeof data?.count === "number" ? data.count : (Array.isArray(data?.items) ? data.items.length : 0);
      setPreviewCount(count);
    } catch (e: any) {
      setError(e?.message || "Falha ao gerar preview");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setLoading(true);
    setError(null);
    setCommitInfo(null);
    try {
      const filterObj: any = {
        age_min: filters.age_min ? Number(filters.age_min) : undefined,
        age_max: filters.age_max ? Number(filters.age_max) : undefined,
        states: toArray(filters.states),
        cities: toArray(filters.cities),
        funnel_columns: toArray(filters.funnel_columns),
        tags: toArray(filters.tags),
        lead_status: toArray(filters.lead_status),
        created_after: filters.created_after || undefined,
        created_before: filters.created_before || undefined,
      };
      const body = {
        filters: filterObj,
        dry_run: false,
        limit: Number(filters.limit || 1000),
      };
      const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/segmentation/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const inserted = typeof data?.inserted === "number" ? data.inserted : 0;
      setCommitInfo(`${inserted} destinatários adicionados à campanha.`);
      await loadStats();
    } catch (e: any) {
      setError(e?.message || "Falha ao materializar audiência");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = campaign.status === "RUNNING" ? "PAUSED" : "RUNNING";
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSaved(updated);
      }
    } catch (e: any) {
      setError("Falha ao alterar status");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir campanha "${campaign.name}"? Essa ação é irreversível.`)) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      if (onDeleted) onDeleted(campaign.id);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Falha ao deletar campanha");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const statusConfig = {
    DRAFT: { label: "Rascunho", icon: FiAlertCircle, color: "gray" },
    SCHEDULED: { label: "Agendada", icon: FiClock, color: "indigo" },
    RUNNING: { label: "Ativa", icon: FiPlay, color: "green" },
    PAUSED: { label: "Pausada", icon: FiPause, color: "yellow" },
    COMPLETED: { label: "Concluída", icon: FiCheckCircle, color: "blue" },
    CANCELLED: { label: "Cancelada", icon: FiX, color: "red" },
  };

  const currentStatus = statusConfig[campaign.status] || statusConfig.DRAFT;
  const StatusIcon = currentStatus.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-[800px] max-w-[95vw] max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Editar Campanha
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${
                  currentStatus.color === "green"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                    : currentStatus.color === "yellow"
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                    : currentStatus.color === "blue"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                    : currentStatus.color === "red"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                    : currentStatus.color === "indigo"
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                }`}>
                  <StatusIcon className="w-3 h-3" />
                  {currentStatus.label}
                </span>
                {campaign.status === "DRAFT" || campaign.status === "PAUSED" || campaign.status === "RUNNING" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleStatus}
                    disabled={loading}
                    className="text-xs"
                  >
                    {campaign.status === "RUNNING" ? (
                      <><FiPause className="w-3 h-3 mr-1" /> Pausar</>
                    ) : (
                      <><FiPlay className="w-3 h-3 mr-1" /> Ativar</>
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
              <FiX className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Estatísticas */}
          {stats && (stats.total_recipients > 0 || stats.sent > 0) && (
            <Card gradient={false} className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <FiBarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Estatísticas da Campanha
                </h3>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.total_recipients}
                  </div>
                  <div className="text-[10px] text-gray-600 dark:text-gray-400">Alvos</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {stats.sent}
                  </div>
                  <div className="text-[10px] text-gray-600 dark:text-gray-400">Enviadas</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {stats.delivered}
                  </div>
                  <div className="text-[10px] text-gray-600 dark:text-gray-400">Entregues</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {stats.read}
                  </div>
                  <div className="text-[10px] text-gray-600 dark:text-gray-400">Lidas</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">
                    {stats.failed}
                  </div>
                  <div className="text-[10px] text-gray-600 dark:text-gray-400">Falhas</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
                    {stats.pending}
                  </div>
                  <div className="text-[10px] text-gray-600 dark:text-gray-400">Pendentes</div>
                </div>
              </div>
            </Card>
          )}

          {/* Formulário */}
          <div className="space-y-4">
            <Input
              label="Nome da campanha"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Promoção Black Friday"
              required
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Inbox <span className="text-red-500">*</span>
              </label>
              <select
                value={form.inbox_id}
                onChange={(e) => setForm({ ...form, inbox_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                required
              >
                <option value="">Selecione uma inbox…</option>
                {inboxes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name || i.id} {i.provider ? `· ${i.provider}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Template da mensagem <span className="text-red-500">*</span>
              </label>
              <TemplatePicker
                templates={templates}
                value={form.template_id}
                onChange={(templateId) => setForm({ ...form, template_id: templateId })}
              />
              {form.template_id && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <FiCheckCircle className="w-3 h-3" />
                  Template selecionado
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Rate limit (msg/min)"
                type="number"
                min={1}
                value={form.rate_limit_per_minute}
                onChange={(e) => setForm({ ...form, rate_limit_per_minute: Number(e.target.value || 30) })}
              />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.auto_handoff}
                    onChange={(e) => setForm({ ...form, auto_handoff: e.target.checked })}
                    className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Handoff IA automático</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview de audiência */}
          {form.inbox_id && (
            <Card gradient={false} className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Audiência
                  </h4>
                  {previewCount !== null ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{previewCount}</strong> {previewCount === 1 ? "contato será" : "contatos serão"} impactados
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Configure filtros e clique em "Preview" para ver quantos contatos receberão esta campanha
                    </p>
                  )}
                  {commitInfo && (
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                      {commitInfo}
                    </p>
                  )}
                </div>
              </div>

              {/* Filtros de segmentação */}
              <div className="space-y-3 mb-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Idade mínima"
                    type="number"
                    placeholder="18"
                    value={filters.age_min}
                    onChange={(e) => setFilters({...filters, age_min: e.target.value})}
                  />
                  <Input
                    label="Idade máxima"
                    type="number"
                    placeholder="65"
                    value={filters.age_max}
                    onChange={(e) => setFilters({...filters, age_max: e.target.value})}
                  />
                </div>

                <Input
                  label="Estados (separados por vírgula)"
                  placeholder="SP,RJ,MG"
                  value={filters.states}
                  onChange={(e) => setFilters({...filters, states: e.target.value})}
                />

                <Input
                  label="Cidades (separadas por vírgula)"
                  placeholder="São Paulo,Rio de Janeiro,Belo Horizonte"
                  value={filters.cities}
                  onChange={(e) => setFilters({...filters, cities: e.target.value})}
                />

                <Input
                  label="Etapas de funil (IDs ou nomes, separados por vírgula)"
                  placeholder="Prospecção,Negociação"
                  value={filters.funnel_columns}
                  onChange={(e) => setFilters({...filters, funnel_columns: e.target.value})}
                />

                <Input
                  label="Tags (separadas por vírgula)"
                  placeholder="vip,interessado"
                  value={filters.tags}
                  onChange={(e) => setFilters({...filters, tags: e.target.value})}
                />

                <Input
                  label="Status do lead (separados por vírgula)"
                  placeholder="ativo,quente"
                  value={filters.lead_status}
                  onChange={(e) => setFilters({...filters, lead_status: e.target.value})}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Criado após"
                    type="date"
                    value={filters.created_after}
                    onChange={(e) => setFilters({...filters, created_after: e.target.value})}
                  />
                  <Input
                    label="Criado antes"
                    type="date"
                    value={filters.created_before}
                    onChange={(e) => setFilters({...filters, created_before: e.target.value})}
                  />
                </div>

                <Input
                  label="Limite de contatos"
                  type="number"
                  placeholder="1000"
                  value={filters.limit}
                  onChange={(e) => setFilters({...filters, limit: Number(e.target.value) || 1000})}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePreview}
                  disabled={loading || !form.inbox_id}
                >
                  <FiUsers className="w-4 h-4 mr-1" />
                  {loading ? "..." : "Preview"}
                </Button>
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={handleCommit}
                  disabled={loading || !form.inbox_id || previewCount === null}
                >
                  <FiCheckCircle className="w-4 h-4 mr-1" />
                  {loading ? "..." : "Materializar Audiência"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadModal(true)}
                  disabled={loading}
                >
                  <FiUpload className="w-4 h-4 mr-1" />
                  Enviar Lista
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={handleDelete} 
                disabled={loading}
                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <FiTrash2 className="w-4 h-4 mr-2" />
                Deletar Campanha
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                variant="gradient" 
                onClick={handleSave} 
                disabled={saving || !form.name || !form.inbox_id || !form.template_id}
              >
                <FiSave className="w-4 h-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Campanha"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <CampaignUploadRecipientsModal
        apiBase={apiBase}
        campaignId={campaign.id}
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false);
          loadStats(); // Reload stats after upload
        }}
      />
    </div>
  );
}
