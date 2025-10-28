import { useEffect, useState } from "react";
import Icon from "../../assets/icon.png";
import { useNavigate } from "react-router-dom";

const API =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export function CLogin() {
  const [email, setEmail] = useState(() => localStorage.getItem("remember_email") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(!!localStorage.getItem("remember_email"));
  const navigate = useNavigate();

  useEffect(() => {
    // se já está logado, pula pro dashboard
    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { credentials: "include" });
        if (res.ok) navigate("/dashboard");
      } catch {
        // silencioso
      }
    })();
  }, [navigate]);

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

      navigate("/dashboard");
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
    <div className="w-full max-w-sm rounded-2xl bg-black/40 p-10 shadow-2xl backdrop-blur">
      {/* Avatar */}
      <div className="flex justify-center mb-6">
        <div className="h-30 w-30 rounded-full bg-[#42CD55]/20 flex items-center justify-center overflow-hidden">
          <img src={Icon} alt="Logo" className="h-full w-full object-contain" />
        </div>
      </div>

      {/* Form */}
      <form className="space-y-5" onSubmit={handleLogin}>
        {/* Email */}
        <div>
          <div className="flex items-center rounded-md bg-[#204A34]/80 px-3">
            <i className="fas fa-user text-[#EDEDED]/70"></i>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent px-2 py-2 text-sm text-[#EDEDED] placeholder-[#EDEDED]/50 focus:outline-none"
              required
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center rounded-md bg-[#204A34]/80 px-3">
            <i className="fas fa-lock text-[#EDEDED]/70"></i>
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent px-2 py-2 text-sm text-[#EDEDED] placeholder-[#EDEDED]/50 focus:outline-none"
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        {/* Remember & Forgot */}
        <div className="flex items-center justify-between text-sm text-[#EDEDED]/70">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-[#42CD55] bg-[#204A34] text-[#42CD55] focus:ring-[#42CD55]"
            />
            <span>Lembrar-me</span>
          </label>
          <a href="#" className="hover:text-[#CCFF05] transition">
            Esqueceu a senha?
          </a>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#42CD55] py-2 font-semibold tracking-wide text-[#204A34] hover:bg-[#CCFF05] transition cursor-pointer disabled:opacity-60"
        >
          {loading ? "Entrando..." : "ENTRAR"}
        </button>

        {/* Divider */}
        <div className="flex items-center my-4">
          <div className="flex-1 h-px bg-[#EDEDED]/30"></div>
          <span className="px-3 text-[#EDEDED]/60 text-sm">OU</span>
          <div className="flex-1 h-px bg-[#EDEDED]/30"></div>
        </div>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-[#EDEDED] py-2 font-semibold text-[#204A34] shadow hover:bg-[#FF8800] hover:text-[#EDEDED] transition cursor-pointer"
        >
          <i className="fab fa-google"></i>
          Continue com o Google
        </button>

        {/* Sign Up */}
        <p className="mt-4 text-center text-sm text-[#EDEDED]/70">
          É novo por aqui?{" "}
          <a href="#" className="text-[#42CD55] hover:text-[#CCFF05] transition">
            Cadastre-se
          </a>
        </p>
      </form>
    </div>
  );
}
