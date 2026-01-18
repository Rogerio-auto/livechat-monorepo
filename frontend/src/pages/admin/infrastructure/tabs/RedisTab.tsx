// frontend/src/pages/admin/infrastructure/tabs/RedisTab.tsx

import React from 'react';
import { FiZap, FiBox, FiClock, FiActivity, FiCpu } from 'react-icons/fi';

export default function RedisTab({ stats }: { stats: any }) {
  if (!stats) return null;

  const metrics = [
    { label: 'Uso de Memória', value: stats.used_memory_human, icon: FiActivity },
    { label: 'Clientes Conectados', value: stats.connected_clients, icon: FiCpu },
    { label: 'Uptime', value: `${Math.floor(stats.uptime_seconds / 3600)}h`, icon: FiClock },
    { label: 'Versão', value: stats.version, icon: FiBox },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
            <m.icon className="text-amber-400 mb-2" />
            <p className="text-[10px] text-slate-500 uppercase font-bold">{m.label}</p>
            <p className="text-xl font-bold text-white mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <FiZap className="text-amber-400" />
          Operações e Cache Hit Rate
        </h3>
        
        <div className="space-y-6">
           <div>
              <div className="flex justify-between text-xs mb-2">
                 <span className="text-slate-400">Total de Comandos Processados</span>
                 <span className="text-white font-mono">{stats.total_commands_processed?.toLocaleString()}</span>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                 <div className="flex justify-between items-end">
                    <span className="text-xs text-slate-400 uppercase">Hits</span>
                    <span className="text-emerald-400 font-bold">{stats.keyspace_hits}</span>
                 </div>
                 <div className="flex justify-between items-end">
                    <span className="text-xs text-slate-400 uppercase">Misses</span>
                    <span className="text-rose-400 font-bold">{stats.keyspace_misses}</span>
                 </div>
              </div>

              <div className="flex flex-col items-center justify-center border-l border-white/5 pl-8">
                 <div className="text-3xl font-bold text-indigo-400">
                    {((stats.keyspace_hits / (stats.keyspace_hits + stats.keyspace_misses || 1)) * 100).toFixed(1)}%
                 </div>
                 <div className="text-[10px] text-slate-500 uppercase mt-1">Hit Rate</div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
