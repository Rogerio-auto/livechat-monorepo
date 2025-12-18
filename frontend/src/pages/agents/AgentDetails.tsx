import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Activity, AlertCircle, MessageSquare, Clock, 
  ChevronLeft, Settings, Database, Bug, RefreshCw
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const AgentDetails: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'errors' | 'knowledge' | 'config'>('overview');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agents-monitoring/${agentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching agent details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [agentId]);

  if (loading) return <div className="p-8 text-center"><RefreshCw className="animate-spin mx-auto" /></div>;
  if (!data?.agent) return <div className="p-8 text-center text-red-500">Agente não encontrado</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/dashboard?tab=ai-agents" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{data.agent.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              data.agent.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {data.agent.status}
            </span>
          </div>
          <p className="text-gray-500 text-sm">ID: {data.agent.id} • Modelo: {data.agent.model}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity className="w-4 h-4" />} label="Visão Geral" />
        <TabButton active={activeTab === 'errors'} onClick={() => setActiveTab('errors')} icon={<Bug className="w-4 h-4" />} label="Erros e Logs" />
        <TabButton active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} icon={<Database className="w-4 h-4" />} label="Base de Conhecimento" />
        <TabButton active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Settings className="w-4 h-4" />} label="Configurações" />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {activeTab === 'overview' && (
          <>
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.metrics}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period_start" tickFormatter={(val) => new Date(val).toLocaleDateString()} />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="total_conversations" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold">Últimos Erros</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {data.errors?.length > 0 ? data.errors.map((error: any) => (
                    <div key={error.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                          <div>
                            <div className="font-medium text-gray-900">{error.error_type}</div>
                            <div className="text-sm text-gray-500">{error.error_message}</div>
                            <div className="text-xs text-gray-400 mt-1">{new Date(error.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded bg-red-50 text-red-700 font-medium`}>
                          {error.severity}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-gray-500">Nenhum erro registrado recentemente.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Métricas Acumuladas</h3>
                <div className="space-y-4">
                  <MetricRow label="Total de Conversas" value={data.metrics?.reduce((acc: number, m: any) => acc + m.total_conversations, 0) || 0} icon={<MessageSquare className="w-4 h-4" />} />
                  <MetricRow label="Tempo Médio Resposta" value="1.2s" icon={<Clock className="w-4 h-4" />} />
                  <MetricRow label="Taxa de Erro" value="0.5%" icon={<AlertCircle className="w-4 h-4" />} />
                  <MetricRow label="Tokens Utilizados" value={data.metrics?.reduce((acc: number, m: any) => acc + m.total_tokens, 0).toLocaleString() || 0} icon={<Activity className="w-4 h-4" />} />
                </div>
              </div>

              <div className="bg-blue-600 p-6 rounded-xl text-white shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Playground</h3>
                <p className="text-blue-100 text-sm mb-4">Teste o comportamento do agente e ajuste o prompt em tempo real.</p>
                <Link 
                  to={`/agents/${agentId}/playground`}
                  className="block w-full py-2 bg-white text-blue-600 text-center rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  Abrir Playground
                </Link>
              </div>
            </div>
          </>
        )}

        {activeTab === 'errors' && (
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold">Logs Detalhados de Erros</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {data.errors?.length > 0 ? data.errors.map((error: any) => (
                <div key={error.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        error.severity === 'HIGH' || error.severity === 'CRITICAL' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{error.error_type}</h4>
                        <p className="text-xs text-gray-400">{new Date(error.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                      error.severity === 'HIGH' || error.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {error.severity}
                    </span>
                  </div>
                  <div className="ml-11">
                    <p className="text-sm text-gray-700 bg-gray-100 p-3 rounded-lg font-mono mb-3">
                      {error.error_message}
                    </p>
                    {error.agent_context && (
                      <details className="text-xs text-gray-500">
                        <summary className="cursor-pointer hover:text-blue-600 font-medium">Ver metadados e stack trace</summary>
                        <pre className="mt-2 p-3 bg-gray-900 text-gray-300 rounded overflow-x-auto">
                          {JSON.stringify(error.agent_context, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-gray-500">
                  <Bug className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum erro registrado para este agente.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Base de Conhecimento (RAG)</h3>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Adicionar Documento
              </button>
            </div>
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">A base de conhecimento permite que o agente consulte documentos específicos.</p>
              <p className="text-sm text-gray-400 mt-1">Funcionalidade em fase de implementação.</p>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-6">Configurações do Agente</h3>
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Agente</label>
                <input type="text" defaultValue={data.agent.name} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo AI</label>
                <select defaultValue={data.agent.model} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="gpt-4o">GPT-4o (Mais inteligente)</option>
                  <option value="gpt-4o-mini">GPT-4o-mini (Mais rápido/barato)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    {icon}
    {label}
  </button>
);

const MetricRow = ({ label, value, icon }: any) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center gap-2 text-gray-500 text-sm">
      {icon}
      <span>{label}</span>
    </div>
    <span className="font-semibold text-gray-900">{value}</span>
  </div>
);

export default AgentDetails;
