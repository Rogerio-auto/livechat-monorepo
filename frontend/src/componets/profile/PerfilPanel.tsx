import { useMemo, useState } from "react";
import { API, fetchJson } from "../../utils/api";
import { Input, Button } from "../../components/ui";

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
  const passwordsFilled = Boolean(form.novaSenha) || Boolean(form.confirmarSenha);
  const pwMismatch = passwordsFilled && form.novaSenha !== form.confirmarSenha;

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
    <section className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nome"
          placeholder="Seu nome"
          value={form.nome}
          onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
          autoComplete="name"
          disabled={disabled}
        />
        <Input
          label="Avatar (URL)"
          placeholder="https://exemplo.com/avatar.png"
          value={form.avatarUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
          autoComplete="off"
          disabled={disabled}
          helperText="Imagem usada no canto superior e em mensagens"
        />

        <Input
          label="Senha atual"
          type="password"
          placeholder="••••••••"
          value={form.senhaAtual}
          onChange={(e) => setForm((prev) => ({ ...prev, senhaAtual: e.target.value }))}
          autoComplete="current-password"
          disabled={disabled}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nova senha"
            type="password"
            placeholder="Nova senha"
            value={form.novaSenha}
            onChange={(e) => setForm((prev) => ({ ...prev, novaSenha: e.target.value }))}
            autoComplete="new-password"
            disabled={disabled}
            error={pwMismatch ? "As senhas não conferem" : undefined}
          />
          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Repita a senha"
            value={form.confirmarSenha}
            onChange={(e) => setForm((prev) => ({ ...prev, confirmarSenha: e.target.value }))}
            autoComplete="new-password"
            disabled={disabled}
            error={pwMismatch ? "As senhas não conferem" : undefined}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          variant="gradient"
          onClick={saveMain}
          disabled={!dirtyMain || disabled}
        >
          Salvar alterações
        </Button>
        <Button
          variant="secondary"
          onClick={resetMain}
          disabled={!dirtyMain || disabled}
        >
          Cancelar
        </Button>
      </div>

      <div className="flex gap-3">
        <Button
          variant="primary"
          onClick={savePassword}
          disabled={disabled || savingPw || !form.novaSenha || form.novaSenha !== form.confirmarSenha}
        >
          {savingPw ? "Salvando..." : "Atualizar senha"}
        </Button>
      </div>
    </section>
  );
}
