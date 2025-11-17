import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

type InitStatus = "loading" | "ready" | "error";

function extractAuthParams() {
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );
  const queryParams = new URLSearchParams(window.location.search);
  const read = (key: string) =>
    hashParams.get(key) ?? queryParams.get(key) ?? undefined;
  return {
    accessToken: read("access_token"),
    refreshToken: read("refresh_token"),
    type: read("type"),
  };
}

export default function ConvitePage() {
  const [initStatus, setInitStatus] = useState<InitStatus>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const { accessToken, refreshToken, type } = extractAuthParams();
    
    if (!accessToken || !refreshToken) {
      setError("Link de convite inválido ou expirado.");
      setInitStatus("error");
      return;
    }
    
    if (type && type !== "invite" && type !== "recovery") {
      setError("Link recebido não corresponde a um convite válido.");
      setInitStatus("error");
      return;
    }

    (async () => {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      
      if (!active) return;
      
      if (sessionError) {
        setError("Não foi possível validar o convite. Solicite um novo link.");
        setInitStatus("error");
        return;
      }
      
      const { data, error: userError } = await supabase.auth.getUser();
      
      if (!active) return;
      
      if (userError || !data?.user) {
        setError("Não foi possível carregar os dados do usuário.");
        setInitStatus("error");
        return;
      }
      
      setEmail(data.user.email ?? "");
      setInitStatus("ready");
      
      // Limpar parâmetros da URL
      window.history.replaceState({}, document.title, window.location.pathname);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    
    if (password !== confirmPassword) {
      setError("As senhas informadas não conferem.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      
      if (updateError) throw updateError;

      setSuccess(true);
      
      // Redirecionar para dashboard (sessão já está validada)
      setTimeout(() => {
        window.location.href = "https://app.7sion.com/dashboard";
      }, 2000);
      
    } catch (err: any) {
      setError(err?.message || "Não foi possível salvar a nova senha.");
      setSaving(false);
    }
  };

  const goToLogin = () => {
    window.location.href = "https://app.7sion.com/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-gray-100 space-y-6">
        <header className="space-y-2 text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Definir nova senha
          </h1>
          <p className="text-sm text-gray-600">
            Conclua o convite criando sua senha de acesso.
          </p>
        </header>

        {initStatus === "loading" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="text-sm text-gray-600 mt-4">Validando convite...</p>
          </div>
        )}

        {initStatus === "error" && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">
                {error || "O convite informado está inválido. Solicite um novo link ao administrador."}
              </p>
            </div>
            <button
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-white font-medium hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-md"
              onClick={goToLogin}
            >
              Ir para o login
            </button>
          </div>
        )}

        {initStatus === "ready" && !success && (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Email
              </label>
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 border border-gray-200">
                {email || "Email não identificado"}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                autoComplete="new-password"
                placeholder="Crie uma senha segura"
                disabled={saving}
                minLength={MIN_PASSWORD_LENGTH}
              />
              <p className="text-xs text-gray-500">Mínimo de {MIN_PASSWORD_LENGTH} caracteres</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                autoComplete="new-password"
                placeholder="Repita a senha"
                disabled={saving}
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-white font-medium hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
            >
              {saving ? "Salvando..." : "Salvar senha"}
            </button>
            
            <button
              type="button"
              className="w-full rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors duration-200"
              onClick={goToLogin}
              disabled={saving}
            >
              Ir para o login
            </button>
          </form>
        )}

        {success && (
          <div className="space-y-4 py-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-emerald-800">Senha criada com sucesso!</p>
                <p className="text-sm text-emerald-700 mt-1">
                  Redirecionando para o dashboard...
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
