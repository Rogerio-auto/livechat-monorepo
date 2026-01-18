import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  FiSearch, FiFilter, FiMoreHorizontal, FiUser, 
  FiShield, FiClock, FiCheckCircle, FiXCircle, 
  FiUserMinus, FiMail, FiRefreshCw
} from 'react-icons/fi';
import { CompanyOutletContext } from '@livechat/shared';
import { api } from '@/lib/api';
import { showToast } from '@/hooks/useToast';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
}

interface UserListResponse {
  users: AdminUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function CompanyUsers() {
  const { company } = useOutletContext<CompanyOutletContext>();
  const { companyId } = useParams<{ companyId: string }>();
  
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  
  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const fetchUsers = async (page = 1) => {
    if (!companyId) return;
    setLoading(true);
    try {
      const response = await api.get<UserListResponse>(`/api/admin/companies/${companyId}/users`, {
        params: { page, search, role, status }
      });
      setUsers(response.data.users);
      setPagination({ 
        page: response.data.pagination.page, 
        totalPages: response.data.pagination.totalPages 
      });
    } catch (error) {
      showToast("Erro ao carregar usuários", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(1), 300);
    return () => clearTimeout(timer);
  }, [search, role, status, companyId]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/api/admin/companies/${companyId}/users/${userId}/role`, { role: newRole });
      showToast("Papel atualizado com sucesso", "success");
      fetchUsers(pagination.page);
    } catch (error) {
      showToast("Erro ao atualizar papel", "error");
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      await api.patch(`/api/admin/companies/${companyId}/users/${userId}/status`, { status: newStatus });
      showToast(`Status alterado para ${newStatus}`, "success");
      fetchUsers(pagination.page);
    } catch (error) {
      showToast("Erro ao atualizar status", "error");
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário da empresa?")) return;
    try {
      await api.delete(`/api/admin/companies/${companyId}/users/${userId}`);
      showToast("Usuário removido", "success");
      fetchUsers(pagination.page);
    } catch (error) {
      showToast("Erro ao remover usuário", "error");
    }
  };

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string; class: string }> = {
      ADMIN: { label: 'Admin', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
      SUPER_ADMIN: { label: 'Super Admin', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      MANAGER: { label: 'Gerente', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      AGENT: { label: 'Agente', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      VIEWER: { label: 'Visualizador', class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
    };
    const config = roles[role.toUpperCase()] || { label: role, class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statuses: Record<string, { label: string; icon: any; class: string }> = {
      active: { label: 'Ativo', icon: FiCheckCircle, class: 'text-emerald-400' },
      inactive: { label: 'Inativo', icon: FiClock, class: 'text-slate-400' },
      suspended: { label: 'Suspenso', icon: FiXCircle, class: 'text-red-400' },
    };
    const config = statuses[status.toLowerCase()] || { label: status, icon: FiClock, class: 'text-slate-400' };
    const Icon = config.icon;
    return (
      <span className={`flex items-center gap-1.5 text-xs font-medium ${config.class}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-6 py-4 bg-slate-900/50 border border-white/5 rounded-2xl">
        <div>
          <h3 className="text-xl font-semibold text-white">Gestão de Usuários</h3>
          <p className="mt-1 text-sm text-slate-400">
            Gerencie operadores e permissões de <span className="text-blue-400">{company?.name}</span>.
          </p>
        </div>
        <button 
          onClick={() => fetchUsers(1)}
          className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          title="Recarregar"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm focus:border-blue-500/50 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="bg-slate-950 border border-white/10 rounded-xl text-sm px-4 py-2.5 outline-none focus:border-blue-500/50 transition-all"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">Todos os papéis</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Gestor</option>
          <option value="AGENT">Agente</option>
          <option value="VIEWER">Visualizador</option>
        </select>

        <select 
          className="bg-slate-950 border border-white/10 rounded-xl text-sm px-4 py-2.5 outline-none focus:border-blue-500/50 transition-all"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="suspended">Suspenso</option>
        </select>

        <div className="flex items-center justify-end px-2">
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">
            {users.length} encontrados
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/2">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Usuário</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Papel</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Acesso</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8">
                      <div className="h-4 bg-white/5 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <FiUser size={32} className="opacity-20" />
                      <p>Nenhum usuário encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-white/2 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 overflow-hidden">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold">{u.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getRoleBadge(u.role)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(u.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300 flex items-center gap-1.5">
                        <FiClock size={12} className="text-slate-500" />
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR') : 'Nunca logou'}
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-tighter italic">
                        {u.login_count} logins totais
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 outline-none">
                      <select 
                        className="bg-slate-950 border border-white/10 rounded-xl text-[10px] px-2 py-1 outline-none focus:border-blue-500/50"
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                      >
                        <option value="AGENT">AGENTE</option>
                        <option value="MANAGER">GESTOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      
                      <button 
                        onClick={() => handleUpdateStatus(u.id, u.status === 'suspended' ? 'active' : 'suspended')}
                        className={`p-2 rounded-xl transition-all ${u.status === 'suspended' ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-amber-400 hover:bg-amber-400/10'}`}
                        title={u.status === 'suspended' ? 'Ativar' : 'Suspender'}
                      >
                        {u.status === 'suspended' ? <FiCheckCircle /> : <FiXCircle />}
                      </button>

                      <button 
                        onClick={() => handleRemoveUser(u.id)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                        title="Remover da Empresa"
                      >
                        <FiUserMinus />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/1">
            <span className="text-xs text-slate-500">Página {pagination.page} de {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button 
                disabled={pagination.page === 1}
                onClick={() => fetchUsers(pagination.page - 1)}
                className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                Anterior
              </button>
              <button 
                disabled={pagination.page === pagination.totalPages}
                onClick={() => fetchUsers(pagination.page + 1)}
                className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

