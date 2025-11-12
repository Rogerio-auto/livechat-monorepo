import { useMemo, useState, type ReactNode } from "react";
import { API, fetchJson, getAccessToken } from "../../utils/api";

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

const inputClasses = "w-full rounded-xl px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-60 transition-colors duration-200";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</div>
    {children}
  </label>
);

export default function EmpresaPanel({ form, baseline, setForm, onSaved, disabled, userRole }: EmpresaPanelProps) {
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
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
    <section className="space-y-6">
      {!isAdmin && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Visualização limitada:</strong> Informações de plano e configurações avançadas são visíveis apenas para Administradores, Gerentes e Supervisores.
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome da empresa">
          <input
            className={inputClasses}
            value={form.empresa}
            onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))}
            autoComplete="organization"
            disabled={disabled}
            placeholder="Digite o nome da empresa"
          />
        </Field>

        <Field label="Logo da Empresa">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {form.logoUrl && (
                <img 
                  src={form.logoUrl} 
                  alt="Logo preview" 
                  className="w-20 h-20 object-contain rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2"
                />
              )}
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleLogoUpload}
                  disabled={disabled || uploading}
                  className="hidden"
                  id="logo-upload"
                />
                <div className="cursor-pointer px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600 transition text-sm flex items-center gap-2 justify-center">
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Enviando...
                    </>
                  ) : form.logoUrl ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Atualizar logo
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Escolher logo
                    </>
                  )}
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PNG, máx 2MB, dimensões máx 1000x1000px
            </p>
            {uploadError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {uploadError}
              </p>
            )}
          </div>
        </Field>

        <Field label="Endereço">
          <input
            className={inputClasses}
            value={form.endereco}
            onChange={(e) => setForm((prev) => ({ ...prev, endereco: e.target.value }))}
            autoComplete="street-address"
            disabled={disabled}
            placeholder="Rua, número, complemento"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Cidade">
              <input
                className={inputClasses}
                value={form.cidade}
                onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))}
                autoComplete="address-level2"
                disabled={disabled}
                placeholder="Cidade"
              />
            </Field>
          </div>
          <Field label="UF">
            <input
              className={inputClasses}
              value={form.uf}
              maxLength={2}
              onChange={(e) => setForm((prev) => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
              autoComplete="address-level1"
              disabled={disabled}
              placeholder="SP"
            />
          </Field>
        </div>
      </div>

  <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800 transition-colors duration-300">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Plano atual
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Recursos variam conforme plano. Entre em contato para upgrade.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition font-medium disabled:opacity-60" disabled>
              Gerenciar pagamento
            </button>
            <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium transition shadow-md disabled:opacity-60" disabled>
              Ver planos
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={save}
          disabled={!dirty || disabled}
          className={`px-6 py-2.5 rounded-xl font-medium transition shadow-md disabled:opacity-60 ${
            dirty && !disabled 
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white" 
              : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
          }`}
        >
          Salvar alterações
        </button>
        <button
          onClick={reset}
          disabled={!dirty || disabled}
          className="px-6 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition font-medium disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
