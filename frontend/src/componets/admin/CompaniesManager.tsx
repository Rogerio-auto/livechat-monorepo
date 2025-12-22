import { useEffect, useState } from "react";
import { FiUsers, FiCalendar, FiActivity, FiMail, FiPhone, FiPackage, FiTrash2, FiAlertTriangle, FiEdit2, FiRefreshCw, FiSearch, FiX, FiFilter } from "react-icons/fi";
import { IndustryBadge } from "./IndustryBadge";
import { EditIndustryModal } from "./EditIndustryModal";
import { Industry } from "../../types/onboarding";
import { INDUSTRY_OPTIONS } from "../../config/industry-config";

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: Industry | null;
  created_at: string;
  _count?: {
    users: number;
    inboxes: number;
    agents: number;
  };
};

export function CompaniesManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [urlKey, setUrlKey] = useState(0); // Para forçar re-render quando URL muda
  
  // Estados para filtros e busca
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<Industry[]>([]);

  const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

  // Detectar parâmetro editIndustry na URL
  const params = new URLSearchParams(window.location.search);
  const editIndustryId = params.get("editIndustry");
  const editingCompany = editIndustryId ? companies.find((c) => c.id === editIndustryId) : null;

  // Filtrar empresas
  const filteredCompanies = companies.filter((company) => {
    // Filtro de busca (nome ou email)
    const matchesSearch = 
      searchQuery === "" ||
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (company.email?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    
    // Filtro de industry
    const matchesIndustry = 
      selectedIndustries.length === 0 ||
      (company.industry && selectedIndustries.includes(company.industry));
    
    return matchesSearch && matchesIndustry;
  });

  // Sincronizar filtros com URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get("search") || "";
    const industries = params.get("industries")?.split(",").filter(Boolean) as Industry[] || [];
    
    setSearchQuery(search);
    setSelectedIndustries(industries);
  }, [urlKey]);

  useEffect(() => {
    loadCompanies();

    // Escutar mudanças na URL (botão voltar do browser)
    const handlePopState = () => {
      setUrlKey(prev => prev + 1); // Força re-render
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/companies`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar empresas");
      const data = await res.json();
      setCompanies(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${API}/api/admin/companies/${selectedCompany.id}/delete`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao deletar empresa");
      }

      // Recarregar lista de empresas
      await loadCompanies();
      
      // Fechar modais
      setDeleteModalOpen(false);
      setSelectedCompany(null);
      setDeletePassword("");
      setDeleteError(null);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteModalOpen(true);
    setDeletePassword("");
    setDeleteError(null);
  };

  // Helper para fechar o modal de edição de industry
  const closeEditIndustryModal = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("editIndustry");
    window.history.pushState({}, "", url);
    setUrlKey(prev => prev + 1); // Força re-render
  };

  // Helper para recarregar dados após edição bem-sucedida
  const handleEditIndustrySuccess = async () => {
    await loadCompanies();
    // Recarregar também os detalhes da empresa se a modal estiver aberta
    if (selectedCompany) {
      const updatedCompany = companies.find((c) => c.id === selectedCompany.id);
      if (updatedCompany) {
        setSelectedCompany(updatedCompany);
      }
    }
  };

  // Atualizar URL com filtros
  const updateUrlFilters = (search: string, industries: Industry[]) => {
    const url = new URL(window.location.href);
    
    if (search) {
      url.searchParams.set("search", search);
    } else {
      url.searchParams.delete("search");
    }
    
    if (industries.length > 0) {
      url.searchParams.set("industries", industries.join(","));
    } else {
      url.searchParams.delete("industries");
    }
    
    window.history.pushState({}, "", url);
  };

  // Handler para busca
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    updateUrlFilters(value, selectedIndustries);
  };

  // Handler para filtro de industry
  const toggleIndustryFilter = (industry: Industry) => {
    const newIndustries = selectedIndustries.includes(industry)
      ? selectedIndustries.filter((i) => i !== industry)
      : [...selectedIndustries, industry];
    
    setSelectedIndustries(newIndustries);
    updateUrlFilters(searchQuery, newIndustries);
  };

  // Limpar todos os filtros
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedIndustries([]);
    updateUrlFilters("", []);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-primary)"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-sm text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="config-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm config-text-muted">Total de Empresas</p>
              <p className="text-3xl font-bold mt-2 config-heading">{companies.length}</p>
            </div>
            <FiPackage className="text-3xl text-(--color-highlight)" />
          </div>
        </div>

        <div className="config-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm config-text-muted">Total de Usuários</p>
              <p className="text-3xl font-bold mt-2 config-heading">
                {companies.reduce((sum, c) => sum + (c._count?.users || 0), 0)}
              </p>
            </div>
            <FiUsers className="text-3xl text-emerald-400" />
          </div>
        </div>

        <div className="config-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm config-text-muted">Total de Inboxes</p>
              <p className="text-3xl font-bold mt-2 config-heading">
                {companies.reduce((sum, c) => sum + (c._count?.inboxes || 0), 0)}
              </p>
            </div>
            <FiActivity className="text-3xl text-purple-300" />
          </div>
        </div>

        <div className="config-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm config-text-muted">Total de Agentes IA</p>
              <p className="text-3xl font-bold mt-2 config-heading">
                {companies.reduce((sum, c) => sum + (c._count?.agents || 0), 0)}
              </p>
            </div>
            <FiActivity className="text-3xl text-orange-300" />
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="config-card rounded-xl p-6">
        <div className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-lg border config-input"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiX />
              </button>
            )}
          </div>

          {/* Filtros de Nicho */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FiFilter className="text-gray-400" />
                <span className="text-sm font-semibold config-heading">Filtrar por Nicho:</span>
              </div>
              {(selectedIndustries.length > 0 || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  <FiX className="text-xs" />
                  Limpar Filtros
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {INDUSTRY_OPTIONS.map((industry) => {
                const isSelected = selectedIndustries.includes(industry.value);
                const Icon = industry.icon;
                
                return (
                  <button
                    key={industry.value}
                    onClick={() => toggleIndustryFilter(industry.value)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all
                      ${isSelected
                        ? `${industry.color.bg} ${industry.color.text} ${industry.color.border} border-2`
                        : "border-2 border-gray-200 dark:border-gray-700 config-text-muted hover:border-gray-300 dark:hover:border-gray-600"
                      }
                    `}
                  >
                    <Icon className="text-base" />
                    {industry.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm config-text-muted">
            {filteredCompanies.length === companies.length ? (
              <span>Mostrando todas as {companies.length} empresas</span>
            ) : (
              <span>
                Mostrando {filteredCompanies.length} de {companies.length} empresas
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Empresas */}
      <div className="config-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs uppercase tracking-wide config-text-muted border-b config-divider">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">
                  Empresa
                </th>
                <th className="px-6 py-4 text-left font-semibold">
                  Nicho
                </th>
                <th className="px-6 py-4 text-left font-semibold">
                  Contato
                </th>
                <th className="px-6 py-4 text-center font-semibold">
                  Usuários
                </th>
                <th className="px-6 py-4 text-center font-semibold">
                  Inboxes
                </th>
                <th className="px-6 py-4 text-center font-semibold">
                  Agentes IA
                </th>
                <th className="px-6 py-4 text-left font-semibold">
                  Criado em
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FiSearch className="text-4xl config-text-muted" />
                      <p className="text-sm config-text-muted">
                        {searchQuery || selectedIndustries.length > 0
                          ? "Nenhuma empresa encontrada com os filtros aplicados"
                          : "Nenhuma empresa cadastrada"}
                      </p>
                      {(searchQuery || selectedIndustries.length > 0) && (
                        <button
                          onClick={clearFilters}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Limpar Filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                <tr
                  key={company.id}
                  className="hover:bg-(--color-surface-muted) transition-colors cursor-pointer"
                  onClick={() => setSelectedCompany(company)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: "var(--color-surface-muted)", color: "var(--color-heading)" }}>
                        {company.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium config-heading">
                          {company.name}
                        </p>
                        {company.address && (
                          <p className="text-xs config-text-muted mt-0.5">
                            {company.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <IndustryBadge industry={company.industry} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {company.email && (
                        <div className="flex items-center gap-2 text-sm config-text-muted">
                          <FiMail className="config-text-muted" />
                          {company.email}
                        </div>
                      )}
                      {company.phone && (
                        <div className="flex items-center gap-2 text-sm config-text-muted">
                          <FiPhone className="config-text-muted" />
                          {company.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 font-semibold">
                      {company._count?.users || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-semibold">
                      {company._count?.inboxes || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-800 font-semibold">
                      {company._count?.agents || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm config-text-muted">
                      <FiCalendar className="config-text-muted" />
                      {new Date(company.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhes da Empresa (Modal) */}
      {selectedCompany && (
  <div className="fixed inset-0 bg-(--color-overlay) flex items-center justify-center z-50 p-4">
          <div className="config-modal rounded-xl shadow-lg max-w-2xl w-full">
            <div className="flex items-start justify-between gap-4 border-b config-divider p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: "var(--color-surface-muted)", color: "var(--color-heading)" }}>
                  {selectedCompany.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold config-heading">{selectedCompany.name}</h3>
                  <p className="text-sm config-text-muted mt-1">ID: {selectedCompany.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCompany(null)}
                className="config-text-muted transition hover:text-(--color-heading) rounded-lg p-2"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Nicho da Empresa */}
              <div>
                <h4 className="text-sm font-semibold config-heading mb-3">
                  Nicho da Empresa
                </h4>
                <div className="flex items-center justify-between">
                  <IndustryBadge industry={selectedCompany.industry} size="md" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = new URL(window.location.href);
                      url.searchParams.set('editIndustry', selectedCompany.id);
                      window.history.pushState({}, '', url);
                      setUrlKey(prev => prev + 1); // Força re-render
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <FiEdit2 />
                    Editar Nicho
                  </button>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div>
                <h4 className="text-sm font-semibold config-heading mb-3">
                  Ações Rápidas
                </h4>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    
                    if (!selectedCompany.industry) {
                      alert('⚠️ Esta empresa não possui nicho configurado. Configure primeiro antes de aplicar configurações.');
                      return;
                    }
                    
                    if (!confirm(`Re-aplicar configurações do nicho ${selectedCompany.industry}? Isso irá sobrescrever as configurações atuais.`)) {
                      return;
                    }
                    try {
                      const res = await fetch(`${API}/api/admin/companies/${selectedCompany.id}/apply-industry-config`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      if (!res.ok) {
                        const error = await res.json();
                        throw new Error(error.error);
                      }
                      alert('✅ Configurações aplicadas com sucesso!');
                    } catch (err: any) {
                      alert(`Erro: ${err.message}`);
                    }
                  }}
                  disabled={!selectedCompany.industry}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                    selectedCompany.industry
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <FiRefreshCw />
                  Re-aplicar Configurações do Nicho
                </button>
                <p className="text-xs config-text-muted mt-2">
                  {selectedCompany.industry 
                    ? 'ℹ️ Isso irá criar/atualizar campos customizados, módulos habilitados e templates do nicho.'
                    : '⚠️ Configure o nicho primeiro para poder aplicar as configurações.'
                  }
                </p>
              </div>

              {/* Informações de Contato */}
              <div>
                <h4 className="text-sm font-semibold config-heading mb-3">
                  Informações de Contato
                </h4>
                <div className="space-y-2">
                  {selectedCompany.email && (
                    <div className="flex items-center gap-3 config-text-muted">
                      <FiMail className="config-text-muted" />
                      <span>{selectedCompany.email}</span>
                    </div>
                  )}
                  {selectedCompany.phone && (
                    <div className="flex items-center gap-3 config-text-muted">
                      <FiPhone className="config-text-muted" />
                      <span>{selectedCompany.phone}</span>
                    </div>
                  )}
                  {selectedCompany.address && (
                    <div className="flex items-center gap-3 config-text-muted">
                      <FiPackage className="config-text-muted" />
                      <span>{selectedCompany.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Estatísticas */}
              <div>
                <h4 className="text-sm font-semibold config-heading mb-3">
                  Estatísticas
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {selectedCompany._count?.users || 0}
                    </p>
                    <p className="text-xs config-text-muted mt-1">Usuários</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {selectedCompany._count?.inboxes || 0}
                    </p>
                    <p className="text-xs config-text-muted mt-1">Inboxes</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {selectedCompany._count?.agents || 0}
                    </p>
                    <p className="text-xs config-text-muted mt-1">Agentes IA</p>
                  </div>
                </div>
              </div>

              {/* Data de Criação */}
              <div className="pt-4 border-t config-divider">
                <div className="flex items-center gap-2 text-sm config-text-muted">
                  <FiCalendar className="config-text-muted" />
                  <span>
                    Criado em {new Date(selectedCompany.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Botão de Deletar Empresa */}
              <div className="pt-4 border-t border-red-500/20">
                <button
                  onClick={openDeleteModal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                >
                  <FiTrash2 />
                  Deletar Empresa Permanentemente
                </button>
                <p className="text-xs text-red-400 mt-2 text-center">
                  ⚠️ Esta ação irá deletar todos os dados da empresa, usuários, inboxes e agentes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Deleção */}
      {deleteModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4">
          <div className="config-modal rounded-xl shadow-md max-w-md w-full border-2 border-red-500/30">
            <div className="flex items-center justify-center gap-3 bg-red-600 text-white p-6 rounded-t-2xl">
              <FiAlertTriangle className="text-3xl" />
              <h3 className="text-xl font-bold">ATENÇÃO: Ação Irreversível</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                  Você está prestes a deletar:
                </p>
                <p className="text-lg font-bold config-heading">{selectedCompany.name}</p>
                <p className="text-xs config-text-muted mt-1">ID: {selectedCompany.id}</p>
              </div>

              <div className="space-y-2 text-sm config-text-muted">
                <p className="font-semibold text-red-600 dark:text-red-400">Esta ação irá deletar permanentemente:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{selectedCompany._count?.users || 0} usuário(s)</li>
                  <li>{selectedCompany._count?.inboxes || 0} inbox(es)</li>
                  <li>{selectedCompany._count?.agents || 0} agente(s) IA</li>
                  <li>Todos os chats, mensagens e dados relacionados</li>
                </ul>
              </div>

              <div className="pt-4 border-t config-divider space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold config-heading mb-2 block">
                    Digite sua senha de ADMIN para confirmar:
                  </span>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Sua senha de administrador"
                    className="w-full px-4 py-2 rounded-lg border config-input"
                    disabled={deleteLoading}
                    autoFocus
                  />
                </label>

                {deleteError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-700 dark:text-red-400">{deleteError}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setDeletePassword("");
                    setDeleteError(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors font-medium"
                  disabled={deleteLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteCompany}
                  disabled={!deletePassword || deleteLoading}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deletando...
                    </>
                  ) : (
                    <>
                      <FiTrash2 />
                      Confirmar Deleção
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Industry (via URL) */}
      {editingCompany && (
        <EditIndustryModal
          company={editingCompany}
          onClose={closeEditIndustryModal}
          onSuccess={handleEditIndustrySuccess}
        />
      )}
    </div>
  );
}

