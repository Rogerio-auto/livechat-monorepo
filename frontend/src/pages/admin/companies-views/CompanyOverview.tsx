import { useMemo, useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FiEdit2, FiCheck, FiX, FiPlay, FiPause, FiClock } from 'react-icons/fi';
import type { CompanyOutletContext } from '../types';

export function CompanyOverview() {
  const { company, analytics, isLoading, refresh } = useOutletContext<CompanyOutletContext>();
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [extendingDays, setExtendingDays] = useState('');
  const [isExtending, setIsExtending] = useState(false);

  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';

  useEffect(() => {
    if (isEditingPlan && plans.length === 0) {
      fetch(`${API}/api/subscriptions/plans`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPlans(data);
          } else {
            console.error("Invalid plans data:", data);
            setPlans([]);
          }
        })
        .catch(err => {
          console.error("Failed to load plans", err);
          setPlans([]);
        });
    }
  }, [isEditingPlan, plans.length, API]);

  const handleSavePlan = async () => {
    if (!selectedPlanId || !company) return;
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    setSavingPlan(true);
    try {
      const res = await fetch(`${API}/api/admin/companies/${company.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, planName: plan.name }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to update plan');
      await refresh();
      setIsEditingPlan(false);
    } catch (err) {
      alert('Erro ao atualizar plano');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!company) return;
    if (!confirm(`Tem certeza que deseja alterar o status para ${newStatus}?`)) return;
    try {
      await fetch(`${API}/api/admin/companies/${company.id}/subscription/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });
      await refresh();
    } catch (err) {
      alert('Erro ao alterar status');
    }
  };

  const handleExtend = async () => {
    if (!company) return;
    if (!extendingDays) return;
    try {
      await fetch(`${API}/api/admin/companies/${company.id}/subscription/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: Number(extendingDays) }),
        credentials: 'include'
      });
      await refresh();
      setIsExtending(false);
      setExtendingDays('');
    } catch (err) {
      alert('Erro ao estender assinatura');
    }
  };

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
              <dd className="font-semibold text-white flex items-center gap-2">
                {isEditingPlan ? (
                  <div className="flex items-center gap-2">
                    <select 
                      className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-sm"
                      value={selectedPlanId}
                      onChange={e => setSelectedPlanId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {Array.isArray(plans) && plans.map(p => (
                        <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                      ))}
                    </select>
                    <button onClick={handleSavePlan} disabled={savingPlan} className="text-emerald-400 hover:text-emerald-300">
                      <FiCheck />
                    </button>
                    <button onClick={() => setIsEditingPlan(false)} className="text-red-400 hover:text-red-300">
                      <FiX />
                    </button>
                  </div>
                ) : (
                  <>
                    {analytics?.finance.plan ?? company.plan ?? 'Sem plano'}
                    <button onClick={() => setIsEditingPlan(true)} className="text-slate-500 hover:text-white ml-2">
                      <FiEdit2 size={14} />
                    </button>
                  </>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <dt>Status</dt>
              <dd className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  analytics?.finance.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {financeStatus}
                </span>
                {analytics?.finance.isActive ? (
                  <button 
                    onClick={() => handleStatusChange('canceled')}
                    title="Cancelar Assinatura"
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <FiPause size={14} />
                  </button>
                ) : (
                  <button 
                    onClick={() => handleStatusChange('active')}
                    title="Ativar Assinatura"
                    className="text-emerald-400 hover:text-emerald-300 p-1"
                  >
                    <FiPlay size={14} />
                  </button>
                )}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <dt>Vencimento / Trial</dt>
              <dd className="font-semibold text-white flex items-center gap-2">
                {analytics?.finance.trialDaysRemaining !== undefined && analytics.finance.trialDaysRemaining > 0
                  ? `${analytics.finance.trialDaysRemaining} dias restantes (Trial)`
                  : 'Assinatura Ativa'}
                
                {isExtending ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="w-16 bg-slate-900 border border-white/10 rounded px-2 py-1 text-sm"
                      placeholder="Dias"
                      value={extendingDays}
                      onChange={e => setExtendingDays(e.target.value)}
                    />
                    <button onClick={handleExtend} className="text-emerald-400 hover:text-emerald-300">
                      <FiCheck />
                    </button>
                    <button onClick={() => setIsExtending(false)} className="text-red-400 hover:text-red-300">
                      <FiX />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsExtending(true)} 
                    title="Estender período"
                    className="text-slate-500 hover:text-white ml-2"
                  >
                    <FiClock size={14} />
                  </button>
                )}
              </dd>
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
