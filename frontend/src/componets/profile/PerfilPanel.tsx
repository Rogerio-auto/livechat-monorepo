import { useMemo, useState, type ReactNode } from "react";
import { API, fetchJson } from "../../utils/api";

export type ProfileForm = {
  nome: string;
  avatarUrl: string;
  senhaAtual: string;
  novaSenha: string;
  confirmarSenha: string;
};

type PerfilPanelProps = {
  form: ProfileForm;
  baseline: Pick<ProfileForm, "nome" | "avatarUrl">;
  setForm: (updater: (prev: ProfileForm) => ProfileForm) => void;
  onSaved: (next: Pick<ProfileForm, "nome" | "avatarUrl">) => void;
  onNameAvatarSaved?: (name: string, avatarUrl: string) => void;
  disabled?: boolean;
};

const inputClasses = "w-full rounded-xl px-3 py-2 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <div className="text-sm text-gray-600 mb-1">{label}</div>
    {children}
  </label>
);

export default function PerfilPanel({
  form,
  baseline,
  setForm,
  onSaved,
  onNameAvatarSaved,
  disabled,
}: PerfilPanelProps) {
  const dirtyMain = useMemo(
    () => form.nome !== baseline.nome || form.avatarUrl !== baseline.avatarUrl,
    [form, baseline],
  );

  const [savingPw, setSavingPw] = useState(false);

  const saveMain = async () => {
    await fetchJson(`${API}/me/profile`, {
      method: "PUT",
      body: JSON.stringify({ name: form.nome, avatarUrl: form.avatarUrl }),
    });
    onSaved({ nome: form.nome, avatarUrl: form.avatarUrl });
    onNameAvatarSaved?.(form.nome, form.avatarUrl);
  };

  const resetMain = () => {
    setForm((prev) => ({
      ...prev,
      nome: baseline.nome,
      avatarUrl: baseline.avatarUrl,
    }));
  };

  const savePassword = async () => {
    if (!form.novaSenha || form.novaSenha !== form.confirmarSenha || disabled) return;
    setSavingPw(true);
    try {
      await fetchJson(`${API}/me/profile`, {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: form.senhaAtual,
          newPassword: form.novaSenha,
          confirmPassword: form.confirmarSenha,
        }),
      });
      setForm((prev) => ({ ...prev, senhaAtual: "", novaSenha: "", confirmarSenha: "" }));
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[#204A34] mb-2">Configuracao do Perfil</h3>
      <p className="text-sm text-gray-600 mb-4">Atualize nome, avatar e senha.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome">
          <input
            className={inputClasses}
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
            autoComplete="name"
            disabled={disabled}
          />
        </Field>
        <Field label="Avatar (URL)">
          <input
            className={inputClasses}
            value={form.avatarUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
            autoComplete="off"
            disabled={disabled}
          />
        </Field>
        <Field label="Senha atual">
          <input
            type="password"
            className={inputClasses}
            value={form.senhaAtual}
            onChange={(e) => setForm((prev) => ({ ...prev, senhaAtual: e.target.value }))}
            autoComplete="current-password"
            disabled={disabled}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nova senha">
            <input
              type="password"
              className={inputClasses}
              value={form.novaSenha}
              onChange={(e) => setForm((prev) => ({ ...prev, novaSenha: e.target.value }))}
              autoComplete="new-password"
              disabled={disabled}
            />
          </Field>
          <Field label="Confirmar senha">
            <input
              type="password"
              className={inputClasses}
              value={form.confirmarSenha}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmarSenha: e.target.value }))}
              autoComplete="new-password"
              disabled={disabled}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={saveMain}
          disabled={!dirtyMain || disabled}
          className={`px-3 py-2 rounded-lg text-white ${dirtyMain && !disabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-300"}`}
        >
          Salvar
        </button>
        <button
          onClick={resetMain}
          disabled={!dirtyMain || disabled}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={savePassword}
          disabled={disabled || savingPw || !form.novaSenha || form.novaSenha !== form.confirmarSenha}
          className={`px-3 py-2 rounded-lg text-white ${(form.novaSenha && form.novaSenha === form.confirmarSenha && !disabled) ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-300"}`}
        >
          {savingPw ? "Salvando..." : "Atualizar senha"}
        </button>
      </div>
    </section>
  );
}
