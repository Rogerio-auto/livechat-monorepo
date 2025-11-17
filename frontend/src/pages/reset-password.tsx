import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaLock, FaCheckCircle, FaSpinner, FaExclamationTriangle } from "react-icons/fa";
import Icon from "../assets/icon.png";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    setLoading(true);

    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
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
    <main className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl border border-gray-100 space-y-6">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-linear-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center overflow-hidden">
              <img src={Icon} alt="Logo" className="h-12 w-12 object-contain" />
            </div>
          </div>

          {verifying ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
              <p className="text-sm text-gray-600 mt-4">Verificando token...</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <FaExclamationTriangle className="text-3xl text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Token Inválido</h1>
              <p className="text-sm text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 py-3 font-semibold text-white hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Voltar para o Login
              </button>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
                <FaCheckCircle className="text-4xl text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Senha Alterada!</h1>
              <p className="text-sm text-gray-600 mb-6">
                Sua senha foi alterada com sucesso. Você será redirecionado para o login...
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                Redirecionando...
              </div>
            </div>
          ) : (
            <>
              {/* Título */}
              <header className="space-y-2 text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Redefinir Senha
                </h1>
                <p className="text-sm text-gray-600">
                  Crie uma nova senha segura para sua conta
                </p>
              </header>

              {/* Form */}
              <form className="space-y-4" onSubmit={handleSubmit}>
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {/* Nova senha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      required
                      minLength={6}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                {/* Confirmar senha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 py-3 font-semibold text-white hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
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
                  className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors mt-4"
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
