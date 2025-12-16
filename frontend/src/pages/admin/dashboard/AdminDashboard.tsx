import { FiActivity, FiDatabase, FiUsers } from 'react-icons/fi';

const CARDS = [
  {
    title: 'Empresas Ativas',
    value: '--',
    description: 'Total monitorado em tempo real',
    icon: FiUsers,
  },
  {
    title: 'Workers',
    value: 'OK',
    description: 'Filas, cache e automações',
    icon: FiActivity,
  },
  {
    title: 'Uso de Recursos',
    value: 'Em coleta',
    description: 'Storage, mensagens e agentes',
    icon: FiDatabase,
  },
];

export function AdminDashboard() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Visão Geral</p>
        <h2 className="text-3xl font-semibold">SaaS Control Center</h2>
        <p className="text-slate-400">
          Painel dedicado para monitorar empresas, agentes e infraestrutura crítica.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 shadow-xl shadow-black/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{card.title}</p>
                <p className="mt-3 text-3xl font-semibold">{card.value}</p>
                <p className="mt-2 text-sm text-slate-400">{card.description}</p>
              </div>
              <card.icon className="text-3xl text-slate-300" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-8 text-slate-300">
        <p>
          Esta é uma versão inicial do novo portal do administrador. Os indicadores acima serão conectados aos
          serviços do backend durante as próximas fases do rollout.
        </p>
      </div>
    </section>
  );
}
