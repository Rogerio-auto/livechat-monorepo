// frontend/src/pages/admin/infrastructure/tabs/DatabaseTab.tsx

import React from 'react';
import { FiDatabase, FiLayers, FiActivity, FiServer } from 'react-icons/fi';

export default function DatabaseTab({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
          <FiServer className="text-indigo-400 mb-2" />
          <p className="text-[10px] text-slate-500 uppercase font-bold">Conexões Ativas</p>
          <p className="text-xl font-bold text-white mt-1">{stats.activeConnections}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
          <FiDatabase className="text-indigo-400 mb-2" />
          <p className="text-[10px] text-slate-500 uppercase font-bold">SGBD</p>
          <p className="text-xl font-bold text-white mt-1">PostgreSQL</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
          <FiActivity className="text-indigo-400 mb-2" />
          <p className="text-[10px] text-slate-500 uppercase font-bold">Pooler</p>
          <p className="text-xl font-bold text-white mt-1">Supavisor</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
        <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
          <FiLayers className="text-indigo-400" />
          Maiores Tabelas (Storage Profile)
        </h3>
        
        <div className="space-y-4">
          {stats.topTables?.map((table: any) => (
            <div key={table.table_name} className="flex items-center justify-between group">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5 px-1">
                   <span className="text-sm font-medium text-slate-300 font-mono">{table.table_name}</span>
                   <span className="text-[10px] text-slate-500 font-bold">{table.total_size}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-indigo-500/50 group-hover:bg-indigo-500 transition-all" 
                     style={{ 
                        // Mock width based on a heuristic of the largest table in the top 10
                        width: `${Math.max(10, Math.min(100, (parseInt(table.total_size) / parseInt(stats.topTables[0].total_size)) * 100))}%` 
                     }}
                   ></div>
                </div>
                <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-tighter">
                   ~{table.row_count?.toLocaleString()} linhas estimadas
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
