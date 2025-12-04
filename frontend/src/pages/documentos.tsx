import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProposalForm from "../componets/propostas/ProposalForm";

import { io } from "socket.io-client";
import { FaFileAlt, FaFileSignature, FaReceipt, FaTrash, FaFileDownload, FaCog } from "react-icons/fa";

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
  const initialLead = location?.state?.lead ?? null;
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

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
    const term = q.trim().toLowerCase();
    if (term) arr = arr.filter(p => (p.number || "").toLowerCase().includes(term) || (p.title || "").toLowerCase().includes(term));
    if (statusFilter && statusFilter !== "ALL") arr = arr.filter(p => String(p.status || "").toUpperCase() === statusFilter);
    return arr;
  }, [propostas, q, statusFilter]);

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
    if (st === "ACCEPTED" || st === "APPROVED") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-500/40";
    if (st === "SENT" || st === "ISSUED") return "bg-sky-100 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-400/40";
    if (st === "REJECTED" || st === "CANCELLED") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-400/40";
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-600/30 dark:text-slate-100 dark:ring-slate-500/40";
  };

  const allowedStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CANCELLED", "APPROVED"];
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  const changeStatus = async (id: string, status: string) => {
    try {
      await fetchJson(`${API}/proposals/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setPropostas(prev => prev.map(p => p.id === id ? { ...p, status } as Proposal : p));
    } catch (e: any) {
      alert(e?.message || "Erro ao atualizar status");
    }
  };

  const duplicateProposal = async (id: string) => {
    try {
      await fetchJson<{ id: string; number: string }>(`${API}/proposals/${id}/duplicate`, {
        method: "POST",
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Erro ao duplicar proposta");
    }
  };
  const deleteProposal = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta proposta?")) return;
    try {
      await fetchJson(`${API}/proposals/${id}`, { method: "DELETE" });
      setPropostas(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir proposta");
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
    } catch (e: any) {
      alert(e?.message || "Erro ao criar documento");
    }
  };

  // Open template generation modal and load templates
  const openTemplateGeneration = async (proposal: Proposal, docType: 'PROPOSTA' | 'CONTRATO' | 'RECIBO') => {
    setGenerateTemplate({ proposal, templates: [], selectedTemplateId: '', loading: true, generating: false });
    try {
      const templates = await fetchJson<any[]>(`${API}/document-templates?doc_type=${docType}`);
      setGenerateTemplate(prev => prev ? { ...prev, templates, loading: false } : null);
    } catch (e: any) {
      alert(e?.message || "Erro ao carregar templates");
      setGenerateTemplate(null);
    }
  };

  // Generate document from template
  const generateFromTemplate = async () => {
    if (!generateTemplate || !generateTemplate.selectedTemplateId) {
      alert('Selecione um template');
      return;
    }
    setGenerateTemplate(prev => prev ? { ...prev, generating: true } : null);
    try {
      const { proposal } = generateTemplate;
      
      // Generate document usando a nova rota
      const result = await fetchJson<{ 
        success: boolean;
        document_id: string;
        download_url: string;
        generated_path: string;
      }>(`${API}/document-templates/${generateTemplate.selectedTemplateId}/generate-from-proposal`, {
        method: 'POST',
        body: JSON.stringify({ 
          proposal_id: proposal.id,
          custom_variables: {} // Variáveis extras se necessário
        }),
      });

      if (result.download_url) {
        // Download automático do documento gerado
        window.open(result.download_url, '_blank');
      }
      
      setGenerateTemplate(null);
      alert('Documento gerado com sucesso!');
      load(); // Recarregar lista
    } catch (e: any) {
      alert(e?.message || "Erro ao gerar documento");
    } finally {
      setGenerateTemplate(prev => prev ? { ...prev, generating: false } : null);
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
      <div
        className="ml-16 min-h-screen p-8"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
      >
        <div
          className="mt-8 rounded-2xl border p-6 shadow-lg theme-surface"
          style={{
            borderColor: "var(--color-border)",
            boxShadow: "0 32px 48px -32px var(--color-card-shadow)",
          }}
        >
          <div className="flex flex-wrap justify-between gap-4 items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Documentos</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Gerencie propostas, contratos e recibos</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/templates')}
                className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm font-medium"
              >
                <FaCog />
                <span>Gerenciar Templates</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2 shadow-sm font-medium"
              >
                <span className="text-lg leading-none">+</span>
                <span>Nova Proposta</span>
              </button>
            </div>
          </div>

          <div className="grid gap-5 mb-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Total de Propostas */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent p-5">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total de Propostas</span>
                  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{summaryMetrics.totalProposals}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{summaryMetrics.sentCount} enviadas • {summaryMetrics.approvedCount} aprovadas</div>
              </div>
            </div>

            {/* Valor em Propostas */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-green-500/10 via-transparent to-transparent p-5">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-green-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Valor em Propostas</span>
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(summaryMetrics.totalValue)}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Atualizado automaticamente</div>
              </div>
            </div>

            {/* Contratos Gerados */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent p-5">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Contratos Gerados</span>
                  <FaFileSignature className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{summaryMetrics.contractDocs}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Arquivos prontos para download</div>
              </div>
            </div>

            {/* Recibos Emitidos */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent p-5">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Recibos Emitidos</span>
                  <FaReceipt className="h-5 w-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{summaryMetrics.receiptDocs}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Gerados automaticamente</div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-6 shadow-sm">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[250px]">
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Pesquisar número ou título..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="ALL">Todos os status</option>
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {loading && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Carregando...</div>}
          {error && !loading && <div className="text-center py-12 text-red-500">{error}</div>}

          {!loading && !error && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
            >
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Número</th>
                    <th className="px-6 py-4">Título</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Criado em</th>
                    <th className="px-6 py-4">Válido até</th>
                    <th className="px-6 py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPropostas.map((p) => {
                    const rel = docsByProposal.get(p.id) || {} as any;
                    const hasContractDoc = !!rel.contract;
                    const hasContractPdf = !!rel.contract?.has_pdf;
                    const hasReceiptDoc = !!rel.receipt;
                    const hasReceiptPdf = !!rel.receipt?.has_pdf;
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{p.number}</td>
                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{p.title}</td>
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{formatMoney(p.total_value)}</td>
                        <td className="px-6 py-4">
                          {editingStatusId === p.id ? (
                            <select
                              autoFocus
                              onBlur={() => setEditingStatusId(null)}
                              className="text-xs rounded-lg px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={String(p.status || "DRAFT").toUpperCase()}
                              onChange={async (e) => { await changeStatus(p.id, e.target.value); setEditingStatusId(null); }}
                            >
                              {allowedStatuses.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${badgeClass(p.status)}`}
                              onClick={() => setEditingStatusId(p.id)}
                              title="Clique para editar status"
                            >{p.status || '-'}</button>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(p.created_at)}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(p.valid_until)}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 items-center flex-wrap">
                            {/* Gerar documento com template */}
                            <button
                              className="p-2 rounded-lg text-lg flex items-center justify-center w-9 h-9 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                              title="Gerar documento com template"
                              onClick={() => openTemplateGeneration(p, 'PROPOSTA')}
                            >
                              <FaFileDownload />
                            </button>
                            {/* Proposta */}
                            <button
                              className="p-2 rounded-lg text-lg flex items-center justify-center w-9 h-9 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm"
                              title="Proposta (PDF não configurado)"
                              onClick={() => { /* sem PDF de proposta no schema; pode-se implementar futuramente */ }}
                            ><FaFileAlt /> </button>
                            {/* Contrato */}
                            <button
                              className={`p-2 rounded-lg text-lg flex items-center justify-center w-9 h-9 transition-colors shadow-sm ${hasContractDoc ? (hasContractPdf ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white') : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}`}
                              title={hasContractDoc ? (hasContractPdf ? 'Baixar Contrato' : 'Contrato criado (sem PDF)') : 'Criar Contrato'}
                              onClick={() => {
                                if (hasContractPdf) onDownloadDoc(rel.contract?.id);
                                else if (!hasContractDoc) setCreateDoc({ type: 'CONTRACT', proposal: p, step: 'confirm', item_description: `Ref: Proposta ${p.number} - ${p.title}`, quantity: 1, unit_price: Number(p.total_value||0), discountPct: 0 });
                              }}
                            >
                              <FaFileSignature />
                            </button>
                            {/* Recibo */}
                            <button
                              className={`p-2 rounded-lg text-lg flex items-center justify-center w-9 h-9 transition-colors shadow-sm ${hasReceiptDoc ? (hasReceiptPdf ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white') : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}`}
                              title={hasReceiptDoc ? (hasReceiptPdf ? 'Baixar Recibo' : 'Recibo criado (sem PDF)') : 'Criar Recibo'}
                              onClick={() => {
                                if (hasReceiptPdf) onDownloadDoc(rel.receipt?.id);
                                else if (!hasReceiptDoc) setCreateDoc({ type: 'RECEIPT', proposal: p, step: 'confirm', item_description: `Ref: Proposta ${p.number} - ${p.title}`, quantity: 1, unit_price: Number(p.total_value||0), discountPct: 0 });
                              }}
                            >
                              <FaReceipt />
                            </button>
                            <button
                              className="p-2 rounded-lg text-lg flex items-center justify-center w-9 h-9 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30 transition-colors shadow-sm"
                              title="Excluir proposta"
                              onClick={() => deleteProposal(p.id)}
                            >
                              <FaTrash />
                            </button>
                            <button
                              className="text-xs px-3 py-1.5 rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 font-medium"
                              title="Duplicar proposta"
                              onClick={() => duplicateProposal(p.id)}
                            >
                              Duplicar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPropostas.length === 0 && (
                    <tr>
                      <td className="px-6 py-12 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                        Nenhuma proposta encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showNew && (
          <div
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: "var(--color-overlay)" }}
          >
            <div
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border p-5 shadow-xl theme-surface"
              style={{
                borderColor: "var(--color-border)",
                boxShadow: "0 40px 64px -40px var(--color-card-shadow)",
              }}
            >
              <div className="flex items-center justify-between mb-4 sticky top-0 theme-surface pb-2 z-10">
                <h3 className="font-semibold theme-heading">Criar Proposta</h3>
                <button className="theme-text-muted hover:opacity-70 transition" onClick={() => setShowNew(false)}>x</button>
              </div>
              <ProposalForm initialLead={initialLead} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
            </div>
          </div>
        )}

        {createDoc && (
          <div
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: "var(--color-overlay)" }}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-5 shadow-xl theme-surface"
              style={{
                borderColor: "var(--color-border)",
                boxShadow: "0 40px 64px -40px var(--color-card-shadow)",
              }}
            >
              <div className="flex items-center justify-between mb-4 sticky top-0 theme-surface pb-2 z-10">
                <h3 className="font-semibold theme-heading">{createDoc.type === 'CONTRACT' ? 'Criar Contrato' : 'Criar Recibo'}</h3>
                <button className="theme-text-muted hover:opacity-70 transition" onClick={() => setCreateDoc(null)}>x</button>
              </div>
              {createDoc.step === 'confirm' ? (
                <div className="space-y-4">
                  <div className="theme-text-muted">
                    Deseja criar {createDoc.type === 'CONTRACT' ? 'um Contrato' : 'um Recibo'} a partir da proposta {createDoc.proposal.number} - {createDoc.proposal.title}?
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-3 py-2 rounded-xl border theme-surface-muted"
                      style={{ borderColor: "var(--color-border)" }}
                      onClick={() => setCreateDoc(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="px-3 py-2 rounded-xl theme-primary"
                      onClick={() => setCreateDoc({ ...createDoc, step: 'form' })}
                    >
                      Avançar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Descrição do item</label>
                    <input className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.item_description} onChange={e => setCreateDoc({ ...createDoc, item_description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Quantidade</label>
                      <input type="number" className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.quantity} onChange={e => setCreateDoc({ ...createDoc, quantity: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Valor unitário (R$)</label>
                      <input type="number" className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.unit_price} onChange={e => setCreateDoc({ ...createDoc, unit_price: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Desconto (%)</label>
                      <input type="number" className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.discountPct} onChange={e => setCreateDoc({ ...createDoc, discountPct: Number(e.target.value) })} />
                    </div>
                  </div>
                  {createDoc.type === 'RECEIPT' && (
                    <div className="space-y-2 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 p-3">
                      <div className="font-medium text-sm text-indigo-700 dark:text-indigo-300">Dados do recibo</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Eu (Emissor) - Nome</label>
                          <input className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.issuer_name || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), issuer_name: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">CPF/CNPJ</label>
                          <input className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.issuer_cpf || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), issuer_cpf: e.target.value } })} />
                        </div>
                        <div className="sm:col-span-2" />
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Recebi de (Pagador) - Nome</label>
                          <input className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.payer_name || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), payer_name: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">CPF</label>
                          <input className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.payer_cpf || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), payer_cpf: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">RG</label>
                          <input className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.payer_rg || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), payer_rg: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Referente ao pagamento</label>
                          <input className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.reference || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), reference: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Cidade</label>
                          <input className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.city || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), city: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">UF</label>
                          <input className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.uf || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), uf: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Data</label>
                          <input type="date" className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={createDoc.receipt?.date || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), date: e.target.value } })} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-3 py-2 rounded-xl border theme-surface-muted"
                      style={{ borderColor: "var(--color-border)" }}
                      onClick={() => setCreateDoc(null)}
                    >
                      Cancelar
                    </button>
                    <button className="px-3 py-2 rounded-xl theme-primary" onClick={saveCreateDoc}>Salvar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Template generation modal */}
        {generateTemplate && (
          <div
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: "var(--color-overlay)" }}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-5 shadow-xl theme-surface"
              style={{
                borderColor: "var(--color-border)",
                boxShadow: "0 40px 64px -40px var(--color-card-shadow)",
              }}
            >
              <div className="flex items-center justify-between mb-4 sticky top-0 theme-surface pb-2 z-10">
                <h3 className="font-semibold theme-heading">Gerar Documento com Template</h3>
                <button className="theme-text-muted hover:opacity-70 transition" onClick={() => setGenerateTemplate(null)}>×</button>
              </div>

              {generateTemplate.loading ? (
                <div className="py-8 text-center theme-text-muted">
                  <div className="animate-pulse">Carregando templates...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Proposta Selecionada</h4>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      <strong>Número:</strong> {generateTemplate.proposal.number}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      <strong>Título:</strong> {generateTemplate.proposal.title}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      <strong>Valor:</strong> {formatMoney(generateTemplate.proposal.total_value)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Selecione um Template</label>
                    {generateTemplate.templates.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-center">
                        <p className="text-gray-600 dark:text-gray-400">Nenhum template disponível para este tipo de documento.</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                          Crie templates na página de{' '}
                          <a href="/templates" className="text-indigo-600 dark:text-indigo-400 hover:underline">Templates</a>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {generateTemplate.templates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => setGenerateTemplate(prev => prev ? { ...prev, selectedTemplateId: template.id } : null)}
                            className={`w-full p-4 rounded-xl border text-left transition-all ${
                              generateTemplate.selectedTemplateId === template.id
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h5>
                                {template.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{template.description}</p>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    template.is_default
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                  }`}>
                                    {template.is_default ? 'Padrão' : 'Customizado'}
                                  </span>
                                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                                    {template.doc_type}
                                  </span>
                                </div>
                              </div>
                              {generateTemplate.selectedTemplateId === template.id && (
                                <div className="ml-2 text-indigo-600 dark:text-indigo-400">
                                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
                    <button
                      className="px-4 py-2 rounded-xl border theme-surface-muted"
                      style={{ borderColor: "var(--color-border)" }}
                      onClick={() => setGenerateTemplate(null)}
                      disabled={generateTemplate.generating}
                    >
                      Cancelar
                    </button>
                    <button
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      onClick={generateFromTemplate}
                      disabled={!generateTemplate.selectedTemplateId || generateTemplate.generating}
                    >
                      {generateTemplate.generating ? 'Gerando...' : 'Gerar Documento'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
  );
}










