import { useState } from "react";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaArrowRight,
  FaCheckCircle,
  FaPhone,
} from "react-icons/fa";

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
      // Validação básica antes de avançar
      onNext(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const highlightItems = [
    {
      title: "Comece em minutos",
      description: "Assistentes inteligentes, templates e integrações prontas para usar.",
    },
    {
      title: "Centralize os contatos",
      description: "Organize leads, campanhas e atendimento em um só lugar.",
    },
    {
      title: "Experiência moderna",
      description: "Interface responsiva com suporte a modo claro e escuro automaticamente.",
    },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-stretch">
      <section className="relative overflow-hidden rounded-2xl px-8 py-10 shadow-xl config-card">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at top left, color-mix(in srgb, var(--color-highlight) 25%, transparent), transparent 55%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 60%)",
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
            Sua nova central inteligente
          </span>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-tight theme-heading">
              Crie sua conta e conecte seus canais em poucos passos
            </h1>
            <p className="max-w-xl text-base theme-text-muted">
              Cadastre-se para habilitar fluxos automatizados, campanhas omnichannel e dashboards que
              aceleram seu relacionamento com clientes.
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
            className="rounded-xl border px-4 py-3 text-sm flex items-center gap-3"
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
              <p className="font-semibold theme-heading">Suporte humano quando você precisar</p>
              <p className="theme-text-muted">Nossa equipe acompanha a ativação em horário comercial.</p>
            </div>
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="config-card relative rounded-2xl px-8 py-10 shadow-xl"
      >
        <div className="mb-8 space-y-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary) 18%, transparent)",
              color: "var(--color-primary)",
            }}
          >
            <FaUser className="text-2xl" />
          </div>
          <h2 className="text-2xl font-semibold theme-heading">Informações básicas</h2>
          <p className="text-sm theme-text-muted">
            Preencha os campos abaixo para criar seu painel administrativo.
          </p>
        </div>

        <div className="space-y-5">
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "color-mix(in srgb, #ef4444 18%, transparent)",
                color: "#ef4444",
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
              Nome completo
            </label>
            <div className="relative">
              <FaUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                placeholder="João da Silva"
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
              E-mail corporativo
            </label>
            <div className="relative">
              <FaEnvelope className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
              <input
                type="email"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                placeholder="seu@email.com"
                autoComplete="email"
                required
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
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                placeholder="(00) 00000-0000"
                autoComplete="tel"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide theme-text-muted">
                Senha
              </label>
              <div className="relative">
                <FaLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm theme-text-muted" />
                <input
                  type="password"
                  value={data.password}
                  onChange={(e) => setData({ ...data, password: e.target.value })}
                  className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  required
                  minLength={6}
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="config-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
          </div>
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
          {loading ? "Criando conta..." : "Criar conta"}
          {!loading && <FaArrowRight />}
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
