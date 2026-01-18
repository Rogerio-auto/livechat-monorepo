// frontend/src/pages/Admin/Tools/ToolMonitoring.tsx

import React, { useState, useEffect } from 'react';
import { FiActivity, FiAlertTriangle, FiClock, FiCheckCircle, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { api } from '@/lib/api';
import { showToast } from '../../../hooks/useToast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';

export default function ToolMonitoring() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchDashboard = async () => {
    try {
      setRefreshing(true);
      const res = await api.get('/api/admin/tools/dashboard');
      setDashboard(res.data);
    } catch (error) {
      showToast('Erro ao carregar dashboard', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/api/admin/tools/logs', { 
        params: { 
          limit: pageSize,
          offset: (page - 1) * pageSize
        } 
      } as any);
      setLogs(res.data.logs);
      setTotalLogs(res.data.total);
    } catch (error) {
      showToast('Erro ao carregar logs', 'error');
    }
  };

  const fetchData = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboard(), fetchLogs()]);
    setRefreshing(false);
  };

  const handleTestTool = async (toolId: string) => {
    try {
      showToast('Executando teste de saúde...', 'info');
      const response = await api.post(`/api/admin/tools/${toolId}/test`);
      if (response.data.status === 'PASSED') {
        showToast('Ferramenta operacional!', 'success');
      } else {
        showToast(`Falha no teste: ${response.data.error_message || 'Erro desconhecido'}`, 'error');
      }
      fetchData();
    } catch (error) {
      showToast('Erro ao executar teste', 'error');
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Carregando dashboard...</div>;

  if (!dashboard) {
    return (
      <div className="p-10 text-center space-y-4">
        <div className="text-slate-500">Não foi possível carregar os dados do dashboard.</div>
        <button
          onClick={fetchData}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const { globalMetrics, toolStats, criticalTools } = dashboard;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoramento de Ferramentas</h1>
          <p className="text-slate-400">Acompanhe a saúde, latência e taxa de erro das integrações.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition"
        >
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Métricas Globais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Total de Chamadas" 
          value={globalMetrics.totalCalls.toLocaleString()} 
          icon={FiActivity} 
          color="text-blue-400" 
        />
        <MetricCard 
          title="Taxa de Erro" 
          value={`${globalMetrics.errorRate.toFixed(2)}%`} 
          icon={FiAlertTriangle} 
          color={globalMetrics.errorRate > 5 ? 'text-rose-400' : 'text-emerald-400'} 
        />
        <MetricCard 
          title="Latência Média" 
          value={`${globalMetrics.avgLatency.toFixed(0)}ms`} 
          icon={FiClock} 
          color="text-amber-400" 
        />
        <MetricCard 
          title="Ferramentas Ativas" 
          value={toolStats.length} 
          icon={FiCheckCircle} 
          color="text-indigo-400" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Uso */}
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Uso por Ferramenta</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toolStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="tool_name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="total_calls" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ferramentas Críticas */}
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Atenção Necessária</h2>
          <div className="space-y-4">
            {criticalTools.length === 0 ? (
              <p className="text-slate-500 text-center py-10">Nenhuma ferramenta com problemas críticos.</p>
            ) : (
              criticalTools.map((tool: any) => (
                <div key={tool.tool_id} className="flex items-center justify-between p-4 bg-rose-500/5 border border-rose-500/20 rounded-lg">
                  <div>
                    <div className="font-medium text-white">{tool.tool_name || tool.tool_id}</div>
                    <div className="text-xs text-rose-400">Taxa de erro: {Number(tool.error_rate || 0).toFixed(1)}% ({tool.error_count}/{tool.total_calls})</div>
                  </div>
                  <button
                    onClick={() => handleTestTool(tool.tool_id)}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded transition"
                  >
                    TESTAR AGORA
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Logs Recentes */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Logs de Execução Recentes</h2>
          <button className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Ver todos os logs</button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5">
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Data/Hora</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Ferramenta</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Latência</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Agente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-white/5 transition">
                <td className="px-6 py-4 text-sm text-slate-400">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-white">{log.tool_name || log.tool_id}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-400">{log.latency_ms}ms</td>
                <td className="px-6 py-4 text-sm text-slate-500 font-mono">{log.agent_id?.substring(0, 8)}...</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginação */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Mostrando <span className="text-white font-medium">{(page - 1) * pageSize + 1}</span> a <span className="text-white font-medium">{Math.min(page * pageSize, totalLogs)}</span> de <span className="text-white font-medium">{totalLogs}</span> logs
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * pageSize >= totalLogs}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{title}</span>
        <Icon className={color} size={20} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
