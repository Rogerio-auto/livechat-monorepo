import { useEffect, useMemo, useState } from "react";
import Sidebar from "../componets/Sidbars/sidebar";
import { useLocation } from "react-router-dom";
import ProposalForm from "../componets/propostas/ProposalForm";

import { io } from 'socket.io-client';
import { FaFileAlt, FaFileSignature, FaReceipt, FaTrash } from 'react-icons/fa';

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
  if (n === null || n === undefined) return '-';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(iso?: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

export default function DocumentosPage() {
  const [propostas, setPropostas] = useState<Proposal[]>([]);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const location = useLocation() as any;
  const initialLead = location?.state?.lead ?? null;
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) {
      let msg = '';
      try { const e = await res.json(); msg = e?.error || ''; } catch {}
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
      setError(e?.message || 'Erro ao carregar documentos');
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
    if (term) arr = arr.filter(p => (p.number||'').toLowerCase().includes(term) || (p.title||'').toLowerCase().includes(term));
    if (statusFilter && statusFilter !== 'ALL') arr = arr.filter(p => String(p.status||'').toUpperCase() === statusFilter);
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

  const badgeClass = (s?: string | null) => {
    const st = String(s || '').toUpperCase();
    if (st === 'ACCEPTED' || st === 'APPROVED') return 'bg-green-100 text-green-700 ring-1 ring-green-200';
    if (st === 'SENT' || st === 'ISSUED') return 'bg-blue-100 text-blue-700 ring-1 ring-blue-200';
    if (st === 'REJECTED' || st === 'CANCELLED') return 'bg-red-100 text-red-700 ring-1 ring-red-200';
    return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200';
  };

  const allowedStatuses = ['DRAFT','SENT','ACCEPTED','REJECTED','CANCELLED','APPROVED'];
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  const changeStatus = async (id: string, status: string) => {
    try {
      await fetchJson(`${API}/proposals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setPropostas(prev => prev.map(p => p.id === id ? { ...p, status } as Proposal : p));
    } catch (e: any) {
      alert(e?.message || 'Erro ao atualizar status');
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
    if (!confirm('Tem certeza que deseja excluir esta proposta?')) return;
    try {
      await fetchJson(`${API}/proposals/${id}`, { method: 'DELETE' });
      setPropostas(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Erro ao excluir proposta');
    }
  };

  // Modal para criar documento (Contrato/Recibo) a partir da proposta
  const [createDoc, setCreateDoc] = useState<null | {
    type: 'CONTRACT' | 'RECEIPT';
    proposal: Proposal;
    step: 'confirm' | 'form';
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
      await fetchJson(`${API}/documents`, { method: 'POST', body: JSON.stringify(payload) });
      setCreateDoc(null);
      load();
    } catch (e: any) {
      alert(e?.message || 'Erro ao criar documento');
    }
  };

  // Prefill company + lead data for receipt when entering form step
  useEffect(() => {
    (async () => {
      if (!createDoc || createDoc.type !== 'RECEIPT' || createDoc.step !== 'form') return;
      const proposal = createDoc.proposal;
      try {
        // Company (issuer)
        const company = await fetchJson<any>(`${API}/companies/me`);
        // Lead (payer) — if available; fallback to customer contact
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
            date: prev.receipt?.date || new Date().toISOString().slice(0,10),
          }
        } : prev);
      } catch {}
    })();
  }, [createDoc?.step, createDoc?.type]);

  return (
    <>
      <Sidebar />
      <div className="ml-16 min-h-screen bg-[#EDEDED] p-8">
        <div className="bg-white rounded-2xl mt-8 shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[#204A34]">Documentos</h2>
            <button onClick={() => setShowNew(true)} className="bg-[#204A34] text-white px-4 py-2 rounded-xl hover:bg-[#42CD55] transition">+ Nova Proposta</button>
          </div>

          <div className="flex flex-wrap gap-3 items-center mb-4">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar número ou tí­tulo..." className=" rounded-xl px-3 py-2 text-sm w-64 bg-gray-100" />
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className=" rounded-xl px-3 py-2 text-sm bg-gray-100">
              <option value="ALL">Todos os status</option>
              {statusOptions.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
            {/* IA apenas removido */}
          </div>

          {loading && <div className="text-gray-500">Carregando...</div>}
          {error && !loading && <div className="text-red-600">{error}</div>}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-600 border-b">
                    <th className="p-2">NÃºmero</th>
                    <th className="p-2">TÃ­tulo</th>
                    <th className="p-2">Valor</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Criado em</th>
                    <th className="p-2">VÃ¡lido atÃ©</th>
                    <th className="p-2">AÃ§Ãµes</th>
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
                      <tr key={p.id} className="border-b hover:bg-emerald-50/40">
                        <td className="p-2 font-medium text-zinc-800">{p.number}</td>
                        <td className="p-2">{p.title}</td>
                        <td className="p-2">{formatMoney(p.total_value)}</td>
                        <td className="p-2">
                          {editingStatusId === p.id ? (
                            <select
                              autoFocus
                              onBlur={() => setEditingStatusId(null)}
                              className="text-xs rounded-md px-2 py-1 bg-white"
                              value={String(p.status || 'DRAFT').toUpperCase()}
                              onChange={async (e)=> { await changeStatus(p.id, e.target.value); setEditingStatusId(null);} }
                            >
                              {allowedStatuses.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              className={`text-xs px-2 py-1 rounded-full ${badgeClass(p.status)}`}
                              onClick={() => setEditingStatusId(p.id)}
                              title="Clique para editar status"
                            >{p.status || '-'}</button>
                          )}
                        </td>
                        <td className="p-2">{formatDate(p.created_at)}</td>
                        <td className="p-2">{formatDate(p.valid_until)}</td>
                        <td className="p-2">
                          <div className="flex gap-2 items-center">
                            {/* Proposta: cor se existe (sempre, pois estamos na tabela proposals) */}
                            <button
                              className={`p-2 rounded-md text-lg flex items-center justify-center w-9 h-9 ${true ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                              title="Proposta (PDF nÃ£o configurado)"
                              onClick={() => { /* sem PDF de proposta no schema; pode-se implementar futuramente */ }}
                            ><FaFileAlt /> </button>
                            {/* Contrato */}
                            <button
                              className={`p-2 rounded-md text-lg flex items-center justify-center w-9 h-9 ${hasContractDoc ? (hasContractPdf ? 'bg-blue-600 text-white' : 'bg-green-600 text-white') : 'bg-gray-200 text-gray-600'}`}
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
                              className={`p-2 rounded-md text-lg flex items-center justify-center w-9 h-9 ${hasReceiptDoc ? (hasReceiptPdf ? 'bg-amber-600 text-white' : 'bg-green-600 text-white') : 'bg-gray-200 text-gray-600'}`}
                              title={hasReceiptDoc ? (hasReceiptPdf ? 'Baixar Recibo' : 'Recibo criado (sem PDF)') : 'Criar Recibo'}
                              onClick={() => {
                                if (hasReceiptPdf) onDownloadDoc(rel.receipt?.id);
                                else if (!hasReceiptDoc) setCreateDoc({ type: 'RECEIPT', proposal: p, step: 'confirm', item_description: `Ref: Proposta ${p.number} - ${p.title}`, quantity: 1, unit_price: Number(p.total_value||0), discountPct: 0 });
                              }}
                            >
                              <FaReceipt />
                            </button>
                            <button
                              className="p-2 rounded-md text-lg flex items-center justify-center w-9 h-9 bg-red-100 text-red-700 hover:bg-red-200"
                              title="Excluir proposta"
                              onClick={() => deleteProposal(p.id)}
                            >
                              <FaTrash />
                            </button>
                            <button className="text-xs px-3 py-1 rounded-md hover:bg-emerald-50" title="Duplicar proposta" onClick={() => duplicateProposal(p.id)}>
                              Duplicar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPropostas.length === 0 && (
                    <tr>
                      <td className="p-4 text-gray-500" colSpan={7}>Nenhuma proposta encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showNew && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-zinc-800">Criar Proposta</h3>
                <button className="text-zinc-500 hover:text-zinc-800" onClick={() => setShowNew(false)}>x</button>
              </div>
              <ProposalForm initialLead={initialLead} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
            </div>
          </div>
        )}

        {createDoc && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-zinc-800">{createDoc.type === 'CONTRACT' ? 'Criar Contrato' : 'Criar Recibo'}</h3>
                <button className="text-zinc-500 hover:text-zinc-800" onClick={() => setCreateDoc(null)}>x</button>
              </div>
              {createDoc.step === 'confirm' ? (
                <div className="space-y-4">
                  <div>Deseja criar {createDoc.type === 'CONTRACT' ? 'um Contrato' : 'um Recibo'} a partir da proposta {createDoc.proposal.number} - {createDoc.proposal.title}?</div>
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-2 rounded-xl border" onClick={() => setCreateDoc(null)}>Cancelar</button>
                    <button className="px-3 py-2 rounded-xl bg-[#204A34] hover:bg-[#42CD55] text-white" onClick={() => setCreateDoc({ ...createDoc, step: 'form' })}>Avançar</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Descrição do item</label>
                    <input className="w-full border rounded-lg p-2" value={createDoc.item_description} onChange={e=>setCreateDoc({ ...createDoc, item_description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantidade</label>
                      <input type="number" className="w-full border rounded-lg p-2" value={createDoc.quantity} onChange={e=>setCreateDoc({ ...createDoc, quantity: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Valor unitário (R$)</label>
                      <input type="number" className="w-full border rounded-lg p-2" value={createDoc.unit_price} onChange={e=>setCreateDoc({ ...createDoc, unit_price: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Desconto (%)</label>
                      <input type="number" className="w-full border rounded-lg p-2" value={createDoc.discountPct} onChange={e=>setCreateDoc({ ...createDoc, discountPct: Number(e.target.value) })} />
                    </div>
                  </div>
                  {createDoc.type === 'RECEIPT' && (
                    <div className="space-y-2 rounded-xl border p-3 bg-emerald-50/30">
                      <div className="font-medium text-sm text-emerald-900">Dados do recibo</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Eu (Emissor) - Nome</label>
                          <input className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.issuer_name || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), issuer_name: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">CPF/CNPJ</label>
                          <input className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.issuer_cpf || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), issuer_cpf: e.target.value } })} />
                        <div></div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Recebi de (Pagador) - Nome</label>
                          <input className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.payer_name || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), payer_name: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">CPF</label>
                          <input className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.payer_cpf || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), payer_cpf: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">RG</label>
                          <input className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.payer_rg || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), payer_rg: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Referente ao pagamento</label>
                          <input className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.reference || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), reference: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Cidade</label>
                          <input className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.city || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), city: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">UF</label>
                          <input className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.uf || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), uf: e.target.value } })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Data</label>
                          <input type="date" className="w-full border rounded-lg p-2 text-sm" value={createDoc.receipt?.date || ''} onChange={e=>setCreateDoc({ ...createDoc, receipt: { ...(createDoc.receipt||{}), date: e.target.value } })} />
                        </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-2 rounded-xl border" onClick={() => setCreateDoc(null)}>Cancelar</button>
                    <button className="px-3 py-2 rounded-xl bg-[#204A34] hover:bg-[#42CD55] text-white" onClick={saveCreateDoc}>Salvar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}










