import { useMemo, useState } from "react";
import { API, fetchJson, getAccessToken } from "../../utils/api";
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const dirtyMain = useMemo(
    () => form.nome !== baseline.nome || form.avatarUrl !== baseline.avatarUrl,
    [form, baseline],
  );

  const [savingPw, setSavingPw] = useState(false);
  const passwordsFilled = Boolean(form.novaSenha) || Boolean(form.confirmarSenha);
  const pwMismatch = passwordsFilled && form.novaSenha !== form.confirmarSenha;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validar tipo de arquivo
    if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
      setUploadError('Apenas arquivos PNG, JPG ou JPEG são permitidos');
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
      formData.append('avatar', file);

      const token = getAccessToken();
      const response = await fetch(`${API}/api/upload/profile-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const data = await response.json();
      setForm((prev) => ({ ...prev, avatarUrl: data.url }));
      setUploadError(null);
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      setUploadError(error.message || 'Erro ao fazer upload da imagem');
    } finally {
      setUploading(false);
    }
  };

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
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Avatar
          </label>
          <div className="flex items-center gap-3">
            {form.avatarUrl && (
              <img 
                src={form.avatarUrl} 
                alt="Avatar preview" 
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-300 dark:border-gray-700"
              />
            )}
            <label className="flex-1">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleAvatarUpload}
                disabled={disabled || uploading}
                className="hidden"
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
                ) : form.avatarUrl ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Atualizar avatar
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Escolher avatar
                  </>
                )}
              </div>
            </label>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            PNG, JPG ou JPEG, máx 2MB
          </p>
          {uploadError && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {uploadError}
            </p>
          )}
        </div>

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
