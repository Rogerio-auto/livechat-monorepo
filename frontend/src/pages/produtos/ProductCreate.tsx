import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCompany } from "../../hooks/useCompany";
import { getCatalogConfig, getFieldLabel, isFieldVisible, isFieldRequired } from "../../config/catalog-config";
import { Product, ProductForm, ItemType } from "@livechat/shared";
import { ArrowLeft, Save, X, ImageIcon, Package, Info, DollarSign, Settings, Trash2 } from "lucide-react";
import MediaLibraryModal from "../../components/livechat/MediaLibraryModal";

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

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

const modalInputClass = "mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-(--color-primary) focus:ring-4 focus:ring-(--color-primary)/10 transition-all duration-200 outline-none shadow-sm";

const FormSection = ({ title, description, children, icon: Icon }: { title: string; description?: string; children: React.ReactNode; icon?: any }) => (
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

export default function ProductCreate() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const config = getCatalogConfig(company?.industry);
  const [form, setForm] = useState<Partial<ProductForm>>({});
  const [loading, setLoading] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      const payload: any = { ...form };
      if (!payload.name || String(payload.name).trim() === "") {
        alert(`Informe o nome do ${config.labels.itemName.toLowerCase()}`);
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

      await fetchJson<Product>(`${API}/api/products`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      navigate("/produtos");
    } catch (error: any) {
      alert(error?.message || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                <Link to="/produtos" className="hover:text-(--color-primary) transition-colors flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  Produtos
                </Link>
                <span>/</span>
                <span className="text-slate-900 dark:text-white">Novo {config.labels.itemName}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight sm:text-3xl">
                Novo {config.labels.itemName}
              </h1>
              <p className="mt-2 text-slate-500 text-sm">Preencha os campos abaixo para cadastrar um novo item no catálogo.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                onClick={() => navigate("/produtos")}
              >
                Descartar
              </button>
              <button
                type="button"
                disabled={loading}
                className="rounded-lg bg-(--color-primary) px-6 py-2 text-sm font-bold text-white shadow-md shadow-(--color-primary)/20 transition-all hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
                onClick={handleSave}
              >
                {loading ? "Salvando..." : (
                  <>
                    <Save className="w-4 h-4" />
                    Criar {config.labels.itemName}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-8">
            <FormSection 
              title="Visual e Identificação" 
              description="Como o produto será visto na galeria e orçamentos."
              icon={Package}
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {isFieldVisible("image_url", company?.industry) && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fotos do Produto (Até 10)</label>
                    <div className="flex flex-wrap gap-4">
                      {(form.images || []).map((url, idx) => (
                        <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden group border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:scale-105">
                          <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = [...(form.images || [])];
                              newImages.splice(idx, 1);
                              setForm(prev => ({ ...prev, images: newImages }));
                            }}
                            className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {idx === 0 && (
                            <div className="absolute bottom-0 inset-x-0 bg-primary/80 py-0.5 text-[8px] text-white text-center font-bold uppercase">Capa</div>
                          )}
                        </div>
                      ))}
                      
                      {(form.images || []).length < 10 && (
                        <div 
                          className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center bg-white dark:bg-slate-900 hover:border-(--color-primary) transition-all cursor-pointer group shadow-sm"
                          onClick={() => setShowMediaModal(true)}
                        >
                          <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-(--color-primary) mb-1" />
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adicionar</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-3">Clique no botão acima para selecionar fotos da sua galeria. A primeira foto será a capa. Máximo de 10 fotos.</p>
                  </div>
                )}

                {isFieldVisible("name", company?.industry) && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("name", company?.industry)}
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
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("item_type", company?.industry)}
                    </label>
                    <select
                      className={modalInputClass}
                      value={form.item_type || config.itemTypeOptions[0]?.value || "PRODUCT"}
                      onChange={(e) => setForm((prev) => ({ ...prev, item_type: e.target.value as ItemType }))}
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
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("sku", company?.industry)}
                    </label>
                    <input
                      className={modalInputClass}
                      value={form.sku || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
                      placeholder="Identificador único"
                    />
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection 
              title="Valores e Unidade" 
              description="Defina os custos e preços de venda do item."
              icon={DollarSign}
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {isFieldVisible("sale_price", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("sale_price", company?.industry)}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400 text-sm font-bold">R$</span>
                      </div>
                      <input
                        className={`${modalInputClass} pl-10`}
                        value={form.sale_price ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, sale_price: e.target.value }))}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                )}

                {isFieldVisible("cost_price", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("cost_price", company?.industry)}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400 text-sm font-bold">R$</span>
                      </div>
                      <input
                        className={`${modalInputClass} pl-10`}
                        value={form.cost_price ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, cost_price: e.target.value }))}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                )}

                {isFieldVisible("unit", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("unit", company?.industry)}
                    </label>
                    <input
                      className={modalInputClass}
                      value={form.unit || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                      placeholder="Ex: unidade, m2, kg"
                    />
                  </div>
                )}

                {isFieldVisible("billing_type", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("billing_type", company?.industry)}
                    </label>
                    <select
                      className={modalInputClass}
                      value={form.billing_type || "one_time"}
                      onChange={(e) => setForm((prev) => ({ ...prev, billing_type: e.target.value }))}
                    >
                      <option value="one_time">Pagamento Único</option>
                      <option value="monthly">Mensalidade</option>
                      <option value="hourly">Por Hora</option>
                      <option value="session">Por Sessão</option>
                    </select>
                  </div>
                )}

                {isFieldVisible("duration_minutes", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("duration_minutes", company?.industry)}
                    </label>
                    <input
                      type="number"
                      className={modalInputClass}
                      value={form.duration_minutes || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                      placeholder="Duração em minutos"
                    />
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection 
              title="Detalhamento e Atributos" 
              description="Informações específicas para busca e filtros internos."
              icon={Info}
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {isFieldVisible("brand", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("brand", company?.industry)}
                    </label>
                    <input
                      className={modalInputClass}
                      value={form.brand || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                      placeholder="Marca/Fabricante"
                    />
                  </div>
                )}

                {isFieldVisible("grouping", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("grouping", company?.industry)}
                    </label>
                    <input
                      className={modalInputClass}
                      value={form.grouping || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, grouping: e.target.value }))}
                      placeholder="Agrupamento/Categoria"
                    />
                  </div>
                )}

                {isFieldVisible("supplier", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("supplier", company?.industry)}
                    </label>
                    <input
                      className={modalInputClass}
                      value={form.supplier || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))}
                      placeholder="Fornecedor principal"
                    />
                  </div>
                )}

                {isFieldVisible("status", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("status", company?.industry)}
                    </label>
                    <input
                      className={modalInputClass}
                      value={form.status || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                      placeholder="Ex: Disponível"
                    />
                  </div>
                )}

                {isFieldVisible("power", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("power", company?.industry)}
                    </label>
                    <input
                      className={modalInputClass}
                      value={form.power || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, power: e.target.value }))}
                      placeholder="Ex: 550W"
                    />
                  </div>
                )}

                {isFieldVisible("size", company?.industry) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("size", company?.industry)}
                    </label>
                    <input
                      className={modalInputClass}
                      value={form.size || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}
                      placeholder="Ex: 2278 x 1134 mm"
                    />
                  </div>
                )}

                {isFieldVisible("description", company?.industry) && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("description", company?.industry)}
                    </label>
                    <textarea
                      className={`${modalInputClass} min-h-[100px] resize-y`}
                      value={form.description || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder={config.placeholders.description}
                    />
                  </div>
                )}
                
                {isFieldVisible("specs", company?.industry) && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {getFieldLabel("specs", company?.industry)}
                    </label>
                    <textarea
                      className={`${modalInputClass} min-h-[120px] resize-y`}
                      value={form.specs || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, specs: e.target.value }))}
                      placeholder={config.placeholders.specs}
                    />
                  </div>
                )}
              </div>
            </FormSection>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
              onClick={() => navigate("/produtos")}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              className="rounded-lg bg-(--color-primary) px-12 py-3 text-sm font-bold text-white shadow-lg shadow-(--color-primary)/20 transition-all hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
              onClick={handleSave}
            >
              {loading ? "Salvando..." : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar {config.labels.itemName}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showMediaModal && (
        <MediaLibraryModal
          apiBase={API}
          open={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          selectionMode={true}
          mediaType="IMAGE"
          onSelect={(media) => {
            setForm(prev => {
              const currentImages = prev.images || [];
              if (currentImages.length >= 10) return prev;
              if (currentImages.includes(media.public_url)) return prev;
              return { ...prev, images: [...currentImages, media.public_url] };
            });
            setShowMediaModal(false);
          }}
        />
      )}
    </div>
  );
}
