import { Agent } from '../../../types/agent';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { FiTrendingUp, FiUsers, FiClock, FiCheckCircle } from 'react-icons/fi';

const MOCK_DATA = [
  { name: 'Seg', conversas: 45, sucesso: 38, tempo: 12 },
  { name: 'Ter', conversas: 52, sucesso: 42, tempo: 15 },
  { name: 'Qua', conversas: 48, sucesso: 40, tempo: 10 },
  { name: 'Qui', conversas: 61, sucesso: 55, tempo: 18 },
  { name: 'Sex', conversas: 55, sucesso: 48, tempo: 14 },
  { name: 'Sab', conversas: 32, sucesso: 28, tempo: 8 },
  { name: 'Dom', conversas: 28, sucesso: 25, tempo: 7 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function AnalyticsCharts({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Mensagens', value: '1,284', icon: FiTrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Usuários Únicos', value: '452', icon: FiUsers, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Tempo Médio', value: '1.4s', icon: FiClock, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Resoluções', value: '92%', icon: FiCheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg} dark:bg-opacity-10`}>
                <stat.icon className={stat.color} size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume de Conversas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6">Volume de Conversas (7 dias)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_DATA}>
                <defs>
                  <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="conversas" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorConv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Taxa de Sucesso */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6">Taxa de Sucesso vs Volume</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="sucesso" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="conversas" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
