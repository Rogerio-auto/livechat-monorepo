import { Outlet, NavLink } from "react-router-dom";
import { 
  Building2, 
  User, 
  Inbox, 
  Plug2, 
  CreditCard, 
  Bot, 
  Users, 
  Network, 
  Users2, 
  Calendar, 
  Lock,
  BookOpen,
  Bell
} from "lucide-react";

const SECTIONS = [
  { id: "empresa", title: "Empresa", icon: <Building2 size={18} />, path: "empresa" },
  { id: "perfil", title: "Perfil", icon: <User size={18} />, path: "perfil" },
  { id: "notificacoes", title: "Notificações", icon: <Bell size={18} />, path: "notificacoes" },
  { id: "inboxes", title: "Canais", icon: <Inbox size={18} />, path: "canais" },
  { id: "integracoes", title: "Integrações", icon: <Plug2 size={18} />, path: "integracoes" },
  { id: "billing", title: "Faturamento", icon: <CreditCard size={18} />, path: "faturamento" },
  { id: "ia", title: "Agentes de IA", icon: <Bot size={18} />, path: "ia" },
  { id: "knowledge", title: "Base de Conhecimento", icon: <BookOpen size={18} />, path: "base-conhecimento" },
  { id: "colaboradores", title: "Colaboradores", icon: <Users size={18} />, path: "colaboradores" },
  { id: "departamentos", title: "Departamentos", icon: <Network size={18} />, path: "departamentos" },
  { id: "times", title: "Times", icon: <Users2 size={18} />, path: "times" },
  { id: "calendarios", title: "Calendários", icon: <Calendar size={18} />, path: "calendarios" },
  { id: "permissoes-calendario", title: "Permissões", icon: <Lock size={18} />, path: "permissoes-calendario" },
];

export default function SettingsLayout() {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-950">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <div className="mb-10 border-b border-gray-100 dark:border-gray-800 pb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Configurações</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Gerencie as preferências e configurações da sua conta e empresa.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Sidebar de Navegação - Sticky no Desktop */}
          <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-8 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
            <nav className="space-y-0.5 pr-2">
              {SECTIONS.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                      isActive
                        ? "bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                    }`
                  }
                >
                  <span className="text-lg opacity-80">{item.icon}</span>
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </nav>
          </aside>

          {/* Conteúdo da Sub-rota */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
