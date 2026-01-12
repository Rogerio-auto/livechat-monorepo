import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClienteDetailsModal } from "../components/customers/ClienteDetailsModal";
import { formatCPF } from "@livechat/shared";
import { API } from "../utils/api";
import { showToast } from "../hooks/useToast";

type Cliente = {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  status: string;
  kanban_column_id?: string;
  createdAt?: string;
  customer_id?: string;
};

type KanbanColumn = { id: string; name: string };

type LeadStats = {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
  newLastMonth: number;
  byStage: Record<string, number>;
  withProposals: number;
  conversionRate: number;
  avgTicket: number;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  
  const navigate = useNavigate();

  const requireAuth = async () => {
    try {
      await fetchJson(`${API}/auth/me`);
      return true;
    } catch {
      navigate("/login");
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      const ok = await requireAuth();
      if (!ok) return;
      try {
        const [clientesData, statsData, board] = await Promise.all([
          fetchJson<Cliente[]>(`${API}/leads`),
          fetchJson<LeadStats>(`${API}/api/leads/stats`),
          fetchJson<{ id?: string | null }>(`${API}/kanban/my-board`).catch(() => null),
        ]);
        console.log('[CLIENTES] 📊 Stats recebido:', {
          active: statsData.active,
          inactive: statsData.inactive,
          full: statsData
        });
        console.log('[CLIENTES] 👥 Clientes recebidos:', clientesData.length);
        console.log('[CLIENTES] 🎯 Board ID:', board?.id);
        console.log('[CLIENTES] 🔍 Exemplo de cliente (verificar customer_id):', {
          id: clientesData[0]?.id,
          name: clientesData[0]?.name,
          customer_id: clientesData[0]?.customer_id,
          hasCustomerId: !!clientesData[0]?.customer_id
        });
        
        setClientes(clientesData);
        setFilteredClientes(clientesData);
        setStats(statsData);
        if (board?.id) {
          const cols = await fetchJson<KanbanColumn[]>(
            `${API}/kanban/boards/${board.id}/columns`
          );
          console.log('[CLIENTES] 📋 Colunas carregadas:', cols);
          console.log('[CLIENTES] 🔍 Exemplo de cliente com kanban:', clientesData[0]);
          setColumns(cols || []);
        } else {
          console.log('[CLIENTES] ⚠️ Nenhum board encontrado');
        }
      } catch (err) {
        console.error("Failed to load clientes:", err);
      }
    })();
  }, [navigate]);

  // Apply filters
  useEffect(() => {
    let result = [...clientes];
    
    // Search filter
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.email?.toLowerCase().includes(lower) ||
          c.cpf?.includes(searchQuery)
      );
    }
    
    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => (c.status || "").toLowerCase() === statusFilter);
    }
    
    // Stage filter
    if (stageFilter !== "all") {
      result = result.filter((c) => c.kanban_column_id === stageFilter);
    }
    
    setFilteredClientes(result);
  }, [clientes, searchQuery, statusFilter, stageFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    try {
      await fetchJson(`${API}/leads/${id}`, { method: "DELETE" });
      const [clientesData, statsData] = await Promise.all([
        fetchJson<Cliente[]>(`${API}/leads`),
        fetchJson<LeadStats>(`${API}/api/leads/stats`),
      ]);
      setClientes(clientesData);
      setStats(statsData);
      showToast("Cliente excluído com sucesso!", "success");
    } catch (err: any) {
      showToast(err.message || "Erro ao excluir cliente", "error");
    }
  };

  const getInitial = (name?: string) => {
    return name?.charAt(0).toUpperCase() || "?";
  };

  const getInitialColor = (name?: string) => {
    const colors = [
      "bg-[#2fb463]/10 text-[#2fb463] dark:bg-[#2fb463]/20 dark:text-[#74e69e]",
      "bg-[#1f6feb]/10 text-[#1f6feb] dark:bg-[#1f6feb]/20 dark:text-[#388bfd]",
      "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      "bg-pink-500/10 text-pink-600 dark:text-pink-400",
      "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getChangeIndicator = (current: number, previous: number) => {
    if (previous === 0) return { symbol: "", percent: 0, color: "text-slate-500" };
    const change = ((current - previous) / previous) * 100;
    if (change > 0) return { symbol: "↑", percent: change, color: "text-[#2fb463]" };
    if (change < 0) return { symbol: "↓", percent: Math.abs(change), color: "text-rose-500" };
    return { symbol: "→", percent: 0, color: "text-slate-500" };
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-[#0b1015] transition-all duration-300">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-[1920px] mx-auto p-4 md:p-8 space-y-8">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h1>
              <p className="text-sm text-slate-500 mt-1">Gerencie sua base de contatos e acompanhe o desempenho comercial.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/clientes/novo")}
                className="inline-flex items-center justify-center rounded-xl bg-[#2fb463] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#2fb463]/20 transition-all duration-200  hover:bg-[#1f8b49]"
              >
                + Novo Cliente
              </button>
            </div>
          </div>

          {/* Metrics Grid - Stripe Style */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
              {/* Total */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] p-6 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2fb463]/10 text-[#2fb463] dark:text-[#74e69e] border border-[#2fb463]/20">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
              </div>

              {/* Ativos */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] p-6 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativos</div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2fb463]/10 text-[#2fb463] dark:text-[#74e69e] border border-[#2fb463]/20">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.active}</div>
                  <div className="text-xs font-medium text-slate-500">
                    {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                  </div>
                </div>
              </div>

              {/* Novos/Mês */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] p-6 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Novos/Mês</div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1f6feb]/10 text-[#1f6feb] dark:text-[#388bfd] border border-[#1f6feb]/20">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.newThisMonth}</div>
                  {(() => {
                    const indicator = getChangeIndicator(stats.newThisMonth, stats.newLastMonth);
                    return (
                      <div className={`text-xs font-medium ${indicator.color}`}>
                        {indicator.symbol} {indicator.percent.toFixed(0)}%
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Conversão */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] p-6 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversão</div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {Math.round(stats.conversionRate * 100)}%
                  </div>
                  <div className="text-xs font-medium text-slate-500">{stats.withProposals} propostas</div>
                </div>
              </div>

              {/* Ticket Médio */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] p-6 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket Médio</div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  R$ {stats.avgTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Inativos */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] p-6 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inativos</div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.inactive}</div>
                  <div className="text-xs font-medium text-rose-500">Atenção</div>
                </div>
              </div>
            </div>
          )}

          {/* Content Section */}
          <div className="bg-white dark:bg-[#151b23] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {/* Filters Bar */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nome, email ou CPF..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2fb463]/20 focus:border-[#2fb463] transition-all"
                  />
                </div>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2fb463]/20 focus:border-[#2fb463] transition-all"
                >
                  <option value="all">Todos os status</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
                
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2fb463]/20 focus:border-[#2fb463] transition-all"
                >
                  <option value="all">Todas as etapas</option>
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Exibindo {filteredClientes.length} de {clientes.length} clientes
              </div>
            </div>

            {/* Table Section */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 dark:bg-slate-900">
                    <th className="w-[25%] px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Cliente</th>
                    <th className="w-[15%] px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">CPF</th>
                    <th className="w-[25%] px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Email</th>
                    <th className="w-[12%] px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="w-[13%] px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Etapa</th>
                    <th className="w-[10%] px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredClientes.map((cliente) => (
                    <tr
                      key={cliente.id}
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-xs shadow-sm ${getInitialColor(cliente.name)}`}>
                            {getInitial(cliente.name)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-900 dark:text-white truncate text-sm">
                              {cliente.name}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">
                              ID: {cliente.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400 truncate">
                        {cliente.cpf ? formatCPF(cliente.cpf) : "-"}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400 truncate">
                        {cliente.email || "-"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            (cliente.status || "").toLowerCase() === "ativo"
                              ? "bg-[#2fb463]/10 text-[#2fb463] dark:bg-[#2fb463]/20 dark:text-[#74e69e]"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {cliente.status || "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400 truncate">
                        {columns.find((c) => c.id === cliente.kanban_column_id)?.name || "-"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setSelectedCliente(cliente)}
                            className="p-2 text-slate-400 hover:text-[#2fb463] hover:bg-[#2fb463]/10 rounded-lg transition-all"
                            title="Ver detalhes"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate("/documentos", { state: { lead: cliente } })}
                            className="p-2 text-slate-400 hover:text-[#1f6feb] hover:bg-[#1f6feb]/10 rounded-lg transition-all"
                            title="Criar proposta"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                            className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                            title="Editar"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cliente.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredClientes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nenhum cliente encontrado</h3>
                          <p className="text-slate-500 mt-1">Tente ajustar seus filtros ou adicione um novo contato.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Detalhes */}
      {selectedCliente && (
        <ClienteDetailsModal
          cliente={selectedCliente}
          onClose={() => setSelectedCliente(null)}
        />
      )}
    </main>
  );
}

