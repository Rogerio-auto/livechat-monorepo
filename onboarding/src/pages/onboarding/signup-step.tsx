import { useState } from "react";
import { FaUser, FaEnvelope, FaLock, FaArrowRight } from "react-icons/fa";

interface SignupStepProps {
  onNext: (data: SignupData) => void;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export function SignupStep({ onNext }: SignupStepProps) {
  const [data, setData] = useState<SignupData>({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validações
    if (data.password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (data.password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      // Criar usuário no backend (auth.users + public.users)
      const API_BASE = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_BASE}/api/onboarding/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao criar usuário");
      }

      const result = await res.json();
      console.log("Usuário criado:", result);
      
      // Usuário criado com sucesso! Avançar para dados da empresa
      onNext(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaUser className="text-blue-600 text-2xl" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Crie sua conta</h1>
        <p className="text-gray-600">
          Comece a transformar seu atendimento hoje
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block font-semibold mb-2 text-sm">
            Nome completo <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="João da Silva"
              required
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2 text-sm">
            E-mail <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="seu@email.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2 text-sm">
            Telefone/WhatsApp <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="(00) 00000-0000"
            required
          />
        </div>

        <div>
          <label className="block font-semibold mb-2 text-sm">
            Senha <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              value={data.password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2 text-sm">
            Confirmar senha <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite a senha novamente"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          {loading ? "Criando conta..." : "Criar conta"}
          {!loading && <FaArrowRight className="ml-2" />}
        </button>

        <p className="text-center text-sm text-gray-600 mt-4">
          Ao criar uma conta, você concorda com nossos{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Termos de Uso
          </a>
        </p>
      </form>
    </div>
  );
}
