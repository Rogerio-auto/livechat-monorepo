import React, { useEffect, useRef, useState, useCallback } from "react";
import { FiBarChart2, FiPlay, FiPause, FiXCircle, FiTrash2, FiRefreshCw, FiDownload, FiPlus, FiMessageSquare, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useToast } from "../../hooks/useToast";
import CampaignModalWizard from "./CampaignModalWizard";
import CampaignMetricsModal from "./CampaignMetricsModal";
import TemplateCard from "./TemplateCard";
import TemplateWizardModal from "./TemplateWizardModal";
import TemplateDetailModal from "./TemplateDetailModal";
import MetaTemplateSubmitModal from "./MetaTemplateSubmitModal";
import ToastContainer from "../common/ToastContainer";
import type { Campaign } from "../../types/types";

type Template = { id: string; name: string; kind: string; status?: string; meta_status?: string; meta_template_id?: string };
type Inbox = { id: string; name: string; provider: string };
type PagePayload = {
  items: Campaign[];
  total: number;
  limit: number;
  offset: number;
};

export default function CampaignsPanel({ apiBase }: { apiBase: string }) {
  const { profile } = useUserProfile();
  const { toasts, showToast, dismissToast } = useToast();
  const limit = 20;
  const [items, setItems] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [campaignTemplates, setCampaignTemplates] = useState<Map<string, { templateId: string; templateName: string }>>(new Map());
  const [campaignStats, setCampaignStats] = useState<Map<string, { sent: number; total: number; progress: number }>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [metricsFor, setMetricsFor] = useState<Campaign | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTemplateId, setWizardTemplateId] = useState<string | null>(null); // optional edit id
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTemplateId, setDetailTemplateId] = useState<string | null>(null);
  const [metaSubmitOpen, setMetaSubmitOpen] = useState(false);
  const [metaSubmitTemplateId, setMetaSubmitTemplateId] = useState<string | null>(null);
  const [metaSubmitInboxId, setMetaSubmitInboxId] = useState<string | null>(null);
  const pagesRef = useRef<Map<number, PagePayload>>(new Map());
  const loadedOffsetsRef = useRef<Set<number>>(new Set());
  const totalRef = useRef<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef<boolean>(false);
  const loadedCampaignTemplatesRef = useRef<Set<string>>(new Set());
  const loadedCampaignStatsRef = useRef<Set<string>>(new Set());
  const canManageTemplates = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(profile?.role || "");
  
  // Template scroll controls
  const templateScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Check scroll position for arrows
  const checkScrollPosition = useCallback(() => {
    if (!templateScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = templateScrollRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  const scrollTemplates = (direction: 'left' | 'right') => {
    if (!templateScrollRef.current) return;
    const scrollAmount = 300;
    templateScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    checkScrollPosition();
    const scrollEl = templateScrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScrollPosition);
      window.addEventListener('resize', checkScrollPosition);
      return () => {
        scrollEl.removeEventListener('scroll', checkScrollPosition);
        window.removeEventListener('resize', checkScrollPosition);
      };
    }
  }, [templates, checkScrollPosition]);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...(init || {}),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.json();
  }

  const mergeItems = useCallback((page: PagePayload) => {
    pagesRef.current.set(page.offset, page);
    totalRef.current = page.total;
    const seen = new Set<string>();
    const merged: Campaign[] = [];
    const allPages = Array.from(pagesRef.current.values()).sort((a, b) => a.offset - b.offset);
    for (const p of allPages) {
      for (const c of p.items) {
        if (c && !seen.has(c.id)) {
          seen.add(c.id);
          merged.push(c);
        }
      }
    }
    setItems(merged);
  }, []);

  const loadPage = useCallback(
    async (offset: number) => {
      if (loadedOffsetsRef.current.has(offset)) return;
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const page = await fetchJson<PagePayload>(
          `${apiBase}/livechat/campaigns?limit=${limit}&offset=${offset}`
        );
        loadedOffsetsRef.current.add(offset);
        mergeItems(page);
      } catch (e: any) {
        setError(e?.message || "Falha ao carregar campanhas");
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [apiBase, limit, mergeItems]
  );

  const loadTemplates = useCallback((syncMeta = false) => {
    setError(null);
    const url = syncMeta 
      ? `${apiBase}/livechat/campaigns/templates?syncMeta=true`
      : `${apiBase}/livechat/campaigns/templates`;
    
    fetchJson<Template[]>(url)
      .then((ts) => setTemplates(Array.isArray(ts) ? ts : []))
      .catch((err) => {
        console.warn("Falha ao carregar templates", err);
      });
  }, [apiBase]);

  const loadInboxes = useCallback(() => {
    fetchJson<Inbox[]>(`${apiBase}/livechat/inboxes`)
      .then((data) => setInboxes(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.warn("Falha ao carregar inboxes", err);
      });
  }, [apiBase]);

  const loadCampaignTemplates = useCallback(async (campaignIds: string[]) => {
    if (campaignIds.length === 0) return;
    
    // Filter out campaigns that were already loaded
    const idsToLoad = campaignIds.filter(id => !loadedCampaignTemplatesRef.current.has(id));
    if (idsToLoad.length === 0) return;
    
    // Mark as loading
    idsToLoad.forEach(id => loadedCampaignTemplatesRef.current.add(id));
    
    try {
      // Fetch campaign steps for all campaigns - silently fail if campaign was deleted
      const stepsPromises = idsToLoad.map(id =>
        fetch(`${apiBase}/livechat/campaigns/${id}/steps`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      );
      const stepsResults = await Promise.all(stepsPromises);
      
      setCampaignTemplates(prev => {
        const newMap = new Map(prev);
        stepsResults.forEach((steps, idx) => {
          const campaignId = idsToLoad[idx];
          if (steps && steps.length > 0 && steps[0].template_id) {
            const templateId = steps[0].template_id;
            const template = templates.find(t => t.id === templateId);
            newMap.set(campaignId, {
              templateId,
              templateName: template?.name || "Template desconhecido"
            });
          }
        });
        return newMap;
      });
    } catch (err) {
      console.warn("Falha ao carregar templates das campanhas", err);
    }
  }, [apiBase, templates]);

  const loadCampaignStats = useCallback(async (campaignIds: string[]) => {
    if (campaignIds.length === 0) return;
    
    // Filter out campaigns that were already loaded
    const idsToLoad = campaignIds.filter(id => !loadedCampaignStatsRef.current.has(id));
    if (idsToLoad.length === 0) return;
    
    // Mark as loading
    idsToLoad.forEach(id => loadedCampaignStatsRef.current.add(id));
    
    try {
      // Fetch stats for all campaigns - silently fail if campaign was deleted
      const promises = idsToLoad.map(id =>
        fetch(`${apiBase}/livechat/campaigns/${id}/stats`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      );
      const results = await Promise.all(promises);
      setCampaignStats(prev => {
        const newStats = new Map(prev);
        results.forEach((stats, idx) => {
          const campaignId = idsToLoad[idx];
          if (stats) {
            const sent = stats.sent || 0;
            const total = stats.total || sent + (stats.pending || 0);
            const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
            newStats.set(campaignId, { sent, total, progress });
          }
        });
        return newStats;
      });
    } catch (err) {
      console.warn("Falha ao carregar estatísticas das campanhas", err);
    }
  }, [apiBase]);

  useEffect(() => {
    loadPage(0);
    loadTemplates();
    loadInboxes();
  }, [apiBase, loadPage, loadTemplates, loadInboxes]);

  useEffect(() => {
    // Load template info for all campaigns when items or templates change
    if (items.length > 0 && templates.length > 0) {
      loadCampaignTemplates(items.map(c => c.id));
    }
    if (items.length > 0) {
      loadCampaignStats(items.map(c => c.id));
    }
  }, [items, templates, loadCampaignTemplates, loadCampaignStats]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        const loaded = Array.from(loadedOffsetsRef.current.values()).length;
        const nextOffset = loaded * limit;
        if (nextOffset < (totalRef.current || 0)) {
          loadPage(nextOffset);
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadPage, limit]);

  function openNewCampaign() {
    createDraft(); // Cria a campanha e abre o modal
  }

  async function createDraft() {
    setError(null);
    try {
      const body = {
        name: `Campanha ${new Date().toLocaleString()}`,
        type: "BROADCAST",
        rate_limit_per_minute: 30,
        auto_handoff: false,
        timezone: "America/Sao_Paulo",
      };
      const c = await fetchJson<Campaign>(`${apiBase}/livechat/campaigns`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      // reset pages so new campaign appears properly
      pagesRef.current.clear();
      loadedOffsetsRef.current.clear();
      totalRef.current = 0;
      setItems((prev) => [c, ...prev]);
      await loadPage(0);
      setEditing(c);
      setEditorOpen(true);
      return c;
    } catch (e: any) {
      setError(e?.message || "Falha ao criar campanha");
      throw e;
    }
  }

  const openEditor = (c: Campaign) => {
    setEditing(c);
    setEditorOpen(true);
  };

  const onSaved = (updated: Campaign | null) => {
    setEditorOpen(false);
    if (!updated) return;
    
    // Atualiza campanha na lista (já foi adicionada no createDraft)
    setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)));
  };

  const onDeleted = (id: string) => {
    setEditorOpen(false);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Template actions implemented with real API calls (optimistic-ish)
  const handleViewTemplate = (template: Template) => {
     // Open detail modal to show enriched info
     setDetailTemplateId(template.id);
     setDetailOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
     // Open the wizard in edit mode
    setWizardTemplateId(template.id);
    setWizardOpen(true);
  };

  const handleCloneTemplate = async (template: Template) => {
    if (!confirm(`Clonar template "${template.name}"?`)) return;
    try {
      const cloned = await fetchJson<Template>(`${apiBase}/livechat/campaigns/templates/${template.id}/clone`, {
        method: "POST",
      });
      // reload templates
      loadTemplates();
      showToast(`Template "${cloned.name || "Clone"}" criado com sucesso!`, "success");
    } catch (e: any) {
      showToast(`Falha ao clonar: ${e?.message || "erro"}`, "error");
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (!confirm(`Excluir template "${template.name}"? Essa ação é irreversível.`)) return;
    try {
      await fetchJson<void>(`${apiBase}/livechat/campaigns/templates/${template.id}`, {
        method: "DELETE",
      });
      // optimist remove from UI
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      showToast(`Template "${template.name}" excluído com sucesso.`, "success");
    } catch (e: any) {
      showToast(`Falha ao excluir template: ${e?.message || "erro"}`, "error");
    }
  };

  const handleSubmitToMeta = async (template: Template) => {
    // Precisa buscar inbox do template
    try {
      const details = await fetchJson<any>(`${apiBase}/livechat/campaigns/templates/${template.id}/preview`, {});
      const inboxId = details.inbox_id;
      
      if (!inboxId) {
        showToast("Template não possui inbox configurada", "error");
        return;
      }

      setMetaSubmitTemplateId(template.id);
      setMetaSubmitInboxId(inboxId);
      setMetaSubmitOpen(true);
    } catch (e: any) {
      showToast(`Erro ao abrir envio para Meta: ${e?.message || "erro"}`, "error");
    }
  };

  const onMetaSubmitSuccess = () => {
    loadTemplates(true); // Sincroniza com Meta
    showToast("Template enviado para Meta com sucesso! Aguarde aprovação.", "success");
  };

  const handleSyncTemplates = async () => {
    try {
      await loadTemplates(true); // Chama com syncMeta=true
      showToast("Templates sincronizados com a Meta!", "success");
    } catch (e: any) {
      showToast(`Erro ao sincronizar: ${e?.message || "erro"}`, "error");
    }
  };

  const handleImportFromMeta = async () => {
    // Busca inbox META_CLOUD do usuário
    const metaInboxes = inboxes.filter(i => i.provider?.toUpperCase() === "META_CLOUD");
    
    if (metaInboxes.length === 0) {
      showToast("Nenhuma inbox Meta Cloud encontrada", "error");
      return;
    }

    // Se tiver apenas uma, usa ela. Se tiver múltiplas, poderia abrir modal de seleção
    const inboxId = metaInboxes[0].id;

    if (!confirm(`Importar templates aprovados da Meta para a inbox "${metaInboxes[0].name}"?`)) {
      return;
    }

    try {
      const result = await fetchJson<{ imported: number; total: number; templates: any[] }>(
        `${apiBase}/livechat/campaigns/templates/import-from-meta`,
        {
          method: "POST",
          body: JSON.stringify({ inboxId, status: "APPROVED" }),
        }
      );

      if (result.imported > 0) {
        await loadTemplates();
        showToast(`${result.imported} template(s) importado(s) com sucesso!`, "success");
      } else {
        showToast("Nenhum template novo para importar", "info");
      }
    } catch (e: any) {
      showToast(`Erro ao importar: ${e?.message || "erro"}`, "error");
    }
  };

  // create "new template" shortcut that opens wizard directly
  const openNewTemplateWizard = () => {
    setWizardTemplateId(null);
    setWizardOpen(true);
  };

  // handle wizard close: refresh list and reset edit id
  const onWizardClose = () => {
    setWizardOpen(false);
    setWizardTemplateId(null);
  };

  const onTemplateCreated = () => {
    loadTemplates();
  };

  // Handle Meta Template Wizard Submit
  // DEPRECATED: This function will be integrated into TemplateWizardModal
  // Kept as reference for Meta template submission logic
  /*
  const handleMetaTemplateSubmit = async (templateData: MetaTemplateData, inboxId: string) => {
    try {
      // Convert wizard data to Meta API format
      const components: any[] = [];

      // Add header
      if (templateData.header) {
        const headerComp: any = { type: templateData.header.type };
        if (templateData.header.type === 'TEXT') {
          headerComp.text = templateData.header.text;
        } else {
          headerComp.format = templateData.header.type;
          if (templateData.header.example?.header_handle?.[0]) {
            headerComp.example = { header_handle: templateData.header.example.header_handle };
          }
        }
        components.push(headerComp);
      }

      // Add body
      components.push({
        type: 'BODY',
        text: templateData.body.text,
        ...(templateData.body.examples && { examples: templateData.body.examples })
      });

      // Add footer
      if (templateData.footer) {
        components.push({
          type: 'FOOTER',
          text: templateData.footer
        });
      }

      // Add buttons
      if (templateData.buttons && templateData.buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: templateData.buttons.map(btn => {
            if (btn.type === 'QUICK_REPLY') {
              return { type: 'QUICK_REPLY', text: btn.text };
            } else if (btn.type === 'PHONE_NUMBER') {
              return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone_number };
            } else if (btn.type === 'URL') {
              return { 
                type: 'URL', 
                text: btn.text, 
                url: btn.url,
                ...(btn.example && { example: btn.example })
              };
            } else if (btn.type === 'COPY_CODE') {
              return { 
                type: 'COPY_CODE', 
                example: btn.example 
              };
            }
            return btn;
          })
        });
      }

      // Create template via Meta API
      const response = await fetchJson(`${apiBase}/api/meta/templates/create`, {
        method: 'POST',
        body: JSON.stringify({
          inboxId: inboxId,
          name: templateData.name,
          category: templateData.category,
          language: templateData.language,
          components
        })
      });

      showToast('Template criado e enviado para aprovação da Meta!', 'success');
      setWizardOpen(false);
      loadTemplates(true); // Sync after creation
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao criar template Meta');
    }
  };
  */

  // Helper to get inbox name
  const getInboxName = (inboxId: string | null | undefined): string => {
    if (!inboxId) return "Sem caixa";
    const inbox = inboxes.find((ib) => ib.id === inboxId);
    return inbox?.name || "Caixa desconhecida";
  };

  // Helper to get template name for campaign
  const getTemplateName = (campaignId: string): string => {
    const templateInfo = campaignTemplates.get(campaignId);
    return templateInfo?.templateName || "Sem template";
  };

  const getCampaignProgress = (campaignId: string) => {
    const st = campaignStats.get(campaignId);
    return st || { sent: 0, total: 0, progress: 0 };
  };

  // Campaign action handlers
  const handleToggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === "RUNNING" ? "PAUSED" : "RUNNING";
    try {
      const updated = await fetchJson<Campaign>(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setItems((prev) => prev.map((c) => (c.id === campaign.id ? updated : c)));
      showToast(`Campanha ${newStatus === "PAUSED" ? "pausada" : "retomada"} com sucesso!`, "success");
    } catch (e: any) {
      showToast(`Falha ao alterar status: ${e?.message || "erro"}`, "error");
    }
  };

  // Quick activate from DRAFT without opening modal: sets SCHEDULED and start_at=now
  const handleQuickActivate = async (campaign: Campaign) => {
    if (campaign.status !== "DRAFT") return;
    try {
      const payload: any = { status: "SCHEDULED", start_at: new Date().toISOString() };
      const updated = await fetchJson<Campaign>(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setItems((prev) => prev.map((c) => (c.id === campaign.id ? updated : c)));
      showToast(`Campanha agendada e ativada!`, "success");
    } catch (e: any) {
      showToast(`Falha ao ativar campanha: ${e?.message || "erro"}`, "error");
    }
  };

  const handleCancelCampaign = async (campaign: Campaign) => {
    if (!confirm(`Cancelar campanha "${campaign.name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      const updated = await fetchJson<Campaign>(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      setItems((prev) => prev.map((c) => (c.id === campaign.id ? updated : c)));
      showToast(`Campanha "${campaign.name}" cancelada.`, "success");
    } catch (e: any) {
      showToast(`Falha ao cancelar: ${e?.message || "erro"}`, "error");
    }
  };

  const handleDeleteCampaign = async (campaign: Campaign) => {
    if (!confirm(`Excluir campanha "${campaign.name}"? Essa ação é irreversível.`)) return;
    try {
      await fetchJson<void>(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((c) => c.id !== campaign.id));
      showToast(`Campanha "${campaign.name}" excluída com sucesso.`, "success");
    } catch (e: any) {
      showToast(`Falha ao excluir: ${e?.message || "erro"}`, "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Seção de Templates/Messages no topo - sempre renderiza */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-(--color-heading)">Templates/Mensagens</h3>
          <div className="flex items-center gap-2">
            {canManageTemplates && (
              <>
                <button
                  onClick={handleSyncTemplates}
                  className="text-xs px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-medium flex items-center gap-1.5"
                  aria-label="Sincronizar status com Meta"
                  title="Atualizar status dos templates com a Meta"
                >
                  <FiRefreshCw className="w-3.5 h-3.5" />
                  Sync
                </button>
                <button
                  onClick={handleImportFromMeta}
                  className="text-xs px-3 py-2 rounded-xl border border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400 hover:bg-green-600/20 transition-all font-medium flex items-center gap-1.5"
                  aria-label="Importar da Meta"
                  title="Importar templates aprovados da Meta"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  Importar
                </button>
                <button
                  onClick={openNewTemplateWizard}
                  className="text-xs px-4 py-2 rounded-xl border-2 border-blue-600/30 bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600/20 hover:border-blue-600/50 transition-all font-medium flex items-center gap-1.5"
                  aria-label="Criar novo template"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  Novo Template
                </button>
              </>
            )}
          </div>
        </div>

        {/* quando não houver templates: mostrar CTA central */}
        {templates.length === 0 ? (
          <div className="min-h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex items-center justify-center bg-linear-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50">
            <div className="text-center p-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-linear-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-200 dark:border-blue-800 flex items-center justify-center shadow-lg">
                <FiMessageSquare className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                Nenhum template criado
              </h4>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                Crie templates de mensagens para usar em suas campanhas de marketing.
              </p>
              {canManageTemplates ? (
                <button
                  onClick={openNewTemplateWizard}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
                >
                  <FiPlus className="w-4 h-4" />
                  Criar primeiro template
                </button>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Peça a um administrador para criar templates.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative group">
            {/* Left Arrow */}
            {showLeftArrow && (
              <button
                onClick={() => scrollTemplates('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-2 border-gray-300 dark:border-gray-600 shadow-lg flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                aria-label="Rolar templates para esquerda"
              >
                <FiChevronLeft className="w-6 h-6" />
              </button>
            )}
            
            {/* Right Arrow */}
            {showRightArrow && (
              <button
                onClick={() => scrollTemplates('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-2 border-gray-300 dark:border-gray-600 shadow-lg flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                aria-label="Rolar templates para direita"
              >
                <FiChevronRight className="w-6 h-6" />
              </button>
            )}
            
            <div 
              ref={templateScrollRef}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  canManage={canManageTemplates}
                  onView={() => handleViewTemplate(template)}
                  onEdit={() => handleEditTemplate(template)}
                  onClone={() => handleCloneTemplate(template)}
                  onDelete={() => handleDeleteTemplate(template)}
                  onSubmitToMeta={() => handleSubmitToMeta(template)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Seção de Campanhas */}
      <div className="flex-1 grid grid-rows-[auto,1fr] gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-(--color-heading)">Campanhas</h2>
          {canManageTemplates && (
            <button
              onClick={openNewCampaign}
              className="rounded-xl border-2 border-(--color-primary)/30 bg-(--color-primary)/10 px-4 py-2 text-xs font-medium text-(--color-primary) hover:bg-(--color-primary)/20 transition-colors"
            >
              + Nova campanha
            </button>
          )}
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-20rem)] px-1">
          {error && <div className="p-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl mb-3">Erro: {error}</div>}
          {items.length === 0 && !loading && !error && (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <FiMessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-(--color-text-muted)">Nenhuma campanha criada ainda.</p>
              {canManageTemplates && (
                <button
                  onClick={openNewCampaign}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-(--color-primary) text-sm font-medium text-(--color-primary) hover:bg-(--color-primary)/10 transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Criar primeira campanha
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {items.map((c) => (
            <div 
              key={c.id} 
              className="p-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 group-hover:translate-x-1 transition-transform duration-300">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {c.name}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-all duration-300 ${
                      c.status === "RUNNING" 
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 group-hover:shadow-md group-hover:shadow-green-200 dark:group-hover:shadow-green-900/50"
                        : c.status === "PAUSED"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 group-hover:shadow-md group-hover:shadow-yellow-200 dark:group-hover:shadow-yellow-900/50"
                        : c.status === "COMPLETED"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 group-hover:shadow-md group-hover:shadow-blue-200 dark:group-hover:shadow-blue-900/50"
                        : c.status === "SCHEDULED"
                        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 group-hover:shadow-md group-hover:shadow-indigo-200 dark:group-hover:shadow-indigo-900/50"
                        : c.status === "CANCELLED"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 group-hover:shadow-md group-hover:shadow-red-200 dark:group-hover:shadow-red-900/50"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400 transition-all duration-300">
                    <span className="flex items-center gap-1 group-hover:text-gray-900 dark:group-hover:text-gray-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:scale-125 transition-transform duration-300"></span>
                      Caixa: {getInboxName(c.inbox_id)}
                    </span>
                    <span className="flex items-center gap-1 group-hover:text-gray-900 dark:group-hover:text-gray-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover:scale-125 transition-transform duration-300"></span>
                      Mensagem: {getTemplateName(c.id)}
                    </span>
                    <span className="flex items-center gap-1 group-hover:text-gray-900 dark:group-hover:text-gray-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 group-hover:scale-125 transition-transform duration-300"></span>
                      {c.type}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="mt-3">
                    {(() => {
                      const { sent, total, progress } = getCampaignProgress(c.id);
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-medium text-gray-600 dark:text-gray-400">
                            <span>Progresso</span>
                            <span>{sent}/{total} ({progress}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden group-hover:h-2.5 transition-all duration-300">
                            <div
                              className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500 dark:bg-green-400' : 'bg-blue-500 dark:bg-blue-400'} group-hover:shadow-lg ${progress === 100 ? 'group-hover:shadow-green-300 dark:group-hover:shadow-green-900/50' : 'group-hover:shadow-blue-300 dark:group-hover:shadow-blue-900/50'}`}
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Action buttons row */}
                  {canManageTemplates && (
                    <div className="flex items-center gap-2 mt-3 opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                      {/* Pause/Play button - only show for RUNNING or PAUSED */}
                      {(c.status === "RUNNING" || c.status === "PAUSED") && (
                        <button
                          onClick={() => handleToggleStatus(c)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border-2 transition-all duration-300 flex items-center gap-1.5 hover:scale-105 hover:shadow-md ${
                            c.status === "RUNNING"
                              ? "border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                              : "border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                          }`}
                          title={c.status === "RUNNING" ? "Pausar campanha" : "Retomar campanha"}
                        >
                          {c.status === "RUNNING" ? (
                            <>
                              <FiPause className="w-3.5 h-3.5" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <FiPlay className="w-3.5 h-3.5" />
                              Retomar
                            </>
                          )}
                        </button>
                      )}
                      
                      {/* Cancel button - only show for SCHEDULED, RUNNING, PAUSED */}
                      {["SCHEDULED", "RUNNING", "PAUSED"].includes(c.status) && (
                        <button
                          onClick={() => handleCancelCampaign(c)}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border-2 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-300 flex items-center gap-1.5 hover:scale-105 hover:shadow-md"
                          title="Cancelar campanha"
                        >
                          <FiXCircle className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      )}
                      
                      {/* Delete button - only show for DRAFT, CANCELLED, COMPLETED */}
                      {["DRAFT", "CANCELLED", "COMPLETED"].includes(c.status) && (
                        <button
                          onClick={() => handleDeleteCampaign(c)}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300 flex items-center gap-1.5 hover:scale-105 hover:shadow-md"
                          title="Excluir campanha"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {canManageTemplates && (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    {/* Quick activate switch for DRAFT */}
                    {c.status === "DRAFT" && (
                      <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 select-none transition-transform duration-300 hover:scale-105">
                        <span>Ativar</span>
                        <button
                          onClick={() => handleQuickActivate(c)}
                          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors border-2 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                          title="Ativar campanha agora"
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-200 translate-x-0 transition-transform" />
                        </button>
                      </label>
                    )}
                    <button
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 hover:scale-105 hover:shadow-md flex items-center gap-1.5"
                      onClick={() => {
                        setMetricsFor(c);
                        setMetricsOpen(true);
                      }}
                      aria-label={`Ver métricas da campanha ${c.name}`}
                    >
                      <FiBarChart2 className="w-3.5 h-3.5" />
                      Métricas
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 hover:scale-105 hover:shadow-md"
                      onClick={() => openEditor(c)}
                      aria-label={`Editar campanha ${c.name}`}
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>

          <div ref={sentinelRef} className="h-10 w-full flex items-center justify-center col-span-full">
            {loading && <span className="text-xs text-(--color-text-muted) py-2">Carregando…</span>}
          </div>
        </div>

        {editorOpen && (
          <CampaignModalWizard
            apiBase={apiBase}
            campaign={editing}
            templates={templates}
            open={editorOpen}
            onClose={() => setEditorOpen(false)}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        )}

        {wizardOpen && (
          <TemplateWizardModal
            apiBase={apiBase}
            open={wizardOpen}
            editTemplateId={wizardTemplateId || undefined} // se o modal aceitar esse prop, ele editará
            onClose={onWizardClose}
            onCreated={onTemplateCreated}
          />
        )}

          {detailOpen && (
            <TemplateDetailModal
              apiBase={apiBase}
              templateId={detailTemplateId}
              open={detailOpen}
              onClose={() => setDetailOpen(false)}
              onEdit={(id) => {
                setDetailOpen(false);
                setWizardTemplateId(id);
                setWizardOpen(true);
              }}
            />
          )}

          {metricsOpen && metricsFor && (
            <CampaignMetricsModal
              apiBase={apiBase}
              campaign={metricsFor}
              open={metricsOpen}
              onClose={() => {
                setMetricsOpen(false);
                setMetricsFor(null);
              }}
            />
          )}

          {metaSubmitOpen && (
            <MetaTemplateSubmitModal
              apiBase={apiBase}
              open={metaSubmitOpen}
              templateId={metaSubmitTemplateId}
              inboxId={metaSubmitInboxId}
              onClose={() => {
                setMetaSubmitOpen(false);
                setMetaSubmitTemplateId(null);
                setMetaSubmitInboxId(null);
              }}
              onSuccess={onMetaSubmitSuccess}
            />
          )}
      </div>
    </div>
  );
}
