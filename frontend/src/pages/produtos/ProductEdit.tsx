import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useCompany } from "../../hooks/useCompany";
import { getCatalogConfig, getFieldLabel, isFieldVisible, isFieldRequired } from "../../config/catalog-config";
import { Product, ProductForm, ItemType } from "./types";
import { ArrowLeft, Save, X } from "lucide-react";

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

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { company } = useCompany();
  const config = getCatalogConfig(company?.industry);
  const [form, setForm] = useState<Partial<ProductForm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const modalInputClass = "mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-(--color-text) placeholder-(--color-text-muted) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]";

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await fetchJson<Product>(`${API}/api/products/${id}`);
        setForm(data as any);
      } catch (error: any) {
        alert(error?.message || "Erro ao carregar produto");
        navigate("/produtos");
      } finally {
        setLoading(false);
      }
    };
    if (id) loadProduct();
  }, [id, navigate]);

  const handleSave = async () => {
    try {
      setSaving(true);
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

      await fetchJson<Product>(`${API}/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      navigate("/produtos");
    } catch (error: any) {
      alert(error?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--color-primary) border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="mx-auto w-full max-w-[1200px] px-3 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 text-sm text-(--color-text-muted) mb-2">
              <Link to="/produtos" className="hover:text-(--color-primary) transition-colors">Produtos</Link>
              <span>/</span>
              <span className="text-(--color-text) font-medium">Editar {config.labels.itemName}</span>
            </div>
            <h1 className="text-3xl font-bold text-(--color-text)">Editar {config.labels.itemName}</h1>
            <p className="mt-2 text-(--color-text-muted)">Altere as informações do item abaixo.</p>
          </div>

          <div className="">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {isFieldVisible("name", company?.industry) && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("item_type", company?.industry)}
                    {isFieldRequired("item_type", company?.industry) && " *"}
                  </label>
                  <select
                    className={modalInputClass}
                    value={form.item_type || "PRODUCT"}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("sku", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("unit", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("description", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("cost_price", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("sale_price", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("duration_minutes", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("billing_type", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("brand", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("grouping", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("power", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("size", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("supplier", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("status", company?.industry)}
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
                  <label className="block text-sm font-bold text-(--color-text) mb-2">
                    {getFieldLabel("specs", company?.industry)}
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

            <div className="mt-12 flex flex-col gap-3 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="px-5 py-2.5 text-sm font-bold text-slate-500 transition-all duration-200 hover:text-slate-900 dark:hover:text-white"
                onClick={() => navigate("/produtos")}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-xl bg-[#2fb463] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#2fb463]/20 transition-all duration-200  hover:bg-[#1f8b49] disabled:opacity-50"
                onClick={handleSave}
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
