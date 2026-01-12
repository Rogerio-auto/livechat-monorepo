import { useMemo, useState, type ReactNode } from "react";
import { API, fetchJson, getAccessToken } from "../../utils/api";

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
  onSaved: (next: ProfileForm) => void;
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
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
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
    try {
      await fetchJson(`${API}/me/profile`, {
        method: "PUT",
        body: JSON.stringify({ name: form.nome, avatarUrl: form.avatarUrl }),
      });
      onSaved({ ...form, nome: form.nome, avatarUrl: form.avatarUrl });
      onNameAvatarSaved?.(form.nome, form.avatarUrl);
      alert("Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      alert(error.message || "Erro ao salvar perfil");
    }
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
    setPwError(null);
    setPwSuccess(false);
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
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (error: any) {
      console.error('Erro ao atualizar senha:', error);
      setPwError(error.message || "Erro ao atualizar senha");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <section className="space-y-0">
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        <Field label="Nome completo" description="Como você será identificado no sistema.">
          <input
            className={inputClasses}
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
            autoComplete="name"
            disabled={disabled}
            placeholder="Seu nome"
          />
        </Field>

        <Field label="Foto de perfil" description="PNG ou JPG de até 2MB.">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-16 h-16 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleAvatarUpload} disabled={disabled || uploading} className="hidden" />
                {uploading ? "Enviando..." : "Alterar foto"}
              </label>
              {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}
            </div>
          </div>
        </Field>

        <div className="flex items-center justify-end gap-3 py-6">
          <button
            onClick={resetMain}
            disabled={!dirtyMain || disabled}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={saveMain}
            disabled={!dirtyMain || disabled}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 disabled:bg-gray-400 transition-all"
          >
            Salvar perfil
          </button>
        </div>

        <div className="pt-10 pb-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Segurança</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Atualize sua senha para manter sua conta segura.</p>
        </div>

        <Field label="Senha atual">
          <input
            type="password"
            className={inputClasses}
            value={form.senhaAtual}
            onChange={(e) => setForm((prev) => ({ ...prev, senhaAtual: e.target.value }))}
            autoComplete="current-password"
            disabled={disabled}
            placeholder="••••••••"
          />
        </Field>

        <Field label="Nova senha" description="Mínimo de 8 caracteres.">
          <div className="space-y-3">
            <input
              type="password"
              className={inputClasses}
              value={form.novaSenha}
              onChange={(e) => setForm((prev) => ({ ...prev, novaSenha: e.target.value }))}
              autoComplete="new-password"
              disabled={disabled}
              placeholder="Nova senha"
            />
            <input
              type="password"
              className={inputClasses}
              value={form.confirmarSenha}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmarSenha: e.target.value }))}
              autoComplete="new-password"
              disabled={disabled}
              placeholder="Confirme a nova senha"
            />
            {pwMismatch && <p className="text-[10px] text-red-500">As senhas não conferem</p>}
          </div>
        </Field>

        <div className="flex items-center justify-end gap-3 py-6">
          {pwError && <p className="text-xs text-red-500 mr-auto">{pwError}</p>}
          {pwSuccess && <p className="text-xs text-green-500 mr-auto">Senha atualizada com sucesso!</p>}
          <button
            onClick={savePassword}
            disabled={!passwordsFilled || pwMismatch || savingPw || disabled}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 shadow-sm disabled:opacity-50 transition-all"
          >
            {savingPw ? "Atualizando..." : "Atualizar senha"}
          </button>
        </div>
      </div>
    </section>
  );
}
