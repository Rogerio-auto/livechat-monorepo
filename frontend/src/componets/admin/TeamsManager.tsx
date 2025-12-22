import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Users as UsersIcon,
  Clock,
  UserPlus,
  UserMinus,
  Calendar,
  Shield,
  Crown,
  User,
  MessageSquare,
} from "lucide-react";
import { API, fetchJson } from "../../utils/api";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

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

const Field = ({ label, children, description }: { label: string; children: React.ReactNode; description?: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="md:col-span-1">
      <label className="block text-sm font-semibold text-gray-900 dark:text-white">
        {label}
      </label>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="md:col-span-2">
      {children}
    </div>
  </div>
);

export function TeamsManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

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
      const memberIds = members.map((m: TeamMember) => m.user.id);
      setAvailableUsers(users.filter((u: User) => !memberIds.includes(u.id)));
    } catch (err) {
      console.error("Error loading members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

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

      if (selectedTeamId) await openMembersModal(selectedTeamId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await fetchJson(
        `${API}/api/teams/${selectedTeamId}/members/${memberId}`,
        {
          method: "DELETE",
        }
      );

      if (selectedTeamId) await openMembersModal(selectedTeamId);
    } catch (err: any) {
      alert(err.message);
    }
  };

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lista de Times
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {teams.length} times configurados
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => openModal()}
          disabled={departments.length === 0}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          Novo Time
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0" size={20} />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Aviso se não há departamentos */}
      {departments.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-amber-600 dark:text-amber-400" size={20} />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Crie pelo menos um departamento antes de criar times.
          </p>
        </div>
      )}

      {/* Lista de Times */}
      {teams.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 dark:border-gray-800 rounded-2xl">
          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <UsersIcon size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Nenhum time</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
            Crie times para organizar seus agentes e definir escalas de atendimento.
          </p>
          {departments.length > 0 && (
            <Button variant="primary" onClick={() => openModal()}>
              Criar primeiro time
            </Button>
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
                className="group rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:border-blue-500/50 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {team.name}
                      </h3>
                      {team.department && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                          style={{
                            backgroundColor: `${team.department.color}10`,
                            color: team.department.color,
                            borderColor: `${team.department.color}30`
                          }}
                        >
                          {team.department.name}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          team.is_active
                            ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                            : "bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800"
                        }`}
                      >
                        {team.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    {team.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        {team.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openModal(team)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(team.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Deletar"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-gray-50 dark:border-gray-900">
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <UsersIcon size={16} className="text-gray-400" />
                      <span className="font-medium">{membersCount} membros</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <MessageSquare size={16} className="text-gray-400" />
                      <span className="font-medium">{chatsCount} chats ativos</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Shield size={16} className="text-gray-400" />
                      <span className="font-medium">Máx: {team.max_concurrent_chats}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openMembersModal(team.id)}
                      className="bg-blue-50/50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      <UsersIcon size={16} className="mr-2" />
                      Membros
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openScheduleModal(team.id)}
                      className="bg-purple-50/50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/10 dark:text-purple-400 dark:hover:bg-purple-900/20"
                    >
                      <Clock size={16} className="mr-2" />
                      Horários
                    </Button>
                  </div>
                </div>

                {deleteConfirm === team.id && (
                  <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-3">
                      Excluir este time? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDelete(team.id)}
                      >
                        Confirmar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 bg-white dark:bg-gray-800"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criar/Editar Time */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Editar Time" : "Novo Time"}
        size="lg"
      >
        <div className="space-y-0">
          <Field 
            label="Nome do Time" 
            description="Como a equipe será identificada internamente."
          >
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Time Alpha, Squad de Vendas..."
            />
          </Field>

          <Field 
            label="Descrição" 
            description="Breve resumo do propósito deste time."
          >
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </Field>

          <Field 
            label="Departamento" 
            description="Vincule este time a um departamento organizacional."
          >
            <select
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full rounded-lg px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="">Sem departamento</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </Field>

          <Field 
            label="Capacidade e Prioridade" 
            description="Defina os limites de atendimento e ordem de distribuição."
          >
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Máx. Chats Simultâneos"
                type="number"
                min="1"
                max="100"
                value={formData.max_concurrent_chats}
                onChange={(e) =>
                  setFormData({ ...formData, max_concurrent_chats: parseInt(e.target.value) || 1 })
                }
              />
              <Input
                label="Prioridade (0-100)"
                type="number"
                min="0"
                max="100"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
              />
            </div>
          </Field>

          <Field 
            label="Configurações de Fluxo" 
            description="Controle o comportamento de atribuição do time."
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-800"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                  Time Ativo
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto_assign"
                  checked={formData.auto_assign}
                  onChange={(e) => setFormData({ ...formData, auto_assign: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-800"
                />
                <label htmlFor="auto_assign" className="text-sm text-gray-700 dark:text-gray-300">
                  Atribuição automática de chats
                </label>
              </div>
            </div>
          </Field>

          <div className="flex justify-end gap-3 pt-8">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!formData.name.trim()}
            >
              {editingId ? "Salvar Alterações" : "Criar Time"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Membros */}
      <Modal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        title="Gerenciar Membros"
        size="lg"
      >
        <div className="space-y-8">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Membros Atuais ({teamMembers.length})
            </h4>
            {loadingMembers ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-sm text-gray-500">
                Nenhum membro vinculado a este time.
              </div>
            ) : (
              <div className="space-y-2">
                {teamMembers.map((member) => {
                  const RoleIcon = ROLE_ICONS[member.role as keyof typeof ROLE_ICONS];
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shadow-sm">
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {member.user.name}
                            </span>
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 text-[10px] font-bold uppercase rounded-full border border-blue-100 dark:border-blue-800">
                              <RoleIcon size={10} />
                              {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS]}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {member.user.email}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <UserMinus size={16} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {availableUsers.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                Adicionar Membro
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-800 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500 font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddMember(user.id)}
                      className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <UserPlus size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="primary" onClick={() => setShowMembersModal(false)}>
              Concluído
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Horários */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Horários de Atendimento"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-6">
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              Os horários definem quando o time está disponível para receber novos chats automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day, index) => {
              const schedule = teamSchedules.find((s) => s.day_of_week === index);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-800 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-gray-400" />
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-24">{day}</span>
                  </div>
                  {schedule ? (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                        <Clock size={14} />
                        {schedule.start_time} - {schedule.end_time}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          schedule.is_active
                            ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                            : "bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800"
                        }`}
                      >
                        {schedule.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-gray-400 italic">Não configurado</span>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-end pt-6">
            <Button variant="primary" onClick={() => setShowScheduleModal(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
