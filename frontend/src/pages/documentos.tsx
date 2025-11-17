import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import ProposalForm from "../componets/propostas/ProposalForm";

import { io } from "socket.io-client";
import { FaFileAlt, FaFileSignature, FaReceipt, FaTrash } from "react-icons/fa";

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
          <div className="flex flex-wrap justify-between gap-4 items-center mb-6">
            <div>
              <h2 className="text-2xl font-semibold theme-heading">Documentos</h2>
              <p className="theme-text-muted text-sm">Gerencie propostas, contratos e recibos</p>
            </div>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="theme-primary px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              <span className="text-lg leading-none">+</span>
              <span>Nova Proposta</span>
            </button>
          </div>

          <div className="grid gap-4 mb-6 sm:grid-cols-2 xl:grid-cols-4">
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <p className="text-xs font-medium uppercase theme-text-muted">Total de propostas</p>
              <p className="mt-2 text-2xl font-semibold theme-heading">{summaryMetrics.totalProposals}</p>
              <p className="mt-1 text-xs theme-text-muted">{summaryMetrics.sentCount} enviadas • {summaryMetrics.approvedCount} aprovadas</p>
            </div>
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <p className="text-xs font-medium uppercase theme-text-muted">Valor em propostas</p>
              <p className="mt-2 text-2xl font-semibold theme-heading">{formatMoney(summaryMetrics.totalValue)}</p>
              <p className="mt-1 text-xs theme-text-muted">Atualizado automaticamente</p>
            </div>
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <p className="text-xs font-medium uppercase theme-text-muted">Contratos gerados</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl font-semibold theme-heading">{summaryMetrics.contractDocs}</span>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-highlight) 15%, transparent)", color: "var(--color-highlight-strong)" }}
                >
                  <FaFileSignature size={14} />
                </span>
              </div>
              <p className="mt-1 text-xs theme-text-muted">Arquivos prontos para download</p>
            </div>
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <p className="text-xs font-medium uppercase theme-text-muted">Recibos emitidos</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl font-semibold theme-heading">{summaryMetrics.receiptDocs}</span>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-highlight) 15%, transparent)", color: "var(--color-highlight-strong)" }}
                >
                  <FaReceipt size={14} />
                </span>
              </div>
              <p className="mt-1 text-xs theme-text-muted">Gerados automaticamente pelo sistema</p>
            </div>
          </div>

          <div
            className="rounded-2xl border theme-surface-muted p-4 mb-6"
            style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
          >
            <div className="flex flex-wrap gap-3 items-center">
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Pesquisar número ou título..."
                className="config-input rounded-xl px-3 py-2 text-sm w-64"
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="config-input rounded-xl px-3 py-2 text-sm"
              >
                <option value="ALL">Todos os status</option>
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {loading && <div className="theme-text-muted">Carregando...</div>}
          {error && !loading && <div className="text-red-500">{error}</div>}

          {!loading && !error && (
            <div className="overflow-x-auto rounded-2xl border"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 75%, transparent)" }}
            >
              <table className="w-full text-left border-collapse">
                <thead
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 60%, transparent)" }}
                >
                  <tr className="theme-text-muted text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Número</th>
                    <th className="px-4 py-3 font-semibold">Título</th>
                    <th className="px-4 py-3 font-semibold">Valor</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Criado em</th>
                    <th className="px-4 py-3 font-semibold">Válido até</th>
                    <th className="px-4 py-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPropostas.map((p) => {
                    const rel = docsByProposal.get(p.id) || {} as any;
                    const hasContractDoc = !!rel.contract;
                    const hasContractPdf = !!rel.contract?.has_pdf;
                    const hasReceiptDoc = !!rel.receipt;
                    const hasReceiptPdf = !!rel.receipt?.has_pdf;
                    return (
                      <tr
                        key={p.id}
                        className="border-b transition-colors hover:bg-sky-50/50 dark:hover:bg-white/5"
                        style={{ borderColor: "color-mix(in srgb, var(--color-border) 75%, transparent)" }}
                      >
                        <td className="px-4 py-3 font-medium theme-heading">{p.number}</td>
                        <td className="px-4 py-3">{p.title}</td>
                        <td className="px-4 py-3 theme-heading">{formatMoney(p.total_value)}</td>
                        <td className="px-4 py-3">
                          {editingStatusId === p.id ? (
                            <select
                              autoFocus
                              onBlur={() => setEditingStatusId(null)}
                              className="config-input text-xs rounded-md px-2 py-1"
                              value={String(p.status || "DRAFT").toUpperCase()}
                              onChange={async (e) => { await changeStatus(p.id, e.target.value); setEditingStatusId(null); }}
                            >
                              {allowedStatuses.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              className={`text-xs px-2 py-1 rounded-full transition-colors ${badgeClass(p.status)}`}
                              onClick={() => setEditingStatusId(p.id)}
                              title="Clique para editar status"
                            >{p.status || '-'}</button>
                          )}
                        </td>
                        <td className="px-4 py-3 theme-text-muted">{formatDate(p.created_at)}</td>
                        <td className="px-4 py-3 theme-text-muted">{formatDate(p.valid_until)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 items-center">
                            {/* Proposta: cor se existe (sempre, pois estamos na tabela proposals) */}
                            <button
                              className="p-2 rounded-md text-lg flex items-center justify-center w-9 h-9 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              title="Proposta (PDF não configurado)"
                              onClick={() => { /* sem PDF de proposta no schema; pode-se implementar futuramente */ }}
                            ><FaFileAlt /> </button>
                            {/* Contrato */}
                            <button
                              className={`p-2 rounded-md text-lg flex items-center justify-center w-9 h-9 transition-colors ${hasContractDoc ? (hasContractPdf ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white') : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'}`}
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
                              className={`p-2 rounded-md text-lg flex items-center justify-center w-9 h-9 transition-colors ${hasReceiptDoc ? (hasReceiptPdf ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white') : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                              title={hasReceiptDoc ? (hasReceiptPdf ? 'Baixar Recibo' : 'Recibo criado (sem PDF)') : 'Criar Recibo'}
                              onClick={() => {
                                if (hasReceiptPdf) onDownloadDoc(rel.receipt?.id);
                                else if (!hasReceiptDoc) setCreateDoc({ type: 'RECEIPT', proposal: p, step: 'confirm', item_description: `Ref: Proposta ${p.number} - ${p.title}`, quantity: 1, unit_price: Number(p.total_value||0), discountPct: 0 });
                              }}
                            >
                              <FaReceipt />
                            </button>
                            <button
                              className="p-2 rounded-md text-lg flex items-center justify-center w-9 h-9 bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/35"
                              title="Excluir proposta"
                              onClick={() => deleteProposal(p.id)}
                            >
                              <FaTrash />
                            </button>
                            <button
                              className="text-xs px-3 py-1 rounded-md transition theme-surface-muted border"
                              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
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
                      <td className="px-4 py-6 theme-text-muted" colSpan={7}>Nenhuma proposta encontrada.</td>
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
              className="w-full max-w-3xl rounded-2xl border p-5 shadow-xl theme-surface"
              style={{
                borderColor: "var(--color-border)",
                boxShadow: "0 40px 64px -40px var(--color-card-shadow)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
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
              className="w-full max-w-2xl rounded-2xl border p-5 shadow-xl theme-surface"
              style={{
                borderColor: "var(--color-border)",
                boxShadow: "0 40px 64px -40px var(--color-card-shadow)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
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
                    <label className="block text-sm font-medium mb-1 theme-heading">Descrição do item</label>
                    <input className="config-input w-full rounded-lg p-2" value={createDoc.item_description} onChange={e => setCreateDoc({ ...createDoc, item_description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 theme-heading">Quantidade</label>
                      <input type="number" className="config-input w-full rounded-lg p-2" value={createDoc.quantity} onChange={e => setCreateDoc({ ...createDoc, quantity: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 theme-heading">Valor unitário (R$)</label>
                      <input type="number" className="config-input w-full rounded-lg p-2" value={createDoc.unit_price} onChange={e => setCreateDoc({ ...createDoc, unit_price: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 theme-heading">Desconto (%)</label>
                      <input type="number" className="config-input w-full rounded-lg p-2" value={createDoc.discountPct} onChange={e => setCreateDoc({ ...createDoc, discountPct: Number(e.target.value) })} />
                    </div>
                  </div>
                  {createDoc.type === 'RECEIPT' && (
                    <div
                      className="space-y-2 rounded-xl border p-3 theme-surface-muted"
                      style={{
                        borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--color-highlight) 6%, var(--color-surface-muted))",
                      }}
                    >
                      <div className="font-medium text-sm" style={{ color: "var(--color-highlight-strong)" }}>Dados do recibo</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">Eu (Emissor) - Nome</label>
                          <input className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.issuer_name || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), issuer_name: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">CPF/CNPJ</label>
                          <input className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.issuer_cpf || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), issuer_cpf: e.target.value } })} />
                        </div>
                        <div className="sm:col-span-2" />
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">Recebi de (Pagador) - Nome</label>
                          <input className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.payer_name || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), payer_name: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">CPF</label>
                          <input className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.payer_cpf || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), payer_cpf: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">RG</label>
                          <input className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.payer_rg || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), payer_rg: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">Referente ao pagamento</label>
                          <input className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.reference || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), reference: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">Cidade</label>
                          <input className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.city || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), city: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">UF</label>
                          <input className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.uf || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), uf: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 theme-heading">Data</label>
                          <input type="date" className="config-input w-full rounded-lg p-2 text-sm" value={createDoc.receipt?.date || ''} onChange={e => setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt || {}), date: e.target.value } })} />
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
      </div>
  );
}










