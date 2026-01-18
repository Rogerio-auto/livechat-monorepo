// frontend/src/pages/admin/infrastructure/tabs/RabbitTab.tsx

import React from 'react';
import { FiLayers, FiUsers, FiMessageSquare, FiAlertCircle } from 'react-icons/fi';

export default function RabbitTab({ stats }: { stats: any[] }) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
        <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
          <FiLayers className="text-blue-400" />
          Filas de Mensageria
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase">Fila</th>
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase text-center">Mensagens</th>
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase text-center">Consumidores</th>
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stats.map((q) => (
                <tr key={q.queue} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="py-4">
                    <span className="text-sm font-medium text-slate-300 font-mono">{q.queue}</span>
                  </td>
                  <td className="py-4 text-center">
                    <span className={`text-sm font-bold ${q.messageCount > 100 ? 'text-rose-400' : 'text-white'}`}>
                      {q.messageCount}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400">
                      <FiUsers size={12} />
                      <span className="text-sm">{q.consumerCount}</span>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    {q.error ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500">
                        <FiAlertCircle size={10} /> ERRO
                      </span>
                    ) : q.consumerCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
                        ATIVO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-500">
                        IDLE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
               <FiMessageSquare size={20} />
            </div>
            <div>
               <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Backlog</p>
               <h4 className="text-xl font-bold text-white">
                  {stats.reduce((acc, q) => acc + (q.messageCount || 0), 0)}
               </h4>
            </div>
         </div>
         <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
               <FiUsers size={20} />
            </div>
            <div>
               <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Consumers</p>
               <h4 className="text-xl font-bold text-white">
                  {stats.reduce((acc, q) => acc + (q.consumerCount || 0), 0)}
               </h4>
            </div>
         </div>
      </div>
    </div>
  );
}
