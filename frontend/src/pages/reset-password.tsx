import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaLock, FaCheckCircle, FaSpinner, FaExclamationTriangle } from "react-icons/fa";
import { FiPhone } from "react-icons/fi";
import Icon from "../assets/icon.png";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar token na montagem
  useEffect(() => {
    if (!token) {
      setError("Token não fornecido");
      setVerifying(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${API}/auth/verify-reset-token/${token}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setError(data.error || "Token inválido ou expirado");
          setTokenValid(false);
        } else {
          setTokenValid(true);
        }
      } catch (err: any) {
        setError("Erro ao verificar token");
        setTokenValid(false);
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const formatPhone = (value: string) => {
    // Remove tudo exceto números
    const cleaned = value.replace(/\D/g, '');
    
    // Limitar a 13 dígitos (55 + 11 + 9 dígitos)
    const limited = cleaned.slice(0, 13);
    
    // Formatar: +55 (11) 99999-9999
    if (limited.length === 0) return '';
    if (limited.length <= 2) return `+${limited}`;
    if (limited.length <= 4) return `+${limited.slice(0, 2)} (${limited.slice(2)}`;
    if (limited.length <= 6) return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4)}`;
    if (limited.length <= 10) return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4)}`;
    return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4, 9)}-${limited.slice(9)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError("Por favor, insira um telefone válido");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
          phone: phone.replace(/\D/g, ''), // Enviar apenas números
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao redefinir senha");
      }

      setSuccess(true);

      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen livechat-theme flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-[28px] livechat-card shadow-[0_32px_90px_-60px_rgba(8,12,20,0.85)] backdrop-blur-sm p-8 space-y-6">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 livechat-muted-surface rounded-full flex items-center justify-center overflow-hidden backdrop-blur-sm">
              <img src={Icon} alt="Logo" className="h-12 w-12 object-contain" />
            </div>
          </div>

          {verifying ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">Verificando token...</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full livechat-muted-surface backdrop-blur-sm mb-4">
                <FaExclamationTriangle className="text-3xl text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Token Inválido</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{error}</p>
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Voltar para o Login
              </button>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full livechat-muted-surface backdrop-blur-sm mb-4">
                <FaCheckCircle className="text-4xl text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Senha Alterada!</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Sua senha foi alterada com sucesso. Você será redirecionado para o login...
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                Redirecionando...
              </div>
            </div>
          ) : (
            <>
              {/* Título */}
              <header className="space-y-2 text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Redefinir Senha
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Crie uma nova senha segura para sua conta
                </p>
              </header>

              {/* Form */}
              <form className="space-y-4" onSubmit={handleSubmit}>
                {error && (
                  <div className="p-3 rounded-xl livechat-muted-surface backdrop-blur-sm border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm font-medium">
                    {error}
                  </div>
                )}

                {/* Nova senha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaLock className="text-gray-400" />
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl livechat-muted-surface backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      required
                      minLength={6}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiPhone className="text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      placeholder="+55 (11) 99999-9999"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="w-full pl-10 pr-4 py-3 rounded-xl livechat-muted-surface backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Digite seu telefone com DDD
                  </p>
                </div>

                {/* Confirmar senha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaLock className="text-gray-400" />
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl livechat-muted-surface backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Alterando senha...
                    </span>
                  ) : (
                    "Redefinir Senha"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mt-4"
                >
                  Voltar para o login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
