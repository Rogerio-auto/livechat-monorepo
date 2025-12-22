import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FiMessageSquare, FiImage, FiVideo, FiFile, FiCreditCard, FiFolder, FiCheckCircle, FiX, FiUsers, FiCheck, FiPlay } from "react-icons/fi";
import MediaLibraryModal from "./MediaLibraryModal";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import MetaHeaderBuilder from "./MetaHeaderBuilder";
import MetaBodyBuilder from "./MetaBodyBuilder";
import MetaButtonsBuilder from "./MetaButtonsBuilder";
import MetaTemplatePreview from "./MetaTemplatePreview";
import type { HeaderComponent, BodyComponent, ButtonComponent } from "./MetaTemplateTypes";

type InboxWithStats = {
  id: string;
  name?: string;
  provider?: string;
  phone_number?: string;
  stats?: {
    total_contacts: number;
    active_contacts: number;
  };
};

export type TemplateDraft = {
  id?: string;
  inbox_id?: string | null;
  kind: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "BUTTONS" | "PAYMENT" | "MEDIA_TEXT";
  name: string;
  payload: any;
};

type Props = {
  apiBase: string;
  open: boolean;
  editTemplateId?: string;
  onClose: () => void;
  onCreated?: (tplId: string) => void;
};

const wahaSteps = [
  { id: 1, label: "Inbox" },
  { id: 2, label: "Tipo" },
  { id: 3, label: "Conteúdo" },
  { id: 4, label: "Preview" },
  { id: 5, label: "Resumo" },
];

const metaSteps = [
  { id: 1, label: "Inbox" },
  { id: 2, label: "Categoria" },
  { id: 3, label: "Cabeçalho" },
  { id: 4, label: "Corpo" },
  { id: 5, label: "Botões" },
  { id: 6, label: "Preview" },
  { id: 7, label: "Resumo" },
];

// Mapeamento de tipos com tradução e ícones
const messageTypes = [
  { key: "TEXT", label: "Texto", icon: FiMessageSquare, description: "Apenas mensagem de texto", requiresOfficialAPI: false },
  { key: "MEDIA_TEXT", label: "Mídia + Texto", icon: FiImage, description: "Imagem/vídeo/documento com texto", requiresOfficialAPI: false },
  { key: "BUTTONS", label: "Botões", icon: FiCreditCard, description: "Mensagem com botões de ação", requiresOfficialAPI: true },
  { key: "PAYMENT", label: "Pagamento", icon: FiCreditCard, description: "Solicitação de pagamento", requiresOfficialAPI: true },
] as const;

export default function TemplateWizardModal({ apiBase, open, editTemplateId, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingInboxes, setLoadingInboxes] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inboxes, setInboxes] = useState<InboxWithStats[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState<string>("");
  const [kind, setKind] = useState<TemplateDraft["kind"]>("TEXT");
  const [name, setName] = useState<string>("");
  const [content, setContent] = useState<any>({ text: "", mediaUrl: "", buttons: [] });
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaSelectionContext, setMediaSelectionContext] = useState<'header' | 'waha' | null>(null);

  // Meta template states
  const [metaHeader, setMetaHeader] = useState<HeaderComponent | undefined>(undefined);
  const [metaBody, setMetaBody] = useState<BodyComponent>({ text: '' });
  const [metaFooter, setMetaFooter] = useState<string>('');
  const [metaButtons, setMetaButtons] = useState<ButtonComponent[]>([]);
  const [metaLanguage, setMetaLanguage] = useState('pt_BR');

  const selectedInbox = useMemo(() => inboxes.find((i) => i.id === selectedInboxId) || null, [inboxes, selectedInboxId]);
  const isOfficialAPI = useMemo(() => selectedInbox?.provider?.toUpperCase().includes("META") && !selectedInbox?.provider?.toUpperCase().includes("WAHA"), [selectedInbox]);

  // Selecionar steps baseado no provider
  const steps = useMemo(() => isOfficialAPI ? metaSteps : wahaSteps, [isOfficialAPI]);
  const totalSteps = steps.length;

  // Filtrar tipos disponíveis baseado na inbox selecionada
  const availableTypes = useMemo(() => {
    return messageTypes.filter(t => !t.requiresOfficialAPI || isOfficialAPI);
  }, [isOfficialAPI]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setError(null);
      setSaving(false);
      setLoadingTemplate(false);
      return;
    }

    setLoadingInboxes(true);
    // Usa o novo endpoint com estatísticas
    fetch(`${apiBase}/livechat/inboxes/stats`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => setInboxes(Array.isArray(data) ? data : []))
      .catch(() => setInboxes([]))
      .finally(() => setLoadingInboxes(false));

    if (editTemplateId) {
      setLoadingTemplate(true);
      fetch(`${apiBase}/livechat/campaigns/templates/${encodeURIComponent(editTemplateId)}/preview`, { credentials: "include" })
        .then((r) => { if (!r.ok) return Promise.reject(r.statusText); return r.json(); })
        .then((tpl) => {
          if (!tpl) throw new Error("Template não encontrado");
          setTemplateId(tpl.id || editTemplateId);
          setName(tpl.name || "");
          const originalKind = tpl.payload?._meta?.original_kind;
          const displayKind = originalKind || tpl.kind || "TEXT";
          setKind(displayKind as TemplateDraft["kind"]);
          setSelectedInboxId(tpl.inbox_id || "");
          setContent(tpl.payload || { text: "", mediaUrl: "", buttons: [] });
        })
        .catch((err) => { console.warn("Falha ao carregar template para edição", err); setError("Não foi possível carregar o template para edição."); })
        .finally(() => setLoadingTemplate(false));
    } else {
      setTemplateId(null);
      setSelectedInboxId("");
      setKind("TEXT");
      setName("");
      setContent({ text: "", mediaUrl: "", buttons: [] });
    }
  }, [apiBase, open, editTemplateId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && open) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const next = useCallback(() => {
    setError(null);
    
    // Step 1: Inbox (ambos)
    if (step === 1 && !selectedInboxId) { 
      setError("Selecione uma inbox"); 
      return; 
    }
    
    // Step 2: Categoria/Tipo
    if (step === 2) {
      if (isOfficialAPI) {
        if (!content.metaCategory) { setError("Selecione uma categoria"); return; }
      } else {
        if (!kind) { setError("Selecione o tipo de mensagem"); return; }
      }
    }
    
    if (isOfficialAPI) {
      // Meta: Step 3 (Nome + Idioma + Header)
      if (step === 3) {
        if (!name || name.trim().length === 0) { 
          setError("Preencha o nome do template"); 
          return; 
        }
        // Header é opcional, pode avançar
      }
      
      // Meta: Step 4 (Body + Footer)
      if (step === 4) {
        if (!metaBody.text || metaBody.text.trim().length === 0) { 
          setError("Preencha o corpo da mensagem"); 
          return; 
        }
        if (metaBody.text.trim().length > 1024) { 
          setError("Corpo muito longo (máx 1024 caracteres)"); 
          return; 
        }
        // Footer é opcional
      }
      
      // Meta: Step 5 (Buttons) - opcional, pode pular
      // Meta: Step 6 (Preview) - sem validação
      // Meta: Step 7 (Resumo) - sem validação
    } else {
      // WAHA: Step 3 (Conteúdo)
      if (step === 3) {
        if (kind === "TEXT" || kind === "MEDIA_TEXT") {
          if (!content.text || content.text.trim().length === 0) { 
            setError("Preencha o texto"); 
            return; 
          }
          if (content.text.trim().length > 4096) { 
            setError("Texto muito longo (máx 4096 caracteres)"); 
            return; 
          }
        }
        if (kind === "MEDIA_TEXT") {
          if (!content.mediaUrl || content.mediaUrl.trim().length === 0) { 
            setError("Informe uma mídia"); 
            return; 
          }
          try { 
            new URL(content.mediaUrl); 
          } catch { 
            setError("URL de mídia inválida"); 
            return; 
          }
        }
        if (kind === "BUTTONS") {
          if (!content.text || content.text.trim().length === 0) { 
            setError("Preencha o texto para o botão"); 
            return; 
          }
          if (!content.buttons || content.buttons.length === 0) { 
            setError("Adicione pelo menos um botão"); 
            return; 
          }
          const btn = content.buttons[0];
          if (!btn.label || btn.label.trim().length === 0) { 
            setError("Informe o rótulo do botão"); 
            return; 
          }
          if (!btn.url || btn.url.trim().length === 0) { 
            setError("Informe a URL do botão"); 
            return; 
          }
          try { 
            new URL(btn.url); 
          } catch { 
            setError("URL do botão inválida"); 
            return; 
          }
        }
      }
      // WAHA: Step 4 (Preview) - sem validação
      // WAHA: Step 5 (Resumo) - sem validação
    }
    
    setStep((s) => Math.min(totalSteps, s + 1));
  }, [step, selectedInboxId, kind, content, isOfficialAPI, metaBody, name, totalSteps]);

  const prev = useCallback(() => { setError(null); setStep((s) => Math.max(1, s - 1)); }, []);

  async function saveDraft(): Promise<string> {
    setSaving(true); setError(null);
    try {
      // Limpa o payload removendo campos vazios (buttons vazio causa erro na trigger)
      const cleanPayload = { ...content };
      if (Array.isArray(cleanPayload.buttons) && cleanPayload.buttons.length === 0) {
        delete cleanPayload.buttons;
      }
      const body = { name: name && name.trim().length > 0 ? name.trim() : `Template ${new Date().toLocaleString()}`, kind, payload: cleanPayload, inboxId: selectedInboxId || null };
      if (templateId) {
        const res = await fetch(`${apiBase}/livechat/campaigns/templates/${encodeURIComponent(templateId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
        if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(txt || `HTTP ${res.status}`); }
        await res.json().catch(() => null); onCreated?.(templateId); return templateId;
      } else {
        const res = await fetch(`${apiBase}/livechat/campaigns/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
        if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(txt || `HTTP ${res.status}`); }
        const data = await res.json(); const id = data?.id || data?.template?.id; if (!id) throw new Error("Falha ao criar rascunho de template"); setTemplateId(id); onCreated?.(id); return id;
      }
    } catch (e: any) { setError(e?.message || "Falha ao salvar rascunho"); throw e; } finally { setSaving(false); }
  }

  async function ensureDraft(): Promise<string> { if (templateId) return templateId; return saveDraft(); }

  async function doPreview() {
    setPreviewLoading(true); setError(null);
    try {
      const id = await ensureDraft();
      const res = await fetch(`${apiBase}/livechat/campaigns/templates/${encodeURIComponent(id)}/preview`, { method: "GET", credentials: "include" });
      if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(txt || `HTTP ${res.status}`); }
      const data = await res.json(); setPreviewData(data);
    } catch (e: any) { setError(e?.message || "Falha ao gerar preview"); setPreviewData(null); } finally { setPreviewLoading(false); }
  }

  async function finish() { 
    setError(null); 
    setSaving(true);
    try { 
      if (isOfficialAPI) {
        // Submit to Meta API
        await submitMetaTemplate();
      } else {
        // Save as WAHA draft
        await saveDraft();
      }
      onClose(); 
    } catch (e: any) {
      setError(e?.message || "Falha ao salvar template");
    } finally {
      setSaving(false);
    }
  }

  const handleOpenMediaLibrary = (context: 'header' | 'waha', headerType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT') => {
    console.log('[MediaLibrary] Opening with context:', context, 'headerType:', headerType);
    setMediaSelectionContext(context);
    setMediaLibraryOpen(true);
  };

  const handleMediaSelected = (media: any) => {
    console.log('[MediaLibrary] Media selected:', media, 'context:', mediaSelectionContext);
    console.log('[MediaLibrary] Current metaHeader:', metaHeader);
    console.log('[MediaLibrary] Current content:', content);
    
    if (mediaSelectionContext === 'header') {
      // Meta header media
      if (metaHeader && metaHeader.type !== 'TEXT') {
        const newHeader = {
          ...metaHeader,
          example: { header_handle: [media.public_url] }
        };
        console.log('[MediaLibrary] Setting Meta header:', newHeader);
        setMetaHeader(newHeader);
      }
    } else {
      // WAHA media
      const newContent = { 
        ...content, 
        mediaUrl: media.public_url,
        mimeType: media.content_type,
        mediaType: media.media_type,
        filename: media.filename,
      };
      console.log('[MediaLibrary] Setting WAHA content:', newContent);
      setContent(newContent);
    }
    setMediaLibraryOpen(false);
    setMediaSelectionContext(null);
  };

  async function submitMetaTemplate() {
    try {
      // Convert to Meta API format
      const components: any[] = [];

      // Add header
      if (metaHeader) {
        const headerComp: any = { type: 'header' };
        if (metaHeader.type === 'TEXT') {
          headerComp.format = 'text';
          headerComp.text = metaHeader.text;
        } else {
          // IMAGE, VIDEO, or DOCUMENT
          headerComp.format = metaHeader.type.toLowerCase();
          
          // Para headers de mídia, precisamos fazer upload usando Resumable Upload API
          if (metaHeader.example?.header_handle?.[0]) {
            console.log('[Meta Template] Uploading media to Meta...');
            const uploadResponse = await fetch(`${apiBase}/api/meta/templates/upload-media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                inboxId: selectedInboxId,
                mediaUrl: metaHeader.example.header_handle[0]
              })
            });

            if (!uploadResponse.ok) {
              const txt = await uploadResponse.text().catch(() => "");
              throw new Error(`Falha ao fazer upload da mídia: ${txt}`);
            }

            const uploadData = await uploadResponse.json();
            console.log('[Meta Template] Media uploaded, handle:', uploadData.handle);
            
            // Usa o handle retornado pela Resumable Upload API
            headerComp.example = {
              header_handle: [uploadData.handle]
            };
          } else {
            throw new Error('Header de mídia requer uma imagem/vídeo/documento selecionado');
          }
        }
        components.push(headerComp);
      }

      // Add body
      const bodyComp: any = {
        type: 'body',
        text: metaBody.text,
      };
      
      // Se houver exemplos de variáveis, adiciona no formato correto da Meta
      if (metaBody.examples && metaBody.examples.length > 0) {
        bodyComp.example = {
          body_text: metaBody.examples
        };
      }
      
      components.push(bodyComp);

      // Add footer
      if (metaFooter) {
        components.push({
          type: 'footer',
          text: metaFooter
        });
      }

      // Add buttons
      if (metaButtons && metaButtons.length > 0) {
        components.push({
          type: 'buttons',
          buttons: metaButtons.map(btn => {
            if (btn.type === 'QUICK_REPLY') {
              return { type: 'quick_reply', text: btn.text };
            } else if (btn.type === 'PHONE_NUMBER') {
              return { type: 'phone_number', text: btn.text, phone_number: btn.phone_number };
            } else if (btn.type === 'URL') {
              return { 
                type: 'url', 
                text: btn.text, 
                url: btn.url,
                ...(btn.example && { example: btn.example })
              };
            } else if (btn.type === 'COPY_CODE') {
              return { 
                type: 'copy_code', 
                example: btn.example 
              };
            }
            return btn;
          })
        });
      }

      const payload = {
        inboxId: selectedInboxId,
        name: name,
        category: content.metaCategory,
        language: metaLanguage,
        components
      };
      
      console.log('[Meta Template] Submitting payload:', JSON.stringify(payload, null, 2));

      // Create template via Meta API
      const response = await fetch(`${apiBase}/api/meta/templates/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        console.error('[Meta Template] Error response:', txt);
        throw new Error(txt || `HTTP ${response.status}`);
      }

      const data = await response.json();
      onCreated?.(data.id || name);
    } catch (e: any) {
      throw new Error(e?.message || 'Erro ao criar template Meta');
    }
  }

  const renderWahaMediaPreview = () => {
    if (!content.mediaUrl) return null;
    
    const url = content.mediaUrl;
    const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i) || content.mediaUrl.includes('video');
    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || !isVideo;

    if (isVideo) {
      return (
        <video
          src={url}
          controls
          className="w-full max-h-48 rounded-xl object-contain bg-black/5"
        />
      );
    }

    if (isImage) {
      return (
        <img
          src={url}
          alt="Preview"
          className="w-full max-h-48 rounded-xl object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }

    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-(--color-bg) rounded-xl border border-(--color-border)">
        <FiFile className="w-5 h-5 text-(--color-text-muted)" />
        <span className="text-sm text-(--color-heading) truncate">{url}</span>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-[920px] max-w-[95vw] max-h-[90vh] flex flex-col">
        <Card gradient className="relative flex flex-col h-full">
          {/* Header */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            {(loadingInboxes || loadingTemplate) && <span className="text-xs text-gray-500">Carregando…</span>}
            <Button aria-label="Fechar" size="sm" variant="ghost" onClick={onClose}><FiX className="w-4 h-4" /></Button>
          </div>
          <CardHeader title={templateId || editTemplateId ? "Editar Template" : "Novo Template"} subtitle={steps.find(s => s.id === step)?.label} icon={<FiFolder className="w-5 h-5" />} iconColor="indigo" />

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            {steps.map(s => (
              <button key={s.id} onClick={() => s.id < step ? setStep(s.id) : null} className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all ${s.id === step ? "bg-blue-600 text-white border-blue-600" : s.id < step ? "border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" : "border-gray-300 text-gray-600"}`} disabled={s.id > step}> 
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${s.id === step ? "bg-white/20" : s.id < step ? "bg-blue-50 dark:bg-blue-900/40" : "bg-gray-100"}`}>{s.id}</span>
                <span className="hidden md:inline">{s.label}</span>
                {s.id < step && <FiCheckCircle className="w-4 h-4" />}
              </button>
            ))}
          </div>

          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-2 rounded-xl">{error}</div>}

          {/* Content - Scrollable */}
          <div className="space-y-8 overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 280px)' }}>
            {/* STEP 1: Inbox Selection as Blocks */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">Selecione a caixa de entrada onde o template será usado</p>
                {loadingInboxes ? (
                  <div className="text-center py-8 text-gray-500">Carregando inboxes...</div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {inboxes.map((inbox) => {
                      const isSelected = selectedInboxId === inbox.id;
                      const isOfficial = inbox.provider?.toUpperCase().includes("META") && !inbox.provider?.toUpperCase().includes("WAHA");
                      
                      return (
                        <button
                          key={inbox.id}
                          onClick={() => !editTemplateId && setSelectedInboxId(inbox.id)}
                          disabled={!!editTemplateId}
                          className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                              : "border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:shadow-md"
                          } ${editTemplateId ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                              <FiCheck className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                {inbox.name?.[0]?.toUpperCase() || "I"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 dark:text-white truncate">{inbox.name || inbox.id}</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{inbox.phone_number || "Sem número"}</p>
                              </div>
                            </div>
                            
                            {isOfficial && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                                <FiCheckCircle className="w-3 h-3" />
                                API Oficial Meta
                              </span>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                              <div className="flex items-center gap-1.5">
                                <FiUsers className="w-4 h-4" />
                                <span>{inbox.stats?.total_contacts || 0} contatos</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span>{inbox.stats?.active_contacts || 0} ativos</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {editTemplateId && (
                  <p className="text-xs text-gray-500 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-2">
                    <strong>Atenção:</strong> Inbox bloqueada durante edição. Alterar a inbox pode invalidar aprovações do Meta.
                  </p>
                )}
              </div>
            )}

            {/* STEP 2: Message Type */}
            {step === 2 && (
              <div className="space-y-4">
                {isOfficialAPI ? (
                  // Meta Cloud API - Mostrar categorias de template
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Escolha a categoria do template Meta</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {['MARKETING', 'UTILITY', 'AUTHENTICATION'].map((category) => {
                        const isSelected = content.metaCategory === category;
                        return (
                          <button
                            key={category}
                            onClick={() => setContent({ ...content, metaCategory: category })}
                            className={`group relative text-left p-4 rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                                : "border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:shadow-md"
                            }`}
                          >
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900 dark:text-white">{category}</h4>
                                {isSelected && (
                                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                                    <FiCheck className="w-4 h-4 text-white" />
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {category === 'MARKETING' && 'Promoções, ofertas e anúncios'}
                                {category === 'UTILITY' && 'Notificações, confirmações e alertas'}
                                {category === 'AUTHENTICATION' && 'Códigos de verificação (OTP)'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2">
                      <strong>API Oficial Meta:</strong> Templates precisam ser aprovados pela Meta antes do uso.
                    </p>
                  </>
                ) : (
                  // WAHA - Manter fluxo original
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Escolha o tipo de mensagem que deseja criar</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {availableTypes.map((type) => {
                        const Icon = type.icon;
                        const isSelected = kind === type.key;
                        
                        return (
                          <button
                            key={type.key}
                            onClick={() => setKind(type.key as any)}
                            className={`group relative text-left p-4 rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                                : "border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:shadow-md"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40"
                              }`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white">{type.label}</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{type.description}</p>
                              </div>
                              {isSelected && (
                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                                  <FiCheck className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STEP 3: Meta = Nome + Idioma + Header | WAHA = Conteúdo */}
            {step === 3 && (
              <div className="space-y-6">
                {isOfficialAPI ? (
                  // Meta: Step 3 - Informações Básicas + Cabeçalho
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>📝 Informações Básicas:</strong> Configure o nome e idioma do template. O cabeçalho é opcional e pode conter texto ou mídia (imagem, vídeo ou documento).
                      </p>
                    </div>

                    <Input 
                      label="Nome do template" 
                      placeholder="Ex: promo_outubro" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      helperText="Use letras minúsculas e underscores. Ex: boas_vindas, oferta_especial"
                    />
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Idioma</label>
                      <select
                        value={metaLanguage}
                        onChange={(e) => setMetaLanguage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="pt_BR">Português (Brasil)</option>
                        <option value="en_US">English (US)</option>
                        <option value="es">Español</option>
                      </select>
                      <p className="text-xs text-gray-500">Idioma da mensagem que será enviada aos contatos</p>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Cabeçalho (Opcional)</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                        Adicione um cabeçalho para destacar sua mensagem. Pode ser um texto curto ou uma mídia (imagem, vídeo ou documento).
                      </p>
                      <MetaHeaderBuilder 
                        header={metaHeader} 
                        onChange={setMetaHeader}
                        onOpenMediaLibrary={(type) => handleOpenMediaLibrary('header', type)}
                      />
                    </div>
                  </>
                ) : (
                  // WAHA - Conteúdo completo
                  <>
                    <Input label="Nome do template (opcional)" placeholder="Ex: Promo Outubro" value={name} onChange={(e) => setName(e.target.value)} />
                    {(kind === "TEXT" || kind === "MEDIA_TEXT") && (
                      <Textarea label="Mensagem" placeholder="Use {{nome}} como placeholder para personalizar" value={content.text || ""} onChange={(e) => setContent({ ...content, text: e.target.value })} maxLength={4096} helperText={`${(content.text || "").length} / 4096 caracteres`} />
                    )}
                    {kind === "MEDIA_TEXT" && (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mídia (Imagem, Vídeo ou Documento)</label>
                        {content.mediaUrl ? (
                          <div className="space-y-3">
                            {renderWahaMediaPreview()}
                            <div className="flex gap-2">
                              <Button variant="secondary" size="sm" onClick={() => handleOpenMediaLibrary('waha')}><FiFolder className="w-4 h-4 mr-1" />Trocar mídia</Button>
                              <Button variant="ghost" size="sm" onClick={() => setContent({ ...content, mediaUrl: "" })}><FiX className="w-4 h-4 mr-1" />Remover</Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="secondary" fullWidth onClick={() => handleOpenMediaLibrary('waha')}>
                            <FiFolder className="w-4 h-4 mr-2" />
                            Selecionar da Galeria
                          </Button>
                        )}
                      </div>
                    )}
                    {kind === "BUTTONS" && (
                      <div className="space-y-4">
                        <Input label="Texto da mensagem" value={content.text || ""} onChange={(e) => setContent({ ...content, text: e.target.value })} />
                        <Input label="Texto do botão" placeholder="Ex: Ver oferta" value={content.buttons?.[0]?.label || ""} onChange={(e) => setContent({ ...content, buttons: [{ type: "url", label: e.target.value, url: content.buttons?.[0]?.url || "" }] })} />
                        <Input label="URL de destino" placeholder="https://..." value={content.buttons?.[0]?.url || ""} onChange={(e) => setContent({ ...content, buttons: [{ type: "url", label: content.buttons?.[0]?.label || "", url: e.target.value }] })} />
                      </div>
                    )}
                    {kind === "PAYMENT" && <p className="text-sm text-gray-500">Configuração de cobrança será integrada ao gateway de pagamento (em breve).</p>}
                  </>
                )}
              </div>
            )}

            {/* STEP 4: Meta = Body + Footer | WAHA = Preview */}
            {step === 4 && (
              <div className="space-y-6">
                {isOfficialAPI ? (
                  // Meta: Step 4 - Corpo e Rodapé
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>💬 Corpo da Mensagem:</strong> Conteúdo principal do template. Use variáveis como {`{{1}}`}, {`{{2}}`} para personalizar. O rodapé é opcional e aparece em texto pequeno no fim da mensagem.
                      </p>
                    </div>

                    <MetaBodyBuilder body={metaBody} onChange={setMetaBody} />
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Rodapé (Opcional)</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                        Texto curto exibido no fim da mensagem. Ideal para informações legais, links ou créditos.
                      </p>
                      <Input
                        placeholder="Ex: © 2024 Sua Empresa"
                        value={metaFooter}
                        onChange={(e) => setMetaFooter(e.target.value)}
                        maxLength={60}
                      />
                      <p className="text-xs text-gray-500 mt-1">{metaFooter.length} / 60 caracteres</p>
                    </div>
                  </>
                ) : (
                  // WAHA: Preview
                  <>
                    {!previewData && (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <Button size="md" onClick={doPreview} disabled={saving || loadingTemplate || previewLoading} variant="primary">
                          {previewLoading ? "Gerando..." : "Gerar Pré-visualização"}
                        </Button>
                        <p className="text-xs text-gray-500 text-center max-w-md">
                          A pré-visualização usa o rascunho salvo. Se ainda não existir, será criado automaticamente.
                        </p>
                      </div>
                    )}
                    {previewData && (
                      <div className="space-y-3">
                        <Card gradient={false} className="p-6 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                          <div className="flex items-start gap-4">
                            <div className="mt-1 text-blue-600 dark:text-blue-400">
                              {kind === "TEXT" && <FiMessageSquare className="w-6 h-6" />}
                              {kind === "MEDIA_TEXT" && <FiImage className="w-6 h-6" />}
                              {kind === "BUTTONS" && <FiCreditCard className="w-6 h-6" />}
                              {kind === "PAYMENT" && <FiCreditCard className="w-6 h-6" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-3">
                              {(previewData.text || content.text) && (
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                  {previewData.text || content.text}
                                </p>
                              )}
                              {(previewData.mediaUrl || content.mediaUrl) && (
                                <div className="rounded-xl overflow-hidden">
                                  {renderWahaMediaPreview()}
                                </div>
                              )}
                              {(previewData.buttons || content.buttons)?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {(previewData.buttons || content.buttons).map((btn: any, idx: number) => (
                                    <span key={idx} className="inline-flex items-center gap-1 text-xs px-4 py-2 rounded-full border-2 border-blue-600 text-blue-700 dark:text-blue-300 font-medium">
                                      {btn.label || "Botão"}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                        <Button size="sm" variant="ghost" onClick={() => setPreviewData(null)}>Atualizar pré-visualização</Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* STEP 5: Meta = Buttons | WAHA = Resumo */}
            {step === 5 && (
              <div className="space-y-6">
                {isOfficialAPI ? (
                  // Meta: Step 5 - Botões
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>🔘 Botões Interativos (Opcional):</strong> Adicione botões de ação rápida, links, telefone ou código de cópia. Disponibilidade varia por categoria do template.
                      </p>
                    </div>

                    <MetaButtonsBuilder
                      buttons={metaButtons}
                      onChange={setMetaButtons}
                      category={content.metaCategory}
                    />
                  </>
                ) : (
                  // WAHA: Resumo
                  <div className="space-y-4">
                    <Card gradient={false} className="p-5 bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 rounded-xl">
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-gray-500">Nome</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{name || `Template ${new Date().toLocaleString()}`}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-gray-500">Inbox</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{selectedInbox?.name || selectedInboxId || "Nenhuma"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-gray-500">Tipo</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{messageTypes.find(t => t.key === kind)?.label || kind}</p>
                        </div>
                        {content.mediaUrl && (
                          <div className="space-y-1">
                            <p className="text-gray-500">Mídia</p>
                            <div className="mt-2">
                              {renderWahaMediaPreview()}
                            </div>
                          </div>
                        )}
                      </div>
                      {content.text && (
                        <div className="mt-4 space-y-1">
                          <p className="text-gray-500">Texto</p>
                          <p className="text-xs bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3 max-h-32 overflow-auto text-gray-700 dark:text-gray-300">{content.text.slice(0, 400)}{content.text.length > 400 && "..."}</p>
                        </div>
                      )}
                      {content.buttons && content.buttons.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-gray-500">Botões</p>
                          <div className="flex flex-wrap gap-2">
                            {content.buttons.map((btn: any, idx: number) => (
                              <span key={idx} className="text-xs px-3 py-1.5 rounded-full border border-blue-600 text-blue-700 dark:text-blue-300">{btn.label} → {btn.url}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                    <p className="text-xs text-gray-500 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2">
                      💡 Template será salvo como rascunho. Você pode editar e usar posteriormente em campanhas.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 6: Meta = Preview | WAHA = não existe (já terminou) */}
            {step === 6 && isOfficialAPI && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>👀 Pré-visualização:</strong> Veja como sua mensagem aparecerá no WhatsApp antes de enviar para aprovação da Meta.
                  </p>
                </div>
                <MetaTemplatePreview
                  header={metaHeader}
                  body={metaBody}
                  footer={metaFooter}
                  buttons={metaButtons}
                />
              </div>
            )}

            {/* STEP 7: Meta = Resumo | WAHA = não existe */}
            {step === 7 && isOfficialAPI && (
              <div className="space-y-4">
                <Card gradient={false} className="p-5 bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 rounded-xl">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-gray-500">Nome</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500">Inbox</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{selectedInbox?.name || selectedInboxId}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500">Categoria</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{content.metaCategory}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500">Idioma</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{metaLanguage === 'pt_BR' ? 'Português (Brasil)' : metaLanguage === 'en_US' ? 'English (US)' : 'Español'}</p>
                    </div>
                  </div>
                  {metaHeader && (
                    <div className="mt-4 space-y-1">
                      <p className="text-gray-500">Cabeçalho</p>
                      <p className="text-xs bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-700 dark:text-gray-300">
                        {metaHeader.type === 'TEXT' ? metaHeader.text : `${metaHeader.type} (mídia)`}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 space-y-1">
                    <p className="text-gray-500">Corpo</p>
                    <p className="text-xs bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3 max-h-32 overflow-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {metaBody.text}
                    </p>
                  </div>
                  {metaFooter && (
                    <div className="mt-4 space-y-1">
                      <p className="text-gray-500">Rodapé</p>
                      <p className="text-xs bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-700 dark:text-gray-300">{metaFooter}</p>
                    </div>
                  )}
                  {metaButtons.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-gray-500">Botões</p>
                      <div className="flex flex-wrap gap-2">
                        {metaButtons.map((btn, idx) => (
                          <span key={idx} className="text-xs px-3 py-1.5 rounded-full border border-blue-600 text-blue-700 dark:text-blue-300">
                            {btn.type}: {btn.text || 'Código'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
                <p className="text-xs text-gray-500 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2">
                  <strong>✅ Próximo passo:</strong> Após salvar, o template será enviado para aprovação da Meta. Você poderá acompanhar o status no painel de templates.
                </p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="mt-10 flex items-center justify-between">
            <p className="text-xs text-gray-500">Etapa {step} de {steps.length}</p>
            <div className="flex items-center gap-2">
              {step > 1 && <Button size="sm" variant="secondary" onClick={prev}>Voltar</Button>}
              {step < steps.length && <Button size="sm" variant="primary" onClick={next}>Avançar</Button>}
              {step === steps.length && <Button size="sm" variant="gradient" disabled={saving} onClick={finish}>{saving ? "Salvando..." : "Salvar Template"}</Button>}
            </div>
          </div>
        </Card>
      </div>

      <MediaLibraryModal
        apiBase={apiBase}
        open={mediaLibraryOpen}
        onClose={() => {
          setMediaLibraryOpen(false);
          setMediaSelectionContext(null);
        }}
        onSelect={handleMediaSelected}
        selectionMode={true}
        mediaType={kind === "MEDIA_TEXT" ? undefined : undefined}
      />
    </div>
  );
}

