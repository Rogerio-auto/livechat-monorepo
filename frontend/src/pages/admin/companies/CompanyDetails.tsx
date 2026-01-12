import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPauseCircle, FiPlayCircle, FiRefreshCw, FiRotateCcw } from 'react-icons/fi';
import { IndustryBadge } from '../../../components/admin/IndustryBadge';
import { useAdminNav } from '../layout/AdminNavContext';
import {
  AdminCompany,
  AdminCompanyDetails,
  CompanyAnalytics,
  CompanyDetailsPayload,
  CompanyOutletContext,
} from '@livechat/shared';

const TABS = [
  { label: 'Visão Geral', to: 'overview' },
  { label: 'Agentes', to: 'agents' },
  { label: 'Usuários', to: 'users' },
  { label: 'Logs', to: 'logs' },
];

export function CompanyDetails() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<AdminCompanyDetails | null>(null);
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setLabel } = useAdminNav();
  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';

  const fetchCompany = useCallback(async () => {
    if (!companyId) {
      throw new Error('Empresa não encontrada');
    }

    let payload: CompanyDetailsPayload | null = null;
    let errorMessage: string | null = null;

    const primary = await fetch(`${API}/api/admin/companies/${companyId}`, { credentials: 'include' });

    if (primary.ok) {
      payload = await primary.json();
    } else {
      errorMessage = await extractErrorMessage(primary);
      const fallback = await fetch(`${API}/api/companies`, { credentials: 'include' });
      if (fallback.ok) {
        const list: AdminCompany[] = await fallback.json();
        const found = list.find((item) => item.id === companyId);
        if (found) {
          payload = {
            company: found,
            analytics: buildFallbackAnalytics(found),
          };
        }
      } else if (!errorMessage) {
        errorMessage = await extractErrorMessage(fallback);
      }
    }

    if (!payload) {
      throw new Error(errorMessage ?? 'Não foi possível carregar os dados da empresa');
    }

    setCompany(payload.company);
    setAnalytics(payload.analytics);
  }, [API, companyId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchCompany()
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar empresa');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchCompany]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchCompany();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar dados');
    } finally {
      setRefreshing(false);
    }
  }, [fetchCompany]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleResetCache = async () => {
    if (!companyId) return;
    if (!confirm("Tem certeza que deseja limpar o cache desta empresa? Isso desconectará sessões ativas.")) return;
    
    setActionLoading('cache');
    try {
      const res = await fetch(`${API}/api/admin/companies/${companyId}/cache/reset`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Falha ao resetar cache');
      alert('Cache limpo com sucesso!');
    } catch (err) {
      alert('Erro ao limpar cache');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!companyId || !company) return;
    const isActive = company.status !== 'inactive';
    const action = isActive ? 'suspender' : 'ativar';
    if (!confirm(`Tem certeza que deseja ${action} esta empresa?`)) return;

    setActionLoading('status');
    try {
      const res = await fetch(`${API}/api/admin/companies/${companyId}/toggle-status`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Falha ao alterar status');
      await fetchCompany(); // Reload data
    } catch (err) {
      alert('Erro ao alterar status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImpersonate = async () => {
    if (!companyId) return;
    if (!confirm("Você será desconectado da sua conta de admin e logado como um usuário desta empresa. Continuar?")) return;

    setActionLoading('impersonate');
    try {
      const res = await fetch(`${API}/api/admin/companies/${companyId}/impersonate`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Falha ao gerar sessão de acesso');
      
      // O backend já setou o cookie. Redirecionar para o dashboard.
      window.location.href = '/dashboard';
    } catch (err) {
      alert('Erro ao tentar logar como empresa: ' + (err instanceof Error ? err.message : String(err)));
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (!companyId || !company?.name) {
      return;
    }
    setLabel(companyId, company.name);
    return () => {
      setLabel(companyId, null);
    };
  }, [company?.name, companyId, setLabel]);

  const statusBadge = useMemo(() => {
    const isActive = analytics?.finance.isActive ?? (company?.status?.toLowerCase() !== 'inactive');
    return isActive
      ? { label: 'Ativo', className: 'bg-emerald-500/20 text-emerald-200' }
      : { label: 'Inativo', className: 'bg-red-500/20 text-red-300' };
  }, [analytics?.finance.isActive, company?.status]);

  const planLabel = useMemo(() => {
    const plan = analytics?.finance.plan ?? company?.plan ?? 'Sem plano';
    return plan.toUpperCase();
  }, [analytics?.finance.plan, company?.plan]);

  const summaryCards = useMemo(
    () =>
      analytics
        ? [
            { label: 'Usuários', value: analytics.counts.users, tone: 'text-emerald-200' },
            { label: 'Inboxes', value: analytics.counts.inboxes, tone: 'text-indigo-200' },
            { label: 'Agentes', value: analytics.counts.agents, tone: 'text-orange-200' },
            { label: 'Mensagens', value: analytics.usage.messages, tone: 'text-sky-200' },
          ]
        : [],
    [analytics]
  );

  const outletContext = useMemo<CompanyOutletContext>(
    () => ({
      company,
      analytics,
      isLoading: loading || refreshing,
      refresh,
    }),
    [analytics, company, loading, refresh, refreshing]
  );

  if (loading && !company) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-white" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/admin/companies')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <FiArrowLeft />
          Voltar para a lista de empresas
        </button>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          {error ?? 'Empresa não encontrada'}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <button
        type="button"
        onClick={() => navigate('/admin/companies')}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <FiArrowLeft />
        Voltar para Empresas
      </button>

      <div className="rounded-xl border border-white/5 bg-slate-900/70 p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 text-2xl font-semibold">
                {company.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Empresa</p>
                <h1 className="text-3xl font-semibold text-white">{company.name}</h1>
                <p className="text-xs text-slate-500">ID: {company.id}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className={`rounded-full px-3 py-1 ${statusBadge.className}`}>{statusBadge.label}</span>
              <span className="rounded-full bg-blue-500/15 px-3 py-1 text-blue-200">
                {planLabel}
              </span>
              <IndustryBadge industry={company.industry} size="md" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleImpersonate}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:opacity-50"
            >
              {actionLoading === 'impersonate' ? <FiRefreshCw className="animate-spin" /> : <FiPlayCircle />}
              Logar como Empresa
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-400/40 px-4 py-2 text-sm text-orange-200 transition hover:bg-orange-500/10 disabled:opacity-50"
            >
              {actionLoading === 'status' ? <FiRefreshCw className="animate-spin" /> : <FiPauseCircle />}
              {company.status === 'inactive' ? 'Ativar' : 'Suspender'}
            </button>
            <button
              type="button"
              onClick={handleResetCache}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/10 disabled:opacity-50"
            >
              <FiRefreshCw className={actionLoading === 'cache' ? 'animate-spin' : ''} />
              Resetar Cache
            </button>
          </div>
        </div>
      </div>

        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {error}
          </div>
        )}

        {analytics && summaryCards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-xl border border-white/5 bg-slate-900/70 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
                <p className={`mt-3 text-3xl font-semibold ${card.tone}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-xl border border-white/5 bg-slate-900/70 p-2">
            <nav className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    [
                      'rounded-xl px-4 py-2 text-sm font-medium transition',
                      isActive ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white',
                    ].join(' ')
                  }
                  end={tab.to === 'overview'}
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRotateCcw className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar dados'}
          </button>
        </div>

      <Outlet context={outletContext} />
    </section>
  );
}

function buildFallbackAnalytics(company: AdminCompany): CompanyAnalytics {
  return {
    counts: {
      users: company._count?.users ?? 0,
      inboxes: company._count?.inboxes ?? 0,
      agents: company._count?.agents ?? 0,
      chats: 0,
    },
    usage: {
      messages: 0,
      lastMessageAt: null,
    },
    finance: {
      plan: company.plan ?? null,
      status: company.status ?? null,
      isActive: (company.status ?? '').toLowerCase() !== 'inactive',
    },
  };
}

async function extractErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    return (payload && (payload.error || payload.message)) ?? response.statusText;
  } catch {
    return response.statusText || null;
  }
}

