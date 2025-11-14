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
}

export function CombinedSignupStep({ onSubmit, loading, error }: Props) {
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
      <section className="config-card relative overflow-hidden rounded-2xl px-8 py-10 shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at top left, color-mix(in srgb, var(--color-highlight) 22%, transparent), transparent 55%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 60%)",
          }}
        />

        <div className="relative space-y-8">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, transparent)",
              color: "var(--color-primary)",
            }}
          >
            Portal de ativação 7Sion
          </span>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-tight theme-heading">
              Transforme seu atendimento ao cliente
            </h1>
            <p className="max-w-xl text-sm theme-text-muted">
              Centralize conversas do WhatsApp, Instagram e outros canais. Gerencie sua equipe, automatize campanhas e acompanhe métricas em tempo real.
            </p>
          </div>

          <ul className="space-y-4">
            {highlightItems.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span
                  className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
                    color: "var(--color-primary)",
                  }}
                >
                  <FaCheckCircle className="text-sm" />
                </span>
                <div>
                  <p className="text-sm font-semibold theme-heading">{item.title}</p>
                  <p className="text-sm theme-text-muted">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div
            className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 65%, transparent)",
            }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-primary) 28%, transparent)",
                color: "var(--color-primary)",
              }}
            >
              <FaPhone />
            </span>
            <div>
              <p className="font-semibold theme-heading">Sistema completo de livechat</p>
              <p className="theme-text-muted">
                Atendimento em tempo real, histórico de conversas, transferência entre agentes e muito mais.
              </p>
            </div>
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="config-card relative rounded-2xl px-8 py-10 shadow-xl"
      >
        <div className="mb-8 space-y-2 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary) 18%, transparent)",
              color: "var(--color-primary)",
            }}
          >
            <FaRocket className="text-2xl" />
          </div>
          <h2 className="text-2xl font-semibold theme-heading">Crie sua conta grátis</h2>
          <p className="text-xs theme-text-muted">
            Comece a gerenciar seus atendimentos em poucos minutos.
          </p>
        </div>

        <div className="space-y-6">
          {(localError || error) && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "color-mix(in srgb, #ef4444 18%, transparent)",
                color: "#ef4444",
              }}
            >
              {localError || error}
            </div>
          )}

          <section className="space-y-4">
            <header className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide theme-text-muted">
                Dados do responsável
              </p>
              <p className="text-xs theme-text-muted">
                Suas credenciais de acesso à plataforma de atendimento.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Nome completo
                </label>
                <div className="relative">
                  <FaUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="Seu nome completo"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Email corporativo
                </label>
                <div className="relative">
                  <FaEnvelope className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="seu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <FaPhone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="(00) 00000-0000"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Senha de acesso
                </label>
                <div className="relative">
                  <FaLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Confirmar senha
                </label>
                <div className="relative">
                  <FaLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <header className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide theme-text-muted">
                Dados da empresa
              </p>
              <p className="text-xs theme-text-muted">
                Usamos essas informações para personalizar relatórios, propostas e mensagens.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Razão social / nome fantasia
                </label>
                <div className="relative">
                  <FaBuilding className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="Nome da sua empresa"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  CNPJ
                </label>
                <div className="relative">
                  <FaIdCard className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="text"
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleChange}
                    required
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Telefone da empresa
                </label>
                <div className="relative">
                  <FaPhone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="tel"
                    name="company_phone"
                    value={formData.company_phone}
                    onChange={handleChange}
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="(00) 0000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Cidade
                </label>
                <div className="relative">
                  <FaMapMarkerAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                    placeholder="Sua cidade"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Estado
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="config-input w-full rounded-lg px-4 py-2.5 text-sm uppercase"
                  placeholder="UF"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                  Tamanho da equipe
                </label>
                <div className="relative">
                  <FaUsers className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                  <select
                    name="team_size"
                    value={formData.team_size}
                    onChange={handleChange}
                    className="config-input w-full appearance-none rounded-lg pl-10 pr-10 py-2.5 text-sm"
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
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-all disabled:opacity-60"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
            boxShadow: "0 16px 32px -18px color-mix(in srgb, var(--color-primary) 55%, transparent)",
          }}
        >
          {loading ? (
            <>
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-solid"
                style={{
                  borderColor: "color-mix(in srgb, var(--color-on-primary) 55%, transparent)",
                  borderTopColor: "transparent",
                }}
              />
              Criando sua conta...
            </>
          ) : (
            "Criar conta e avançar"
          )}
        </button>

        <p className="mt-4 text-center text-xs theme-text-muted">
          Ao continuar, você concorda com nossos
          <a
            href="#"
            className="ml-1 font-medium"
            style={{ color: "var(--color-primary)" }}
          >
            Termos de Uso
          </a>
          .
        </p>
      </form>
    </div>
  );
}
