import { useEffect, useState } from "react";
import Icon from "../../assets/icon.png";
import { useNavigate } from "react-router-dom";
import { ForgotPasswordModal } from "./ForgotPasswordModal";
import { useSubscription } from "../../context/SubscriptionContext";
import { useAuth } from "../../context/AuthContext";
import { useCadastro } from "../../context/CadastroContext";

const API =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export function CLogin() {
  const [email, setEmail] = useState(() => localStorage.getItem("remember_email") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(!!localStorage.getItem("remember_email"));
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const navigate = useNavigate();
  const { refreshSubscription } = useSubscription();
  const { user, refreshUser, loading: authLoading } = useAuth();
  const { checkStatus } = useCadastro();

  // Se já está logado, redireciona baseado no status de onboarding
  useEffect(() => {
    if (!authLoading && user) {
      (async () => {
        const status = await checkStatus();
        if (status && !status.completed) {
          navigate("/cadastro");
        } else {
          navigate("/dashboard");
        }
      })();
    }
  }, [user, authLoading, navigate, checkStatus]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // << ESSENCIAL: usa cookie httpOnly
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const msg =
          payload?.error ||
          (res.status === 401
            ? "Credenciais inválidas"
            : `Erro no login (HTTP ${res.status})`);
        throw new Error(msg);
      }

      // Cookie httpOnly já veio. Nada de localStorage de token.
      if (remember) localStorage.setItem("remember_email", email);
      else localStorage.removeItem("remember_email");

      // 1. Atualizar usuário no contexto
      const profile = await refreshUser();
      
      // 2. Atualizar assinatura
      await refreshSubscription();

      // 3. Verificar onboarding
      const status = await checkStatus();

      // 4. Redirecionar
      if (status && !status.completed) {
        navigate("/cadastro");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      alert(err?.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    // Quando implementar no back: redirecionar para seu endpoint OAuth
    // window.location.href = `${API}/auth/google`;
    alert("Google Login ainda não implementado no backend.");
  }

  return (
    <div className="w-full">
      {/* Card principal com gradiente */}
      <div className="bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-md transition-colors duration-300">
        
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 rounded-full bg-blue-500/10 flex items-center justify-center overflow-hidden ring-2 ring-blue-500/20">
            <img src={Icon} alt="Logo" className="h-16 w-16 object-contain" />
          </div>
        </div>

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Bem-vindo de volta</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Entre com suas credenciais para continuar</p>
        </div>

        {/* Form */}
        <form className="space-y-5" onSubmit={handleLogin}>
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              E-mail
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-user text-gray-400"></i>
              </div>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-lock text-gray-400"></i>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Remember & Forgot */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-gray-600 dark:text-gray-400">Lembrar-me</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition"
            >
              Esqueceu a senha?
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 transition-all duration-200 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fas fa-spinner fa-spin"></i>
                Entrando...
              </span>
            ) : (
              "ENTRAR"
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
            <span className="px-4 text-gray-500 dark:text-gray-400 text-sm">OU</span>
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-3 font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md"
          >
            <i className="fab fa-google text-lg"></i>
            Continue com o Google
          </button>

          {/* Sign Up */}
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            É novo por aqui?{" "}
            <a href="https://account.7sion.com" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold transition">
              Cadastre-se
            </a>
          </p>
        </form>
      </div>

      {/* Modal de recuperação de senha */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
}
