import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useCompany } from "../hooks/useCompany";
import { getCatalogConfig, FIELD_LABELS, isFieldVisible, isFieldRequired } from "../config/catalog-config";

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

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "Ativo", label: "Ativo" },
  { value: "Inativo", label: "Inativo" },
];

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
  const { company } = useCompany();
  const config = getCatalogConfig(company?.industry);
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

  // Helper to format field values for display in table
  const formatFieldValue = (product: Product, field: string): string => {
    const value = product[field as keyof Product];
    
    if (value === null || value === undefined) return '-';
    
    switch (field) {
      case 'sale_price':
      case 'cost_price':
        return typeof value === 'number' 
          ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '-';
      case 'duration_minutes':
        return typeof value === 'number' ? `${value} min` : '-';
      case 'power':
        return value ? `${value}W` : '-';
      case 'size':
        return value ? `${value}m²` : '-';
      case 'specs':
        return parseSpecs(String(value));
      case 'is_active':
        return value ? 'Ativo' : 'Inativo';
      case 'billing_type':
        const billingLabels: Record<string, string> = {
          'one_time': 'Pagamento Único',
          'hourly': 'Por Hora',
          'monthly': 'Mensal',
          'session': 'Por Sessão'
        };
        return billingLabels[String(value)] || String(value);
      case 'item_type':
        const typeLabels: Record<string, string> = {
          'PRODUCT': 'Produto',
          'SERVICE': 'Serviço',
          'SUBSCRIPTION': 'Assinatura'
        };
        return typeLabels[String(value)] || String(value);
      default:
        return String(value);
    }
  };
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

  const summaryCards = useMemo(
    () => [
      {
        key: "catalog",
        title: "Itens do catálogo",
        primary: summaryMetrics.totalItems.toLocaleString("pt-BR"),
        secondary: `${summaryMetrics.activeCount} ativos • ${summaryMetrics.inactiveCount} inativos`,
        accent: "bg-[rgba(47,180,99,0.22)]",
      },
      {
        key: "saleAverage",
        title: "Preço médio de venda",
        primary:
          summaryMetrics.saleAverage > 0
            ? summaryMetrics.saleAverage.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : "-",
        secondary: "Com base nos itens com preço informado",
        accent: "bg-[rgba(47,180,99,0.18)]",
      },
      {
        key: "costAverage",
        title: "Preço médio de custo",
        primary:
          summaryMetrics.costAverage > 0
            ? summaryMetrics.costAverage.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : "-",
        secondary: "Compare sua margem e rentabilidade",
        accent: "bg-[rgba(21,63,41,0.22)]",
      },
      {
        key: "import",
        title: "Itens importados",
        primary: importCount === null ? "-" : importCount.toLocaleString("pt-BR"),
        secondary: fileName ? `Último arquivo: ${fileName}` : "Importe planilhas XLSX para atualizar o catálogo",
        accent: "bg-[rgba(59,130,246,0.18)]",
      },
    ],
    [summaryMetrics, importCount, fileName]
  );

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
  const shouldShowSkeleton = loading && products.length === 0;
  const filterInputClass = "config-input w-full rounded-xl border border-transparent bg-(--color-surface) px-4 py-2 text-sm text-(--color-text) shadow-sm focus:border-[rgba(47,180,99,0.35)] focus:outline-none";
  const filterSelectClass = "config-input rounded-xl border border-transparent bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) shadow-sm focus:border-[rgba(47,180,99,0.35)] focus:outline-none";
  const modalInputClass = "config-input mt-1 w-full rounded-xl border border-transparent bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) shadow-sm focus:border-[rgba(47,180,99,0.35)] focus:outline-none";

  return (
    <>
      <div className="livechat-theme min-h-screen w-full pb-12 transition-colors duration-500">
        <div className="mx-auto w-full max-w-(--page-max-width) px-3 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="livechat-card rounded-3xl p-6 shadow-xl md:p-8">
            <div className="space-y-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(47,180,99,0.16)] px-3 py-1 text-xs font-semibold text-(--color-primary)">
                    Catálogo inteligente
                  </div>
                  <h1 className="text-3xl font-bold text-(--color-text)">{config.labels.pageTitle}</h1>
                  <p className="text-sm text-(--color-text-muted)">{config.labels.pageDescription}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <button
                    type="button"
                    onClick={() => loadProducts()}
                    className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-4 py-2 text-sm font-semibold text-(--color-text) transition-all hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                  >
                    Recarregar lista
                  </button>
                  {config.features.xlsxImport && (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[rgba(47,180,99,0.28)] bg-[color-mix(in_srgb,var(--color-muted) 75%,transparent)] px-4 py-2 text-sm font-semibold text-(--color-primary) transition-all hover:bg-[rgba(47,180,99,0.12)]">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFile(file);
                          e.currentTarget.value = "";
                        }}
                      />
                      Importar XLSX
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setForm({});
                      setShowForm(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2fb463] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1f8b49]"
                  >
                    {config.labels.addButton}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <div key={card.key} className="relative overflow-hidden rounded-2xl livechat-panel p-5 shadow-xl">
                    <div className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full ${card.accent} blur-3xl`} />
                    <div className="relative">
                      <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">{card.title}</p>
                      <div className="mt-3 text-2xl font-bold text-(--color-text)">{card.primary}</div>
                      <p className="mt-1 text-xs text-(--color-text-muted)">{card.secondary}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Pesquisar por nome..."
                      className={filterInputClass}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <select
                      className={filterSelectClass}
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      {STATUS_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {shouldShowSkeleton ? (
                <div className="grid gap-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-14 animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)]"
                    />
                  ))}
                </div>
              ) : total === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-8 py-16 text-center text-(--color-text-muted)">
                  <p className="text-sm">Nenhum produto encontrado.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                    <span className="rounded-full bg-[rgba(47,180,99,0.16)] px-3 py-1 font-semibold text-(--color-primary)">
                      Dica: importe um XLSX ou cadastre manualmente
                    </span>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl livechat-panel shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto text-left">
                      <thead className="bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] text-xs uppercase tracking-wide text-(--color-text-muted)">
                        <tr>
                          {config.tableColumns.map((col) => (
                            <th key={col} className="px-4 py-3 font-semibold">
                              {FIELD_LABELS[col]}
                            </th>
                          ))}
                          <th className="px-4 py-3 font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color-mix(in_srgb,var(--color-muted) 65%,transparent)] text-sm">
                        {products.map((product) => (
                          <tr
                            key={product.id || product.external_id}
                            className="transition-colors hover:bg-[color-mix(in_srgb,var(--color-muted) 68%,transparent)]"
                          >
                            {config.tableColumns.map((col) => {
                              const isNameColumn = col === "name";
                              const isDescription = col === "description" || col === "specs";
                              const value = formatFieldValue(product, col);
                              return (
                                <td
                                  key={col}
                                  className={`px-4 py-3 align-top ${
                                    isNameColumn
                                      ? "max-w-[360px]"
                                      : isDescription
                                      ? "max-w-[520px]"
                                      : "max-w-[220px]"
                                  }`}
                                >
                                  {isNameColumn ? (
                                    <span className="block truncate font-semibold text-(--color-text)" title={product.name}>
                                      {product.name}
                                    </span>
                                  ) : col === "sale_price" ? (
                                    <span className="font-semibold text-(--color-primary)">{value}</span>
                                  ) : (
                                    <span
                                      className={`block truncate ${isDescription ? "text-(--color-text-muted)" : "text-(--color-text)"}`}
                                      title={value}
                                    >
                                      {value}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] text-(--color-text) transition hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                                  title="Editar"
                                  onClick={() => {
                                    setEditing(product);
                                    setForm({ ...product });
                                    setShowForm(true);
                                  }}
                                >
                                  <FaEdit />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-rose-500 transition hover:bg-rose-100"
                                  title="Excluir"
                                  onClick={async () => {
                                    if (!product.id) {
                                      alert("Produto sem id");
                                      return;
                                    }
                                    if (!confirm("Excluir este produto?")) return;
                                    try {
                                      await fetchJson(`${API}/api/products/${product.id}`, { method: "DELETE" });
                                      setProducts((prev) => prev.filter((item) => item.id !== product.id));
                                    } catch (error: any) {
                                      alert(error?.message || "Erro ao excluir");
                                    }
                                  }}
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {loading && products.length > 0 && (
                <div className="text-xs text-(--color-text-muted)">Atualizando catálogo...</div>
              )}

              <div className="flex flex-col gap-4 rounded-2xl bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-(--color-text-muted)">
                  Mostrando {total === 0 ? 0 : startIdx + 1}-{endIdx} de {total}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <select
                    className={filterSelectClass}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[10, 25, 50].map((size) => (
                      <option key={size} value={size}>
                        {size}/página
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-xl border border-transparent bg-(--color-surface) px-4 py-2 text-sm font-semibold text-(--color-text) transition disabled:opacity-50 hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Anterior
                    </button>
                    <span className="text-sm font-semibold text-(--color-text)">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-xl border border-transparent bg-(--color-surface) px-4 py-2 text-sm font-semibold text-(--color-text) transition disabled:opacity-50 hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-[rgba(7,20,13,0.7)] px-4 py-8 backdrop-blur-sm">
          <div className="livechat-card relative w-full max-w-3xl rounded-3xl p-6 shadow-2xl">
            <button
              type="button"
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] text-(--color-text-muted) transition hover:text-(--color-primary)"
              onClick={() => setShowForm(false)}
              aria-label="Fechar"
            >
              x
            </button>
            <h3 className="text-lg font-semibold text-(--color-text)">
              {editing ? `Editar ${config.labels.itemName}` : config.labels.addButton}
            </h3>
            <p className="mt-1 text-xs text-(--color-text-muted)">
              Preencha os campos abaixo para manter o catálogo alinhado com a operação.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {isFieldVisible("name", company?.industry) && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.name}
                    {isFieldRequired("name", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.name || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={config.placeholders.name}
                    required={isFieldRequired("name", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("item_type", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.item_type}
                    {isFieldRequired("item_type", company?.industry) && " *"}
                  </label>
                  <select
                    className={modalInputClass}
                    value={form.item_type || config.itemTypeOptions[0]?.value || "PRODUCT"}
                    onChange={(e) => setForm((prev) => ({ ...prev, item_type: e.target.value as ItemType }))}
                    required={isFieldRequired("item_type", company?.industry)}
                  >
                    {config.itemTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isFieldVisible("sku", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.sku}
                    {isFieldRequired("sku", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.sku || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
                    placeholder="Código SKU"
                    required={isFieldRequired("sku", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("unit", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.unit}
                    {isFieldRequired("unit", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.unit || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder={config.placeholders.unit}
                    required={isFieldRequired("unit", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("description", company?.industry) && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.description}
                    {isFieldRequired("description", company?.industry) && " *"}
                  </label>
                  <textarea
                    className={`${modalInputClass} resize-y`}
                    value={form.description || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder={config.placeholders.description}
                    rows={3}
                    required={isFieldRequired("description", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("cost_price", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.cost_price}
                    {isFieldRequired("cost_price", company?.industry) && " *"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={modalInputClass}
                    value={form.cost_price ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, cost_price: e.target.value }))}
                    placeholder="0.00"
                    required={isFieldRequired("cost_price", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("sale_price", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.sale_price}
                    {isFieldRequired("sale_price", company?.industry) && " *"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={modalInputClass}
                    value={form.sale_price ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, sale_price: e.target.value }))}
                    placeholder="0.00"
                    required={isFieldRequired("sale_price", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("duration_minutes", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.duration_minutes}
                    {isFieldRequired("duration_minutes", company?.industry) && " *"}
                  </label>
                  <input
                    type="number"
                    className={modalInputClass}
                    value={form.duration_minutes ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        duration_minutes: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    placeholder="Ex: 60"
                    required={isFieldRequired("duration_minutes", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("billing_type", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.billing_type}
                    {isFieldRequired("billing_type", company?.industry) && " *"}
                  </label>
                  <select
                    className={modalInputClass}
                    value={form.billing_type || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, billing_type: e.target.value }))}
                    required={isFieldRequired("billing_type", company?.industry)}
                  >
                    <option value="">Selecione...</option>
                    <option value="one_time">Pagamento Único</option>
                    <option value="hourly">Por Hora</option>
                    <option value="monthly">Mensal</option>
                    <option value="session">Por Sessão</option>
                  </select>
                </div>
              )}

              {isFieldVisible("brand", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.brand}
                    {isFieldRequired("brand", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.brand || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                    placeholder="Ex: Canadian Solar"
                    required={isFieldRequired("brand", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("grouping", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.grouping}
                    {isFieldRequired("grouping", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.grouping || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, grouping: e.target.value }))}
                    placeholder="Ex: Painéis, Inversores"
                    required={isFieldRequired("grouping", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("power", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.power}
                    {isFieldRequired("power", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.power || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, power: e.target.value }))}
                    placeholder="Ex: 550W"
                    required={isFieldRequired("power", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("size", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.size}
                    {isFieldRequired("size", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.size || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}
                    placeholder="Ex: 120m²"
                    required={isFieldRequired("size", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("supplier", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.supplier}
                    {isFieldRequired("supplier", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.supplier || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))}
                    placeholder="Nome do fornecedor"
                    required={isFieldRequired("supplier", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("status", company?.industry) && (
                <div>
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.status}
                    {isFieldRequired("status", company?.industry) && " *"}
                  </label>
                  <input
                    className={modalInputClass}
                    value={form.status || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                    placeholder="Ex: Disponível, Esgotado"
                    required={isFieldRequired("status", company?.industry)}
                  />
                </div>
              )}

              {isFieldVisible("specs", company?.industry) && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-(--color-text)">
                    {FIELD_LABELS.specs}
                    {isFieldRequired("specs", company?.industry) && " *"}
                  </label>
                  <textarea
                    className={`${modalInputClass} resize-y`}
                    value={form.specs || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, specs: e.target.value }))}
                    placeholder={config.placeholders.specs}
                    rows={4}
                    required={isFieldRequired("specs", company?.industry)}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-4 py-2 text-sm font-semibold text-(--color-text) transition hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-[#2fb463] px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition hover:-translate-y-0.5 hover:bg-[#1f8b49]"
                onClick={async () => {
                  try {
                    const payload: any = { ...form };
                    if (!payload.name || String(payload.name).trim() === "") {
                      alert("Informe o nome do produto");
                      return;
                    }
                    if (payload.cost_price !== undefined) {
                      payload.cost_price = parseMoney(payload.cost_price);
                    }
                    if (payload.sale_price !== undefined) {
                      payload.sale_price = parseMoney(payload.sale_price);
                    }
                    if (
                      payload.duration_minutes !== undefined &&
                      payload.duration_minutes !== null &&
                      payload.duration_minutes !== ""
                    ) {
                      payload.duration_minutes = Number(payload.duration_minutes);
                    }
                    if (!payload.item_type) {
                      payload.item_type = "PRODUCT";
                    }

                    if (editing?.id) {
                      const updated = await fetchJson<Product>(`${API}/api/products/${editing.id}`, {
                        method: "PUT",
                        body: JSON.stringify(payload),
                      });
                      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                    } else {
                      const created = await fetchJson<Product>(`${API}/api/products`, {
                        method: "POST",
                        body: JSON.stringify(payload),
                      });
                      setProducts((prev) => [created, ...prev]);
                      setPage(1);
                    }

                    setShowForm(false);
                    setEditing(null);
                    setForm({});
                  } catch (error: any) {
                    alert(error?.message || "Erro ao salvar");
                  }
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ProdutosPage;
