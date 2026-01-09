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

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const ViewSection = ({ title, description, children, icon: Icon }: { title: string; description?: string; children: React.ReactNode; icon?: any }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm mb-8 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3">
      {Icon && <Icon className="w-5 h-5 text-(--color-primary)" />}
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const DetailItem = ({ label, value, visible, fullWidth = false }: { label: string; value: string | number | null | undefined; visible?: boolean; fullWidth?: boolean }) => {
  if (visible === false || value === null || value === undefined || value === "") return null;
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-slate-900 dark:text-white font-medium bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2.5">
        {value}
      </p>
    </div>
  );
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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
            <div className="flex items-start gap-4 sm:gap-6">
              {((product.images && product.images.length > 0) || product.image_url) && (
                <div className="flex flex-col gap-3">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl border-2 border-white dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 dark:shadow-none shrink-0">
                    <img 
                      src={product.images && product.images.length > 0 ? product.images[0] : product.image_url!} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {product.images && product.images.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-[128px] scrollbar-hide">
                      {product.images.slice(1).map((img, i) => (
                        <div key={i} className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 shadow-sm">
                          <img src={img} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  <Link to="/produtos" className="hover:text-(--color-primary) transition-colors flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" />
                    Produtos
                  </Link>
                  <span>/</span>
                  <span className="text-slate-900 dark:text-white">Visualizar Item</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-(--color-primary)/10 text-[10px] font-bold text-(--color-primary) uppercase tracking-wider">
                    {config.itemTypeOptions.find(opt => opt.value === product.item_type)?.label || (product.item_type === "SERVICE" ? "Serviço" : "Produto")}
                  </span>
                  {product.sku && (
                    <span className="text-xs font-bold text-slate-400">SKU: {product.sku}</span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight sm:text-3xl">
                  {product.name}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/produtos/${id}/editar`}
                className="rounded-lg bg-(--color-primary) px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-(--color-primary)/20 transition-all hover:brightness-110 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar {config.labels.itemName}
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ViewSection 
                title="Informações Detalhadas" 
                description="Características e propriedades do item."
                icon={Package}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DetailItem 
                    label={getFieldLabel("brand", company?.industry)} 
                    value={product.brand} 
                    visible={isFieldVisible("brand", company?.industry)} 
                  />
                  <DetailItem 
                    label={getFieldLabel("grouping", company?.industry)} 
                    value={product.grouping} 
                    visible={isFieldVisible("grouping", company?.industry)} 
                  />
                  <DetailItem 
                    label={getFieldLabel("power", company?.industry)} 
                    value={product.power} 
                    visible={isFieldVisible("power", company?.industry)} 
                  />
                  <DetailItem 
                    label={getFieldLabel("size", company?.industry)} 
                    value={product.size} 
                    visible={isFieldVisible("size", company?.industry)} 
                  />
                  <DetailItem 
                    label={getFieldLabel("supplier", company?.industry)} 
                    value={product.supplier} 
                    visible={isFieldVisible("supplier", company?.industry)} 
                  />
                  <DetailItem 
                    label={getFieldLabel("status", company?.industry)} 
                    value={product.status} 
                    visible={isFieldVisible("status", company?.industry)} 
                  />
                  {isFieldVisible("description", company?.industry) && product.description && (
                    <div className="md:col-span-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descrição</p>
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{product.description}</p>
                      </div>
                    </div>
                  )}
                  {isFieldVisible("specs", company?.industry) && product.specs && (
                    <div className="md:col-span-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Especificações Técnicas</p>
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap font-mono uppercase text-[11px]">{product.specs}</p>
                      </div>
                    </div>
                  )}
                </div>
              </ViewSection>
            </div>

            <div className="space-y-8">
              <ViewSection 
                title="Comercial" 
                description="Preços e faturamento."
                icon={DollarSign}
              >
                <div className="space-y-6">
                  {isFieldVisible("sale_price", company?.industry) && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{getFieldLabel("sale_price", company?.industry)}</p>
                      <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(product.sale_price)}</p>
                    </div>
                  )}

                  {isFieldVisible("cost_price", company?.industry) && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{getFieldLabel("cost_price", company?.industry)}</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(product.cost_price)}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{getFieldLabel("unit", company?.industry)}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{product.unit || "Unidade"}</p>
                    </div>
                    {isFieldVisible("duration_minutes", company?.industry) && product.duration_minutes && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Duração</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{product.duration_minutes}m</p>
                      </div>
                    )}
                  </div>

                  {isFieldVisible("billing_type", company?.industry) && product.billing_type && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Cobrança</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {product.billing_type === "one_time" && "Pagamento Único"}
                        {product.billing_type === "hourly" && "Por Hora"}
                        {product.billing_type === "monthly" && "Assinatura Mensal"}
                        {product.billing_type === "session" && "Por Sessão"}
                      </p>
                    </div>
                  )}
                </div>
              </ViewSection>

              <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl shadow-slate-200 dark:shadow-none">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-white/10">
                    <Info className="w-4 h-4 text-(--color-primary)" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Rastreabilidade</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">SKU Interno</span>
                    <span className="font-mono text-slate-200">{product.sku || product.id?.substring(0, 8)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Data do Cadastro</span>
                    <span className="text-slate-200">{product.created_at ? new Date(product.created_at).toLocaleDateString("pt-BR") : "---"}</span>
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

