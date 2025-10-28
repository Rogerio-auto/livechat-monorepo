import { useMemo, type ReactNode } from "react";
import { API, fetchJson } from "../../utils/api";

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
};

const inputClasses = "config-input w-full rounded-xl px-3 py-2 disabled:opacity-60";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <div className="text-sm config-text-muted mb-1">{label}</div>
    {children}
  </label>
);

export default function EmpresaPanel({ form, baseline, setForm, onSaved, disabled }: EmpresaPanelProps) {
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

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
    <section className="config-card rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-semibold config-heading mb-2">Configuracao da Empresa</h3>
      <p className="text-sm config-text-muted mb-4">Atualize dados da empresa, logo e endereco.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome da empresa">
          <input
            className={inputClasses}
            value={form.empresa}
            onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))}
            autoComplete="organization"
            disabled={disabled}
          />
        </Field>

        <Field label="Logo (URL)">
          <input
            className={inputClasses}
            value={form.logoUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
            autoComplete="off"
            disabled={disabled}
          />
        </Field>

        <Field label="Endereco">
          <input
            className={inputClasses}
            value={form.endereco}
            onChange={(e) => setForm((prev) => ({ ...prev, endereco: e.target.value }))}
            autoComplete="street-address"
            disabled={disabled}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Cidade">
            <input
              className={inputClasses}
              value={form.cidade}
              onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))}
              autoComplete="address-level2"
              disabled={disabled}
            />
          </Field>
          <Field label="UF">
            <input
              className={inputClasses}
              value={form.uf}
              maxLength={2}
              onChange={(e) => setForm((prev) => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
              autoComplete="address-level1"
              disabled={disabled}
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm config-heading">
          <div className="font-medium">Plano atual</div>
          <div className="config-text-muted">Recursos variam conforme plano. Entre em contato para upgrade.</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="config-btn px-3 py-2 rounded-lg disabled:opacity-60" disabled>
            Gerenciar pagamento
          </button>
          <button className="config-btn-primary px-3 py-2 rounded-lg disabled:opacity-60" disabled>
            Ver planos
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={save}
          disabled={!dirty || disabled}
          className={`px-3 py-2 rounded-lg ${
            dirty && !disabled ? "config-btn-primary" : "config-btn"
          } disabled:opacity-60`}
        >
          Salvar
        </button>
        <button
          onClick={reset}
          disabled={!dirty || disabled}
          className="config-btn px-3 py-2 rounded-lg disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
