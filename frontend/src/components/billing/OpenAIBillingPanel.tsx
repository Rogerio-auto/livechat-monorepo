import { useEffect, useState } from "react";
import { API, fetchJson } from "../../utils/api";
import type { OpenAIUsageLog, CompanyMonthlyBill } from "@livechat/shared";
import { 
  Download, 
  History, 
  TrendingUp, 
  DollarSign, 
  AlertCircle,
  Calendar,
  Cpu
} from "lucide-react";
import { Button } from "../../components/ui/Button";

export default function OpenAIBillingPanel() {
  const [summary, setSummary] = useState<any>(null);
  const [logs, setLogs] = useState<OpenAIUsageLog[]>([]);
  const [bills, setBills] = useState<CompanyMonthlyBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [summaryData, logsData, billsData] = await Promise.all([
          fetchJson<any>(`${API}/billing/summary`),
          fetchJson<OpenAIUsageLog[]>(`${API}/billing/usage-logs?limit=10`),
          fetchJson<CompanyMonthlyBill[]>(`${API}/billing/monthly`),
        ]);

        setSummary(summaryData);
        setLogs(logsData);
        setBills(billsData);
      } catch (err) {
        console.error("Error loading billing data:", err);
        setError("Não foi possível carregar os dados de faturamento.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleExportCsv = () => {
    window.open(`${API}/billing/export/csv`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0" size={20} />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Custo Estimado (Mês Atual)</span>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <DollarSign size={18} className="text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            ${summary?.current_month?.total_cost ? parseFloat(summary.current_month.total_cost).toFixed(4) : "0.0000"}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Baseado no consumo de tokens da API OpenAI.</p>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tokens Utilizados (Mês Atual)</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {summary?.current_month?.total_tokens?.toLocaleString() ?? "0"}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Total acumulado de prompt e completion tokens.</p>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="overflow-hidden">
        <div className="py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
            <History size={16} className="text-gray-400" />
            Uso Recente
          </h3>
          <Button variant="ghost" size="sm" onClick={handleExportCsv} className="flex items-center gap-2 text-blue-600">
            <Download size={14} />
            Exportar CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modelo</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Funcionalidade</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Tokens</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Custo (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 italic">
                    Nenhum registro de uso encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
                        <Cpu size={14} className="text-gray-400" />
                        {log.model}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        {log.request_type || 'chat'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                      {log.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-900 dark:text-white">
                      ${Number(log.estimated_cost).toFixed(6)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Bills */}
      <div className="overflow-hidden">
        <div className="py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
            <Calendar size={16} className="text-gray-400" />
            Faturas Mensais
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mês</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Tokens</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Total (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 italic">
                    Nenhuma fatura gerada ainda.
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                      {new Date(bill.billing_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        bill.status === 'paid' 
                          ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' 
                          : bill.status === 'pending' 
                          ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' 
                          : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                      }`}>
                        {bill.status === 'paid' ? 'Pago' : bill.status === 'pending' ? 'Pendente' : 'Atrasado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">
                      {bill.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                      ${Number(bill.total_cost_usd).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
