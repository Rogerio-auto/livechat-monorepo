import { useEffect, useState, useRef } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  FiActivity, FiAlertCircle, FiAlertTriangle, FiCheckCircle, 
  FiInfo, FiSearch, FiCalendar, FiDownload, FiTrash2,
  FiRefreshCw, FiClock, FiMaximize2, FiFilter, FiUser
} from 'react-icons/fi';
import { CompanyOutletContext } from '@livechat/shared';
import { api } from '@/lib/api';
import { showToast } from '@/hooks/useToast';

interface CompanyLog {
  id: string;
  event_type: 'error' | 'warning' | 'info' | 'success';
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  metadata: any;
  user_name: string | null;
  created_at: string;
}

interface LogListResponse {
  logs: CompanyLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    success: number;
  };
}

export function CompanyLogs() {
  const { company } = useOutletContext<CompanyOutletContext>();
  const { companyId } = useParams<{ companyId: string }>();
  
  const [logs, setLogs] = useState<CompanyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LogListResponse['stats'] | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  
  // Filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [selectedLog, setSelectedLog] = useState<CompanyLog | null>(null);

  const fetchLogs = async (page = 1) => {
    if (!companyId) return;
    setLoading(true);
    try {
      const response = await api.get<LogListResponse>(`/api/admin/companies/${companyId}/logs`, {
        params: { page, search, type, category }
      });
      setLogs(response.data.logs);
      setStats(response.data.stats);
      setPagination({ 
        page: response.data.pagination.page, 
        totalPages: response.data.pagination.totalPages 
      });
    } catch (error) {
      showToast("Erro ao carregar logs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(1), 300);
    return () => clearTimeout(timer);
  }, [search, type, category, companyId]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'error': return <FiAlertCircle className="text-red-400" />;
      case 'warning': return <FiAlertTriangle className="text-amber-400" />;
      case 'success': return <FiCheckCircle className="text-emerald-400" />;
      default: return <FiInfo className="text-blue-400" />;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Erros (24h)', value: stats?.errors || 0, color: 'text-red-400', bg: 'bg-red-400/5' },
          { label: 'Alertas (24h)', value: stats?.warnings || 0, color: 'text-amber-400', bg: 'bg-amber-400/5' },
          { label: 'Informações', value: stats?.info || 0, color: 'text-blue-400', bg: 'bg-blue-400/5' },
          { label: 'Sucessos', value: stats?.success || 0, color: 'text-emerald-400', bg: 'bg-emerald-400/5' }
        ].map((stat, i) => (
          <div key={i} className={`p-4 rounded-2xl border border-white/5 ${stat.bg}`}>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar nos logs..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-white/10 rounded-xl text-sm outline-none focus:border-blue-500/50 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <select 
            className="bg-slate-950 border border-white/10 rounded-xl text-xs px-3 py-2 outline-none focus:border-blue-500/50 transition-all text-slate-300"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todos Tipos</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
          </select>

          <select 
            className="bg-slate-950 border border-white/10 rounded-xl text-xs px-3 py-2 outline-none focus:border-blue-500/50 transition-all text-slate-300"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas Categorias</option>
            <option value="auth">Auth</option>
            <option value="message">Message</option>
            <option value="agent">Agent</option>
            <option value="system">System</option>
            <option value="api">API</option>
          </select>

          <button 
            onClick={() => fetchLogs(1)}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/2">
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Evento</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Usuário</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Gravidade</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Data/Hora</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-6">
                      <div className="h-4 bg-white/5 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <FiActivity size={32} className="opacity-20" />
                      <p>Nenhum log registrado</p>
                    </div>
                  </td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/2 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {getEventIcon(log.event_type)}
                      <div>
                        <p className="text-sm font-medium text-white">{log.title}</p>
                        <p className="text-[10px] text-slate-500 font-mono italic">[{log.category}]</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <FiUser size={12} />
                      {log.user_name || 'Sistema'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityClass(log.severity)}`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                    >
                      <FiMaximize2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination bar */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-white/5 bg-white/1 flex items-center justify-between">
             <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
               Page {pagination.page} / {pagination.totalPages}
             </span>
             <div className="flex gap-2">
                <button 
                  disabled={pagination.page === 1}
                  onClick={() => fetchLogs(pagination.page - 1)}
                  className="p-2 text-xs text-slate-400 hover:text-white disabled:opacity-30"
                >
                  Previous
                </button>
                <button 
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => fetchLogs(pagination.page + 1)}
                  className="p-2 text-xs text-slate-400 hover:text-white disabled:opacity-30"
                >
                  Next
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getEventIcon(selectedLog.event_type)}
                <div>
                  <h4 className="text-xl font-bold text-white">{selectedLog.title}</h4>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">{selectedLog.category} • {selectedLog.severity}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all"
              >
                <FiTrash2 className="rotate-45" size={20} /> {/* It's a cross if rotated */}
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Mensagem</p>
                <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 text-sm text-slate-300 leading-relaxed">
                  {selectedLog.message || 'Sem mensagem adicional.'}
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Metadados</p>
                  <pre className="p-4 bg-black/50 rounded-2xl border border-white/5 text-[10px] text-blue-300 overflow-x-auto font-mono">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase">Data do Evento</p>
                  <p className="mt-1 text-xs text-white">{new Date(selectedLog.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase">ID do Recurso</p>
                  <p className="mt-1 text-xs text-white font-mono">{selectedLog.id}</p>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-white/2 border-t border-white/5 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm transition-all"
              >
                Fechar
              </button>
              <button 
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all flex items-center gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                  showToast("Copiado!", "success");
                }}
              >
                <FiDownload size={14} />
                Copiar JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

