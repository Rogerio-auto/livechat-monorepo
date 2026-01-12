import { FaTimes, FaSave } from 'react-icons/fa';
import { useEffect, useMemo, useState } from "react";
import { LeadPicker } from "../funil/LeadPicker";
import { ClienteForm } from "../clientes/ClienteForm";
import { FinancingFields, FinancingData } from "./FinancingFields";
import { calculateSolarData, formatSolarDataForAPI, type KitData, type SolarData } from "../../utils/solarDataExtractor";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

type Lead = { id: string; name: string; email?: string | null };

type Product = {
  id: string;
  name: string;
  sale_price?: number | null;
  cost_price?: number | null;
  power?: string | null;
  brand?: string | null;
  specs?: string | null;
  size?: string | null;
};

type ExtendedProduct = Product & KitData;

 type ProposalMin = { id: string; number: string; title: string; total_value: number; lead_id?: string | null; customer_id?: string };

type Props = {
  initialLead?: Lead | null;
  onClose?: () => void;
  onSaved?: (docId: string) => void;
};

export default function ProposalForm({ initialLead = null, onClose, onSaved }: Props) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(initialLead || null);
  const [docType, setDocType] = useState<'PROPOSAL'|'CONTRACT'|'RECEIPT'>('PROPOSAL');
  const [consumo, setConsumo] = useState<string>("");
  const [desconto, setDesconto] = useState<number>(0);
  const [formaPagamento, setFormaPagamento] = useState<string>("A_VISTA");
  const [vendedor, setVendedor] = useState<string>("");
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [produto, setProduto] = useState<string>("");
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadModeNew, setLeadModeNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposalOptions, setProposalOptions] = useState<ProposalMin[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string>("");
  const [financing, setFinancing] = useState<FinancingData>({});
  const [solarData, setSolarData] = useState<SolarData | null>(null);

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchJson(`${API}/auth/me`);
        const me = await fetchJson<{ name?: string }>(`${API}/me/profile`);
        setVendedor(me?.name || "");
        const resp = await fetchJson<any>(`${API}/products?limit=200&offset=0`);
        const items: Product[] = Array.isArray(resp) ? resp : (resp?.items || []);
        setProdutos(items);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (docType === 'PROPOSAL') return;
      if (!selectedLead) { setProposalOptions([]); return; }
      try {
        const data = await fetchJson<ProposalMin[]>(`${API}/proposals`);
        const list = (Array.isArray(data) ? data : []).filter((p:any) => (p.lead_id || '') === selectedLead.id);
        setProposalOptions(list);
      } catch {}
    })();
  }, [docType, selectedLead]);

  const produtosFiltrados = useMemo(() => {
    const q = (query || "").toLowerCase();
    if (!q) return produtos;
    return produtos.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.power || "").toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q) || (p.specs || "").toLowerCase().includes(q));
  }, [produtos, query]);

  const produtoSelecionado = useMemo(() => produtos.find((p) => p.id === produto) || null, [produto, produtos]);

  // Calcular dados solares automaticamente quando kit for selecionado
  useEffect(() => {
    console.log("[ProposalForm] useEffect disparado");
    console.log("[ProposalForm] produtoSelecionado:", produtoSelecionado);
    
    if (!produtoSelecionado) {
      console.log("[ProposalForm] Nenhum produto selecionado");
      setSolarData(null);
      return;
    }

    console.log("[ProposalForm] Produto selecionado:", {
      name: produtoSelecionado.name,
      power: produtoSelecionado.power,
      size: produtoSelecionado.size,
      specs: produtoSelecionado.specs?.substring(0, 50)
    });

    // Verificar se é um kit solar (tem power e size)
    if (!produtoSelecionado.power || !produtoSelecionado.size) {
      console.log("[ProposalForm] ⚠️ Produto SEM power ou size - não é kit solar");
      console.log("[ProposalForm] power:", produtoSelecionado.power);
      console.log("[ProposalForm] size:", produtoSelecionado.size);
      setSolarData(null);
      return;
    }

    console.log("[ProposalForm] ✅ Produto é kit solar - calculando dados...");

    // Calcular valor total para payback
    const base = (produtoSelecionado.sale_price ?? produtoSelecionado.cost_price ?? 0) as number;
    const total = Math.max(0, base * (1 - Math.max(0, Math.min(100, desconto))/100));

    console.log("[ProposalForm] Valor base:", base);
    console.log("[ProposalForm] Desconto:", desconto);
    console.log("[ProposalForm] Valor total:", total);

    // Calcular consumo mensal do cliente (se informado)
    const monthlyConsumption = consumo ? parseFloat(consumo) : undefined;

    // Criar objeto KitData
    const kitData: KitData = {
      name: produtoSelecionado.name,
      power: produtoSelecionado.power,
      size: produtoSelecionado.size || "0",
      specs: produtoSelecionado.specs,
      sale_price: produtoSelecionado.sale_price,
    };

    // Calcular todos os dados solares
    const calculated = calculateSolarData(kitData, total, monthlyConsumption);
    setSolarData(calculated);

    console.log("[ProposalForm] ✅ Dados solares calculados:", calculated);
  }, [produtoSelecionado, desconto, consumo]);

  const salvar = async () => {
    try {
      setSaving(true);
      if (docType === 'PROPOSAL') {
        if (!selectedLead) return alert('Selecione um cliente');
        if (!produtoSelecionado) return alert('Selecione um produto');
        
        // Validar campos obrigatórios de financiamento se aplicável
        if (formaPagamento === 'FINANCIAMENTO') {
          if (!financing.bank) return alert('Informe o banco financiador');
          if (!financing.installments) return alert('Informe o número de parcelas');
          if (!financing.installment_value) return alert('Informe o valor da parcela');
          if (!financing.interest_rate) return alert('Informe a taxa de juros');
        }
        
        const sysPower = Number(String(produtoSelecionado.power || '').replace(/[^0-9.,-]/g,'').replace(',','.')) || 0;
        const base = (produtoSelecionado.sale_price ?? produtoSelecionado.cost_price ?? 0) as number;
        const total = Math.max(0, base * (1 - Math.max(0, Math.min(100, desconto))/100));
        
        const payload: any = {
          lead_id: selectedLead.id,
          title: produtoSelecionado.name,
          total_value: total,
          system_power: sysPower,
          panel_quantity: solarData?.solar_num_panels || 1,
          description: formaPagamento ? `Forma de pagamento: ${formaPagamento}; Desconto: ${desconto}%` : undefined,
          valid_days: 30,
          payment_method: formaPagamento,
          // Campos de financiamento
          ...(formaPagamento === 'FINANCIAMENTO' && {
            financing_bank: financing.bank,
            financing_installments: financing.installments,
            financing_installment_value: financing.installment_value,
            financing_interest_rate: financing.interest_rate,
            financing_total_amount: financing.total_amount,
            financing_entry_value: financing.entry_value,
            financing_cet: financing.cet,
            financing_iof: financing.iof,
            financing_type: financing.type,
            financing_first_due_date: financing.first_due_date,
          }),
          // Campos solares calculados automaticamente
          ...(solarData && formatSolarDataForAPI(solarData))
        };

        console.log("[ProposalForm] ====================================");
        console.log("[ProposalForm] PAYLOAD FINAL:");
        console.log("[ProposalForm] solarData existe?", !!solarData);
        console.log("[ProposalForm] solarData:", solarData);
        console.log("[ProposalForm] Payload completo:", JSON.stringify(payload, null, 2));
        console.log("[ProposalForm] ====================================");
        
        const data = await fetchJson<{ id: string }>(`${API}/proposals`, { method: 'POST', body: JSON.stringify(payload) });
        onSaved?.(data.id);
        onClose?.();
        return;
      }
      // CONTRACT or RECEIPT based on existing proposal
      if (!selectedProposalId) return alert('Selecione uma proposta');
      const pr = proposalOptions.find(p => p.id === selectedProposalId);
      if (!pr) return alert('Proposta inv?lida');
      const payload: any = {
        lead_id: selectedLead?.id,
        doc_type: docType === 'CONTRACT' ? 'CONTRACT' : 'RECEIPT',
        item_description: `Ref: Proposta ${pr.number} - ${pr.title}`,
        quantity: 1,
        unit_price: pr.total_value,
        discountPct: 0,
        metadata: { proposal_id: pr.id },
      };
      const data = await fetchJson<{ id: string }>(`${API}/documents`, { method: 'POST', body: JSON.stringify(payload) });
      onSaved?.(data.id);
      onClose?.();
    } catch (e: any) {
      alert(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[#204A34]">Nova Proposta</h3>
        <div className="text-sm text-zinc-600">Vendedor: {vendedor || '-'}</div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-zinc-700">Tipo:</label>
        <label className="flex items-center gap-1 text-sm"><input type="radio" name="doctype" checked={docType==='PROPOSAL'} onChange={() => setDocType('PROPOSAL')} /> Proposta</label>
        <label className="flex items-center gap-1 text-sm"><input type="radio" name="doctype" checked={docType==='CONTRACT'} onChange={() => setDocType('CONTRACT')} /> Contrato</label>
        <label className="flex items-center gap-1 text-sm"><input type="radio" name="doctype" checked={docType==='RECEIPT'} onChange={() => setDocType('RECEIPT')} /> Recibo</label>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          {selectedLead ? (
            <div className="bg-emerald-50/60 p-3 rounded-xl ring-1 ring-emerald-200">
              <div className="font-medium">Cliente selecionado</div>
              <div className="mt-1">{selectedLead.name}</div>
              <div className="text-emerald-900/80">{selectedLead.email || 'sem e-mail'}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-zinc-600">Nenhum cliente selecionado.</div>
          )}
        </div>
        <button className="text-sm text-white bg-[#204A34] hover:bg-[#42CD55] px-3 py-2 rounded-xl" onClick={() => { setShowLeadModal(true); setLeadModeNew(false); }}>
          {selectedLead ? 'Trocar cliente' : '+ Selecionar cliente'}
        </button>
      </div>

      {docType==='PROPOSAL' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Consumo medio (kWh/mes)</label>
              <input type="number" value={consumo} onChange={(e) => setConsumo(e.target.value)} className="mt-1 border rounded-lg p-2 w-full focus:ring-2 focus:ring-emerald-300 outline-none" placeholder="Ex: 500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Produto</label>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por nome, potencia, marca..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none mb-2" />
            <div id="prod-carousel" className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 px-1">
              {produtosFiltrados.map((p) => {
                const preco = p.sale_price ?? p.cost_price ?? null;
                return (
                  <button key={p.id} onClick={() => setProduto(p.id)} className={`flex-none snap-start w-[300px] h-[140px] rounded-xl p-4 ring-1 shadow-sm transition ${produto === p.id ? 'bg-emerald-50 ring-emerald-300' : 'bg-white ring-zinc-200 hover:bg-zinc-50'}`}>
                    <div className="flex h-full flex-col">
                      <div className="font-medium text-zinc-800 leading-tight" title={p.name} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                      {(p.power || p.brand) && (
                        <div className="text-xs text-zinc-500 mt-1">{[p.power, p.brand].filter(Boolean).join(' ? ')}</div>
                      )}
                      <div className="mt-auto text-sm font-semibold text-zinc-700">{preco != null ? Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem pre?o'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumo dos dados solares calculados */}
          {solarData && (
            <div className="bg-linear-to-br from-emerald-50 to-green-50 p-4 rounded-xl ring-2 ring-emerald-300 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">☀️</span>
                <div className="font-semibold text-emerald-900">Dados Solares Calculados</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-white/70 p-2 rounded-lg">
                  <div className="text-xs text-emerald-700 font-medium">Potência Total</div>
                  <div className="text-emerald-900 font-semibold">{solarData.solar_total_power.toFixed(2)} kWp</div>
                </div>
                {solarData.solar_num_panels && (
                  <div className="bg-white/70 p-2 rounded-lg">
                    <div className="text-xs text-emerald-700 font-medium">Painéis</div>
                    <div className="text-emerald-900 font-semibold">{solarData.solar_num_panels} unidades</div>
                  </div>
                )}
                {solarData.solar_monthly_production && (
                  <div className="bg-white/70 p-2 rounded-lg">
                    <div className="text-xs text-emerald-700 font-medium">Geração Mensal</div>
                    <div className="text-emerald-900 font-semibold">{solarData.solar_monthly_production} kWh</div>
                  </div>
                )}
                {solarData.solar_area_needed && (
                  <div className="bg-white/70 p-2 rounded-lg">
                    <div className="text-xs text-emerald-700 font-medium">Área Necessária</div>
                    <div className="text-emerald-900 font-semibold">{solarData.solar_area_needed} m²</div>
                  </div>
                )}
                {solarData.solar_savings_value && (
                  <div className="bg-white/70 p-2 rounded-lg">
                    <div className="text-xs text-emerald-700 font-medium">Economia Mensal</div>
                    <div className="text-emerald-900 font-semibold">
                      {solarData.solar_savings_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                )}
                {solarData.solar_payback_years && (
                  <div className="bg-white/70 p-2 rounded-lg">
                    <div className="text-xs text-emerald-700 font-medium">Payback</div>
                    <div className="text-emerald-900 font-semibold">{solarData.solar_payback_years} anos</div>
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-emerald-700">
                ✅ Estes dados serão incluídos automaticamente na proposta
              </div>
            </div>
          )}

          <div className="bg-zinc-50 p-4 rounded-xl ring-1 ring-zinc-200 text-sm text-zinc-800">
            <div className="font-medium mb-2">Vendedor responsavel</div>
            <div>{vendedor || '-'}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Forma de pagamento</label>
              <select 
                value={formaPagamento} 
                onChange={(e) => setFormaPagamento(e.target.value)} 
                className="mt-1 border border-gray-300 dark:border-gray-600 rounded-lg p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="A_VISTA">À Vista</option>
                <option value="PARCELADO_DIRETO">Parcelado Direto</option>
                <option value="FINANCIAMENTO">Financiamento Bancário</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Desconto (%)</label>
              <input type="number" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} className="mt-1 border border-gray-300 dark:border-gray-600 rounded-lg p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" placeholder="Ex: 10" />
            </div>
          </div>

          {/* Mostrar campos de financiamento apenas se selecionado */}
          {formaPagamento === 'FINANCIAMENTO' && (
            <FinancingFields 
              value={financing} 
              onChange={setFinancing}
              disabled={saving}
            />
          )}

          {produtoSelecionado && (
            <div className="bg-white p-4 rounded-xl ring-1 ring-emerald-200 shadow-sm">
              <h3 className="font-semibold text-[#204A34] mb-2">Resumo da Proposta</h3>
              <p><strong>Cliente:</strong> {selectedLead?.name || '-'}</p>
              <p><strong>Produto:</strong> {produtoSelecionado?.name}</p>
              <p><strong>Pre?o:</strong> {(produtoSelecionado?.sale_price ?? produtoSelecionado?.cost_price) != null ? (produtoSelecionado!.sale_price ?? produtoSelecionado!.cost_price)!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</p>
              <p><strong>Desconto:</strong> {desconto}%</p>
              <p><strong>Forma de Pagamento:</strong> {formaPagamento || '-'}</p>
            </div>
          )}
        </>
      )}

      {docType!=='PROPOSAL' && (
        <div className="bg-emerald-50/60 p-4 rounded-xl ring-1 ring-emerald-200 text-sm text-emerald-900">
          <div className="font-medium mb-2">Selecionar proposta</div>
          {selectedLead ? (
            <select className="border rounded-lg p-2 w-full" value={selectedProposalId} onChange={e=>setSelectedProposalId(e.target.value)}>
              <option value="">Selecione uma proposta</option>
              {proposalOptions.map(pr => (
                <option key={pr.id} value={pr.id}>{pr.number} - {pr.title} - {Number(pr.total_value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</option>
              ))}
            </select>
          ) : (
            <div className="text-emerald-900/80">Selecione um cliente para listar propostas.</div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button className="p-2 rounded-xl border" onClick={onClose} disabled={saving} title="Cancelar"><FaTimes /></button>
        <button className="p-2 rounded-xl bg-[#204A34] hover:bg-[#42CD55] text-white" onClick={salvar} disabled={saving} title={docType==='PROPOSAL' ? 'Salvar Proposta' : (docType==='CONTRACT' ? 'Gerar Contrato' : 'Gerar Recibo')}><FaSave /></button>
      </div>

      {showLeadModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2 sticky top-0 bg-white pb-2 z-10">
              <h3 className="font-semibold text-zinc-800">{leadModeNew ? 'Cadastrar novo cliente' : 'Selecionar cliente'}</h3>
              <button className="text-zinc-500 hover:text-zinc-800" onClick={() => { setShowLeadModal(false); setLeadModeNew(false); }}>x</button>
            </div>
            {leadModeNew ? (
              <ClienteForm
                onSubmit={async (payload: any) => {
                  try {
                    const res = await fetch(`${API}/leads`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err?.error || `HTTP ${res.status}`);
                    }
                    const data = await res.json();
                    setSelectedLead({ id: data.id, name: data.name, email: data.email });
                    setLeadModeNew(false);
                    setShowLeadModal(false);
                  } catch (e: any) { alert(e?.message || 'Erro ao salvar cliente'); }
                }}
              />
            ) : (
              <LeadPicker
                apiBase={API}
                onSelect={(l: any) => { setSelectedLead({ id: l.id, name: l.name, email: l.email }); setShowLeadModal(false); }}
                onCreateNew={() => setLeadModeNew(true)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}


