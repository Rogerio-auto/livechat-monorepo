import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../componets/Sidbars/sidebar";
import * as XLSX from "xlsx";
import { FaEdit, FaTrash } from "react-icons/fa";

// =============================
// Tipos
// =============================
export type ItemType = "PRODUCT" | "SERVICE" | "SUBSCRIPTION";

export type Product = {
  id?: string;
  external_id?: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  unit?: string | null;
  item_type?: ItemType;
  cost_price?: number | null;
  sale_price?: number | null;
  duration_minutes?: number | null;
  billing_type?: string | null;
  brand?: string | null;
  grouping?: string | null;
  power?: string | null;
  size?: string | null;
  supplier?: string | null;
  status?: string | null;
  specs?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

// Form permite string nos campos numéricos para não quebrar o setState
export type ProductForm = Omit<Product, "cost_price" | "sale_price" | "duration_minutes"> & {
  cost_price?: string | number | null;
  sale_price?: string | number | null;
  duration_minutes?: string | number | null;
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

function parseSpecs(specs: unknown): string {
  if (!specs) return "-";
  if (typeof specs === "string") return specs;
  if (typeof specs === "object" && specs !== null) {
    // Se tem legacy_specs, extrai o conteúdo
    if ("legacy_specs" in specs) {
      return String((specs as any).legacy_specs);
    }
    // Caso contrário, converte para JSON
    return JSON.stringify(specs);
  }
  return String(specs);
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

  const summaryMetrics = useMemo(() => {
    let saleSum = 0;
    let saleCount = 0;
    let costSum = 0;
    let costCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    products.forEach((product) => {
      if (typeof product.sale_price === "number") {
        saleSum += product.sale_price;
        saleCount += 1;
      }
      if (typeof product.cost_price === "number") {
        costSum += product.cost_price;
        costCount += 1;
      }

      const status = String(product.status || "").toLowerCase();
      if (status === "ativo") activeCount += 1;
      else if (status === "inativo") inactiveCount += 1;
    });

    return {
      totalItems: products.length,
      saleAverage: saleCount > 0 ? saleSum / saleCount : 0,
      costAverage: costCount > 0 ? costSum / costCount : 0,
      activeCount,
      inactiveCount,
    };
  }, [products]);

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
    // Se for 204 No Content, retorna null
    if (res.status === 204) {
      return null as T;
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
      const resp = await fetchJson<{ items: Product[]; total: number }>(`${API}/api/products?${params.toString()}`);
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
          out.external_id = String(out.external_id ?? "").trim().toLowerCase(); // Normalizar lowercase
          out.name = String(out.name ?? "").trim();
          out.item_type = "PRODUCT"; // Todos importados como PRODUCT por padrão
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

      const res = await fetchJson<{ upserted: number }>(`${API}/api/products/bulk-upsert`, {
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
      <div
        className="ml-16 min-h-screen p-6"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
      >
        <div
          className="mt-8 rounded-2xl border p-6 shadow-lg theme-surface"
          style={{
            borderColor: "var(--color-border)",
            boxShadow: "0 32px 48px -32px var(--color-card-shadow)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold theme-heading">Produtos</h2>
              <p className="theme-text-muted text-sm">Gerencie seu catálogo, preços e importações</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="theme-primary px-4 py-2 text-sm rounded-xl transition shadow-sm"
                onClick={() => {
                  setEditing(null);
                  setForm({});
                  setShowForm(true);
                }}
              >
                + Novo Produto
              </button>
              <label
                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border cursor-pointer theme-surface-muted"
                style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
              >
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

          <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <p className="text-xs font-medium uppercase theme-text-muted">Itens do catálogo</p>
              <p className="mt-2 text-2xl font-semibold theme-heading">{summaryMetrics.totalItems}</p>
              <p className="mt-1 text-xs theme-text-muted">{summaryMetrics.activeCount} ativos • {summaryMetrics.inactiveCount} inativos</p>
            </div>
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <p className="text-xs font-medium uppercase theme-text-muted">Preço médio de venda</p>
              <p className="mt-2 text-2xl font-semibold theme-heading">
                {summaryMetrics.saleAverage > 0
                  ? summaryMetrics.saleAverage.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "-"}
              </p>
              <p className="mt-1 text-xs theme-text-muted">Baseado em produtos com preço informado</p>
            </div>
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <p className="text-xs font-medium uppercase theme-text-muted">Preço médio de custo</p>
              <p className="mt-2 text-2xl font-semibold theme-heading">
                {summaryMetrics.costAverage > 0
                  ? summaryMetrics.costAverage.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "-"}
              </p>
              <p className="mt-1 text-xs theme-text-muted">Compare margem e rentabilidade</p>
            </div>
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <p className="text-xs font-medium uppercase theme-text-muted">Importações recentes</p>
              <p className="mt-2 text-2xl font-semibold theme-heading">{importCount ?? 0}</p>
              <p className="mt-1 text-xs theme-text-muted">Itens atualizados a partir do último XLSX</p>
            </div>
          </div>

          {fileName && (
            <div className="mt-3 text-xs theme-text-muted">
              Arquivo: <span className="font-medium theme-heading">{fileName}</span>
              {importCount !== null && <span className="ml-2">Itens processados: {importCount}</span>}
            </div>
          )}

          <div
            className="rounded-2xl border theme-surface-muted p-4 mb-6"
            style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 w-full">
                <input
                  type="text"
                  placeholder="Pesquisar por nome..."
                  className="config-input w-full rounded-xl px-3 py-2 text-sm"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <select
                  className="config-input rounded-xl px-3 py-2 text-sm"
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
          </div>

          <div
            className="overflow-auto rounded-2xl border"
            style={{ borderColor: "color-mix(in srgb, var(--color-border) 75%, transparent)" }}
          >
            <table className="w-full text-left border-collapse">
              <thead
                style={{ backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 60%, transparent)" }}
              >
                <tr className="theme-text-muted text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Nome do Produto</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Descrição</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Preço de Venda</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Preço de Custo</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {products.map((p) => (
                  <tr
                    key={p.id || p.external_id}
                    className="border-t transition-colors hover:bg-sky-50/50 dark:hover:bg-white/5"
                    style={{ borderColor: "color-mix(in srgb, var(--color-border) 70%, transparent)" }}
                  >
                    <td className="py-3 px-4 max-w-[360px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="block truncate font-medium theme-heading" title={p.name}>
                          {p.name}
                        </span>
                        <div className="flex items-center gap-2 opacity-60 transition hover:opacity-100">
                          <button
                            className="p-1 rounded-md theme-surface-muted border"
                            style={{ borderColor: "color-mix(in srgb, var(--color-border) 55%, transparent)" }}
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
                            className="p-1 rounded-md border border-transparent text-rose-600 hover:bg-rose-100 transition dark:text-rose-200 dark:hover:bg-rose-500/20"
                            title="Excluir"
                            onClick={async () => {
                              if (!p.id) return alert("Produto sem id");
                              if (!confirm("Excluir este produto?")) return;
                              try {
                                await fetchJson(`${API}/api/products/${p.id}`, { method: "DELETE" });
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
                    <td className="py-3 px-4 max-w-[520px]">
                      <span className="block truncate theme-text-muted" title={parseSpecs(p.specs)}>
                        {parseSpecs(p.specs)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium" style={{ color: "var(--color-highlight-strong)" }}>
                      {p.sale_price != null
                        ? p.sale_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "-"}
                    </td>
                    <td className="py-3 px-4 theme-text-muted">
                      {p.cost_price != null
                        ? p.cost_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "-"}
                    </td>
                  </tr>
                ))}
                {total === 0 && !loading && (
                  <tr>
                    <td className="py-6 px-4 theme-text-muted" colSpan={4}>
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginacao */}
          <div
            className="mt-6 flex flex-col gap-4 rounded-2xl border theme-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
          >
            <div className="text-xs theme-text-muted">
              Mostrando {total === 0 ? 0 : startIdx + 1}-{endIdx} de {total}
            </div>
            <div className="flex items-center gap-3">
              <select
                className="config-input rounded-xl px-2 py-1 text-sm"
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
                  className="px-3 py-1 text-sm rounded-xl border theme-surface transition disabled:opacity-50"
                  style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span className="text-sm theme-heading">
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="px-3 py-1 text-sm rounded-xl border theme-surface transition disabled:opacity-50"
                  style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>

          {loading && <div className="text-sm theme-text-muted mt-4">Carregando...</div>}
        </div>

        {showForm && (
          <div
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: "var(--color-overlay)" }}
          >
            <div
              className="relative w-full max-w-3xl rounded-2xl border p-6 shadow-xl theme-surface"
              style={{
                borderColor: "var(--color-border)",
                boxShadow: "0 40px 64px -40px var(--color-card-shadow)",
              }}
            >
              <button
                className="absolute top-3 right-4 text-sm theme-text-muted hover:opacity-70 transition"
                onClick={() => setShowForm(false)}
                aria-label="Fechar"
              >
                x
              </button>
              <h3 className="text-lg font-semibold theme-heading mb-4">{editing ? "Editar Produto" : "Novo Produto"}</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 theme-heading">Nome*</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.name || ""}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do produto/serviço"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Tipo*</label>
                  <select
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.item_type || "PRODUCT"}
                    onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value as ItemType }))}
                  >
                    <option value="PRODUCT">📦 Produto</option>
                    <option value="SERVICE">🛠️ Serviço</option>
                    <option value="SUBSCRIPTION">🔄 Assinatura</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">ID (planilha)</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.external_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, external_id: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">SKU</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.sku || ""}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="Código SKU"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Unidade</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.unit || ""}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 theme-heading">Descrição</label>
                  <textarea
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.description || ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Preço de Custo</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.cost_price ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Preço de Venda</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.sale_price ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Marca</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.brand || ""}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Agrupamento</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.grouping || ""}
                    onChange={(e) => setForm((f) => ({ ...f, grouping: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Potência</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.power || ""}
                    onChange={(e) => setForm((f) => ({ ...f, power: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Tamanho</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.size || ""}
                    onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Fornecedor</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.supplier || ""}
                    onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 theme-heading">Situação</label>
                  <input
                    className="config-input w-full rounded-lg px-3 py-2"
                    value={form.status || ""}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 theme-heading">Especificações</label>
                  <textarea
                    className="config-input w-full rounded-lg px-3 py-2 min-h-20"
                    value={form.specs || ""}
                    onChange={(e) => setForm((f) => ({ ...f, specs: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  className="px-4 py-2 rounded-xl border theme-surface-muted"
                  style={{ borderColor: "var(--color-border)" }}
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 rounded-xl theme-primary"
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
                      if (payload.duration_minutes !== undefined && payload.duration_minutes !== null && payload.duration_minutes !== "")
                        payload.duration_minutes = Number(payload.duration_minutes);
                      
                      if (!payload.item_type) payload.item_type = "PRODUCT"; // Padrão

                      if (editing?.id) {
                        const updated = await fetchJson<Product>(`${API}/api/products/${editing.id}`, {
                          method: "PUT",
                          body: JSON.stringify(payload),
                        });
                        setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      } else {
                        const created = await fetchJson<Product>(`${API}/api/products`, {
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
