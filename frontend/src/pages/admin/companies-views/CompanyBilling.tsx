import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  FiCreditCard, FiDollarSign, FiClock, FiCheckCircle, 
  FiAlertCircle, FiDownload, FiExternalLink, FiFileText,
  FiArrowUpRight, FiSearch
} from 'react-icons/fi';
import { CompanyOutletContext } from '@livechat/shared';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BillingData {
  history: any[];
  subscription: any;
  stats: {
    total_paid: number;
    last_payment: any;
    pending_count: number;
  };
}

export function CompanyBilling() {
  const { companyId } = useParams<{ companyId: string }>();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBilling = async () => {
    try {
      const res = await api.get(`/api/admin/companies/${companyId}/billing`);
      setData(res.data);
    } catch (error) {
      console.error("Erro ao carregar financeiro:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchBilling();
  }, [companyId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'failed': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <FiCheckCircle />;
      case 'pending': return <FiClock />;
      case 'failed': return <FiAlertCircle />;
      default: return <FiFileText />;
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-500">Acessando registros financeiros...</div>;
  if (!data) return <div className="p-20 text-center text-slate-500">Registros financeiros indisponíveis.</div>;

  return (
    <div className="space-y-8">
      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Pago (Lifetime)</p>
          <p className="mt-1 text-2xl font-bold text-white">R$ {data.stats.total_paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Plano Atual</p>
          <p className="mt-1 text-lg font-bold text-blue-400 uppercase">{data.subscription?.plans?.display_name || 'N/A'}</p>
        </div>
        <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Faturas Pendentes</p>
          <p className={`mt-1 text-2xl font-bold ${data.stats.pending_count > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
            {data.stats.pending_count}
          </p>
        </div>
        <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Próximo Vencimento</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {data.subscription?.current_period_end 
              ? format(new Date(data.subscription.current_period_end), "dd 'de' MMMM", { locale: ptBR })
              : 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payment History Table */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
            <h3 className="font-bold text-white flex items-center gap-2">
              <FiFileText className="text-blue-400" />
              Histórico de Faturas
            </h3>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input 
                type="text" 
                placeholder="Filtrar faturas..." 
                className="pl-8 pr-4 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Método</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.history.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-white/1 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <p className="text-xs text-white">
                          {format(new Date(invoice.created_at), "dd/MM/yyyy")}
                        </p>
                        <p className="text-[10px] text-slate-500">#{invoice.id.split('-')[0].toUpperCase()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-white">
                        {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: invoice.currency })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        {invoice.status.toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">{invoice.payment_method || '---'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-500 hover:text-white transition-all">
                        <FiDownload size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subscription Info Sidebar */}
        <div className="space-y-6">
          <div className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl space-y-6">
            <h4 className="font-bold text-white flex items-center gap-2">
              <FiCreditCard className="text-purple-400" />
              Assinatura Ativa
            </h4>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase text-slate-500 mb-1">Método de Pagamento</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 bg-white/5 rounded border border-white/10" />
                    <span className="text-xs text-white font-mono">•••• 4242</span>
                  </div>
                  <FiArrowUpRight className="text-slate-600" />
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase text-slate-500 mb-2">Features Habilitadas</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.subscription?.plans?.features || {}).map(([key, val], i) => (
                    val ? (
                      <span key={i} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] uppercase font-bold">
                        {key.replace('_', ' ')}
                      </span>
                    ) : null
                  ))}
                </div>
              </div>

              <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                <FiExternalLink />
                Ver no Stripe Dashboard
              </button>
            </div>
          </div>

          <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl">
             <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl">
                   <FiDollarSign className="text-indigo-400" size={20} />
                </div>
                <div>
                   <h5 className="text-sm font-bold text-white">Próximo Faturamento</h5>
                   <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                     O valor previsto é de <strong>R$ 149,90</strong> em 12 de Outubro.
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}