import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CompanyOutletContext } from '../types';

export function CompanyOverview() {
  const { company, analytics, isLoading } = useOutletContext<CompanyOutletContext>();

  if (isLoading && !analytics) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/5 bg-slate-900/70">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 text-slate-200">
        <p className="text-sm text-slate-400">Selecione uma empresa para visualizar os detalhes.</p>
      </div>
    );
  }

  const cards = useMemo(
    () =>
      analytics
        ? [
            { label: 'Usuários', value: analytics.counts.users },
            { label: 'Inboxes', value: analytics.counts.inboxes },
            { label: 'Agentes', value: analytics.counts.agents },
            { label: 'Mensagens', value: analytics.usage.messages },
          ]
        : [],
    [analytics]
  );

  const lastMessageLabel = analytics?.usage.lastMessageAt
    ? new Date(analytics.usage.lastMessageAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Sem registros recentes';

  const financeStatus = analytics?.finance.isActive ? 'Operacional' : 'Suspensa';

  return (
    <div className="space-y-6 rounded-3xl border border-white/5 bg-slate-900/70 p-8 text-slate-200">
      <div>
        <h3 className="text-xl font-semibold text-white">Visão Geral</h3>
        <p className="mt-2 text-sm text-slate-400">Panorama consolidado de {company.name}.</p>
      </div>

      {cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <h4 className="text-sm font-semibold text-white">Assinatura</h4>
          <dl className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <dt>Plano atual</dt>
              <dd className="font-semibold text-white">{analytics?.finance.plan ?? company.plan ?? 'Sem plano'}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <dt>Status</dt>
              <dd className={analytics?.finance.isActive ? 'text-emerald-300' : 'text-red-300'}>{financeStatus}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Último evento</dt>
              <dd className="text-slate-200">{lastMessageLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <h4 className="text-sm font-semibold text-white">Contato</h4>
          <dl className="mt-4 space-y-3 text-sm text-slate-300">
            {company.email && (
              <div className="flex items-center justify-between">
                <dt>Email</dt>
                <dd className="text-right text-white">{company.email}</dd>
              </div>
            )}
            {company.phone && (
              <div className="flex items-center justify-between">
                <dt>Telefone</dt>
                <dd className="text-right text-white">{company.phone}</dd>
              </div>
            )}
            {company.address && (
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">Endereço</dt>
                <dd className="mt-1 text-white">{company.address}</dd>
              </div>
            )}
            {!company.email && !company.phone && !company.address && (
              <p className="text-slate-500">Nenhuma informação de contato cadastrada.</p>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
