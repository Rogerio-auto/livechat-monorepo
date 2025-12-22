import { useOutletContext } from 'react-router-dom';
import type { CompanyOutletContext } from '../types';

export function CompanyLogs() {
  const { company, analytics } = useOutletContext<CompanyOutletContext>();

  const lastMessageLabel = analytics?.usage.lastMessageAt
    ? new Date(analytics.usage.lastMessageAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Sem registros recentes';

  return (
    <div className="space-y-6 rounded-xl border border-white/5 bg-slate-900/70 p-8 text-slate-200">
      <div>
        <h3 className="text-xl font-semibold text-white">Logs</h3>
        <p className="mt-2 text-sm text-slate-400">
          Últimas atividades de {company?.name ?? 'esta empresa'}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mensagens registradas</p>
          <p className="mt-2 text-3xl font-semibold text-white">{analytics?.usage.messages ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Último evento</p>
          <p className="mt-2 text-sm text-white">{lastMessageLabel}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-slate-400">
        O console de streaming (via Socket.io) será plugado aqui para acompanhar erros, jobs e ações críticas em tempo real.
      </div>
    </div>
  );
}

