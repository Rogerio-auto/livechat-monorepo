import { useMemo, useState, type ReactNode } from "react";
import { API, fetchJson, getAccessToken } from "../../utils/api";
import { PlansSection } from "./PlansSection";

export type CompanyForm = {
  empresa: string;
  endereco: string;
  cidade: string;
  uf: string;
  logoUrl: string;
};

type EmpresaPanelProps = {
  form: CompanyForm;
  baseline: CompanyForm;
  setForm: (updater: (prev: CompanyForm) => CompanyForm) => void;
  onSaved: (next: CompanyForm) => void;
  disabled?: boolean;
  userRole?: string | null;
};

const inputClasses = "w-full rounded-md px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 transition-all duration-200 text-sm shadow-xs";

const Field = ({ label, children, description }: { label: string; children: ReactNode; description?: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-b border-gray-50 dark:border-gray-800 last:border-0">
    <div className="md:col-span-1">
      <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
      {description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</div>}
    </div>
    <div className="md:col-span-2">
      {children}
    </div>
  </div>
);

export default function EmpresaPanel({ form, baseline, setForm, onSaved, disabled, userRole }: EmpresaPanelProps) {
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  
  // Verificar se o usuário tem permissão para editar informações sensíveis
  const isAdmin = useMemo(() => {
    const role = String(userRole || "").toUpperCase();
    return ["ADMIN", "MANAGER", "SUPERVISOR"].includes(role);
  }, [userRole]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/png')) {
      setUploadError('Apenas arquivos PNG são permitidos');
      return;
    }

    // Validar tamanho (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setUploadError('O arquivo deve ter no máximo 2MB');
      return;
    }

    // Upload via backend
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const token = getAccessToken();
      const response = await fetch(`${API}/api/upload/company-logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include', // Envia cookies junto
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const data = await response.json();
      setForm((prev) => ({ ...prev, logoUrl: data.url }));
      setUploadError(null);
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      setUploadError(error.message || 'Erro ao fazer upload da imagem');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const payload = {
      name: form.empresa,
      address: form.endereco,
      city: form.cidade,
      state: form.uf,
      logo: form.logoUrl,
    };

    await fetchJson(`${API}/companies/me`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    onSaved({ ...form });
  };

  const reset = () => {
    setForm(() => ({ ...baseline }));
  };

  return (
    <section className="space-y-0">
      {!isAdmin && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-md p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Visualização limitada:</strong> Informações de plano e configurações avançadas são visíveis apenas para Administradores, Gerentes e Supervisores.
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        <Field label="Nome da empresa" description="O nome público da sua organização.">
          <input
            className={inputClasses}
            value={form.empresa}
            onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))}
            autoComplete="organization"
            disabled={disabled}
            placeholder="Ex: Minha Empresa LTDA"
          />
        </Field>

        <Field label="Logo da Empresa" description="PNG de até 2MB. Recomendado 512x512px.">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-20 h-20 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                <input type="file" accept="image/png" onChange={handleLogoUpload} disabled={disabled || uploading} className="hidden" />
                {uploading ? "Enviando..." : "Alterar logo"}
              </label>
              {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}
            </div>
          </div>
        </Field>

        <Field label="Endereço" description="Endereço físico da sede da empresa.">
          <div className="space-y-3">
            <input
              className={inputClasses}
              value={form.endereco}
              onChange={(e) => setForm((prev) => ({ ...prev, endereco: e.target.value }))}
              autoComplete="street-address"
              disabled={disabled}
              placeholder="Rua, número, complemento"
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  className={inputClasses}
                  value={form.cidade}
                  onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))}
                  autoComplete="address-level2"
                  disabled={disabled}
                  placeholder="Cidade"
                />
              </div>
              <input
                className={inputClasses}
                value={form.uf}
                maxLength={2}
                onChange={(e) => setForm((prev) => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                autoComplete="address-level1"
                disabled={disabled}
                placeholder="UF"
              />
            </div>
          </div>
        </Field>

        <div className="py-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Plano e Assinatura</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Gerencie seu plano atual e faturamento.</p>
            </div>
            <button
              onClick={() => setShowPlans(!showPlans)}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showPlans ? "Ocultar detalhes" : "Ver planos"}
            </button>
          </div>
          
          {showPlans ? (
            <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <PlansSection />
            </div>
          ) : (
            <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">Plano Profissional</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Sua assinatura está ativa</div>
                </div>
              </div>
              <button className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                Gerenciar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-8 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={reset}
          disabled={!dirty || disabled}
          className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={!dirty || disabled}
          className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 disabled:bg-gray-400 transition-all"
        >
          Salvar alterações
        </button>
      </div>
    </section>
  );
}

