import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { API } from "../utils/api";

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

export default function InviteAcceptPage() {
  const navigate = useNavigate();
  const [initStatus, setInitStatus] = useState<InitStatus>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const { accessToken, refreshToken, type } = extractAuthParams();
    if (!accessToken || !refreshToken) {
      setError("Link de convite invalido ou expirado.");
      setInitStatus("error");
      return;
    }
    if (type && type !== "invite" && type !== "recovery") {
      setError("Link recebido nao corresponde a um convite valido.");
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
        setError("Nao foi possivel validar o convite. Solicite um novo link.");
        setInitStatus("error");
        return;
      }
      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !data?.user) {
        setError("Nao foi possivel carregar os dados do usuario.");
        setInitStatus("error");
        return;
      }
      setEmail(data.user.email ?? "");
      setInitStatus("ready");
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
    setInfo(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas informadas nao conferem.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      if (email) {
        try {
          const res = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
              const payload = await res.json();
              if (payload?.error) msg = payload.error;
            } catch {}
            throw new Error(msg);
          }
          navigate("/dashboard", { replace: true });
          return;
        } catch (loginError) {
          console.warn("login after invite failed:", loginError);
          setInfo(
            "Senha criada! Tudo certo; faca login manualmente com seu email.",
          );
        }
      } else {
        setInfo("Senha criada! Faca login com seu email e a nova senha.");
      }
    } catch (err: any) {
      setError(err?.message || "Nao foi possivel salvar a nova senha.");
    } finally {
      try {
        await supabase.auth.signOut();
      } catch {}
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-[#204A34]">
            Definir nova senha
          </h1>
          <p className="text-sm text-gray-600">
            Conclua o convite criando sua senha de acesso.
          </p>
        </header>

        {initStatus === "loading" && (
          <p className="text-sm text-gray-600 text-center">
            Validando convite...
          </p>
        )}

        {initStatus === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-red-600 text-center">
              {error ||
                "O convite informado esta invalido. Solicite um novo link ao administrador."}
            </p>
            <button
              className="w-full rounded-lg bg-[#204A34] px-4 py-2 text-white hover:bg-[#42CD55]"
              onClick={() => navigate("/login")}
            >
              Voltar para o login
            </button>
          </div>
        )}

        {initStatus === "ready" && (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">
                Email
              </span>
              <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
                {email || "Email nao identificado"}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-600">Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#42CD55]"
                autoComplete="new-password"
                placeholder="Crie uma senha"
                disabled={saving}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-600">Confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#42CD55]"
                autoComplete="new-password"
                placeholder="Repita a senha"
                disabled={saving}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {info && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-[#204A34] px-4 py-2 text-white hover:bg-[#42CD55] disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar senha"}
            </button>
            <button
              type="button"
              className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              onClick={() => navigate("/login")}
              disabled={saving}
            >
              Ir para o login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

