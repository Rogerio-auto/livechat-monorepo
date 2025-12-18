import { useEffect, useState } from "react";
import { API, fetchJson } from "../../utils/api";
import type { OpenAIUsageLog, CompanyMonthlyBill } from "../../types/types";
import { FaFileDownload, FaHistory, FaChartLine, FaMoneyBillWave } from "react-icons/fa";

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
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="config-card p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
            <FaMoneyBillWave size={24} />
          </div>
          <div>
            <p className="text-sm config-text-muted">Custo Estimado (Mês Atual)</p>
            <p className="text-2xl font-bold config-heading">
              ${summary?.current_month?.total_cost ? parseFloat(summary.current_month.total_cost).toFixed(4) : "0.0000"}
            </p>
          </div>
        </div>
        <div className="config-card p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <FaChartLine size={24} />
          </div>
          <div>
            <p className="text-sm config-text-muted">Tokens Utilizados (Mês Atual)</p>
            <p className="text-2xl font-bold config-heading">
              {summary?.current_month?.total_tokens?.toLocaleString() ?? "0"}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="config-card overflow-hidden">
        <div className="flex items-center justify-between border-b config-divider p-4">
          <div className="flex items-center gap-2 font-semibold config-heading">
            <FaHistory />
            Uso Recente
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
          >
            <FaFileDownload />
            Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg-secondary)] config-text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Funcionalidade</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Custo (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y config-divider">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center config-text-muted">
                    Nenhum registro de uso encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--color-bg-secondary)] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{log.model}</td>
                    <td className="px-4 py-3 capitalize">{log.request_type || 'chat'}</td>
                    <td className="px-4 py-3 text-right">{log.total_tokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">
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
      <div className="config-card overflow-hidden">
        <div className="border-b config-divider p-4 font-semibold config-heading flex items-center gap-2">
          <FaMoneyBillWave />
          Faturas Mensais
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg-secondary)] config-text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Mês</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Total (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y config-divider">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center config-text-muted">
                    Nenhuma fatura gerada ainda.
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-[var(--color-bg-secondary)] transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {new Date(bill.billing_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        bill.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                        bill.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {bill.status === 'paid' ? 'Pago' : bill.status === 'pending' ? 'Pendente' : 'Atrasado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{bill.total_tokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold">
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
