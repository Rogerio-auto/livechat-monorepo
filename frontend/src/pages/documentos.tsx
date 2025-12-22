import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ProposalForm from "../componets/propostas/ProposalForm";
import { toast } from "../hooks/useToast";
import { io } from "socket.io-client";
import { 
  FileText, 
  FileSignature, 
  Receipt, 
  Trash2, 
  Download, 
  Settings, 
  Plus, 
  Search, 
  Filter,
  MoreHorizontal,
  Eye,
  FileDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  DollarSign,
  Files,
  Bot
} from "lucide-react";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

type Proposal = {
  id: string;
  number: string;
  title: string;
  total_value: number;
  status: string | null;
  valid_until?: string | null;
  created_at?: string | null;
  customer_id: string;
  lead_id?: string | null;
  ai_generated?: boolean | null;
};

type DocSummary = {
  id: string;
  customer_id: string;
  proposta_id?: string | null;
  doc_type: 'CONTRACT' | 'RECEIPT';
  has_pdf?: boolean;
  created_at?: string | null;
};

function formatMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export default function DocumentosPage() {
  const [propostas, setPropostas] = useState<Proposal[]>([]);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const location = useLocation() as any;
  const navigate = useNavigate();
  const { docId } = useParams();
  const initialLead = location?.state?.lead ?? null;
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [generatingPdf, setGeneratingPdf] = useState(false); // Loading overlay for PDF generation

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) {
      let msg = "";
      try { const e = await res.json(); msg = e?.error || ""; } catch {}
      throw new Error(msg || `HTTP ${res.status}`);
    }
    // Handle empty/204 responses gracefully
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as unknown as T;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchJson(`${API}/auth/me`);
      const [props, dcs] = await Promise.all([
        fetchJson<Proposal[]>(`${API}/proposals`),
        fetchJson<DocSummary[]>(`${API}/documents`),
      ]);
      setPropostas(Array.isArray(props) ? props : []);
      setDocs(Array.isArray(dcs) ? dcs : []);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const socket = io(API, { withCredentials: true });
    const handler = (_evt: any) => { load(); };
    socket.on("proposals:changed", handler);
    return () => { try { socket.off("proposals:changed", handler); socket.disconnect(); } catch {} };
  }, []);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of propostas) { if (p.status) set.add(String(p.status).toUpperCase()); }
    return Array.from(set).sort();
  }, [propostas]);

  const filteredPropostas = useMemo(() => {
    let arr = propostas as Proposal[];
    
    if (docId) {
      return arr.filter(p => p.id === docId || p.number === docId);
    }

    const term = q.trim().toLowerCase();
    if (term) arr = arr.filter(p => (p.number || "").toLowerCase().includes(term) || (p.title || "").toLowerCase().includes(term));
    if (statusFilter && statusFilter !== "ALL") arr = arr.filter(p => String(p.status || "").toUpperCase() === statusFilter);
    return arr;
  }, [propostas, q, statusFilter, docId]);

  const docsByProposal = useMemo(() => {
    const map = new Map<string, { contract?: DocSummary; receipt?: DocSummary }>();
    for (const d of docs) {
      const key = (d.proposta_id || '').trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, {});
      const slot = map.get(key)!;
      if (d.doc_type === 'CONTRACT') {
        if (!slot.contract || new Date(d.created_at || 0) > new Date(slot.contract.created_at || 0)) slot.contract = d;
      } else if (d.doc_type === 'RECEIPT') {
        if (!slot.receipt || new Date(d.created_at || 0) > new Date(slot.receipt.created_at || 0)) slot.receipt = d;
      }
    }
    return map;
  }, [docs]);

  const onDownloadDoc = (id?: string) => {
    if (!id) return;
    window.location.href = `${API}/documents/${id}/download`;
  };

  const summaryMetrics = useMemo(() => {
    const totalValue = propostas.reduce((acc, p) => acc + (Number(p.total_value) || 0), 0);
    const approvedCount = propostas.filter((p) => {
      const st = String(p.status || "").toUpperCase();
      return st === "ACCEPTED" || st === "APPROVED";
    }).length;
    const sentCount = propostas.filter((p) => {
      const st = String(p.status || "").toUpperCase();
      return st === "SENT" || st === "ISSUED";
    }).length;
    const contractDocs = docs.filter((d) => d.doc_type === "CONTRACT").length;
    const receiptDocs = docs.filter((d) => d.doc_type === "RECEIPT").length;

    return {
      totalProposals: propostas.length,
      approvedCount,
      sentCount,
      totalValue,
      contractDocs,
      receiptDocs,
    };
  }, [propostas, docs]);

  const badgeClass = (s?: string | null) => {
    const st = String(s || "").toUpperCase();
    if (st === "ACCEPTED" || st === "APPROVED") return "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-100 dark:border-green-500/20";
    if (st === "SENT" || st === "ISSUED") return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20";
    if (st === "REJECTED" || st === "CANCELLED") return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-500/20";
    return "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-100 dark:border-gray-700";
  };

  const allowedStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CANCELLED", "APPROVED"];
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  const changeStatus = async (id: string, status: string) => {
    try {
      await fetchJson(`${API}/proposals/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setPropostas(prev => prev.map(p => p.id === id ? { ...p, status } as Proposal : p));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar status");
    }
  };

  const duplicateProposal = async (id: string) => {
    try {
      await fetchJson<{ id: string; number: string }>(`${API}/proposals/${id}/duplicate`, {
        method: "POST",
      });
      await load();
      toast.success("Proposta duplicada com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao duplicar proposta");
    }
  };
  const deleteProposal = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta proposta?")) return;
    try {
      await fetchJson(`${API}/proposals/${id}`, { method: "DELETE" });
      setPropostas(prev => prev.filter(p => p.id !== id));
      toast.success("Proposta excluída com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir proposta");
    }
  };

  // Modal para criar documento (Contrato/Recibo) a partir da proposta
  const [createDoc, setCreateDoc] = useState<null | {
  type: "CONTRACT" | "RECEIPT";
  proposal: Proposal;
  step: "confirm" | "form";
    item_description: string;
    quantity: number;
    unit_price: number;
    discountPct: number;
    receipt?: {
      issuer_name?: string;
      issuer_cpf?: string;
      payer_name?: string;
      payer_cpf?: string;
      payer_rg?: string;
      reference?: string;
      date?: string; // ISO date
      city?: string;
      uf?: string;
    };
  }>(null);

  // Template-based document generation
  const [generateTemplate, setGenerateTemplate] = useState<null | {
    proposal: Proposal;
    templates: any[];
    selectedTemplateId: string;
    convertToPdf: boolean;
    loading: boolean;
    generating: boolean;
  }>(null);

  const saveCreateDoc = async () => {
    if (!createDoc) return;
    try {
      const payload: any = {
        customer_id: createDoc.proposal.customer_id,
        doc_type: createDoc.type,
        item_description: createDoc.item_description,
        quantity: createDoc.quantity,
        unit_price: createDoc.unit_price,
        discountPct: createDoc.discountPct,
        metadata: {
          proposal_id: createDoc.proposal.id,
          receipt: createDoc.receipt,
          formatted: {
            total_brl: (createDoc.quantity * createDoc.unit_price * (1 - Math.max(0, Math.min(100, createDoc.discountPct))/100))
              .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            date_br: (createDoc.receipt?.date ? new Date(createDoc.receipt.date) : new Date()).toLocaleDateString('pt-BR'),
            location: [createDoc.receipt?.city, createDoc.receipt?.uf].filter(Boolean).join('/'),
          }
        },
      };
      await fetchJson(`${API}/documents`, { method: "POST", body: JSON.stringify(payload) });
      setCreateDoc(null);
      load();
      toast.success("Documento criado com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar documento");
    }
  };

  // Open template generation modal and load templates
  const openTemplateGeneration = async (proposal: Proposal, docType: 'PROPOSTA' | 'CONTRATO' | 'RECIBO') => {
    setGenerateTemplate({ proposal, templates: [], selectedTemplateId: '', convertToPdf: true, loading: true, generating: false });
    try {
      const templates = await fetchJson<any[]>(`${API}/document-templates?doc_type=${docType}`);
      setGenerateTemplate(prev => prev ? { ...prev, templates, loading: false } : null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar templates");
      setGenerateTemplate(null);
    }
  };

  // Generate PDF directly without modal (uses default template)
  const generatePdfDirectly = async (proposal: Proposal) => {
    setGeneratingPdf(true);
    try {
      // Load templates for PROPOSTA
      const templates = await fetchJson<any[]>(`${API}/document-templates?doc_type=PROPOSTA`);
      
      if (!templates || templates.length === 0) {
        toast.error("Erro");
        return;
      }

      // Find default template or use first one
      const defaultTemplate = templates.find((t: any) => t.is_default) || templates[0];
      
      // Generate document with PDF conversion
      const result = await fetchJson<{ 
        success: boolean;
        document_id: string;
        download_url: string;
        generated_path: string;
        pdf_download_url?: string;
        pdf_path?: string;
      }>(`${API}/document-templates/${defaultTemplate.id}/generate-document`, {
        method: 'POST',
        body: JSON.stringify({ 
          proposal_id: proposal.id,
          convert_to_pdf: true
        }),
      });

      // Open PDF in new tab
      if (result.pdf_download_url) {
        window.open(result.pdf_download_url, '_blank');
      } else if (result.download_url) {
        window.open(result.download_url, '_blank');
      }

      load(); // Reload list
      toast.error("Erro");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Generate document from template
  const generateFromTemplate = async () => {
    if (!generateTemplate || !generateTemplate.selectedTemplateId) {
      toast.error("Erro");
      return;
    }
    setGenerateTemplate(prev => prev ? { ...prev, generating: true } : null);
    setGeneratingPdf(true);
    try {
      const { proposal, convertToPdf } = generateTemplate;
      
      // Usar rota genérica que detecta o tipo de gerador automaticamente
      const result = await fetchJson<{ 
        success: boolean;
        document_id: string;
        download_url: string;
        generated_path: string;
        pdf_download_url?: string;
        pdf_path?: string;
      }>(`${API}/document-templates/${generateTemplate.selectedTemplateId}/generate-document`, {
        method: 'POST',
        body: JSON.stringify({ 
          proposal_id: proposal.id,
          convert_to_pdf: convertToPdf
        }),
      });

      // Abrir downloads
      if (convertToPdf && result.pdf_download_url) {
        window.open(result.pdf_download_url, '_blank');
        setTimeout(() => {
          if (result.download_url) {
            window.open(result.download_url, '_blank');
          }
        }, 500);
      } else if (result.download_url) {
        window.open(result.download_url, '_blank');
      }
      
      setGenerateTemplate(null);
      const msg = convertToPdf && result.pdf_path 
        ? 'Documento gerado com sucesso! (DOCX + PDF)'
        : 'Documento gerado com sucesso!';
      toast.error("Erro");
      load(); // Recarregar lista
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar documento");
    } finally {
      setGenerateTemplate(prev => prev ? { ...prev, generating: false } : null);
      setGeneratingPdf(false);
    }
  };

  // Prefill company + lead data for receipt when entering form step
  useEffect(() => {
    (async () => {
      if (!createDoc || createDoc.type !== "RECEIPT" || createDoc.step !== "form") return;
      const proposal = createDoc.proposal;
      try {
        // Company (issuer)
        const company = await fetchJson<any>(`${API}/companies/me`);
        // Lead (payer) � if available; fallback to customer contact
        let lead: any = null;
        if (proposal.lead_id) {
          try { lead = await fetchJson<any>(`${API}/leads/${proposal.lead_id}`); } catch {}
        }
        if (!lead) {
          try { lead = await fetchJson<any>(`${API}/leads/by-customer/${proposal.customer_id}`); } catch {}
        }
        let payerName = lead?.name || '';
        let payerCpf = lead?.cpf || '';
        let payerRg = lead?.rg || '';
        if (!payerName) {
          try { const c = await fetchJson<any>(`${API}/livechat/contacts/${proposal.customer_id}`); payerName = c?.name || ''; } catch {}
        }
        setCreateDoc(prev => prev ? {
          ...prev,
          receipt: {
            issuer_name: company?.name || prev.receipt?.issuer_name || '',
            issuer_cpf: company?.cnpj || prev.receipt?.issuer_cpf || '',
            payer_name: payerName || prev.receipt?.payer_name || '',
            payer_cpf: payerCpf || prev.receipt?.payer_cpf || '',
            payer_rg: payerRg || prev.receipt?.payer_rg || '',
            reference: prev.receipt?.reference || '',
            city: company?.city || prev.receipt?.city || '',
            uf: company?.state || prev.receipt?.uf || '',
            date: prev.receipt?.date || new Date().toISOString().slice(0, 10),
          }
        } : prev);
      } catch {}
    })();
  }, [createDoc?.step, createDoc?.type]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-950">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Documentos</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Gerencie propostas, contratos e recibos da sua empresa.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/templates')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm font-medium shadow-sm"
            >
              <Settings size={18} />
              <span>Templates</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all text-sm font-medium shadow-md shadow-blue-500/20"
            >
              <Plus size={18} />
              <span>Nova Proposta</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Total de Propostas */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                <Files size={20} />
              </div>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg">Geral</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summaryMetrics.totalProposals}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total de propostas</p>
            <div className="mt-4 flex items-center gap-3 text-xs">
              <span className="text-gray-400">{summaryMetrics.sentCount} enviadas</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
              <span className="text-green-600 dark:text-green-400 font-medium">{summaryMetrics.approvedCount} aprovadas</span>
            </div>
          </div>

          {/* Valor em Propostas */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-green-50 dark:bg-green-500/10 rounded-xl text-green-600 dark:text-green-400">
                <DollarSign size={20} />
              </div>
              <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-lg">Volume</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(summaryMetrics.totalValue)}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Valor total em aberto</p>
            <div className="mt-4 flex items-center text-xs text-gray-400">
              <ArrowUpRight size={14} className="mr-1 text-green-500" />
              <span>Atualizado em tempo real</span>
            </div>
          </div>

          {/* Contratos Gerados */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400">
                <FileSignature size={20} />
              </div>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider bg-purple-50 dark:bg-purple-500/10 px-2 py-1 rounded-lg">Jurídico</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summaryMetrics.contractDocs}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Contratos gerados</p>
            <div className="mt-4 flex items-center text-xs text-gray-400">
              <CheckCircle2 size={14} className="mr-1 text-purple-500" />
              <span>Prontos para assinatura</span>
            </div>
          </div>

          {/* Recibos Emitidos */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400">
                <Receipt size={20} />
              </div>
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded-lg">Financeiro</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summaryMetrics.receiptDocs}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recibos emitidos</p>
            <div className="mt-4 flex items-center text-xs text-gray-400">
              <Clock size={14} className="mr-1 text-orange-500" />
              <span>Histórico completo</span>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Pesquisar por número, título ou cliente..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-48">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none transition-all"
              >
                <option value="ALL">Todos os status</option>
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando documentos...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-full text-red-600 mb-4">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Erro ao carregar</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs">{error}</p>
              <button onClick={load} className="mt-6 text-blue-600 hover:underline text-sm font-medium">Tentar novamente</button>
            </div>
          ) : filteredPropostas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full text-gray-400 mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nenhum documento encontrado</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Tente ajustar seus filtros ou crie uma nova proposta.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Número</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Título</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Datas</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredPropostas.map((p) => {
                    const rel = docsByProposal.get(p.id) || {} as any;
                    return (
                      <tr key={p.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">#{p.number}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</span>
                            {p.ai_generated && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                                <Bot size={10} /> IA Gerado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(p.total_value)}</span>
                        </td>
                        <td className="px-6 py-4">
                          {editingStatusId === p.id ? (
                            <select
                              autoFocus
                              onBlur={() => setEditingStatusId(null)}
                              className="text-xs rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                              value={String(p.status || "DRAFT").toUpperCase()}
                              onChange={async (e) => { await changeStatus(p.id, e.target.value); setEditingStatusId(null); }}
                            >
                              {allowedStatuses.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingStatusId(p.id)}
                              className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-tight transition-all ${badgeClass(p.status)}`}
                            >
                              {p.status || 'DRAFT'}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                              <Clock size={12} className="opacity-60" />
                              <span>{formatDate(p.created_at)}</span>
                            </div>
                            {p.valid_until && (
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                <AlertCircle size={11} className="opacity-50" />
                                <span>Expira {formatDate(p.valid_until)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openTemplateGeneration(p, 'PROPOSTA')}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                              title="Gerar PDF"
                            >
                              <FileDown size={18} />
                            </button>
                            <button
                              onClick={() => navigate(`/propostas/${p.id}`)}
                              className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
                              title="Visualizar"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => deleteProposal(p.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modais e Overlays */}
      {showNew && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white">Criar Proposta</h3>
              <button 
                onClick={() => setShowNew(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <Plus className="rotate-45" size={20} />
              </button>
            </div>
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <ProposalForm initialLead={initialLead} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
            </div>
          </div>
        </div>
      )}

      {/* Modal para criar documento (Contrato/Recibo) */}
      {createDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {createDoc.type === 'CONTRACT' ? 'Criar Contrato' : 'Criar Recibo'}
              </h3>
              <button 
                onClick={() => setCreateDoc(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <Plus className="rotate-45" size={20} />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {createDoc.step === 'confirm' ? (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                      Deseja criar {createDoc.type === 'CONTRACT' ? 'um Contrato' : 'um Recibo'} a partir da proposta 
                      <span className="font-bold mx-1">#{createDoc.proposal.number} - {createDoc.proposal.title}</span>?
                    </p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setCreateDoc(null)}
                      className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setCreateDoc({ ...createDoc, step: 'form' })}
                      className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all text-sm font-medium shadow-md shadow-blue-500/20"
                    >
                      Avançar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Descrição do item</label>
                      <input 
                        className="w-full rounded-xl px-4 py-2.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                        value={createDoc.item_description} 
                        onChange={e => setCreateDoc({ ...createDoc, item_description: e.target.value })} 
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Quantidade</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl px-4 py-2.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                          value={createDoc.quantity} 
                          onChange={e => setCreateDoc({ ...createDoc, quantity: Number(e.target.value) })} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Valor unitário (R$)</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl px-4 py-2.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                          value={createDoc.unit_price} 
                          onChange={e => setCreateDoc({ ...createDoc, unit_price: Number(e.target.value) })} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Desconto (%)</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl px-4 py-2.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                          value={createDoc.discountPct} 
                          onChange={e => setCreateDoc({ ...createDoc, discountPct: Number(e.target.value) })} 
                        />
                      </div>
                    </div>
                  </div>

                  {createDoc.type === 'RECEIPT' && (
                    <div className="space-y-4 p-5 rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-500/5">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-sm mb-2">
                        <Receipt size={18} />
                        <span>Dados do Recibo</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Emissor (Nome)</label>
                            <input className="w-full rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none" value={createDoc.receipt?.issuer_name || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), issuer_name: e.target.value } })} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">CPF/CNPJ</label>
                            <input className="w-full rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none" value={createDoc.receipt?.issuer_cpf || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), issuer_cpf: e.target.value } })} />
                          </div>
                        </div>
                        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pagador (Nome)</label>
                            <input className="w-full rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none" value={createDoc.receipt?.payer_name || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), payer_name: e.target.value } })} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">CPF</label>
                            <input className="w-full rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none" value={createDoc.receipt?.payer_cpf || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), payer_cpf: e.target.value } })} />
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Referente a</label>
                          <input className="w-full rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none" value={createDoc.receipt?.reference || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), reference: e.target.value } })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Cidade</label>
                            <input className="w-full rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none" value={createDoc.receipt?.city || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), city: e.target.value } })} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Data</label>
                            <input type="date" className="w-full rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none" value={createDoc.receipt?.date || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), date: e.target.value } })} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setCreateDoc(null)}
                      className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm font-medium"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={saveCreateDoc}
                      className="px-8 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all text-sm font-medium shadow-md shadow-blue-500/20"
                    >
                      Salvar Documento
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Template generation modal */}
        {generateTemplate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="font-semibold text-gray-900 dark:text-white">Gerar Documento com Template</h3>
                <button 
                  onClick={() => setGenerateTemplate(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <Plus className="rotate-45" size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[80vh] overflow-y-auto">
                {generateTemplate.loading ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando templates...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Proposta Selecionada</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">#{generateTemplate.proposal.number}</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{generateTemplate.proposal.title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{formatMoney(generateTemplate.proposal.total_value)}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Selecione um Template</label>
                      {generateTemplate.templates.length === 0 ? (
                        <div className="p-8 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-center">
                          <FileText className="mx-auto text-gray-300 dark:text-gray-700 mb-3" size={32} />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum template disponível para este tipo.</p>
                          <button 
                            onClick={() => navigate('/templates')}
                            className="mt-4 text-blue-600 hover:underline text-sm font-medium"
                          >
                            Criar meu primeiro template
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {generateTemplate.templates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => setGenerateTemplate(prev => prev ? { ...prev, selectedTemplateId: template.id } : null)}
                              className={`w-full p-4 rounded-xl border text-left transition-all group ${
                                generateTemplate.selectedTemplateId === template.id
                                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 ring-1 ring-blue-500'
                                  : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-blue-300 dark:hover:border-blue-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-semibold text-gray-900 dark:text-white">{template.name}</h5>
                                    {template.is_default && (
                                      <span className="text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">Padrão</span>
                                    )}
                                  </div>
                                  {template.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{template.description}</p>
                                  )}
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  generateTemplate.selectedTemplateId === template.id
                                    ? 'border-blue-600 bg-blue-600'
                                    : 'border-gray-200 dark:border-gray-700'
                                }`}>
                                  {generateTemplate.selectedTemplateId === template.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Checkbox para converter em PDF */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
                      <input 
                        type="checkbox"
                        id="convertToPdf"
                        checked={generateTemplate.convertToPdf}
                        onChange={(e) => setGenerateTemplate(prev => prev ? { ...prev, convertToPdf: e.target.checked } : null)}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="convertToPdf" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                        <span className="font-medium">Gerar PDF automaticamente</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">Além do DOCX, também será gerado um arquivo PDF</span>
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        onClick={() => setGenerateTemplate(null)}
                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm font-medium"
                      >
                        Cancelar
                      </button>
                      <button 
                        disabled={!generateTemplate.selectedTemplateId || generateTemplate.generating}
                        onClick={generateFromTemplate}
                        className="px-8 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all text-sm font-medium shadow-md shadow-blue-500/20 flex items-center gap-2"
                      >
                        {generateTemplate.generating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <span>Gerando...</span>
                          </>
                        ) : (
                          <>
                            <FileDown size={18} />
                            <span>Gerar Documento</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Loading Overlay for PDF Generation */}
      {generatingPdf && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-900 dark:text-white font-medium">Gerando documento...</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Isso pode levar alguns segundos.</p>
            <div className="flex items-center justify-center gap-1 pt-4">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}











