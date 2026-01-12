import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { FiMenu, FiMoon, FiSun } from "react-icons/fi";
import { NotificationBadge } from "../../components/notifications/NotificationBadge";
import { useTheme } from "../../context/ThemeContext";

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Visão geral" },
  "/clientes": { title: "Clientes", subtitle: "Relacionamento" },
  "/tarefas": { title: "Tarefas", subtitle: "Fluxo operacional" },
  "/automacao": { title: "Automações", subtitle: "Regras inteligentes" },
  "/documentos": { title: "Documentos", subtitle: "Modelos e envios" },
  "/templates": { title: "Templates", subtitle: "Biblioteca" },
  "/calendario": { title: "Calendário", subtitle: "Organização" },
  "/livechat": { title: "Atendimento", subtitle: "Conversas ativas" },
  "/produtos": { title: "Produtos", subtitle: "Catálogo" },
  "/galeria": { title: "Galeria", subtitle: "Biblioteca" },
  "/configuracoes": { title: "Configurações", subtitle: "Preferências" },
  "/admin": { title: "Administração", subtitle: "Controles avançados" },
  "/funil": { title: "Funil de Vendas", subtitle: "Performance" },
  "/subscription": { title: "Assinatura", subtitle: "Plano ativo" },
};

type TopBarProps = {
  onMenuClick: () => void;
};

export function TopBar({ onMenuClick }: TopBarProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const meta = useMemo(() => {
    return (
      routeMeta[location.pathname] ?? {
        title: "Plataforma Omnichannel",
        subtitle: "Bem-vindo",
      }
    );
  }, [location.pathname]);

  const ThemeIcon = theme === "dark" ? FiSun : FiMoon;
  const themeLabel = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <header className="sticky top-0 z-30 border-b border-(--color-border) bg-(--color-bg)/90 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-(--color-border) text-xl text-(--color-heading) shadow-sm hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-highlight) lg:hidden"
          aria-label="Abrir navegação"
        >
          <FiMenu />
        </button>

        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
            {meta.subtitle}
          </span>
          <span className="text-lg font-semibold text-(--color-heading)">
            {meta.title}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <NotificationBadge />
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-(--color-border) text-lg text-(--color-heading) shadow-sm hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-highlight)"
            aria-label={themeLabel}
            title={themeLabel}
          >
            <ThemeIcon />
          </button>
        </div>
      </div>
    </header>
  );
}

