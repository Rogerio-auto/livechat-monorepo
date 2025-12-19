import { NavLink, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCpu, FiLayers, FiMonitor, FiBox, FiActivity } from 'react-icons/fi';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: FiMonitor, exact: true },
  { label: 'Empresas', to: '/admin/companies', icon: FiLayers },
  { label: 'Templates de Agentes', to: '/admin/templates', icon: FiBox },
  { label: 'Templates de Projetos', to: '/admin/projects/templates', icon: FiLayers },
  { label: 'Ferramentas', to: '/admin/tools', icon: FiActivity },
  { label: 'Infraestrutura', to: '/admin/infrastructure', icon: FiCpu },
];

function navClasses({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
    isActive
      ? 'bg-white/10 text-white shadow-lg shadow-black/30'
      : 'text-slate-400 hover:text-white hover:bg-white/5',
  ].join(' ');
}

export function AdminSidebar() {
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex w-72 flex-col border-r border-white/5 bg-slate-950/80 p-6 text-white sticky top-0 h-screen overflow-y-auto">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Control Center</p>
        <h1 className="mt-2 text-2xl font-semibold">Admin Portal</h1>
        <p className="mt-2 text-sm text-slate-400">
          Ferramentas exclusivas para o time de operações.
        </p>
      </div>

      <nav className="mt-10 flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={navClasses}
            end={item.exact}
          >
            <item.icon className="text-lg" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
        >
          <FiArrowLeft />
          Voltar ao App
        </button>
      </div>
    </aside>
  );
}
