import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell
} from 'recharts';
import { 
  Activity, AlertCircle, MessageSquare, Users, 
  ChevronRight, Search, Filter, RefreshCw, Play,
  Clock, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

const MonitoringDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveActivity, setLiveActivity] = useState<any[]>([]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agents-monitoring/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Configurar WebSocket para atualizações em tempo real
    const socket = io(import.meta.env.VITE_API_URL, { 
      withCredentials: true,
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('Connected to monitoring socket');
      // O backend deve colocar o usuário na sala da empresa automaticamente 
      // baseado no token/session, mas podemos emitir um join se necessário
    });

    socket.on('agent:activity', (activity) => {
      setLiveActivity(prev => [
        { ...activity, timestamp: new Date() }, 
        ...prev
      ].slice(0, 5));

      // Atualizar contadores locais para feedback imediato
      if (activity.type === 'message') {
        setStats((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            summary: {
              ...prev.summary,
              totalConversations: (prev.summary.totalConversations || 0) + 1
            }
          };
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoramento de Agentes IA</h1>
          <p className="text-gray-500">Acompanhe o desempenho e saúde dos seus agentes em tempo real.</p>
        </div>
        <button 
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Conversas Totais" 
          value={stats?.summary?.totalConversations || 0} 
          icon={<MessageSquare className="w-6 h-6 text-blue-500" />}
          trend="+12% vs ontem"
        />
        <StatCard 
          title="Erros Detectados" 
          value={stats?.summary?.totalErrors || 0} 
          icon={<AlertCircle className="w-6 h-6 text-red-500" />}
          trend="-5% vs ontem"
          trendColor="text-green-500"
        />
        <StatCard 
          title="Agentes Ativos" 
          value={stats?.summary?.activeAgents || 0} 
          icon={<Activity className="w-6 h-6 text-green-500" />}
          subValue={`de ${stats?.summary?.totalAgents || 0} totais`}
        />
        <StatCard 
          title="Taxa de Sucesso" 
          value="98.2%" 
          icon={<Users className="w-6 h-6 text-purple-500" />}
          trend="+0.5%"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Volume de Conversas</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.charts?.conversationsOverTime || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString()} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Atividade em Tempo Real */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Atividade Live</h3>
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          </div>
          <div className="space-y-4">
            {liveActivity.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Aguardando atividade...</p>
              </div>
            ) : (
              liveActivity.map((act, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 animate-in fade-in slide-in-from-right-4">
                  <div className="mt-1">
                    {act.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Zap className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {act.agentName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {act.type === 'message' ? `Respondeu em ${act.duration}ms` : act.message}
                    </p>
                  </div>
                  <div className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Performance por Agente</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.agents || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="metrics.total_conversations" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lista de Agentes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold">Status dos Agentes</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar agente..." 
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-3">Agente</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Conversas (24h)</th>
                <th className="px-6 py-3">Erros</th>
                <th className="px-6 py-3">Última Atividade</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.agents?.map((agent: any) => (
                <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      agent.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{agent.metrics?.total_conversations || 0}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={agent.metrics?.error_count > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {agent.metrics?.error_count || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {agent.metrics?.updated_at ? new Date(agent.metrics.updated_at).toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link 
                        to={`/agents/${agent.id}/playground`}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Playground"
                      >
                        <Play className="w-4 h-4" />
                      </Link>
                      <Link 
                        to={`/agents/${agent.id}`}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, trend, trendColor = "text-blue-500", subValue }: any) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      {trend && <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>}
    </div>
    <div>
      <h4 className="text-sm text-gray-500 font-medium">{title}</h4>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {subValue && <span className="text-xs text-gray-400">{subValue}</span>}
      </div>
    </div>
  </div>
);

export default MonitoringDashboard;
