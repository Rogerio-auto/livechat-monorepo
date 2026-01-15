import { useState } from "react";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaPhone,
  FaBuilding,
  FaIdCard,
  FaMapMarkerAlt,
  FaUsers,
  FaRocket,
  FaCheckCircle,
} from "react-icons/fa";

export interface CombinedSignupData {
  // Dados do usuário
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  // Dados da empresa
  company_name: string;
  cnpj: string;
  company_phone: string;
  city: string;
  state: string;
  team_size: string;
}

interface Props {
  onSubmit: (data: CombinedSignupData) => void;
  loading?: boolean;
  error?: string | null;
  selectedPlan?: string | null;
}

export function CombinedSignupStep({ onSubmit, loading, error, selectedPlan }: Props) {
  const [formData, setFormData] = useState<CombinedSignupData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    company_name: "",
    cnpj: "",
    company_phone: "",
    city: "",
    state: "",
    team_size: "1-10",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (formData.password.length < 6) {
      setLocalError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError("As senhas informadas não coincidem.");
      return;
    }

    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const highlightItems = [
    {
      title: "Atendimento Multicanal",
      description: "Integre WhatsApp, Instagram e outros canais em uma única plataforma unificada.",
    },
    {
      title: "Gestão de Equipe",
      description: "Organize departamentos, distribua conversas automaticamente e monitore performance em tempo real.",
    },
    {
      title: "Campanhas e Automação",
      description: "Envie mensagens em massa, automatize respostas e acompanhe resultados com relatórios detalhados.",
    },
  ];

  return (
    <div className="grid items-stretch gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="relative overflow-hidden rounded-2xl bg-white px-8 py-10 border border-slate-200 shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(47, 180, 99, 0.1), transparent 55%), radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.1), transparent 60%)",
          }}
        />

        <div className="relative space-y-8">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: "rgba(47, 180, 99, 0.1)",
              color: "#2fb463",
            }}
          >
            Portal de ativação 7Sion
          </span>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight text-slate-900">
              Transforme seu atendimento ao cliente
            </h1>
            <p className="max-w-xl text-sm text-slate-500">
              Centralize conversas do WhatsApp, Instagram e outros canais. Gerencie sua equipe, automatize campanhas e acompanhe métricas em tempo real.
            </p>
          </div>

          <ul className="space-y-4">
            {highlightItems.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span
                  className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "rgba(47, 180, 99, 0.1)",
                    color: "#2fb463",
                  }}
                >
                  <FaCheckCircle className="text-sm" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div
            className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(47, 180, 99, 0.2)",
              backgroundColor: "rgba(47, 180, 99, 0.02)",
            }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                backgroundColor: "rgba(47, 180, 99, 0.1)",
                color: "#2fb463",
              }}
            >
              <FaPhone />
            </span>
            <div>
              <p className="font-bold text-slate-900">Sistema completo de livechat</p>
              <p className="text-slate-500">
                Atendimento em tempo real, histórico de conversas, transferência entre agentes e muito mais.
              </p>
            </div>
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="relative rounded-2xl bg-white px-8 py-10 border border-slate-200 shadow-sm"
      >
        <div className="mb-8 space-y-2 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              backgroundColor: "rgba(47, 180, 99, 0.1)",
              color: "#2fb463",
            }}
          >
            <FaRocket className="text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Crie sua conta grátis</h2>
          {selectedPlan && (
            <div className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200">
              Plano Selecionado: <span className="text-[#2fb463]">{selectedPlan}</span>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Comece a gerenciar seus atendimentos em poucos minutos.
          </p>
        </div>

        <div className="space-y-6">
          {(localError || error) && (
            <div
              className="rounded-xl px-4 py-3 text-sm border border-red-100 bg-red-50 text-red-600"
            >
              {localError || error}
            </div>
          )}

          <section className="space-y-4">
            <header className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Dados do responsável
              </p>
              <p className="text-xs text-slate-500">
                Suas credenciais de acesso à plataforma de atendimento.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Nome completo
                </label>
                <div className="relative">
                  <FaUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="Seu nome completo"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Email corporativo
                </label>
                <div className="relative">
                  <FaEnvelope className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="seu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <FaPhone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="(00) 00000-0000"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Senha de acesso
                </label>
                <div className="relative">
                  <FaLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Confirmar senha
                </label>
                <div className="relative">
                  <FaLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <header className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Dados da empresa
              </p>
              <p className="text-xs text-slate-500">
                Usamos essas informações para personalizar relatórios, propostas e mensagens.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Razão social / nome fantasia
                </label>
                <div className="relative">
                  <FaBuilding className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="Nome da sua empresa"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  CNPJ
                </label>
                <div className="relative">
                  <FaIdCard className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="text"
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Telefone da empresa
                </label>
                <div className="relative">
                  <FaPhone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="tel"
                    name="company_phone"
                    value={formData.company_phone}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="(00) 0000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Cidade
                </label>
                <div className="relative">
                  <FaMapMarkerAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                    placeholder="Sua cidade"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Estado
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm uppercase transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                  placeholder="UF"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tamanho da equipe
                </label>
                <div className="relative">
                  <FaUsers className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <select
                    name="team_size"
                    value={formData.team_size}
                    onChange={handleChange}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-10 py-2 text-sm transition-all focus:border-[#2fb463] focus:bg-white focus:ring-2 focus:ring-[#2fb463]/10 outline-none"
                  >
                    <option value="1-10">1-10 pessoas</option>
                    <option value="11-50">11-50 pessoas</option>
                    <option value="51-200">51-200 pessoas</option>
                    <option value="201+">201+ pessoas</option>
                  </select>
                </div>
              </div>
            </div>
          </section>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition-all disabled:opacity-60"
          style={{
            backgroundColor: "#2fb463",
            boxShadow: "0 10px 15px -3px rgba(47, 180, 99, 0.2)",
          }}
        >
          {loading ? (
            <>
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-white/30 border-t-white"
              />
              Criando sua conta...
            </>
          ) : (
            "Criar conta e avançar"
          )}
        </button>

        <p className="mt-4 text-center text-[10px] text-slate-400">
          Ao continuar, você concorda com nossos
          <a
            href="#"
            className="ml-1 font-bold text-[#2fb463]"
          >
            Termos de Uso
          </a>
          .
        </p>
      </form>
    </div>
  );
}
