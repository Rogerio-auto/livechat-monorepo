// frontend/src/pages/admin/infrastructure/tabs/WorkersTab.tsx

import React from 'react';
import { FiCpu, FiActivity, FiSearch, FiClock } from 'react-icons/fi';

export default function WorkersTab({ workers }: { workers: any[] }) {
  if (!workers) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FiCpu className="text-emerald-400" />
          Instâncias de Workers (PID Locks)
        </h3>
        <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded">
          {workers.filter(w => w.active).length} ativos
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workers.map((worker) => (
          <div 
            key={worker.type} 
            className={`p-5 rounded-2xl border transition-all ${
              worker.active 
                ? 'bg-emerald-500/5 border-emerald-500/10' 
                : 'bg-slate-900/50 border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-tight">{worker.type}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Tipo de Processamento</p>
              </div>
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                worker.active ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-400'
              }`}>
                {worker.active ? 'RUNNING' : 'STOPPED'}
              </div>
            </div>

            {worker.active && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs">
                   <span className="text-slate-400 flex items-center gap-1.5 font-mono">
                      <FiSearch size={12}/> ID: {worker.instanceId.split('-')[0]}
                   </span>
                   <span className="text-slate-400 flex items-center gap-1.5">
                      <FiClock size={12}/> TTL: {worker.ttl}s
                   </span>
                </div>
                {/* Visual heartbeat bar */}
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 animate-[pulse_2s_infinite]" style={{ width: '100%' }}></div>
                </div>
              </div>
            )}

            {!worker.active && (
              <div className="mt-6 py-2 text-center border border-dashed border-white/5 rounded-lg">
                <p className="text-xs text-slate-600 italic">instância inativa</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex gap-4">
         <FiActivity className="text-indigo-400 shrink-0 mt-1" />
         <div>
            <h5 className="text-sm text-indigo-200 font-semibold italic">Nota sobre Auto-Healing</h5>
            <p className="text-xs text-indigo-300/60 mt-1 leading-relaxed">
              O sistema utiliza locks baseados em Redis com TTL. Se um worker cair inesperadamente, o lock expirará e uma nova instância poderá assumir o processamento automaticamente (Auto-Healing).
            </p>
         </div>
      </div>
    </div>
  );
}
