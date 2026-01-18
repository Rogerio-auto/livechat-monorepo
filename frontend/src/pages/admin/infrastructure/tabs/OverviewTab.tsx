// frontend/src/pages/admin/infrastructure/tabs/OverviewTab.tsx

import React from 'react';
import { 
  FiCheckCircle, FiAlertTriangle, FiActivity, FiZap, FiLayers, FiDatabase, FiCpu, FiServer 
} from 'react-icons/fi';

export default function OverviewTab({ data }: { data: any }) {
  if (!data) return null;

  const cards = [
    {
      label: 'Redis Cache',
      value: data.redis?.used_memory_human || 'N/A',
      status: data.redis?.uptime_seconds > 0 ? 'online' : 'offline',
      sub: `${data.redis?.connected_clients || 0} conexões`,
      icon: FiZap,
      color: 'text-amber-400'
    },
    {
      label: 'Fila RabbitMQ',
      value: data.rabbit?.reduce((acc: number, q: any) => acc + (q.messageCount || 0), 0) || 0,
      status: 'online',
      sub: 'mensagens pendentes',
      icon: FiLayers,
      color: 'text-blue-400'
    },
    {
      label: 'Workers Ativos',
      value: data.workers?.filter((w: any) => w.active).length || 0,
      status: 'online',
      sub: `de ${data.workers?.length || 0} tipos`,
      icon: FiCpu,
      color: 'text-emerald-400'
    },
    {
      label: 'Conexões DB',
      value: data.db?.activeConnections || 0,
      status: 'online',
      sub: 'no pool principal',
      icon: FiDatabase,
      color: 'text-indigo-400'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
              <div className="mt-2 flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-white">{card.value}</h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">{card.sub}</p>
            </div>
            <div className={`p-3 rounded-xl bg-white/5 ${card.color}`}>
              <card.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Grid de status detalhado rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiCheckCircle className="text-emerald-400" /> 
            Serviços Críticos
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <span className="text-sm text-emerald-100">API Principal</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">OPERACIONAL</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <span className="text-sm text-emerald-100">Webhooks Meta</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">OPERACIONAL</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <span className="text-sm text-amber-100">IA Agents Runtime</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">CARGA ALTA</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiActivity className="text-indigo-400" />
            Performance Global
          </h3>
          <div className="flex items-center justify-center py-4">
             <div className="text-center">
                <div className="text-4xl font-black text-indigo-400">99.9<span className="text-lg">%</span></div>
                <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest">Uptime Mensal</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
