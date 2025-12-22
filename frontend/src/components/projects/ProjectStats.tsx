// frontend/src/components/projects/ProjectStats.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";

const API = import.meta.env.VITE_API_URL;

export default function ProjectStats({ templateId }: { templateId?: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = templateId 
      ? `${API}/projects/stats?template_id=${templateId}`
      : `${API}/projects/stats`;
      
    fetchJson<any>(url)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [templateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <p className="text-gray-500 dark:text-gray-400">Erro ao carregar estatísticas</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📈 Estatísticas de Projetos
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Visão geral do desempenho dos seus projetos
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Projetos"
          value={stats.total_projects}
          icon="📊"
          color="bg-blue-600"
        />
        <StatCard
          title="Ativos"
          value={stats.active}
          icon="🔵"
          color="bg-indigo-600"
        />
        <StatCard
          title="Concluídos"
          value={stats.completed}
          icon="✅"
          color="bg-emerald-600"
        />
        <StatCard
          title="Progresso Médio"
          value={`${stats.avg_progress}%`}
          icon="📈"
          color="bg-purple-600"
        />
      </div>

      {/* Status Breakdown */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Por Status
        </h3>
        <div className="space-y-4">
          <StatusBar label="Ativos" value={stats.active} total={stats.total_projects} color="bg-blue-600" />
          <StatusBar label="Concluídos" value={stats.completed} total={stats.total_projects} color="bg-emerald-600" />
          <StatusBar label="Em Espera" value={stats.on_hold} total={stats.total_projects} color="bg-amber-500" />
          <StatusBar label="Cancelados" value={stats.cancelled} total={stats.total_projects} color="bg-rose-600" />
        </div>
      </section>

      {/* Priority Breakdown */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Por Prioridade
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PriorityCard label="Urgente" value={stats.by_priority.urgent} icon="🔴" color="text-rose-600" />
          <PriorityCard label="Alta" value={stats.by_priority.high} icon="🟠" color="text-orange-600" />
          <PriorityCard label="Média" value={stats.by_priority.medium} icon="🟡" color="text-amber-600" />
          <PriorityCard label="Baixa" value={stats.by_priority.low} icon="🟢" color="text-emerald-600" />
        </div>
      </section>

      {/* Financial Summary */}
      <section className="bg-linear-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
        
        <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
          <span className="p-2 bg-white/20 rounded-lg">💰</span>
          Resumo Financeiro
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/10">
            <p className="text-indigo-100/80 text-sm font-medium mb-2 uppercase tracking-wider">Valor Estimado Total</p>
            <p className="text-4xl font-black tracking-tight">
              {formatCurrency(stats.total_estimated_value)}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/10">
            <p className="text-indigo-100/80 text-sm font-medium mb-2 uppercase tracking-wider">Valor Final Total</p>
            <p className="text-4xl font-black tracking-tight">
              {formatCurrency(stats.total_final_value)}
            </p>
          </div>
        </div>

        {stats.total_final_value > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between relative z-10">
            <p className="text-sm font-medium text-indigo-100/80 uppercase tracking-wider">
              Variação do Portfólio
            </p>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${
              stats.total_final_value >= stats.total_estimated_value 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {stats.total_final_value >= stats.total_estimated_value ? '▲' : '▼'}
              {formatCurrency(Math.abs(stats.total_final_value - stats.total_estimated_value))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ==================== STAT CARD ====================

function StatCard({ title, value, icon, color }: { title: string; value: number | string; icon: string; color:  string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center text-2xl shadow-sm`}>
          {icon}
        </div>
      </div>
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">{title}</h4>
      <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
    </div>
  );
}

// ==================== STATUS BAR ====================

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-gray-900 dark:text-gray-100 font-bold">{label}</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          {value} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden border border-gray-200 dark:border-gray-600">
        <div
          className={`${color} h-3 rounded-full transition-all duration-500 ease-out shadow-sm`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ==================== PRIORITY CARD ====================

function PriorityCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className={`text-2xl font-bold ${color} mb-1`}>{value}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ==================== HELPERS ====================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

