import { useEffect, useMemo, useState } from "react";


  const produtosFiltrados = useMemo(() => {
    const q = (query || "").toLowerCase();
    if (!q) return produtos;
    return produtos.filter((p) =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.power || "").toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q) ||
      (p.specs || "").toLowerCase().includes(q)
    );
  }, [produtos, query]);

  const produtoSelecionado = useMemo(() => produtos.find((p) => p.id === produto) || null, [produto, produtos]);

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../componets/Sidbars/sidebar";
import { LeadPicker } from "../componets/funil/LeadPicker";
import { ClienteForm } from "../componets/clientes/ClienteForm";
import { useNavigate } from "react-router-dom";

type Lead = {
  id: string;
  name: string;
  email?: string | null;
};

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export function PropostaPage() {
  const navigate = useNavigate();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [consumo, setConsumo] = useState("");
  const [produto, setProduto] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [desconto, setDesconto] = useState<number>(0);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadModeNew, setLeadModeNew] = useState(false);
  const [vendedor, setVendedor] = useState<string>("");
  const [produtos, setProdutos] = useState<CSSMathProduct[]>([]);
  const [query, setQuery] = useState("");

  // produtos serão carregados do backend

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const requireAuth = async () => {
    try {
      await fetchJson(`${API}/auth/me`);
      return true;
    } catch {
      navigate("/login");
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      const ok = await requireAuth();
      if (!ok) return;
      try {
        const me = await fetchJson<{ name?: string }>(`${API}/me/profile`);
        setVendedor(me?.name || "");
      } catch {}
    })();
  }, []);

  const produtoSelecionado = useMemo(() => produtos.find((p) => p.id === produto) || null, [produto]);

  return (
    <>
      <Sidebar />

      <div className="ml-16 min-h-screen bg-[#EDEDED] p-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-[#204A34]">Criar Proposta</h2>
            <button
              className="text-sm text-white bg-[#204A34] hover:bg-[#42CD55] px-3 py-2 rounded-xl"
              onClick={() => { setShowLeadModal(true); setLeadModeNew(false); }}
            >
              {selectedLead ? "Trocar cliente" : "+ Selecionar cliente"}
            </button>
          </div>

          {selectedLead ? (
            <div className="bg-emerald-50/60 p-4 rounded-xl ring-1 ring-emerald-200 text-sm text-emerald-900">
              <div className="font-medium">Cliente selecionado</div>
              <div className="mt-1">{selectedLead.name}</div>
              <div className="text-emerald-900/80">{selectedLead.email || "sem e-mail"}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
              Nenhum cliente selecionado.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Consumo mÃ©dio (kWh/mÃªs)</label>
              <input
                type="number"
                value={consumo}
                onChange={(e) => setConsumo(e.target.value)}
                className="mt-1 border rounded-lg p-2 w-full focus:ring-2 focus:ring-emerald-300 outline-none"
                placeholder="Ex: 500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Forma de pagamento</label>
              <select
                className="mt-1 border rounded-lg p-2 w-full focus:ring-2 focus:ring-emerald-300 outline-none"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
              >
                <option value="">Selecione</option>
                <option value="Pix">Pix</option>
                <option value="Boleto">Boleto</option>
                <option value="CartÃ£o">CartÃ£o</option>
                <option value="Parcelado">Parcelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Desconto (%)</label>
              <input
                type="number"
                value={desconto}
                onChange={(e) => setDesconto(Number(e.target.value}) }
                className="mt-1 border rounded-lg p-2 w-full focus:ring-2 focus:ring-emerald-300 outline-none"
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Produto</label>\n            <div className="mb-3">\n              <input\n                type="text"\n                value={query}\n                onChange={(e) => setQuery(e.target.value)}\n                placeholder="Pesquisar por nome, potencia, marca..."\n                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"\n              />\n            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {produtosFiltrados.map((p) => {
                <button
                  key={p.id}
                  onClick={() => setProduto(p.id)}
                  className={`text-left rounded-xl p-3 ring-1 transition ${produto === p.id ? "bg-emerald-100 ring-emerald-300" : "bg-white ring-zinc-200 hover:bg-zinc-50"}`}
                >
                  <div className="font-medium text-zinc-800">{p.nome}</div>
                  <div className="text-sm text-zinc-600">{(p.sale_price ?? p.cost_price)?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "Sem preço"}</div>
                </button>
              }) }
            </div>
          </div>

          <div className="bg-zinc-50 p-4 rounded-xl ring-1 ring-zinc-200 text-sm text-zinc-800">
            <div className="font-medium mb-2">Vendedor responsÃ¡vel</div>
            <div>{vendedor || "-"}</div>
          </div>

          {produtoSelecionado && (
            <div className="bg-white p-4 rounded-xl ring-1 ring-emerald-200 shadow-sm">
              <h3 className="font-semibold text-[#204A34] mb-2">Resumo da Proposta</h3>
              <p><strong>Cliente:</strong> {selectedLead?.name || "-"}</p>
              <p><strong>Produto:</strong> {produtoSelecionado.name}</p>
              <p><strong>PreÃ§o:</strong> {(produtoSelecionado.sale_price ?? produtoSelecionado.cost_price)?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "-"}</p>
              <p><strong>Desconto:</strong> {desconto}%</p>
              <p><strong>Forma de Pagamento:</strong> {formaPagamento || "-"}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button className="bg-[#204A34] text-white px-6 py-2 rounded-xl hover:bg-[#42CD55] transition">
              Salvar Proposta
            </button>
          </div>
        </div>

        {showLeadModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-zinc-800">{leadModeNew ? "Cadastrar novo cliente" : "Selecionar cliente"}</h3>
                <button className="text-zinc-500 hover:text-zinc-800" onClick={() => { setShowLeadModal(false); setLeadModeNew(false); }}>
                  âœ•
                </button>
              </div>
              {leadModeNew ? (
                <ClienteForm
                  onSubmit={async (payload: any) => {
                    try {
                      const res = await fetch(`${API}/leads`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err?.error || `HTTP ${res.status}`);
                      }
                      const data = await res.json();
                      setSelectedLead({ id: data.id, name: data.name, email: data.email });
                      setLeadModeNew(false);
                      setShowLeadModal(false);
                    } catch (e: any) {
                      alert(e?.message || "Erro ao salvar cliente");
                    }
                  }}
                />
              ) : (
                <LeadPicker
                  apiBase={API}
                  onSelect={(l: any) => {
                    setSelectedLead({ id: l.id, name: l.name, email: l.email });
                    setShowLeadModal(false);
                  }}
                  onCreateNew={() => setLeadModeNew(true)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}







