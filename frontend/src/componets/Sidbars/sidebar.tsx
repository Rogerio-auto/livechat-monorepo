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
  FaSun,
  FaMoon,
} from "react-icons/fa";
import Logo from "../../assets/icon.png";
import { useTheme } from "../../context/ThemeContext";

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
    to: "/produtos",
    icon: <FaBoxOpen />,
    label: "Produtos",
    isActive: (path) => path.startsWith("/produtos"),
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

export default function Sidebar() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const API =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
  const { theme, toggleTheme, registerUserTheme } = useTheme();

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
    }
  };

  const ThemeIcon = theme === "dark" ? FaSun : FaMoon;
  const themeLabel = theme === "dark" ? "Tema claro" : "Tema escuro";

  return (
    <aside className="fixed top-0 left-0 z-50 h-screen w-16 overflow-hidden bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] shadow-[0_12px_30px_-15px_rgba(8,12,20,0.9)] transition-all duration-300 ease-in-out group hover:w-72">
      <div className="relative flex h-full flex-col">
        <div className="border-b border-[color:var(--color-sidebar-border)] px-3 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <img src={Logo} alt="logo" className="h-8 w-auto object-contain" />
            <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="font-semibold leading-tight text-[var(--color-sidebar-text)]">
                {profile?.companyName || "Sua Empresa"}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <img
              src={
                profile?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  profile?.name || "User",
                )}&background=1d4ed8&color=fff`
              }
              className="h-9 w-9 rounded-full ring-2 ring-[rgba(56,189,248,0.45)] object-cover"
            />
            <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="text-sm font-medium leading-tight text-[var(--color-sidebar-text)]">
                {profile?.name || "Usuario"}
              </div>
              <div className="max-w-[10rem] truncate text-xs text-[var(--color-sidebar-text-muted)]">
                {profile?.email || ""}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {links.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={item.isActive(location.pathname)}
            />
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-[color:var(--color-sidebar-border)] p-3">
          <SidebarItem
            icon={<ThemeIcon />}
            label={themeLabel}
            onClick={toggleTheme}
          />
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[var(--color-sidebar-text)] transition-colors duration-150 hover:bg-[var(--color-sidebar-hover)]"
          >
            <FaSignOutAlt className="text-lg text-[var(--color-sidebar-icon)]" />
            <span className="whitespace-nowrap opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
              Sair
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}

type ItemBase = {
  icon: ReactNode;
  label: string;
  active?: boolean;
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

function SidebarItem({ icon, label, to, active, onClick }: ItemProps) {
  const baseClasses =
    "flex w-full items-center gap-3 rounded-lg px-3 py-3 transition-colors duration-150";

  const classes = to
    ? `${baseClasses} ${
        active
          ? "bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text)]"
          : "text-[var(--color-sidebar-text-muted)] hover:bg-[var(--color-sidebar-hover)]"
      }`
    : `${baseClasses} text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)]`;

  const iconColor = active
    ? "text-[var(--color-highlight)]"
    : to
    ? "text-[var(--color-sidebar-icon)]"
    : "text-[var(--color-highlight)]";

  const labelColor = to
    ? active
      ? "text-[var(--color-sidebar-text)]"
      : "text-[var(--color-sidebar-text-muted)]"
    : "text-[var(--color-sidebar-text)]";

  const content = (
    <>
      <span className={`text-lg ${iconColor}`}>{icon}</span>
      <span
        className={`whitespace-nowrap -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 ${labelColor}`}
      >
        {label}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
