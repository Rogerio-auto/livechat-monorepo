import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../componets/Sidbars/sidebar";
import { ClienteForm } from "../componets/clientes/ClienteForm";
import { formatCPF } from "../utils/format";
import { API } from "../utils/api";

type Cliente = {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  status: string;
  kanban_column_id?: string;
  createdAt?: string;
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
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  
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
        setClientes(clientesData);
        setFilteredClientes(clientesData);
        setStats(statsData);
        if (board?.id) {
          const { data: cols } = await fetchJson<{ data: KanbanColumn[] }>(
            `${API}/kanban/${board.id}/columns`
          );
          setColumns(cols || []);
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

  const handleFormSubmit = async (data: Partial<Cliente>) => {
    try {
      if (editingCliente) {
        await fetchJson(`${API}/leads/${editingCliente.id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        await fetchJson(`${API}/leads`, {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
      
      // Reload data
      const [clientesData, statsData] = await Promise.all([
        fetchJson<Cliente[]>(`${API}/leads`),
        fetchJson<LeadStats>(`${API}/api/leads/stats`),
      ]);
      setClientes(clientesData);
      setStats(statsData);
      
      // Success feedback
      const message = editingCliente ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!";
      alert(message);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar cliente");
      throw err; // Re-throw para que o form não feche
    }
  };

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
    } catch (err: any) {
      alert(err.message || "Erro ao excluir cliente");
    }
  };

  const getInitial = (name?: string) => {
    return name?.charAt(0).toUpperCase() || "?";
  };

  const getInitialColor = (name?: string) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-red-500",
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getChangeIndicator = (current: number, previous: number) => {
    if (previous === 0) return { symbol: "", percent: 0, color: "text-gray-400" };
    const change = ((current - previous) / previous) * 100;
    if (change > 0) return { symbol: "↑", percent: change, color: "text-green-500" };
    if (change < 0) return { symbol: "↓", percent: Math.abs(change), color: "text-red-500" };
    return { symbol: "→", percent: 0, color: "text-gray-400" };
  };

  return (
    <>
      <Sidebar />
  <div className="ml-16 min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20 transition-colors duration-300">
        <div className="h-screen overflow-auto p-6">
          <div className="w-full space-y-6">
            {/* Card principal com todo o conteúdo */}
            <div className="bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-2xl transition-colors duration-300">
              
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Gerencie seus clientes e acompanhe métricas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCliente(null);
                    setShowForm(true);
                  }}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700 hover:shadow-lg"
                >
                  + Novo Cliente
                </button>
              </div>

              {/* Metrics Cards */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                  {/* Total */}
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-blue-500/10 via-transparent to-transparent p-5">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total</span>
                        <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
                    </div>
                  </div>

                  {/* Ativos */}
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-green-500/10 via-transparent to-transparent p-5">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-green-500/10 blur-2xl" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Ativos</span>
                        <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% do total
                      </div>
                    </div>
                  </div>

                  {/* Novos/Mês */}
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-purple-500/10 via-transparent to-transparent p-5">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Novos/Mês</span>
                        <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.newThisMonth}</div>
                      {(() => {
                        const indicator = getChangeIndicator(stats.newThisMonth, stats.newLastMonth);
                        return (
                          <div className={`text-xs mt-1 ${indicator.color}`}>
                            {indicator.symbol} {indicator.percent.toFixed(0)}% vs mês anterior
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Conversão */}
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-orange-500/10 via-transparent to-transparent p-5">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Conversão</span>
                        <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {Math.round(stats.conversionRate * 100)}%
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {stats.withProposals} com propostas
                      </div>
                    </div>
                  </div>

                  {/* Ticket Médio */}
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-pink-500/10 via-transparent to-transparent p-5">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-pink-500/10 blur-2xl" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Ticket Médio</span>
                        <svg className="h-5 w-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        R$ {stats.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Inativos */}
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-red-500/10 via-transparent to-transparent p-5">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Inativos</span>
                        <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inactive}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Requer atenção</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Buscar por nome, email ou CPF..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {/* Status */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos os status</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                  
                  {/* Stage */}
                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todas as etapas</option>
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Results count */}
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Exibindo {filteredClientes.length} de {clientes.length} clientes
                </div>
              </div>

              {/* Table with limited height and scroll */}
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 sticky top-0 z-10">
                      <tr className="uppercase tracking-wide text-xs">
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">CPF</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Etapa</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClientes.map((cliente) => (
                        <tr
                          key={cliente.id}
                          className="border-t border-gray-200 dark:border-gray-700 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getInitialColor(cliente.name)} text-white font-semibold text-sm`}>
                                {getInitial(cliente.name)}
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {cliente.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {cliente.cpf ? formatCPF(cliente.cpf) : "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {cliente.email || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                (cliente.status || "").toLowerCase() === "ativo"
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {cliente.status || "Inativo"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {columns.find((c) => c.id === cliente.kanban_column_id)?.name || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                title="Criar proposta"
                                onClick={() =>
                                  navigate("/documentos", {
                                    state: {
                                      lead: {
                                        id: cliente.id,
                                        name: cliente.name,
                                        email: cliente.email,
                                      },
                                    },
                                  })
                                }
                                className="rounded-lg p-2 text-blue-600 dark:text-blue-400 transition-colors duration-150 hover:bg-blue-500/10"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="h-5 w-5"
                                >
                                  <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375H16.5V7.5a3 3 0 00-3-3H7.125a3.375 3.375 0 00-3.375 3.375v9.75A3.375 3.375 0 007.125 21h9.75A3.375 3.375 0 0020.25 17.625V16.5a2.25 2.25 0 00-.75-1.659v-.591z" />
                                  <path d="M15 3.75H9.75A2.25 2.25 0 007.5 6v.75h6.75A3.75 3.75 0 0118 10.5v1.5h.75a.75.75 0 010 1.5H18v1.5a2.25 2.25 0 01-2.25 2.25H7.5V18a.75.75 0 011.5 0v1.5h6a3 3 0 003-3V6A2.25 2.25 0 0015 3.75z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Editar"
                                onClick={() => {
                                  setEditingCliente(cliente);
                                  setShowForm(true);
                                }}
                                className="rounded-lg p-2 text-blue-600 dark:text-blue-400 transition-colors duration-150 hover:bg-blue-500/10"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="h-5 w-5"
                                >
                                  <path d="M21.731 2.269a2.625 2.625 0 00-3.714 0l-1.086 1.086 3.714 3.714 1.086-1.086a2.625 2.625 0 000-3.714z" />
                                  <path d="M3 17.25V21h3.75L19.314 8.436l-3.714-3.714L3 17.25z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Excluir"
                                onClick={() => handleDelete(cliente.id)}
                                className="rounded-lg p-2 text-red-500 transition-colors duration-150 hover:bg-red-500/10"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="h-5 w-5"
                                >
                                  <path d="M9 3a1 1 0 00-1 1v1H5.5a.75.75 0 000 1.5h13a.75.75 0 000-1.5H16V4a1 1 0 00-1-1H9z" />
                                  <path
                                    fillRule="evenodd"
                                    d="M6.75 7.5A.75.75 0 016 8.25v10.5A3.75 3.75 0 009.75 22.5h4.5A3.75 3.75 0 0018 18.75V8.25a.75.75 0 00-.75-.75h-10.5zM9 10.5a.75.75 0 011.5 0v8.25a.75.75 0 01-1.5 0V10.5zm4.5 0a.75.75 0 011.5 0v8.25a.75.75 0 01-1.5 0V10.5z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredClientes.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-gray-600 dark:text-gray-400">
                            <div className="flex flex-col items-center justify-center">
                              <svg className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                              <p className="font-medium">Nenhum cliente encontrado</p>
                              <p className="text-sm mt-1">Tente ajustar os filtros ou adicione um novo cliente</p>
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
        </div>

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div 
              className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fixo do modal */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-8 py-5">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {editingCliente ? "Editar Cliente" : "Novo Cliente"}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Preencha os dados abaixo para {editingCliente ? "atualizar" : "cadastrar"} o cliente
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCliente(null);
                  }}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Fechar
                </button>
              </div>

              {/* Conteúdo com scroll */}
              <div className="overflow-y-auto max-h-[calc(90vh-88px)] px-8 py-6">
                <ClienteForm 
                  initialData={editingCliente} 
                  onSubmit={async (data: any) => {
                    await handleFormSubmit(data);
                    setShowForm(false);
                    setEditingCliente(null);
                  }} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
