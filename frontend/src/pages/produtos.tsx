import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { FaEdit, FaTrash, FaEye } from "react-icons/fa";
import { ImageIcon } from "lucide-react";
import { useCompany } from "../hooks/useCompany";
import { getCatalogConfig, getFieldLabel, isFieldVisible, isFieldRequired } from "../config/catalog-config";
import { Product, ProductForm, ItemType } from "@livechat/shared";

// =============================
// Tipos
// =============================
// Removidos pois agora estão em ./produtos/types.ts

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
  const [stats, setStats] = useState({ total: 0, active: 0, totalValue: 0, categoriesCount: 0 });
  const [fileName, setFileName] = useState<string | null>(null);
  const [importCount, setImportCount] = useState<number | null>(null);
  const [page, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<'list' | 'categories' | 'suppliers' | 'calculator'>('list');

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

  const summaryCards = [
    {
      key: "total",
      title: `Total de ${config.labels.itemNamePlural}`,
      primary: stats.total,
      secondary: "Itens cadastrados",
      accent: "bg-emerald-500/20",
    },
    {
      key: "active",
      title: "Em Estoque / Ativos",
      primary: stats.active,
      secondary: "Disponíveis para venda",
      accent: "bg-blue-500/20",
    },
    {
      key: "value",
      title: "Valor em Catálogo",
      primary: stats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      secondary: "Soma dos preços de venda",
      accent: "bg-purple-500/20",
    },
    {
      key: "types",
      title: "Categorias",
      primary: stats.categoriesCount,
      secondary: "Grupos distintos",
      accent: "bg-amber-500/20",
    },
  ];

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
    if (res.status === 204) return null as T;
    return res.json();
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      // Carregar estatísticas em paralelo
      const statsPromise = fetchJson<typeof stats>(`${API}/api/products/stats`);
      
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      
      const [resp, statsResp] = await Promise.all([
        fetchJson<{ items: Product[]; total: number }>(`${API}/api/products?${params.toString()}`),
        statsPromise.catch(() => stats) // Fallback se falhar
      ]);
      
      setProducts(resp.items || []);
      setTotal(resp.total || 0);
      setStats(statsResp);
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
          out.external_id = String(out.external_id ?? "").trim().toLowerCase();
          out.name = String(out.name ?? "").trim();
          out.item_type = "PRODUCT";
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
  
  const filterInputClass = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2 text-sm text-(--color-text) placeholder-(--color-text-muted) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]";
  const filterSelectClass = "rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2 text-sm text-(--color-text) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]";
  const modalInputClass = "mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-(--color-text) placeholder-(--color-text-muted) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]";

  const tabs = [
    { id: 'list', label: 'Lista de Itens', icon: <FaEdit /> },
    { id: 'categories', label: 'Categorias', icon: <FaEdit />, visible: ['retail', 'construction', 'solar_energy', 'accounting'].includes(company?.industry || '') },
    { id: 'suppliers', label: 'Fornecedores', icon: <FaEdit />, visible: config.features.supplierManagement },
    { id: 'calculator', label: 'Calculadora Solar', icon: <FaEdit />, visible: company?.industry === 'solar_energy' },
  ].filter(t => t.visible !== false);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="mx-auto w-full max-w-[1920px] px-3 pb-10 pt-6 sm:px-6 lg:px-8">
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
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2 text-sm font-semibold text-(--color-text) transition-all hover:border-(--color-primary) hover:text-(--color-primary)"
              >
                Recarregar lista
              </button>
              {config.features.xlsxImport && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[rgba(47,180,99,0.28)] bg-transparent px-4 py-2 text-sm font-semibold text-(--color-primary) transition-all hover:bg-[rgba(47,180,99,0.12)]">
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
                onClick={() => navigate("/produtos/novo")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2fb463] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition-all duration-200  hover:bg-[#1f8b49]"
              >
                {config.labels.addButton}
              </button>
            </div>
          </div>

          {/* Tabs Navigation */}
          {tabs.length > 1 && (
            <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-3 text-sm font-semibold transition-all relative ${
                    activeTab === tab.id
                      ? "text-(--color-primary)"
                      : "text-(--color-text-muted) hover:text-(--color-text)"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--color-primary)" />
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'list' && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card) => (
                  <div key={card.key} className="relative overflow-hidden p-5 border border-slate-100 dark:border-slate-800 rounded-xl">
                    <div className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full ${card.accent} blur-3xl`} />
                    <div className="relative">
                      <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">{card.title}</p>
                      <div className="mt-3 text-2xl font-bold text-(--color-text)">{card.primary}</div>
                      <p className="mt-1 text-xs text-(--color-text-muted)">{card.secondary}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 py-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Pesquisar por nome..."
                      className={filterInputClass}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPageNum(1);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <select
                      className={filterSelectClass}
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPageNum(1);
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
                      className="h-14 animate-pulse rounded-xl bg-slate-100/50 dark:bg-slate-800/50"
                    />
                  ))}
                </div>
              ) : total === 0 ? (
                <div className="flex flex-col items-center justify-center px-8 py-16 text-center text-(--color-text-muted)">
                  <p className="text-sm">Nenhum produto encontrado.</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
                    <span className="rounded-full bg-[rgba(47,180,99,0.16)] px-3 py-1 font-semibold text-(--color-primary)">
                      Dica: importe um XLSX ou cadastre manualmente
                    </span>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto text-left">
                      <thead className="text-xs uppercase tracking-wide text-(--color-text-muted)">
                        <tr>
                          {config.tableColumns.map((col) => (
                            <th key={col} className="px-4 py-3 font-semibold border-b border-slate-100 dark:border-slate-800">
                              {getFieldLabel(col, company?.industry)}
                            </th>
                          ))}
                          <th className="px-4 py-3 font-semibold border-b border-slate-100 dark:border-slate-800">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        {products.map((product) => (
                          <tr
                            key={product.id || product.external_id}
                            className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                          >
                            {config.tableColumns.map((col) => {
                              const isNameColumn = col === "name";
                              const isImageColumn = col === "image_url";
                              const isDescription = col === "description" || col === "specs";
                              const value = formatFieldValue(product, col);
                              return (
                                <td
                                  key={col}
                                  className={`px-4 py-3 align-top ${
                                    isNameColumn
                                      ? "max-w-[360px]"
                                      : isImageColumn
                                      ? "w-16"
                                      : isDescription
                                      ? "max-w-[520px]"
                                      : "max-w-[220px]"
                                  }`}
                                >
                                  {isImageColumn ? (
                                    <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                                      {product.images && product.images.length > 0 ? (
                                        <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                                      ) : product.image_url ? (
                                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <ImageIcon className="w-4 h-4 text-slate-400" />
                                      )}
                                    </div>
                                  ) : isNameColumn ? (
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
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-(--color-text) transition hover:border-(--color-primary) hover:text-(--color-primary)"
                                  title="Visualizar"
                                  onClick={() => navigate(`/produtos/${product.id}`)}
                                >
                                  <FaEye />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-(--color-text) transition hover:border-(--color-primary) hover:text-(--color-primary)"
                                  title="Editar"
                                  onClick={() => navigate(`/produtos/${product.id}/editar`)}
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

              <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-(--color-text-muted)">
                  Mostrando {total === 0 ? 0 : startIdx + 1}-{endIdx} de {total}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <select
                    className={filterSelectClass}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPageNum(1);
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
                      className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2 text-sm font-semibold text-(--color-text) transition disabled:opacity-50 hover:border-(--color-primary) hover:text-(--color-primary)"
                      disabled={currentPage <= 1}
                      onClick={() => setPageNum((prev) => Math.max(1, prev - 1))}
                    >
                      Anterior
                    </button>
                    <span className="text-sm font-semibold text-(--color-text)">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2 text-sm font-semibold text-(--color-text) transition disabled:opacity-50 hover:border-(--color-primary) hover:text-(--color-primary)"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPageNum((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'categories' && (
            <div className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <FaEdit className="text-slate-400 text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-(--color-text)">Gestão de Categorias</h3>
              <p className="text-sm text-(--color-text-muted) max-w-md mx-auto mt-2">
                Em breve você poderá gerenciar categorias de forma independente. Por enquanto, utilize o campo "Agrupamento" no cadastro do item.
              </p>
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <FaEdit className="text-slate-400 text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-(--color-text)">Gestão de Fornecedores</h3>
              <p className="text-sm text-(--color-text-muted) max-w-md mx-auto mt-2">
                Módulo de fornecedores em desenvolvimento. Utilize o campo "Fornecedor" no cadastro do item para rastreabilidade.
              </p>
            </div>
          )}

          {activeTab === 'calculator' && (
            <div className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                <FaEdit className="text-emerald-500 text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-(--color-text)">Calculadora de Dimensionamento</h3>
              <p className="text-sm text-(--color-text-muted) max-w-md mx-auto mt-2">
                Ferramenta para calcular a quantidade de painéis e inversores necessários com base no consumo do cliente.
              </p>
              <button className="mt-6 rounded-xl bg-[#2fb463] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f8b49]">
                Abrir Calculadora
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProdutosPage;

