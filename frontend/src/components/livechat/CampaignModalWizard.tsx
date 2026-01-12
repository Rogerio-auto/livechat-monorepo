import React, { useEffect, useState } from "react";
import { FiX, FiSave, FiPlay, FiPause, FiUsers, FiCheckCircle, FiAlertCircle, FiClock, FiBarChart2, FiChevronRight, FiChevronLeft, FiSettings, FiTarget, FiUpload } from "react-icons/fi";
import { getAccessToken } from "../../utils/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { Campaign } from "@livechat/shared";
import TemplatePicker from "./TemplatePicker";
import FunnelStageSelector from "./FunnelStageSelector";
import TagSelector from "./TagSelector";
import DynamicWindowsEditor from "./DynamicWindowsEditor";
import CampaignUploadRecipientsModal from "./CampaignUploadRecipientsModal";
import { MetaHealthStatus } from "../../components/campaigns/MetaHealthStatus";
import { CampaignValidationAlert } from "../../components/campaigns/CampaignValidationAlert";
import { CampaignMetricsDashboard } from "../../components/campaigns/CampaignMetricsDashboard";

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
  campaign: Campaign | null; // null = criar nova
  templates: Template[];
  open: boolean;
  onClose: () => void;
  onSaved: (campaign: Campaign) => void;
  onDeleted?: (id: string) => void;
};

type WizardStep = 1 | 2 | 3 | 4; // 4 = Faixas de Horário

export default function CampaignModalWizard({ apiBase, campaign, templates, open, onClose, onSaved, onDeleted }: Props) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  
  // Step 1: Dados básicos
  const [form, setForm] = useState({
    name: campaign?.name || "",
    inbox_id: campaign?.inbox_id || "",
    template_id: "",
    rate_limit_per_minute: campaign?.rate_limit_per_minute || 30,
    auto_handoff: !!campaign?.auto_handoff,
    start_at: campaign?.start_at || "", // ISO string
    end_at: campaign?.end_at || "",     // ISO string
    send_windows_enabled: !!campaign?.send_windows?.enabled,
    send_windows_timezone: campaign?.send_windows?.timezone || campaign?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    send_windows_weekdays: (() => {
      const base: Record<string, string> = { "1":"", "2":"", "3":"", "4":"", "5":"", "6":"", "0":"" };
      const src = campaign?.send_windows?.weekdays || {};
      const res: Record<string, string> = { ...base };
      Object.keys(src).forEach(k => { res[k] = (src as any)[k]?.join(", ") || ""; });
      return res;
    })(),
  });

  // Step 2: Segmentação opcional
  const [useSegmentation, setUseSegmentation] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    age_min: "",
    age_max: "",
    states: "",
    cities: "",
    funnel_columns: [] as string[], // array de IDs de colunas
    tags: [] as string[], // array de nomes de tags
    lead_status: "",
    created_after: "",
    created_before: "",
    limit: 200, // default dentro do maximo aceito
  });

  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<Array<{ name?: string | null; phone: string; idade?: number | null; kanban_column_id?: string | null; created_at?: string }>>([]);
  const [showPreviewList, setShowPreviewList] = useState(false);
  const [commitInfo, setCommitInfo] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBulkOptIn, setShowBulkOptIn] = useState(false);
  const [bulkOptInForm, setBulkOptInForm] = useState({
    method: "FORMULARIO_WEB",
    source: "",
  });
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const fetchWithAuth = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, {
      ...init,
      headers,
      credentials: "include"
    });
  };

  useEffect(() => {
    if (!open) return;
    
    // Resetar form com dados atuais da campanha (sincroniza estado local com props)
    // Carregar steps para descobrir template selecionado
    let initialTemplateId = "";
    if (campaign?.id) {
      fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/steps`)
        .then(r => r.ok ? r.json() : [])
        .then((steps) => {
          if (Array.isArray(steps) && steps.length > 0) {
            initialTemplateId = steps[0].template_id || "";
            setForm(f => ({ ...f, template_id: initialTemplateId }));
            const tmpl = templates.find(t => t.id === initialTemplateId);
            if (tmpl) setSelectedTemplate(tmpl);
          }
        })
        .catch(() => {});
    }

    // Carregar segment ligado (preview legacy retorna segment)
    if (campaign?.id) {
      fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/preview`)
        .then(r => r.ok ? r.json() : null)
        .then((payload) => {
          if (payload?.segment?.definition) {
            const def = payload.segment.definition || {};
            // Prefill segmentation filters
            const fc = Array.isArray(def.funnel_columns) ? def.funnel_columns : [];
            const tagsArray = Array.isArray(def.tags) ? def.tags : [];
            setFilters(f => ({
              ...f,
              age_min: def.age_min?.toString() || "",
              age_max: def.age_max?.toString() || "",
              states: Array.isArray(def.states) ? def.states.join(", ") : "",
              cities: Array.isArray(def.cities) ? def.cities.join(", ") : "",
              funnel_columns: fc,
              tags: tagsArray,
              lead_status: Array.isArray(def.lead_status) ? def.lead_status.join(", ") : "",
              created_after: def.created_after || "",
              created_before: def.created_before || "",
              limit: def.limit || f.limit,
            }));
            setUseSegmentation(true);
          }
        })
        .catch(() => {});
    }

    setForm({
      name: campaign?.name || "",
      inbox_id: campaign?.inbox_id || "",
      template_id: initialTemplateId,
      rate_limit_per_minute: campaign?.rate_limit_per_minute || 30,
      auto_handoff: !!campaign?.auto_handoff,
      start_at: campaign?.start_at || "",
      end_at: campaign?.end_at || "",
      send_windows_enabled: !!campaign?.send_windows?.enabled,
      send_windows_timezone: campaign?.send_windows?.timezone || campaign?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      send_windows_weekdays: (() => {
        const base: Record<string, string> = { "1":"", "2":"", "3":"", "4":"", "5":"", "6":"", "0":"" };
        const src = campaign?.send_windows?.weekdays || {};
        const res: Record<string, string> = { ...base };
        Object.keys(src).forEach(k => { res[k] = (src as any)[k]?.join(", ") || ""; });
        return res;
      })(),
    });
    
    // Carregar inboxes
    fetchWithAuth(`${apiBase}/livechat/inboxes`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => setInboxes(Array.isArray(data) ? data : []))
      .catch(() => setInboxes([]));

    // Carregar estatísticas (só se já existe campanha)
    if (campaign?.id) {
      loadStats();
    }
  }, [apiBase, open, campaign]);

  const loadStats = async () => {
    if (!campaign?.id) return;
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

  // Sincronizar selectedTemplate quando template_id mudar
  useEffect(() => {
    if (form.template_id) {
      const tmpl = templates.find(t => t.id === form.template_id);
      setSelectedTemplate(tmpl || null);
    }
  }, [form.template_id, templates]);

  // helpers para datetime-local conversão correta local <-> ISO
  function isoToLocalInput(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    // observação: datetime-local espera horário local sem timezone
  }
  function localInputToIso(local: string) {
    if (!local) return null;
    const d = new Date(local);
    return d.toISOString();
  }

  const handleNextStep = () => {
    if (currentStep === 1) {
      // Validar step 1
      if (!form.name || !form.inbox_id || !form.template_id) {
        setError("Preencha todos os campos obrigatórios");
        return;
      }
    }
    setError(null);
    setCurrentStep((prev) => Math.min(4, prev + 1) as WizardStep);
  };

  const handlePrevStep = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1) as WizardStep);
  };

  const handlePreview = async () => {
    if (!campaign) {
      setError("Salve a campanha primeiro para gerar o preview");
      return;
    }
    
    if (!useSegmentation) {
      // Preview simples: todos os contatos da inbox
      setPreviewLoading(true);
      try {
        const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/preview`);
        if (res.ok) {
          const data = await res.json();
          setPreviewCount(Array.isArray(data) ? data.length : 0);
        }
      } catch (e: any) {
        setError("Falha ao gerar preview");
      } finally {
        setPreviewLoading(false);
      }
      return;
    }

    // Preview com filtros
    setPreviewLoading(true);
    setError(null);
    try {
      const payload: any = { limit: filters.limit };
      if (filters.age_min) payload.age_min = Number(filters.age_min);
      if (filters.age_max) payload.age_max = Number(filters.age_max);
      if (filters.states) payload.states = filters.states.split(",").map(s => s.trim()).filter(Boolean);
      if (filters.cities) payload.cities = filters.cities.split(",").map(s => s.trim()).filter(Boolean);
      if (filters.funnel_columns && filters.funnel_columns.length > 0) payload.funnel_columns = filters.funnel_columns;
      if (filters.tags && filters.tags.length > 0) payload.tags = filters.tags;
      if (filters.lead_status) payload.lead_status = filters.lead_status.split(",").map(s => s.trim()).filter(Boolean);
      if (filters.created_after) payload.created_after = filters.created_after;
      if (filters.created_before) payload.created_before = filters.created_before;

      const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/segmentation/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewCount(data.count || 0);
        setPreviewItems(Array.isArray(data.items) ? data.items : []);
      } else {
        throw new Error(await res.text());
      }
    } catch (e: any) {
      setError(e?.message || "Falha ao gerar preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!campaign) {
      setError("Salve a campanha primeiro para gerar a audiência");
      return;
    }
    
    if (!useSegmentation) {
      // Commit simples (legacy)
      setLoading(true);
      try {
        await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/commit`, {
          method: "POST",
        });
        setCommitInfo("✓ Audiência gerada com sucesso");
        loadStats();
      } catch (e) {
        setError("Falha ao gerar audiência");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Commit com filtros
    setLoading(true);
    setError(null);
    setCommitInfo(null);
    try {
      const payload: any = { limit: filters.limit };
      if (filters.age_min) payload.age_min = Number(filters.age_min);
      if (filters.age_max) payload.age_max = Number(filters.age_max);
      if (filters.states) payload.states = filters.states.split(",").map(s => s.trim()).filter(Boolean);
      if (filters.cities) payload.cities = filters.cities.split(",").map(s => s.trim()).filter(Boolean);
      if (filters.funnel_columns && filters.funnel_columns.length > 0) payload.funnel_columns = filters.funnel_columns;
      if (filters.tags && filters.tags.length > 0) payload.tags = filters.tags;
      if (filters.lead_status) payload.lead_status = filters.lead_status.split(",").map(s => s.trim()).filter(Boolean);
      if (filters.created_after) payload.created_after = filters.created_after;
      if (filters.created_before) payload.created_before = filters.created_before;

      const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/segmentation/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: payload, limit: payload.limit, segment_name: form.name ? `Segmento - ${form.name}` : undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setCommitInfo(`✓ ${data.inserted || 0} contatos adicionados à campanha`);
        loadStats(); // refresh stats
      } else {
        throw new Error(await res.text());
      }
    } catch (e: any) {
      setError(e?.message || "Falha ao materializar audiência");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndFinish = async () => {
    setError(null);
    setSaving(true);

    try {
      const nowIso = new Date().toISOString();
      const shouldSchedule = form.start_at && new Date(form.start_at).toISOString() > nowIso;
      
      const payload = {
        name: form.name || `Campanha ${new Date().toLocaleString()}`,
        inbox_id: form.inbox_id || null,
        rate_limit_per_minute: Number(form.rate_limit_per_minute || 30),
        auto_handoff: form.auto_handoff,
        start_at: form.start_at || null,
        end_at: form.end_at || null,
        timezone: form.send_windows_timezone || "America/Sao_Paulo",
        ...(shouldSchedule ? { status: "SCHEDULED" } : {}),
        send_windows: form.send_windows_enabled
          ? {
              enabled: true,
              timezone: form.send_windows_timezone,
              weekdays: Object.fromEntries(
                Object.entries(form.send_windows_weekdays).map(([k, v]) => [
                  k,
                  String(v || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(s)),
                ])
              ),
            }
          : { enabled: false },
      };

      let updated: Campaign;

      if (!campaign) {
        // Não deveria acontecer mais, mas mantém fallback
        const createRes = await fetchWithAuth(`${apiBase}/livechat/campaigns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error(errText || `HTTP ${createRes.status}`);
        }

        updated = await createRes.json();
      } else {
        // Atualizar campanha existente (caso normal agora)
        const updateRes = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          throw new Error(errText || `HTTP ${updateRes.status}`);
        }

        updated = await updateRes.json();
      }

      // 2. Se template foi selecionado, criar/atualizar step
      if (form.template_id && updated.id) {
        console.log("[CampaignWizard] 📝 Criando campaign_step:", {
          campaign_id: updated.id,
          template_id: form.template_id,
        });

        const stepRes = await fetchWithAuth(`${apiBase}/livechat/campaigns/${updated.id}/steps`, {
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
          const errorData = await stepRes.json().catch(() => ({}));
          console.error("[CampaignWizard] ❌ Falha ao criar step:", {
            status: stepRes.status,
            error: errorData,
          });
          
          // Mostrar erro ao usuário
          setError(`Campanha salva, mas falha ao configurar template: ${errorData.error || 'Erro desconhecido'}`);
          
          // Mesmo assim considerar sucesso parcial
          onSaved(updated);
          return;
        }

        const stepData = await stepRes.json();
        console.log("[CampaignWizard] ✅ Step criado com sucesso:", stepData);
      }

      onSaved(updated);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Falha ao salvar campanha");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!campaign) return;
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

  const handleConfirmActivation = async () => {
    if (!campaign) return;
    
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RUNNING" }),
      });

      if (!response.ok) throw new Error("Falha ao ativar campanha");

      const updated = await response.json();
      setShowValidation(false);
      if (onSaved) {
        onSaved(updated);
      }
    } catch (e: any) {
      setError("Falha ao ativar campanha");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkOptIn = async () => {
    if (!campaign?.id || !bulkOptInForm.source.trim()) {
      setError("Preencha a fonte do opt-in");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth(`${apiBase}/api/campaigns/${campaign.id}/recipients/bulk-optin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opt_in_method: bulkOptInForm.method,
          opt_in_source: bulkOptInForm.source,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro ao registrar opt-in em lote");
      }

      const result = await response.json();
      setCommitInfo(`✅ Opt-in registrado para ${result.updated_count || 0} recipients`);
      setShowBulkOptIn(false);
      
      // Recarregar validação
      if (validation) {
        const valRes = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/validate`);
        if (valRes.ok) {
          setValidation(await valRes.json());
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro ao registrar opt-in");
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (filterKey: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterKey) ? prev.filter((k) => k !== filterKey) : [...prev, filterKey]
    );
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

  const currentStatus = campaign ? (statusConfig[campaign.status] || statusConfig.DRAFT) : statusConfig.DRAFT;
  const StatusIcon = currentStatus.icon;

  const stepTitles = {
    1: "Dados Básicos",
    2: "Segmentação (Opcional)",
    3: "Faixas de Horário",
    4: "Revisão e Ativação",
  } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-[900px] max-w-[95vw] max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {campaign ? "Editar Campanha" : "Nova Campanha"}
              </h2>
              {campaign && (
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
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
              <FiX className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 flex-1 ${step < 3 ? "mr-2" : ""}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      step === currentStep
                        ? "bg-blue-600 text-white scale-110"
                        : step < currentStep
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {step < currentStep ? "✓" : step}
                  </div>
                  <span className={`text-xs font-medium ${step === currentStep ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {stepTitles[step as WizardStep]}
                  </span>
                </div>
                {step < 4 && (
                  <div className={`h-0.5 flex-1 ${step < currentStep ? "bg-green-600" : "bg-gray-200 dark:bg-gray-700"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Dados Básicos */}
          {currentStep === 1 && (
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

              {/* Meta Health Status */}
              {form.inbox_id && (
                <div className="mt-4">
                  <MetaHealthStatus 
                    inboxId={form.inbox_id}
                    showRefreshButton={true}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Template da mensagem <span className="text-red-500">*</span>
                </label>
                <TemplatePicker
                  templates={templates}
                  value={form.template_id}
                  onChange={(templateId) => {
                    setForm({ ...form, template_id: templateId });
                    const tmpl = templates.find(t => t.id === templateId);
                    setSelectedTemplate(tmpl || null);
                  }}
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

              {/* Scheduling moved to Step 3 */}
            </div>
          )}
          {/* Step 3: Faixas de Horário */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <Card gradient={false} className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <FiClock className="w-4 h-4" /> Agendamento & Horários de Envio
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Defina o período absoluto (início/fim) e as faixas diárias permitidas. Fora das faixas a campanha fica ativa mas não envia.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Início (opcional)</label>
                    <Input
                      type="datetime-local"
                      value={isoToLocalInput(form.start_at)}
                      onChange={(e) => setForm({ ...form, start_at: localInputToIso(e.target.value) || "" })}
                    />
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fim (opcional)</label>
                    <Input
                      type="datetime-local"
                      value={isoToLocalInput(form.end_at)}
                      onChange={(e) => setForm({ ...form, end_at: localInputToIso(e.target.value) || "" })}
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Se o início for futuro, status muda para Agendada. Após o fim ou sem pendentes, marca Concluída.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={form.send_windows_enabled}
                        onChange={(e) => setForm({ ...form, send_windows_enabled: e.target.checked })}
                      />
                      Restringir por faixas diárias
                    </label>
                    {form.send_windows_enabled && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Timezone</label>
                          <Input
                            value={form.send_windows_timezone}
                            onChange={(e) => setForm({ ...form, send_windows_timezone: e.target.value })}
                            placeholder="America/Sao_Paulo"
                          />
                        </div>
                        <DynamicWindowsEditor
                          weekdaysState={form.send_windows_weekdays}
                          onChange={(weekdays) => setForm({ ...form, send_windows_weekdays: weekdays })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Step 2: Segmentação */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Card gradient={false} className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3 mb-3">
                  <FiTarget className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      Segmentação de Audiência
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Configure filtros opcionais para refinar sua audiência. Se nenhum filtro for selecionado, todos os contatos da inbox serão impactados.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSegmentation}
                    onChange={(e) => setUseSegmentation(e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usar segmentação personalizada</span>
                </label>
              </Card>

              {useSegmentation && (
                <div className="space-y-3">
                  {/* Botões de filtro */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "age", label: "Idade", icon: "👤" },
                      { key: "location", label: "Localização", icon: "📍" },
                      { key: "funnel", label: "Etapa de Funil", icon: "🎯" },
                      { key: "tags", label: "Tags", icon: "🏷️" },
                      { key: "status", label: "Status do Lead", icon: "⚡" },
                      { key: "date", label: "Data de Criação", icon: "📅" },
                    ].map((filter) => (
                      <button
                        key={filter.key}
                        onClick={() => toggleFilter(filter.key)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                          activeFilters.includes(filter.key)
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span className="mr-1">{filter.icon}</span>
                        {filter.label}
                      </button>
                    ))}
                  </div>

                  {/* Campos de filtro */}
                  <div className="space-y-3">
                    {activeFilters.includes("age") && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Idade mínima"
                          type="number"
                          placeholder="18"
                          value={filters.age_min}
                          onChange={(e) => setFilters({ ...filters, age_min: e.target.value })}
                        />
                        <Input
                          label="Idade máxima"
                          type="number"
                          placeholder="65"
                          value={filters.age_max}
                          onChange={(e) => setFilters({ ...filters, age_max: e.target.value })}
                        />
                      </div>
                    )}

                    {activeFilters.includes("location") && (
                      <>
                        <Input
                          label="Estados (separados por vírgula)"
                          placeholder="SP, RJ, MG"
                          value={filters.states}
                          onChange={(e) => setFilters({ ...filters, states: e.target.value })}
                        />
                        <Input
                          label="Cidades (separadas por vírgula)"
                          placeholder="São Paulo, Rio de Janeiro"
                          value={filters.cities}
                          onChange={(e) => setFilters({ ...filters, cities: e.target.value })}
                        />
                      </>
                    )}

                    {activeFilters.includes("funnel") && (
                      <FunnelStageSelector
                        apiBase={apiBase}
                        selectedStages={filters.funnel_columns}
                        onChange={(stages) => setFilters({ ...filters, funnel_columns: stages })}
                      />
                    )}

                    {activeFilters.includes("tags") && (
                      <TagSelector
                        apiBase={apiBase}
                        selectedTags={filters.tags}
                        onChange={(tags) => setFilters({ ...filters, tags })}
                      />
                    )}

                    {activeFilters.includes("status") && (
                      <Input
                        label="Status do lead (separados por vírgula)"
                        placeholder="ativo, quente"
                        value={filters.lead_status}
                        onChange={(e) => setFilters({ ...filters, lead_status: e.target.value })}
                      />
                    )}

                    {activeFilters.includes("date") && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Criado após"
                          type="date"
                          value={filters.created_after}
                          onChange={(e) => setFilters({ ...filters, created_after: e.target.value })}
                        />
                        <Input
                          label="Criado antes"
                          type="date"
                          value={filters.created_before}
                          onChange={(e) => setFilters({ ...filters, created_before: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <Input
                    label="Limite de contatos (máx 500)"
                    type="number"
                    min={1}
                    max={500}
                    placeholder="Ex: 200"
                    value={filters.limit}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (!raw) { setFilters({ ...filters, limit: 1 }); return; }
                      const bounded = Math.max(1, Math.min(500, raw));
                      setFilters({ ...filters, limit: bounded });
                    }}
                  />
                </div>
              )}

              {/* Preview */}
              <Card gradient={false} className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      Preview da Audiência
                    </h4>
                    {previewCount !== null ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong className="text-blue-600 dark:text-blue-400 text-lg">{previewCount}</strong>{" "}
                        {previewCount === 1 ? "contato será impactado" : "contatos serão impactados"}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Clique em "Gerar Preview" para ver quantos contatos receberão esta campanha
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePreview}
                    disabled={previewLoading}
                  >
                    <FiUsers className="w-4 h-4 mr-1" />
                    {previewLoading ? "Gerando..." : "Gerar Preview"}
                  </Button>
                </div>

                {/* Lista de amostra dos contatos */}
                {previewItems && previewItems.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Mostrando até 50 contatos de exemplo
                      </p>
                      <button
                        onClick={() => setShowPreviewList((v) => !v)}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {showPreviewList ? "Ocultar" : "Mostrar lista"}
                      </button>
                    </div>
                    {showPreviewList && (
                      <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            <tr>
                              <th className="text-left px-3 py-2">Nome</th>
                              <th className="text-left px-3 py-2">Telefone</th>
                              <th className="text-left px-3 py-2">Idade</th>
                              <th className="text-left px-3 py-2">Etapa (ID)</th>
                              <th className="text-left px-3 py-2">Criado em</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewItems.slice(0, 50).map((it, idx) => (
                              <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                                <td className="px-3 py-2 text-gray-900 dark:text-white">{it.name || "—"}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{it.phone}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{it.idade ?? "—"}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{it.kanban_column_id || "—"}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{it.created_at ? new Date(it.created_at).toLocaleString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Step 4: Revisão e Ativação */}
          {currentStep === 4 && (
            <div className="space-y-4">
              {/* Métricas da Campanha (se já estiver rodando) */}
              {campaign?.id && (campaign.status === "RUNNING" || campaign.status === "COMPLETED" || campaign.status === "PAUSED") && (
                <Card gradient={false} className="p-4 bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FiBarChart2 className="w-4 h-4" /> Métricas em Tempo Real
                  </h3>
                  <CampaignMetricsDashboard 
                    campaignId={campaign.id}
                    autoRefresh={true}
                    refreshInterval={30}
                    compact={false}
                  />
                </Card>
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

              {/* Resumo */}
              <Card gradient={false} className="p-4 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <FiSettings className="w-4 h-4" />
                  Resumo da Configuração
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Nome:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{form.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Inbox:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {inboxes.find((i) => i.id === form.inbox_id)?.name || form.inbox_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Template:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {templates.find((t) => t.id === form.template_id)?.name || "Selecionado"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Segmentação:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {useSegmentation ? `${activeFilters.length} filtros ativos` : "Todos os contatos"}
                    </span>
                  </div>
                  {previewCount !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Audiência prevista:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{previewCount} contatos</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Ações de audiência */}
              <Card gradient={false} className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Materializar Audiência
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Clique no botão abaixo para gerar a lista de contatos que receberão esta campanha.
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Observação: cada contato é incluído no máximo <strong>uma vez</strong> por campanha. Se você executar a materialização novamente, contatos já incluídos não serão duplicados.
                </p>
                {commitInfo && (
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                    {commitInfo}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={handleCommit}
                    disabled={loading}
                    className="flex-1"
                  >
                    <FiCheckCircle className="w-4 h-4 mr-2" />
                    {loading ? "Processando..." : "Materializar Audiência"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUploadModal(true)}
                    disabled={loading || !campaign?.id}
                    className="flex-1"
                  >
                    <FiUpload className="w-4 h-4 mr-2" />
                    Enviar Lista
                  </Button>
                </div>

                {/* Botão para validar campanha */}
                {campaign?.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const res = await fetchWithAuth(`${apiBase}/livechat/campaigns/${campaign.id}/validate`);
                          if (res.ok) {
                            const validationResult = await res.json();
                            setValidation(validationResult);
                            console.log("[Validation Result]", validationResult);
                          }
                        } catch (err) {
                          console.error("Erro ao validar:", err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="w-full"
                    >
                      <FiCheckCircle className="w-4 h-4 mr-2" />
                      {loading ? "Validando..." : "Validar Campanha"}
                    </Button>
                  </div>
                )}
              </Card>

              {/* Registrar Opt-in em Lote (LGPD) - Mostrar sempre se houver recipients sem opt-in */}
              {validation?.stats?.recipients_without_opt_in > 0 && campaign?.id && (
                <Card 
                  gradient={false} 
                  className={`p-4 ${
                    validation?.stats?.recipients_without_opt_in > 0
                      ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700"
                      : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {validation?.stats?.recipients_without_opt_in > 0 ? (
                      <FiAlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                    ) : (
                      <FiCheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        {validation?.stats?.recipients_without_opt_in > 0 
                          ? "⚠️ Opt-in LGPD Necessário"
                          : "✅ Gestão de Opt-in LGPD"
                        }
                      </h3>
                      {validation?.stats?.recipients_without_opt_in > 0 ? (
                        <>
                          <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                            <strong>{validation.stats.recipients_without_opt_in} recipients</strong> ainda não têm consentimento registrado para receber mensagens de MARKETING.
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                            Você pode registrar opt-in em lote para todos os recipients desta campanha de uma só vez.
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                          Registre o consentimento LGPD em lote para todos os recipients desta campanha.
                        </p>
                      )}
                    </div>
                  </div>

                  {showBulkOptIn ? (
                    <div className="space-y-3 p-3 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-800">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Método de Opt-in
                        </label>
                        <select
                          value={bulkOptInForm.method}
                          onChange={(e) => setBulkOptInForm({ ...bulkOptInForm, method: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="FORMULARIO_WEB">Formulário Web</option>
                          <option value="CONVERSA_WHATSAPP">Conversa WhatsApp</option>
                          <option value="CHECKOUT">Checkout/Compra</option>
                          <option value="OUTRO">Outro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Fonte/Origem * <span className="text-gray-500">(ex: "Landing Page Black Friday 2025")</span>
                        </label>
                        <input
                          type="text"
                          value={bulkOptInForm.source}
                          onChange={(e) => setBulkOptInForm({ ...bulkOptInForm, source: e.target.value })}
                          placeholder="Descreva a origem do consentimento"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleBulkOptIn}
                          disabled={loading || !bulkOptInForm.source.trim()}
                          className="flex-1"
                        >
                          <FiCheckCircle className="w-4 h-4 mr-2" />
                          {loading ? "Registrando..." : "Confirmar Opt-in em Lote"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowBulkOptIn(false)}
                          disabled={loading}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowBulkOptIn(true)}
                      disabled={loading}
                      className="w-full"
                    >
                      <FiCheckCircle className="w-4 h-4 mr-2" />
                      Registrar Opt-in em Lote
                    </Button>
                  )}
                </Card>
              )}

              {/* Controle de status */}
              {campaign && (campaign.status === "DRAFT" || campaign.status === "PAUSED" || campaign.status === "RUNNING") && (
                <Card gradient={false} className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Controle de Execução
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleToggleStatus}
                    disabled={loading}
                    className="w-full"
                  >
                    {campaign.status === "RUNNING" ? (
                      <><FiPause className="w-4 h-4 mr-2" /> Pausar Campanha</>
                    ) : (
                      <><FiPlay className="w-4 h-4 mr-2" /> Ativar Campanha</>
                    )}
                  </Button>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={loading || saving}
                className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FiX className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <Button variant="ghost" onClick={handlePrevStep} disabled={saving || loading}>
                  <FiChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
              )}
              {currentStep < 4 ? (
                <Button variant="gradient" onClick={handleNextStep}>
                  Próximo
                  <FiChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  onClick={handleSaveAndFinish}
                  disabled={saving || !form.name || !form.inbox_id || !form.template_id}
                >
                  <FiSave className="w-4 h-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar e Concluir"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {campaign?.id && (
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
      )}

      {/* Validation Alert Modal */}
      <CampaignValidationAlert
        open={showValidation}
        onOpenChange={setShowValidation}
        validation={validation}
        onProceed={handleConfirmActivation}
        onCancel={() => setShowValidation(false)}
      />
    </div>
  );
}
