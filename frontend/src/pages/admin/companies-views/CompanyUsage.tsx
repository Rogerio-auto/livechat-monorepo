import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  FiZap, FiDatabase, FiMessageSquare, 
  FiInfo
} from 'react-icons/fi';
import { api } from '@/lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, Legend 
} from 'recharts';

interface UsageStat {
  history: any[];
  grouped: {
    messages_sent: any[];
    ai_calls: any[];
    storage_mb: any[];
  };
  current: {
    messages: number;
    ai: number;
    storage: number;
  };
}

export function CompanyUsage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [data, setData] = useState<UsageStat | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = async () => {
    try {
      const res = await api.get(`/api/admin/companies/${companyId}/usage`);
      setData(res.data);
    } catch (error) {
      console.error("Erro ao carregar uso:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchUsage();
  }, [companyId]);

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-500">Calculando métricas...</div>;
  if (!data) return <div className="p-20 text-center text-slate-500">Erro ao carregar dados de uso.</div>;

  return (
    <div className="space-y-8">
      {/* Current Usage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 text-emerald-400 mb-4">
            <FiMessageSquare size={20} />
            <h4 className="text-sm font-semibold uppercase tracking-wider">Mensagens (Mês)</h4>
          </div>
          <p className="text-4xl font-bold text-white">{data.current.messages}</p>
          <p className="text-xs text-slate-500 mt-2">Volume total de mensagens trocadas</p>
        </div>

        <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 text-blue-400 mb-4">
            <FiZap size={20} />
            <h4 className="text-sm font-semibold uppercase tracking-wider">Chamadas IA</h4>
          </div>
          <p className="text-4xl font-bold text-white">{data.current.ai}</p>
          <p className="text-xs text-slate-500 mt-2">Tokens e execuções de agentes</p>
        </div>

        <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 text-purple-400 mb-4">
            <FiDatabase size={20} />
            <h4 className="text-sm font-semibold uppercase tracking-wider">Armazenamento</h4>
          </div>
          <p className="text-4xl font-bold text-white">{data.current.storage} <span className="text-xl font-normal text-slate-500">MB</span></p>
          <p className="text-xs text-slate-500 mt-2">Mídias, documentos e logs</p>
        </div>
      </div>

      {/* Main Usage Chart */}
      <div className="p-8 bg-slate-900/50 border border-white/5 rounded-3xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-lg font-bold text-white">Evolução de Consumo</h3>
            <p className="text-xs text-slate-400">Comparativo dos últimos 3 meses</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white transition-all">Exportar CSV</button>
          </div>
        </div>

        <div className="h-[350px] w-full" style={{ minHeight: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.grouped.messages_sent || []}>
              <defs>
                <linearGradient id="colorMsg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis 
                dataKey="period_start" 
                stroke="#64748b" 
                fontSize={10} 
                tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { month: 'short' })}
              />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff10', borderRadius: '12px' }}
                itemStyle={{ color: '#fff', fontSize: '12px' }}
              />
              <Legend />
              <Area 
                name="Mensagens"
                type="monotone" 
                dataKey="value" 
                stroke="#10b981" 
                fillOpacity={1} 
                fill="url(#colorMsg)" 
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: AI Usage + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 bg-slate-900/50 border border-white/5 rounded-3xl">
           <h4 className="text-sm font-semibold text-white mb-6">Execuções de IA</h4>
           <div className="h-[250px]" style={{ minHeight: '250px' }}>
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.grouped.ai_calls || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="period_start" stroke="#64748b" fontSize={10} tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', { month: 'short' })} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff10' }} />
                  <Bar name="Chamadas" dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="p-8 bg-slate-900/50 border border-white/5 rounded-3xl">
           <h4 className="text-sm font-semibold text-white mb-6">Limites vs Consumo</h4>
           <div className="space-y-6">
             {[
               { label: 'Mensagens', current: data.current.messages, limit: 5000, color: 'bg-emerald-500' },
               { label: 'IA Tokens (k)', current: data.current.ai / 100, limit: 100, color: 'bg-blue-500' },
               { label: 'Armazenamento', current: data.current.storage, limit: 1024, color: 'bg-purple-500' },
             ].map((lim, i) => (
               <div key={i} className="space-y-2">
                 <div className="flex justify-between text-xs">
                   <span className="text-slate-400">{lim.label}</span>
                   <span className="text-white font-medium">{lim.current} / {lim.limit}</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                   <div 
                     className={`h-full ${lim.color} transition-all duration-1000`} 
                     style={{ width: `${Math.min((lim.current / lim.limit) * 100, 100)}%` }} 
                   />
                 </div>
               </div>
             ))}
             
             <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-start gap-3">
               <FiInfo className="text-blue-400 mt-1" />
               <p className="text-[11px] text-slate-400 leading-relaxed">
                 Os limites são redefinidos no início de cada ciclo de faturamento. Consumo excedente pode gerar cobranças adicionais conforme o plano contratado.
               </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
