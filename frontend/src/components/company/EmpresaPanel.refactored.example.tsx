/**
 * EXEMPLO: EmpresaPanel Refatorado com Design System
 * 
 * Este arquivo mostra como usar os componentes do design system
 * para criar um painel moderno e consistente.
 */

import { useMemo } from "react";
import { API, fetchJson } from "../../utils/api";
import { Input, Button, InfoCard } from "../../components/ui";
import type { CompanyForm } from "./EmpresaPanel";

type EmpresaPanelProps = {
  form: CompanyForm;
  baseline: CompanyForm;
  setForm: (updater: (prev: CompanyForm) => CompanyForm) => void;
  onSaved: (next: CompanyForm) => void;
  disabled?: boolean;
};

export default function EmpresaPanelRefactored({ 
  form, 
  baseline, 
  setForm, 
  onSaved, 
  disabled 
}: EmpresaPanelProps) {
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline), 
    [form, baseline]
  );

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
      {/* Grid de inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nome da empresa"
          placeholder="Digite o nome da empresa"
          value={form.empresa}
          onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))}
          autoComplete="organization"
          disabled={disabled}
        />

        <Input
          label="Logo (URL)"
          placeholder="https://exemplo.com/logo.png"
          value={form.logoUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
          autoComplete="off"
          disabled={disabled}
          helperText="Insira a URL completa da imagem do logo"
        />

        <Input
          label="Endereço"
          placeholder="Rua, número, complemento"
          value={form.endereco}
          onChange={(e) => setForm((prev) => ({ ...prev, endereco: e.target.value }))}
          autoComplete="street-address"
          disabled={disabled}
        />

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="Cidade"
              placeholder="Cidade"
              value={form.cidade}
              onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))}
              autoComplete="address-level2"
              disabled={disabled}
            />
          </div>
          <Input
            label="UF"
            placeholder="SP"
            value={form.uf}
            maxLength={2}
            onChange={(e) => setForm((prev) => ({ 
              ...prev, 
              uf: e.target.value.toUpperCase().slice(0, 2) 
            }))}
            autoComplete="address-level1"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Card de informações do plano */}
      <InfoCard
        title="Plano atual"
        description="Recursos variam conforme plano. Entre em contato para upgrade."
        color="blue"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        }
        actions={
          <>
            <Button variant="secondary" disabled>
              Gerenciar pagamento
            </Button>
            <Button variant="gradient" disabled>
              Ver planos
            </Button>
          </>
        }
      />

      {/* Botões de ação */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="gradient"
          onClick={save}
          disabled={!dirty || disabled}
        >
          Salvar alterações
        </Button>
        <Button
          variant="secondary"
          onClick={reset}
          disabled={!dirty || disabled}
        >
          Cancelar
        </Button>
      </div>
    </section>
  );
}
