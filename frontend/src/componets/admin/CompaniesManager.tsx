import { useEffect, useState } from "react";
import { FiUsers, FiCalendar, FiActivity, FiMail, FiPhone, FiPackage } from "react-icons/fi";

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
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

  const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

  useEffect(() => {
    loadCompanies();
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
        <div className="config-card rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm config-text-muted">Total de Empresas</p>
              <p className="text-3xl font-bold mt-2 config-heading">{companies.length}</p>
            </div>
            <FiPackage className="text-3xl text-(--color-highlight)" />
          </div>
        </div>

        <div className="config-card rounded-2xl p-6">
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

        <div className="config-card rounded-2xl p-6">
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

        <div className="config-card rounded-2xl p-6">
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

      {/* Lista de Empresas */}
      <div className="config-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs uppercase tracking-wide config-text-muted border-b config-divider">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">
                  Empresa
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
              {companies.map((company) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhes da Empresa (Modal) */}
      {selectedCompany && (
  <div className="fixed inset-0 bg-(--color-overlay) flex items-center justify-center z-50 p-4">
          <div className="config-modal rounded-2xl shadow-lg max-w-2xl w-full">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
