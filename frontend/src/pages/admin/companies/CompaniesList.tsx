import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiActivity,
  FiFilter,
  FiMail,
  FiPackage,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiUsers,
} from 'react-icons/fi';
import type { Industry } from '../../../types/cadastro';
import { INDUSTRY_OPTIONS } from '../../../config/industry-config';
import { IndustryBadge } from '../../../componets/admin/IndustryBadge';
import type { AdminCompany } from '../types';

export function CompaniesList() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<Industry[]>([]);

  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API}/api/companies`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Não foi possível carregar as empresas');
      }
      const data: AdminCompany[] = await response.json();
      setCompanies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao buscar empresas');
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch =
        searchQuery.length === 0 ||
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (company.email ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesIndustry =
        selectedIndustries.length === 0 ||
        (company.industry ? selectedIndustries.includes(company.industry) : false);

      return matchesSearch && matchesIndustry;
    });
  }, [companies, searchQuery, selectedIndustries]);

  const counters = useMemo(() => {
    return filteredCompanies.reduce(
      (acc, company) => {
        acc.users += company._count?.users ?? 0;
        acc.inboxes += company._count?.inboxes ?? 0;
        acc.agents += company._count?.agents ?? 0;
        return acc;
      },
      { users: 0, inboxes: 0, agents: 0 }
    );
  }, [filteredCompanies]);

  const handleRowClick = (companyId: string) => {
    navigate(`/admin/companies/${companyId}`);
  };

  const toggleIndustry = (industry: Industry) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry) ? prev.filter((item) => item !== industry) : [...prev, industry]
    );
  };

  const clearFilters = () => {
    setSelectedIndustries([]);
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        {error}
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Empresas</p>
          <h2 className="mt-2 text-3xl font-semibold">Mapa de contas</h2>
          <p className="text-sm text-slate-400">
            Pesquise, filtre e navegue para detalhes completos de cada empresa.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCompanies}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
        >
          <FiRefreshCw className="text-base" />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total de Empresas</p>
          <p className="mt-4 text-4xl font-semibold">{companies.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Usuários</p>
          <div className="mt-4 flex items-center gap-3 text-3xl font-semibold">
            {counters.users}
            <FiUsers className="text-slate-400" />
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Inboxes</p>
          <div className="mt-4 flex items-center gap-3 text-3xl font-semibold">
            {counters.inboxes}
            <FiActivity className="text-slate-400" />
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Agentes</p>
          <div className="mt-4 flex items-center gap-3 text-3xl font-semibold">
            {counters.agents}
            <FiPackage className="text-slate-400" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6">
        <div className="space-y-4">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Buscar por nome ou email"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-white/5 bg-slate-900/60 py-3 pl-12 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <FiFilter />
              Filtrar por Nicho
            </div>
            <div className="flex flex-wrap gap-2">
              {INDUSTRY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleIndustry(option.value)}
                  className={[
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
                    selectedIndustries.includes(option.value)
                      ? 'border-white bg-white/10 text-white'
                      : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  <option.icon />
                  {option.label}
                </button>
              ))}
            </div>
            {(searchQuery || selectedIndustries.length > 0) && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-sm text-slate-400 underline-offset-2 hover:text-white hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/5">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-6 py-4">Empresa</th>
                <th className="px-6 py-4">Nicho</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4 text-center">Usuários</th>
                <th className="px-6 py-4 text-center">Inboxes</th>
                <th className="px-6 py-4 text-center">Agentes</th>
                <th className="px-6 py-4">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma empresa encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className="cursor-pointer bg-slate-900/30 transition hover:bg-white/5"
                    onClick={() => handleRowClick(company.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
                          {company.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{company.name}</p>
                          {company.address && <p className="text-xs text-slate-400">{company.address}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <IndustryBadge industry={company.industry} size="sm" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-slate-400">
                        {company.email && (
                          <span className="flex items-center gap-2">
                            <FiMail />
                            {company.email}
                          </span>
                        )}
                        {company.phone && (
                          <span className="flex items-center gap-2">
                            <FiPhone />
                            {company.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-emerald-300">
                      {company._count?.users ?? 0}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-indigo-300">
                      {company._count?.inboxes ?? 0}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-orange-300">
                      {company._count?.agents ?? 0}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(company.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

