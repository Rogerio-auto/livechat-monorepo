import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  AlertCircle,
  Users as UsersIcon,
  Clock,
  UserPlus,
  UserMinus,
  Calendar,
  Shield,
  Crown,
  User,
} from "lucide-react";
import { API, fetchJson } from "../../utils/api";

interface Team {
  id: string;
  name: string;
  description?: string;
  department_id?: string;
  is_active: boolean;
  auto_assign: boolean;
  max_concurrent_chats: number;
  priority: number;
  created_at: string;
  department?: {
    id: string;
    name: string;
    color: string;
  };
  members?: { count: number }[];
  active_chats?: { count: number }[];
}

interface Department {
  id: string;
  name: string;
  color: string;
}

interface TeamMember {
  id: string;
  role: string;
  joined_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface TeamFormData {
  name: string;
  description: string;
  department_id: string;
  is_active: boolean;
  auto_assign: boolean;
  max_concurrent_chats: number;
  priority: number;
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const ROLE_ICONS = {
  MEMBER: User,
  LEAD: Shield,
  MANAGER: Crown,
};

const ROLE_LABELS = {
  MEMBER: "Membro",
  LEAD: "Líder",
  MANAGER: "Gerente",
};

export function TeamsManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Modal de membros
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modal de horários
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [teamSchedules, setTeamSchedules] = useState<Schedule[]>([]);

  const [formData, setFormData] = useState<TeamFormData>({
    name: "",
    description: "",
    department_id: "",
    is_active: true,
    auto_assign: true,
    max_concurrent_chats: 10,
    priority: 0,
  });

  // Carregar times e departamentos
  const loadTeams = async () => {
    try {
      setLoading(true);
      const [teamsData, deptsData] = await Promise.all([
        fetchJson<Team[]>(`${API}/api/teams`),
        fetchJson<Department[]>(`${API}/api/departments`),
      ]);

      setTeams(teamsData);
      setDepartments(deptsData.filter((d: Department) => d));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  // Abrir modal para criar/editar
  const openModal = (team?: Team) => {
    if (team) {
      setEditingId(team.id);
      setFormData({
        name: team.name,
        description: team.description || "",
        department_id: team.department_id || "",
        is_active: team.is_active,
        auto_assign: team.auto_assign,
        max_concurrent_chats: team.max_concurrent_chats,
        priority: team.priority,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        description: "",
        department_id: departments[0]?.id || "",
        is_active: true,
        auto_assign: true,
        max_concurrent_chats: 10,
        priority: 0,
      });
    }
    setShowModal(true);
  };

  // Salvar time
  const handleSave = async () => {
    try {
      const url = editingId
        ? `${API}/api/teams/${editingId}`
        : `${API}/api/teams`;

      await fetchJson(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          department_id: formData.department_id || null,
        }),
      });

      await loadTeams();
      setShowModal(false);
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Deletar time
  const handleDelete = async (id: string) => {
    try {
      await fetchJson(`${API}/api/teams/${id}`, {
        method: "DELETE",
      });

      await loadTeams();
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Abrir modal de membros
  const openMembersModal = async (teamId: string) => {
    setSelectedTeamId(teamId);
    setShowMembersModal(true);
    setLoadingMembers(true);

    try {
      const [members, users] = await Promise.all([
        fetchJson<TeamMember[]>(`${API}/api/teams/${teamId}/members`),
        fetchJson<User[]>(`${API}/api/users`),
      ]);

      setTeamMembers(members);
      // Filtrar usuários que já são membros
      const memberIds = members.map((m: TeamMember) => m.user.id);
      setAvailableUsers(users.filter((u: User) => !memberIds.includes(u.id)));
    } catch (err) {
      console.error("Error loading members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Adicionar membro
  const handleAddMember = async (userId: string, role: string = "MEMBER") => {
    try {
      await fetchJson(
        `${API}/api/teams/${selectedTeamId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userId, role }),
        }
      );

      // Recarregar membros
      if (selectedTeamId) await openMembersModal(selectedTeamId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Remover membro
  const handleRemoveMember = async (memberId: string) => {
    try {
      await fetchJson(
        `${API}/api/teams/${selectedTeamId}/members/${memberId}`,
        {
          method: "DELETE",
        }
      );

      // Recarregar membros
      if (selectedTeamId) await openMembersModal(selectedTeamId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Abrir modal de horários
  const openScheduleModal = async (teamId: string) => {
    setSelectedTeamId(teamId);
    setShowScheduleModal(true);

    try {
      const schedules = await fetchJson<Schedule[]>(`${API}/api/teams/${teamId}/schedules`);
      setTeamSchedules(schedules);
    } catch (err) {
      console.error("Error loading schedules:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Times</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie equipes, membros e horários de atendimento
          </p>
        </div>
        <button
          onClick={() => openModal()}
          disabled={departments.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={20} />
          Novo Time
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Aviso se não há departamentos */}
      {departments.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            Crie pelo menos um departamento antes de criar times.
          </p>
        </div>
      )}

      {/* Lista de Times */}
      {teams.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <UsersIcon size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Nenhum time criado ainda</p>
          {departments.length > 0 && (
            <button
              onClick={() => openModal()}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Criar primeiro time
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const membersCount = team.members?.[0]?.count || 0;
            const chatsCount = team.active_chats?.[0]?.count || 0;

            return (
              <div
                key={team.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {team.name}
                      </h3>
                      {team.department && (
                        <span
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${team.department.color}20`,
                            color: team.department.color,
                          }}
                        >
                          {team.department.name}
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          team.is_active
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {team.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    {team.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {team.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(team)}
                      className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(team.id)}
                      className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      title="Deletar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Stats e Ações */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                    <span>👥 {membersCount} membros</span>
                    <span>💬 {chatsCount} chats ativos</span>
                    <span>⚡ Máx: {team.max_concurrent_chats} chats</span>
                    <span>🎯 Prioridade: {team.priority}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openMembersModal(team.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    >
                      <UsersIcon size={16} />
                      Membros
                    </button>
                    <button
                      onClick={() => openScheduleModal(team.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40"
                    >
                      <Clock size={16} />
                      Horários
                    </button>
                  </div>
                </div>

                {/* Confirmação de Delete */}
                {deleteConfirm === team.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      Tem certeza que deseja deletar este time?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(team.id)}
                        className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criar/Editar Time */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingId ? "Editar Time" : "Novo Time"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Time *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Time Alpha, Squad de Vendas..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Departamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Departamento
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Sem departamento</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Configurações */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Máx. Chats Simultâneos
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.max_concurrent_chats}
                    onChange={(e) =>
                      setFormData({ ...formData, max_concurrent_chats: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prioridade (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Time ativo</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.auto_assign}
                    onChange={(e) => setFormData({ ...formData, auto_assign: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Atribuição automática de chats
                  </span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={20} />
                {editingId ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Membros */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Gerenciar Membros
              </h3>
              <button onClick={() => setShowMembersModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Membros Atuais */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Membros Atuais ({teamMembers.length})
                </h4>
                {loadingMembers ? (
                  <div className="text-center py-4">Carregando...</div>
                ) : teamMembers.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum membro ainda</p>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map((member) => {
                      const RoleIcon = ROLE_ICONS[member.role as keyof typeof ROLE_ICONS];
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {member.user.avatar ? (
                              <img
                                src={member.user.avatar}
                                alt={member.user.name}
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                                {member.user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {member.user.name}
                                </span>
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded">
                                  <RoleIcon size={12} />
                                  {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS]}
                                </span>
                              </div>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {member.user.email}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Remover"
                          >
                            <UserMinus size={18} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Adicionar Membro */}
              {availableUsers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Adicionar Membro
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center text-white font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddMember(user.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          <UserPlus size={16} />
                          Adicionar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Horários */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Horários de Atendimento
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day, index) => {
                  const schedule = teamSchedules.find((s) => s.day_of_week === index);
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar size={20} className="text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white w-24">{day}</span>
                      </div>
                      {schedule ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {schedule.start_time} - {schedule.end_time}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              schedule.is_active
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {schedule.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Não configurado</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                💡 Use a API para configurar horários: POST /api/teams/:id/schedules
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
