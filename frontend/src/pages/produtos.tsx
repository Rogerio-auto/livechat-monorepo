import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../componets/Sidbars/sidebar";
import * as XLSX from "xlsx";
import { FaEdit, FaTrash } from "react-icons/fa";

// =============================
// Tipos
// =============================
export type Product = {
  id?: string;
  external_id?: string;
  name: string;
  unit?: string | null;
  cost_price?: number | null;
  sale_price?: number | null;
  brand?: string | null;
  grouping?: string | null;
  power?: string | null;
  size?: string | null;
  supplier?: string | null;
  status?: string | null;
  specs?: string | null;
  created_at?: string;
  updated_at?: string;
};

// Form permite string nos campos numéricos para não quebrar o setState
export type ProductForm = Omit<Product, "cost_price" | "sale_price"> & {
  cost_price?: string | number | null;
  sale_price?: string | number | null;
};

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    // remove acentos (combining marks)
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// headers normalizados da planilha (sem acentos)
const HEADER_MAP: Record<string, keyof Product> = {
  id: "external_id",
  descricao: "name",
  unidade: "unit",
  "preco de custo": "cost_price",
  "preco de venda": "sale_price",
  marca: "brand",
  agrupamento: "grouping",
  potencia: "power",
  tamanho: "size",
  fornecedor: "supplier",
  situacao: "status",
  especificacoes: "specs",
};

function parseMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value;
  const s = String(value)
    .replace(/\./g, "")
    .replace(/,/, ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export function ProdutosPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importCount, setImportCount] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<ProductForm>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error("Unauthorized");
      }
      throw new Error((payload as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const resp = await fetchJson<{ items: Product[]; total: number }>(`${API}/products?${params.toString()}`);
      setProducts(resp.items || []);
      setTotal(resp.total || 0);
    } catch (e: any) {
      if (e?.message === "Unauthorized") {
        navigate("/login");
        return;
      }
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, query, statusFilter]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setImportCount(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const mapped: Product[] = rows
        .map((row) => {
          const out: any = {};
          for (const [rawKey, value] of Object.entries(row)) {
            const key = normalize(rawKey);
            const mappedKey = HEADER_MAP[key];
            if (!mappedKey) continue;
            out[mappedKey] = value;
          }
          out.external_id = String(out.external_id ?? "").trim();
          out.name = String(out.name ?? "").trim();
          out.unit = out.unit ? String(out.unit) : null;
          out.cost_price = parseMoney(out.cost_price);
          out.sale_price = parseMoney(out.sale_price);
          out.brand = out.brand ? String(out.brand) : null;
          out.grouping = out.grouping ? String(out.grouping) : null;
          out.power = out.power ? String(out.power) : null;
          out.size = out.size ? String(out.size) : null;
          out.supplier = out.supplier ? String(out.supplier) : null;
          out.status = out.status ? String(out.status) : null;
          out.specs = out.specs ? String(out.specs) : null;
          return out as Product;
        })
        .filter((p) => p.external_id && p.name);

      if (mapped.length === 0) {
        alert("Nenhuma linha valida encontrada na planilha.");
        setLoading(false);
        return;
      }

      const res = await fetchJson<{ upserted: number }>(`${API}/products/bulk-upsert`, {
        method: "POST",
        body: JSON.stringify(mapped),
      });
      setImportCount(res.upserted);
      await loadProducts();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao importar: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIdx = Math.min(total, startIdx + products.length);

  return (
    <>
      <Sidebar />
      <div className="ml-16 min-h-screen bg-[#F7F7F7] p-6">
        <div className="bg-white/90 backdrop-blur rounded-xl border border-gray-200 shadow-sm mt-8 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Produtos</h2>
              <p className="text-gray-500 text-sm">Gerencie seu catalogo e importe planilhas XLSX</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                onClick={() => {
                  setEditing(null);
                  setForm({});
                  setShowForm(true);
                }}
              >
                + Novo Produto
              </button>
              <label className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.currentTarget.value = "";
                  }}
                />
                Importar XLSX
              </label>
            </div>
          </div>

          {fileName && (
            <div className="mt-3 text-xs text-gray-500">
              Arquivo: <span className="font-medium">{fileName}</span>
              {importCount !== null && <span className="ml-2">— Itens processados: {importCount}</span>}
            </div>
          )}

          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <input
                type="text"
                placeholder="Pesquisar por nome..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Todos os status</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-600 bg-gray-50">
                  <th className="py-2.5 px-3 text-xs font-semibold tracking-wide uppercase whitespace-nowrap">Nome do Produto</th>
                  <th className="py-2.5 px-3 text-xs font-semibold tracking-wide uppercase whitespace-nowrap">Descricao</th>
                  <th className="py-2.5 px-3 text-xs font-semibold tracking-wide uppercase whitespace-nowrap">Preco de Venda</th>
                  <th className="py-2.5 px-3 text-xs font-semibold tracking-wide uppercase whitespace-nowrap">Preco de Custo</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700">
                {products.map((p) => (
                  <tr key={p.id || p.external_id} className="border-t border-gray-100 hover:bg-gray-50/80">
                    <td className="py-2.5 px-3 max-w-[360px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="block truncate font-medium text-gray-900" title={p.name}>
                          {p.name}
                        </span>
                        <div className="flex items-center gap-2 opacity-60 hover:opacity-100">
                          <button
                            className="p-1 rounded hover:bg-gray-100 text-gray-600"
                            title="Editar"
                            onClick={() => {
                              setEditing(p);
                              setForm({ ...p });
                              setShowForm(true);
                            }}
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-gray-100 text-red-600"
                            title="Excluir"
                            onClick={async () => {
                              if (!p.id) return alert("Produto sem id");
                              if (!confirm("Excluir este produto?")) return;
                              try {
                                await fetchJson(`${API}/products/${p.id}`, { method: "DELETE" });
                                setProducts((prev) => prev.filter((x) => x.id !== p.id));
                              } catch (e: any) {
                                alert(e?.message || "Erro ao excluir");
                              }
                            }}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 max-w-[520px]">
                      <span className="block truncate text-gray-600" title={p.specs || "-"}>
                        {p.specs || "-"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-emerald-700">
                      {p.sale_price != null
                        ? p.sale_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">
                      {p.cost_price != null
                        ? p.cost_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "-"}
                    </td>
                  </tr>
                ))}
                {total === 0 && !loading && (
                  <tr>
                    <td className="py-6 px-3 text-gray-500 text-sm" colSpan={4}>
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginacao */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3">
            <div className="text-xs text-gray-600">
              Mostrando {total === 0 ? 0 : startIdx + 1}-{endIdx} de {total}
            </div>
            <div className="flex items-center gap-3">
              <select
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}/pagina
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Proxima
                </button>
              </div>
            </div>
          </div>

          {loading && <div className="text-sm text-gray-600">Carregando...</div>}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 relative">
              <button
                className="absolute top-3 right-4 text-gray-500 hover:text-black"
                onClick={() => setShowForm(false)}
                aria-label="Fechar"
              >
                x
              </button>
              <h3 className="text-lg font-semibold text-[#204A34] mb-4">{editing ? 'Editar Produto' : 'Novo Produto'}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Nome</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.name || ""}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do produto"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ID (planilha)</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.external_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, external_id: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Unidade</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.unit || ""}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Descricao</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.name || ""}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Preco de Custo</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.cost_price ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Preco de Venda</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.sale_price ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Marca</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.brand || ""}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Agrupamento</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.grouping || ""}
                    onChange={(e) => setForm((f) => ({ ...f, grouping: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Potencia</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.power || ""}
                    onChange={(e) => setForm((f) => ({ ...f, power: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Tamanho</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.size || ""}
                    onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fornecedor</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.supplier || ""}
                    onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Situacao</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.status || ""}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Especificacoes</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 min-h-[80px]"
                    value={form.specs || ""}
                    onChange={(e) => setForm((f) => ({ ...f, specs: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button className="px-4 py-2 rounded-lg border" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-[#204A34] text-white hover:bg-[#42CD55]"
                  onClick={async () => {
                    try {
                      const payload: any = { ...form };
                      if (!payload.name || String(payload.name).trim() === '') {
                        alert('Informe o nome do produto');
                        return;
                      }
                      // normaliza precos para numero (pt-BR)
                      if (payload.cost_price !== undefined)
                        payload.cost_price = parseMoney(payload.cost_price);
                      if (payload.sale_price !== undefined)
                        payload.sale_price = parseMoney(payload.sale_price);

                      if (editing?.id) {
                        const updated = await fetchJson<Product>(`${API}/products/${editing.id}`, {
                          method: "PUT",
                          body: JSON.stringify(payload),
                        });
                        setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      } else {
                        const created = await fetchJson<Product>(`${API}/products`, {
                          method: 'POST',
                          body: JSON.stringify(payload),
                        });
                        setProducts((prev) => [created, ...prev]);
                        // ir para primeira página para ver o item, opcional
                        setPage(1);
                      }
                      setShowForm(false);
                      setEditing(null);
                      setForm({});
                    } catch (e: any) {
                      alert(e?.message || "Erro ao salvar");
                    }
                  }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ProdutosPage;
