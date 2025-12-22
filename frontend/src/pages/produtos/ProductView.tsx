import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useCompany } from "../../hooks/useCompany";
import { getCatalogConfig, getFieldLabel, isFieldVisible } from "../../config/catalog-config";
import { Product } from "./types";
import { ArrowLeft, Edit2, Package, Tag, Info, DollarSign, Clock, Truck, Shield } from "lucide-react";

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    const payload = await res.json().catch(() => ({}));
    throw new Error((payload as any)?.error || `HTTP ${res.status}`);
  }
  return res.json();
};

export default function ProductView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { company } = useCompany();
  const config = getCatalogConfig(company?.industry);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await fetchJson<Product>(`${API}/api/products/${id}`);
        setProduct(data);
      } catch (error: any) {
        alert(error?.message || "Erro ao carregar produto");
        navigate("/produtos");
      } finally {
        setLoading(false);
      }
    };
    if (id) loadProduct();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--color-primary) border-t-transparent"></div>
      </div>
    );
  }

  if (!product) return null;

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "N/A";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const InfoCard = ({ icon: Icon, label, value, visible }: { icon: any, label: string, value: string | number | null | undefined, visible?: boolean }) => {
    if (visible === false || value === null || value === undefined || value === "") return null;
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
        <div className="mt-1 p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
          <Icon className="w-4 h-4 text-(--color-primary)" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="mx-auto w-full max-w-[1200px] px-3 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 text-sm text-(--color-text-muted) mb-2">
              <Link to="/produtos" className="hover:text-(--color-primary) transition-colors">Produtos</Link>
              <span>/</span>
              <span className="text-(--color-text) font-medium">{product.name}</span>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {config.itemTypeOptions.find(opt => opt.value === product.item_type)?.label || (product.item_type === "SERVICE" ? "Serviço" : "Produto")}
                    </span>
                    {product.sku && (
                      <span className="text-xs font-medium text-slate-400">SKU: {product.sku}</span>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-(--color-text) mt-1">{product.name}</h1>
                </div>
              </div>
              <Link
                to={`/produtos/${id}/editar`}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#2fb463] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#2fb463]/20 transition-all duration-200  hover:bg-[#1f8b49]"
              >
                <Edit2 className="w-4 h-4" />
                Editar {config.labels.itemName}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-8">
              {/* Description Section */}
              {isFieldVisible("description", company?.industry) && product.description && (
                <div className="">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-(--color-primary)" />
                    Descrição
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Specs Section */}
              {isFieldVisible("specs", company?.industry) && product.specs && (
                <div className="">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-(--color-primary)" />
                    Especificações Técnicas
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {product.specs}
                    </p>
                  </div>
                </div>
              )}

              {/* Grid of Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoCard 
                  icon={Tag} 
                  label={getFieldLabel("brand", company?.industry)} 
                  value={product.brand} 
                  visible={isFieldVisible("brand", company?.industry)} 
                />
                <InfoCard 
                  icon={Package} 
                  label={getFieldLabel("grouping", company?.industry)} 
                  value={product.grouping} 
                  visible={isFieldVisible("grouping", company?.industry)} 
                />
                <InfoCard 
                  icon={Info} 
                  label={getFieldLabel("power", company?.industry)} 
                  value={product.power} 
                  visible={isFieldVisible("power", company?.industry)} 
                />
                <InfoCard 
                  icon={Info} 
                  label={getFieldLabel("size", company?.industry)} 
                  value={product.size} 
                  visible={isFieldVisible("size", company?.industry)} 
                />
                <InfoCard 
                  icon={Truck} 
                  label={getFieldLabel("supplier", company?.industry)} 
                  value={product.supplier} 
                  visible={isFieldVisible("supplier", company?.industry)} 
                />
                <InfoCard 
                  icon={Info} 
                  label={getFieldLabel("status", company?.industry)} 
                  value={product.status} 
                  visible={isFieldVisible("status", company?.industry)} 
                />
              </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              {/* Pricing Card */}
              <div className="">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Valores e Unidade</h2>
                
                <div className="space-y-6">
                  {isFieldVisible("sale_price", company?.industry) && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{getFieldLabel("sale_price", company?.industry)}</p>
                      <p className="text-3xl font-black text-(--color-primary)">{formatCurrency(product.sale_price)}</p>
                    </div>
                  )}

                  {isFieldVisible("cost_price", company?.industry) && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{getFieldLabel("cost_price", company?.industry)}</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(product.cost_price)}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {isFieldVisible("unit", company?.industry) && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{getFieldLabel("unit", company?.industry)}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{product.unit || "N/A"}</p>
                      </div>
                    )}
                    {isFieldVisible("duration_minutes", company?.industry) && product.duration_minutes && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{getFieldLabel("duration_minutes", company?.industry)}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{product.duration_minutes} min</p>
                      </div>
                    )}
                  </div>

                  {isFieldVisible("billing_type", company?.industry) && product.billing_type && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{getFieldLabel("billing_type", company?.industry)}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {product.billing_type === "one_time" && "Pagamento Único"}
                        {product.billing_type === "hourly" && "Por Hora"}
                        {product.billing_type === "monthly" && "Mensal"}
                        {product.billing_type === "session" && "Por Sessão"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats or Meta Info */}
              <div className="rounded-xl bg-slate-900 p-8 text-white shadow-md shadow-slate-200 dark:shadow-none">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-white/10">
                    <Package className="w-5 h-5 text-[#2fb463]" />
                  </div>
                  <h3 className="font-bold">Informações do Sistema</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">ID do Produto</span>
                    <span className="text-sm font-mono font-medium">{product.id?.substring(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Criado em</span>
                    <span className="text-sm font-medium">{product.created_at ? new Date(product.created_at).toLocaleDateString("pt-BR") : "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

