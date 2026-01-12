import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/sidebars/sidebar";
import { LeadPicker } from "../components/funil/LeadPicker";
import { ClienteForm } from "../components/clientes/ClienteForm";
import { useLocation, useNavigate } from "react-router-dom";

type Lead = {
  id: string;
  name: string;
  email?: string | null;
};

type Product = {
  id: string;
  external_id?: string | null;
  name: string;
  sale_price?: number | null;
  cost_price?: number | null;
  power?: string | null;
  brand?: string | null;
  specs?: string | null;
};

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export function PropostaPage() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [consumo, setConsumo] = useState("");
  const [produto, setProduto] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [desconto, setDesconto] = useState<number>(0);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadModeNew, setLeadModeNew] = useState(false);
  const [vendedor, setVendedor] = useState<string>("");
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [query, setQuery] = useState("");

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
        const stLead = location?.state?.lead;
        if (stLead && (!selectedLead || selectedLead.id !== stLead.id)) {
          setSelectedLead({ id: stLead.id, name: stLead.name, email: stLead.email });
        }
        const me = await fetchJson<{ name?: string }>(`${API}/me/profile`);
        setVendedor(me?.name || "");
        const resp = await fetchJson<any>(`${API}/products?limit=200&offset=0`);
        const items: Product[] = Array.isArray(resp) ? resp : (resp?.items || []);
        setProdutos(items);
      } catch { }
    })();
  }, []);

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

  return (
    <>
      <Sidebar />

      <div className="ml-16 min-h-screen bg-[#EDEDED] p-8">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto space-y-6">
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
              <label className="block text-sm font-medium">Consumo medio (kWh/mes)</label>
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
                <option value="Cartao">Cartao</option>
                <option value="Parcelado">Parcelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Desconto (%)</label>
              <input
                type="number"
                value={desconto}
                onChange={(e) => setDesconto(Number(e.target.value))}
                className="mt-1 border rounded-lg p-2 w-full focus:ring-2 focus:ring-emerald-300 outline-none"
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Produto</label>
            <div className="mb-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por nome, potencia, marca..."
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none "
              />
            </div>
            <div
              id="prod-carousel"
              className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 px-1"
            >
              {produtosFiltrados.map((p) => {
                const preco = p.sale_price ?? p.cost_price ?? null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProduto(p.id)}
                    className={`flex-none snap-start w-[300px] h-[140px] rounded-xl p-4 ring-1 shadow-sm transition
          ${produto === p.id ? "bg-emerald-50 ring-emerald-300" : "bg-white ring-zinc-200 hover:bg-zinc-50"}`}
                  >
                    <div className="flex h-full flex-col">
                      <div
                        className="font-medium text-zinc-800 leading-tight"
                        title={p.name}
                        // clamp em 2 linhas sem plugin
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {p.name}
                      </div>

                      {(p.power || p.brand) && (
                        <div className="text-xs text-zinc-500 mt-1">
                          {[p.power, p.brand].filter(Boolean).join(" � ")}
                        </div>
                      )}

                      <div className="mt-auto text-sm font-semibold text-zinc-700">
                        {preco != null
                          ? preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "Sem pre�o"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-50 p-4 rounded-xl ring-1 ring-zinc-200 text-sm text-zinc-800">
            <div className="font-medium mb-2">Vendedor responsavel</div>
            <div>{vendedor || "-"}</div>
          </div>

          {produtoSelecionado && (
            <div className="bg-white p-4 rounded-xl ring-1 ring-emerald-200 shadow-sm">
              <h3 className="font-semibold text-[#204A34] mb-2">Resumo da Proposta</h3>
              <p><strong>Cliente:</strong> {selectedLead?.name || "-"}</p>
              <p><strong>Produto:</strong> {produtoSelecionado?.name}</p>
              <p><strong>Preco:</strong> {(produtoSelecionado?.sale_price ?? produtoSelecionado?.cost_price) != null ? (produtoSelecionado!.sale_price ?? produtoSelecionado!.cost_price)!.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</p>
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
            <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-zinc-800">{leadModeNew ? "Cadastrar novo cliente" : "Selecionar cliente"}</h3>
                <button className="text-zinc-500 hover:text-zinc-800" onClick={() => { setShowLeadModal(false); setLeadModeNew(false); }}>
                  x
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




