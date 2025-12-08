import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
} from "react-icons/fa";
import Logo from "../../assets/icon.png";
import { useTheme } from "../../context/ThemeContext";
import { PlanBadge } from "../../components/subscription/PlanBadge";

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
  isActive: (path: string) => boolean;
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
  },
  {
    to: "/automacao",
    icon: <FaCogs />,
    label: "Automação",
    isActive: (path) => path.startsWith("/automacao"),
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
  },
  {
    to: "/calendario",
    icon: <FaCalendarAlt />,
    label: "Calendario",
    isActive: (path) => path.startsWith("/calendario"),
  },
  {
    to: "/funil",
    icon: <FaProjectDiagram />,
    label: "Funil de Vendas",
    isActive: (path) => path.startsWith("/funil"),
  },
  {
    to: "/documentos",
    icon: <FaFileInvoice />,
    label: "Documentos",
    isActive: (path) => path.startsWith("/documentos"),
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
    isActive: (path) => path.startsWith("/admin"),
  },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onRequestClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onRequestClose }: SidebarProps = {}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const API =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
  const { registerUserTheme } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/me/profile`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("HTTP error");
        const me = (await res.json()) as Profile;
        setProfile(me);
      } catch {
        setProfile(null);
      }
    })();
  }, [API]);

  useEffect(() => {
    registerUserTheme(profile?.id);
  }, [profile?.id, registerUserTheme]);

  const logout = async () => {
    try {
      await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
    } finally {
      registerUserTheme(null);
      navigate("/login");
      onRequestClose?.();
    }
  };

  const handleNav = () => onRequestClose?.();

  return (
    <>
      <aside
        className="group fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-expanded-width,18rem)] flex-col overflow-hidden border-r border-black/30 bg-gradient-to-b from-[#1b3a29] via-[#122517] to-[#08150c] text-white/90 shadow-[0_50px_120px_-60px_rgba(1,15,9,0.8)] lg:flex"
        style={{ backdropFilter: "blur(8px)" }}
      >
        <SidebarContent
          profile={profile}
          locationPath={location.pathname}
          isAdmin={profile?.role?.toUpperCase() === "ADMIN"}
          logout={logout}
          onNavigate={handleNav}
          forceExpanded
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      </aside>

      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onRequestClose}
          aria-hidden="true"
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-[min(20rem,82vw)] translate-x-0 flex-col overflow-hidden border-r border-black/25 bg-gradient-to-b from-[#1f4230] via-[#122617] to-[#070f08] text-white shadow-[0_40px_120px_-45px_rgba(0,0,0,0.85)] transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ backdropFilter: "blur(10px)" }}
        >
          <button
            type="button"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/90 backdrop-blur-md"
            onClick={onRequestClose}
            aria-label="Fechar navegação"
          >
            <FaTimes />
          </button>
          <SidebarContent
            profile={profile}
            locationPath={location.pathname}
            isAdmin={profile?.role?.toUpperCase() === "ADMIN"}
            logout={logout}
            onNavigate={handleNav}
            forceExpanded
          />
        </aside>
      </div>
    </>
  );
}

type SidebarContentProps = {
  profile: Profile | null;
  locationPath: string;
  isAdmin?: boolean;
  logout: () => Promise<void> | void;
  onNavigate?: () => void;
  forceExpanded?: boolean;
};

function SidebarContent({
  profile,
  locationPath,
  isAdmin,
  logout,
  onNavigate,
  forceExpanded,
}: SidebarContentProps) {
  const metaLabel = profile?.companyId ? `ID ${profile.companyId}` : "Operações";

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative border-b border-white/10 px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 shadow-inner shadow-black/40">
            <img src={Logo} alt="logo" className="h-7 w-auto" />
          </div>
          <div
            className={`${
              forceExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity duration-300`}
          >
            <div className="text-sm font-semibold tracking-wide text-white">
              {profile?.companyName || "Sua Empresa"}
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
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
              )}&background=204A34&color=fff`
            }
            className="h-11 w-11 rounded-2xl object-cover ring-2 ring-white/15"
          />
          <div
            className={`${
              forceExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity duration-300`}
          >
            <p className="text-sm font-medium text-white">
              {profile?.name || "Usuário"}
            </p>
            <p className="text-xs text-white/70">{profile?.email || ""}</p>
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
            forceExpanded ? "opacity-70" : "opacity-0 group-hover:opacity-70"
          } px-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-white duration-300`}
        >
          Navegação
        </p>
        {links.map((item) => (
          <SidebarItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            active={item.isActive(locationPath)}
            forceExpanded={forceExpanded}
            onNavigate={onNavigate}
          />
        ))}

        {isAdmin && (
          <div className="mt-3 border-t border-white/5 pt-3">
            <p
              className={`${
                forceExpanded ? "opacity-60" : "opacity-0 group-hover:opacity-60"
              } px-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-white duration-300`}
            >
              Controle
            </p>
            {adminLinks.map((item) => (
              <SidebarItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                active={item.isActive(locationPath)}
                forceExpanded={forceExpanded}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <button
          type="button"
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-white/80 transition-all duration-200 hover:bg-white/10"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-lg text-white">
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
    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200";

  const classes = to
    ? `${baseClasses} ${
        active
          ? "bg-white/10 text-white shadow-[0_18px_35px_-18px_rgba(0,0,0,0.9)] ring-1 ring-white/20"
          : "text-white/70 hover:bg-white/10"
      }`
    : `${baseClasses} text-white/80 hover:bg-white/10`;

  const iconColor = active ? "text-[#7bf0b0]" : "text-white";

  const labelColor = active ? "text-white" : "text-white/80";

  const labelVisibility = forceExpanded
    ? "opacity-100 translate-x-0"
    : "whitespace-nowrap -translate-x-4 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100";

  const content = (
    <>
      <span className={`text-lg ${iconColor}`}>{icon}</span>
      <span className={`${labelVisibility} ${labelColor}`}>{label}</span>
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
