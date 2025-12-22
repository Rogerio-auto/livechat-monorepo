import { useEffect, useState } from 'react';
import { FiActivity, FiDatabase, FiUsers, FiDollarSign } from 'react-icons/fi';

type AdminStats = {
  kpis: {
    mrr: number;
    total_companies: number;
    active_companies: number;
    total_users: number;
  };
  infra: {
    database: string;
    redis: string;
    rabbitmq: string;
    storage: string;
  };
};

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(`${API}/api/admin/stats`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch admin stats', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [API]);

  const CARDS = [
    {
      title: 'MRR (Estimado)',
      value: stats ? `R$ ${stats.kpis.mrr.toLocaleString('pt-BR')}` : '--',
      description: 'Receita recorrente mensal',
      icon: FiDollarSign,
    },
    {
      title: 'Empresas Ativas',
      value: stats ? `${stats.kpis.active_companies} / ${stats.kpis.total_companies}` : '--',
      description: 'Total monitorado em tempo real',
      icon: FiUsers,
    },
    {
      title: 'Infraestrutura',
      value: stats ? 'Saudável' : '--', // Simplificado por enquanto
      description: 'Banco, Redis e Filas operacionais',
      icon: FiActivity,
    },
  ];

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
            className="rounded-xl border border-white/5 bg-slate-900/60 p-6 shadow-md shadow-black/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{card.title}</p>
                <p className="mt-3 text-3xl font-semibold">
                  {loading ? <span className="animate-pulse">...</span> : card.value}
                </p>
                <p className="mt-2 text-sm text-slate-400">{card.description}</p>
              </div>
              <card.icon className="text-3xl text-slate-300" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-8 text-slate-300">
        <h3 className="mb-4 text-lg font-medium text-white">Status dos Serviços</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats && Object.entries(stats.infra).map(([service, status]) => (
            <div key={service} className="flex items-center gap-3 rounded-lg bg-slate-950/50 p-4">
              <div className={`h-2 w-2 rounded-full ${status === 'healthy' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <div>
                <p className="text-xs uppercase text-slate-500">{service}</p>
                <p className="text-sm font-medium capitalize text-white">{status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
