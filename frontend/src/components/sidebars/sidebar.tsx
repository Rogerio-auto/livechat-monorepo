import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { cleanupService } from "../../services/cleanupService";
import {
  FaTachometerAlt,
  FaUsers,
  FaCalendarAlt,
  FaProjectDiagram,
  FaFileInvoice,
  FaSignOutAlt,
  FaBoxOpen,
  FaWhatsapp,
  FaCog,
  FaShieldAlt,
  FaImages,
  FaTasks,
  FaCogs,
  FaFileAlt,
  FaTimes,
  FaMoon,
  FaSun,
  FaRobot,
  FaChartLine,
} from "react-icons/fa";
import Logo from "../../assets/icon.png";
import { useTheme } from "../../context/ThemeContext";
import { PlanBadge } from "../../components/subscription/PlanBadge";
import { useSubscription, type PlanFeatures } from "../../context/SubscriptionContext";
type Profile = {
  id: string;
  email: string;
  name: string;
  role?: string | null;
  avatarUrl?: string | null;
  companyId?: string | null;
  companyName?: string | null;
};

type SidebarLink = {
  to: string;
  icon: ReactNode;
  label: string;
  isActive: (path: string, search: string) => boolean;
  feature?: string;
};

const links: SidebarLink[] = [
  {
    to: "/livechat",
    icon: <FaWhatsapp />,
    label: "Atendimento",
    isActive: (path) => path.startsWith("/livechat"),
  },
  {
    to: "/dashboard",
    icon: <FaTachometerAlt />,
    label: "Dashboard",
    isActive: (path) => path.startsWith("/dashboard"),
  },
  {
    to: "/clientes",
    icon: <FaUsers />,
    label: "Clientes",
    isActive: (path) => path.startsWith("/clientes"),
  },
  {
    to: "/tarefas",
    icon: <FaTasks />,
    label: "Tarefas",
    isActive: (path) => path.startsWith("/tarefas"),
    feature: "tasks_module",
  },
  {
    to: "/automacao",
    icon: <FaCogs />,
    label: "Automação",
    isActive: (path) => path.startsWith("/automacao"),
    feature: "automation_module",
  },
  {
    to: "/produtos",
    icon: <FaBoxOpen />,
    label: "Produtos",
    isActive: (path) => path.startsWith("/produtos"),
  },
  {
    to: "/galeria",
    icon: <FaImages />,
    label: "Galeria",
    isActive: (path) => path.startsWith("/galeria"),
    feature: "media_library",
  },
  {
    to: "/calendario",
    icon: <FaCalendarAlt />,
    label: "Calendario",
    isActive: (path) => path.startsWith("/calendario"),
    feature: "calendar_module",
  },
  {
    to: "/projects",
    icon: <FaProjectDiagram />,
    label: "Projetos",
    isActive: (path) => path.startsWith("/projects"),
  },
  {
    to: "/funil",
    icon: <FaChartLine />,
    label: "Funil de Vendas",
    isActive: (path) => path.startsWith("/funil"),
  },
  {
    to: "/documentos",
    icon: <FaFileInvoice />,
    label: "Documentos",
    isActive: (path) => path.startsWith("/documentos"),
    feature: "document_generation",
  },
  {
    to: "/configuracoes",
    icon: <FaCog />,
    label: "Configuracoes",
    isActive: (path) => path.startsWith("/configuracoes"),
  },
];

// Links especiais para ADMIN
const adminLinks: SidebarLink[] = [
  {
    to: "/admin",
    icon: <FaShieldAlt />,
    label: "Admin",
    isActive: (path, search) => path.startsWith("/admin") && !path.includes("projects/templates"),
  },
  {
    to: "/admin/projects/templates",
    icon: <FaProjectDiagram />,
    label: "Templates de Projeto",
    isActive: (path) => path.startsWith("/admin/projects/templates"),
  },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onRequestClose?: () => void;
  staticPosition?: boolean;
};

export default function Sidebar({ mobileOpen = false, onRequestClose, staticPosition = false, className = "" }: SidebarProps & { className?: string } = {}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { features, loading: subscriptionLoading } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const API =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
  const { registerUserTheme, theme, toggleTheme } = useTheme();

  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setProfileLoading(true);
        // Fetch Profile
        const res = await fetch(`${API}/me/profile`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("HTTP error");
        const me = (await res.json()) as Profile;
        setProfile(me);
      } catch {
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [API]);

  useEffect(() => {
    registerUserTheme(profile?.id);
  }, [profile?.id, registerUserTheme]);

  const logout = async () => {
    console.log('[Sidebar] 🚪 Logout initiated');
    
    try {
      // 1. Chamar endpoint de logout no backend
      await fetch(`${API}/logout`, { 
        method: "POST", 
        credentials: "include" 
      });
      console.log('[Sidebar] ✅ Backend logout successful');
    } catch (error) {
      console.error('[Sidebar] ⚠️ Backend logout error:', error);
      // Continuar com limpeza mesmo se backend falhar
    } finally {
      try {
        // 2. EXECUTAR LIMPEZA COMPLETA DO SISTEMA
        await cleanupService.cleanup();
        console.log('[Sidebar] ✅ System cleanup successful');
        
        // 3. Limpar tema do usuário
        registerUserTheme(null);
        
        // 4. Fechar modais/sidebars
        onRequestClose?.();
        
        // 5. FORÇAR RELOAD COMPLETO (garante limpeza total)
        console.log('[Sidebar] 🔄 Forcing full page reload...');
        window.location.href = '/login';
      } catch (cleanupError) {
        console.error('[Sidebar] ❌ Cleanup error:', cleanupError);
        // Forçar reload mesmo se cleanup falhar
        window.location.href = '/login';
      }
    }
  };

  const handleNav = () => onRequestClose?.();

  // Se estiver carregando o perfil ou a assinatura, mostramos um estado de loading ou nada
  // para evitar o "flicker" de links sumindo/aparecendo
  if (profileLoading || subscriptionLoading) {
    return (
      <aside
        className={`group z-40 hidden flex-col overflow-hidden border-r border-(--color-sidebar-border) bg-(--color-sidebar-bg) text-(--color-sidebar-text) shadow-xl transition-all duration-300 ease-in-out md:flex w-16 ${
          staticPosition ? "relative h-full" : "fixed inset-y-0 left-0"
        } ${className}`}
      >
        <div className="flex h-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--color-sidebar-border) border-t-(--color-sidebar-active)" />
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside
        className={`group z-40 hidden flex-col overflow-hidden border-r border-(--color-sidebar-border) bg-(--color-sidebar-bg) text-(--color-sidebar-text) shadow-xl transition-all duration-300 ease-in-out md:flex w-16 hover:w-[18rem] ${
          staticPosition ? "relative h-full" : "fixed inset-y-0 left-0"
        } ${className}`}
      >
        <SidebarContent
          profile={profile}
          features={features}
          locationPath={location.pathname}
          isAdmin={profile?.role?.toUpperCase() === "ADMIN"}
          logout={logout}
          onNavigate={handleNav}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      </aside>

      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onRequestClose}
          aria-hidden="true"
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-[min(20rem,82vw)] translate-x-0 flex-col overflow-hidden border-r border-(--color-sidebar-border) bg-(--color-sidebar-bg) text-(--color-sidebar-text) shadow-md transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            type="button"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-(--color-sidebar-border) text-(--color-sidebar-text-muted) hover:bg-(--color-sidebar-hover) transition-colors"
            onClick={onRequestClose}
            aria-label="Fechar navegação"
          >
            <FaTimes />
          </button>
          <SidebarContent
            profile={profile}
            features={features}
            locationPath={location.pathname}
            isAdmin={profile?.role?.toUpperCase() === "ADMIN"}
            logout={logout}
            onNavigate={handleNav}
            forceExpanded
            theme={theme}
            toggleTheme={toggleTheme}
          />
        </aside>
      </div>
    </>
  );
}

type SidebarContentProps = {
  profile: Profile | null;
  features: PlanFeatures;
  locationPath: string;
  isAdmin?: boolean;
  logout: () => Promise<void> | void;
  onNavigate?: () => void;
  forceExpanded?: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function SidebarContent({
  profile,
  features,
  locationPath,
  isAdmin,
  logout,
  onNavigate,
  forceExpanded,
  theme,
  toggleTheme,
}: SidebarContentProps) {
  const metaLabel = profile?.companyId ? `ID ${profile.companyId}` : "Operações";

  const visibleLinks = links.filter((link) => {
    if (!link.feature) return true;
    return features[link.feature] === true;
  });

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative border-b border-(--color-sidebar-border) px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--color-sidebar-hover) shadow-sm">
            <img src={Logo} alt="logo" className="h-7 w-auto" />
          </div>
          <div
            className={`${
              forceExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity duration-300`}
          >
            <div className="text-sm font-bold tracking-tight text-(--color-sidebar-text)">
              {profile?.companyName || "Sua Empresa"}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-(--color-sidebar-text-muted)">
              {metaLabel}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <img
            src={
              profile?.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                profile?.name || "User",
              )}&background=2fb463&color=fff`
            }
            className="h-11 w-11 rounded-xl object-cover ring-2 ring-(--color-sidebar-border)"
          />
          <div
            className={`${
              forceExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity duration-300`}
          >
            <p className="text-sm font-semibold text-(--color-sidebar-text)">
              {profile?.name || "Usuário"}
            </p>
            <p className="text-xs text-(--color-sidebar-text-muted)">{profile?.email || ""}</p>
          </div>
        </div>

        <div
          className={`${
            forceExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } mt-4 transition-opacity duration-300`}
        >
          <PlanBadge />
        </div>
      </div>

      <nav className="sidebar-scroll flex flex-1 flex-col gap-1 px-2 py-4">
        <p
          className={`${
            forceExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } px-3 text-[9px] font-bold uppercase tracking-widest text-(--color-sidebar-text-muted) duration-300`}
        >
          Navegação
        </p>
        {visibleLinks.map((item) => (
          <SidebarItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            active={item.isActive(locationPath, location.search)}
            forceExpanded={forceExpanded}
            onNavigate={onNavigate}
          />
        ))}

        {isAdmin && (
          <div className="mt-4 border-t border-(--color-sidebar-border) pt-4">
            <p
              className={`${
                forceExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              } px-3 text-[9px] font-bold uppercase tracking-widest text-(--color-sidebar-text-muted) duration-300`}
            >
              Controle
            </p>
            {adminLinks.map((item) => (
              <SidebarItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                active={item.isActive(locationPath, location.search)}
                forceExpanded={forceExpanded}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-(--color-sidebar-border) px-3 py-4 space-y-1">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-(--color-sidebar-text-muted) transition-all duration-200 hover:bg-(--color-sidebar-hover)"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-sidebar-hover) text-lg">
            {theme === "dark" ? <FaSun className="text-amber-400" /> : <FaMoon className="text-blue-400" />}
          </span>
          <span
            className={`text-sm font-semibold tracking-wide ${
              forceExpanded
                ? "opacity-100"
                : "-translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
            }`}
          >
            {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-rose-500 transition-all duration-200 hover:bg-rose-500/10"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-lg">
            <FaSignOutAlt />
          </span>
          <span
            className={`text-sm font-semibold tracking-wide ${
              forceExpanded
                ? "opacity-100"
                : "-translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
            }`}
          >
            Sair
          </span>
        </button>
      </div>
    </div>
  );
}

type ItemBase = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  forceExpanded?: boolean;
  onNavigate?: () => void;
};

type LinkItem = ItemBase & {
  to: string;
  onClick?: never;
};

type ButtonItem = ItemBase & {
  to?: never;
  onClick: () => void;
};

type ItemProps = LinkItem | ButtonItem;

function SidebarItem({ icon, label, to, active, onClick, forceExpanded, onNavigate }: ItemProps) {
  const baseClasses =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200";

  const classes = to
    ? `${baseClasses} ${
        active
          ? "bg-(--color-sidebar-hover) text-(--color-sidebar-active) font-semibold shadow-sm"
          : "text-(--color-sidebar-text-muted) hover:bg-(--color-sidebar-hover) hover:text-(--color-sidebar-text)"
      }`
    : `${baseClasses} text-(--color-sidebar-text-muted) hover:bg-(--color-sidebar-hover) hover:text-(--color-sidebar-text)`;

  const iconColor = active 
    ? "text-(--color-sidebar-icon)" 
    : "text-(--color-sidebar-text-muted) opacity-50 group-hover:opacity-100";

  const labelColor = active 
    ? "text-(--color-sidebar-text)" 
    : "text-(--color-sidebar-text-muted)";

  const labelVisibility = forceExpanded
    ? "opacity-100 translate-x-0"
    : "whitespace-nowrap -translate-x-4 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100";

  const content = (
    <>
      <span className={`text-base ${iconColor}`}>{icon}</span>
      <span className={`text-[13px] ${labelVisibility} ${labelColor}`}>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={classes}
        onClick={() => {
          onNavigate?.();
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        onNavigate?.();
      }}
      className={classes}
    >
      {content}
    </button>
  );
}

