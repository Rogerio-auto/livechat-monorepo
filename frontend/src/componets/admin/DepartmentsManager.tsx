import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Building2,
  Users,
  MessageSquare,
} from "lucide-react";
import { API, fetchJson } from "../../utils/api";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

interface Department {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  is_active: boolean;
  created_at: string;
  members?: { count: number }[];
  active_chats?: { count: number }[];
}

interface DepartmentFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
}

const ICON_OPTIONS = [
  { value: "building-2", label: "Prédio", icon: "🏢" },
  { value: "headphones", label: "Suporte", icon: "🎧" },
  { value: "shopping-cart", label: "Vendas", icon: "🛒" },
  { value: "dollar-sign", label: "Financeiro", icon: "💰" },
  { value: "users", label: "RH", icon: "👥" },
  { value: "settings", label: "TI", icon: "⚙️" },
  { value: "package", label: "Logística", icon: "📦" },
  { value: "phone", label: "Telefonia", icon: "📞" },
];

const COLOR_PRESETS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
];

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

export function DepartmentsManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState<DepartmentFormData>({
    name: "",
    description: "",
    color: COLOR_PRESETS[0],
    icon: ICON_OPTIONS[0].value,
    is_active: true,
  });

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await fetchJson<Department[]>(`${API}/api/departments`);
      setDepartments(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const openModal = (department?: Department) => {
    if (department) {
      setEditingId(department.id);
      setFormData({
        name: department.name,
        description: department.description || "",
        color: department.color,
        icon: department.icon || ICON_OPTIONS[0].value,
        is_active: department.is_active,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        description: "",
        color: COLOR_PRESETS[0],
        icon: ICON_OPTIONS[0].value,
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    try {
      const url = editingId
        ? `${API}/api/departments/${editingId}`
        : `${API}/api/departments`;

      await fetchJson(url, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(formData),
      });

      await loadDepartments();
      closeModal();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetchJson(`${API}/api/departments/${id}`, {
        method: "DELETE",
      });

      await loadDepartments();
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err.message);
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
            Lista de Departamentos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {departments.length} departamentos configurados
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => openModal()}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          Novo Departamento
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0" size={20} />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Lista de Departamentos */}
      {departments.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 dark:border-gray-800 rounded-2xl">
          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Nenhum departamento</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
            Comece criando um departamento para organizar seus atendimentos.
          </p>
          <Button variant="primary" onClick={() => openModal()}>
            Criar primeiro departamento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {departments.map((dept) => {
            const membersCount = dept.members?.[0]?.count || 0;
            const chatsCount = dept.active_chats?.[0]?.count || 0;

            return (
              <div
                key={dept.id}
                className="group rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:border-blue-500/50 transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-sm"
                      style={{
                        backgroundColor: `${dept.color}15`,
                        color: dept.color,
                        border: `1px solid ${dept.color}30`
                      }}
                    >
                      {ICON_OPTIONS.find((i) => i.value === dept.icon)?.icon || "🏢"}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                        {dept.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`w-2 h-2 rounded-full ${dept.is_active ? 'bg-green-500' : 'bg-gray-400'}`}
                        />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {dept.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openModal(dept)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(dept.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Deletar"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {dept.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2 leading-relaxed">
                    {dept.description}
                  </p>
                )}

                <div className="flex items-center gap-6 pt-6 border-t border-gray-50 dark:border-gray-900">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Users size={16} className="text-gray-400" />
                    <span className="text-sm font-medium">{membersCount} membros</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <MessageSquare size={16} className="text-gray-400" />
                    <span className="text-sm font-medium">{chatsCount} chats</span>
                  </div>
                </div>

                {deleteConfirm === dept.id && (
                  <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-3">
                      Excluir este departamento? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDelete(dept.id)}
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

      {/* Modal de Criar/Editar */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? "Editar Departamento" : "Novo Departamento"}
        size="lg"
      >
        <div className="space-y-0">
          <Field 
            label="Nome do Departamento" 
            description="Como o departamento será exibido para os agentes e clientes."
          >
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Vendas, Suporte, Financeiro..."
            />
          </Field>

          <Field 
            label="Descrição" 
            description="Breve resumo das responsabilidades deste departamento."
          >
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva as responsabilidades..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </Field>

          <Field 
            label="Identidade Visual" 
            description="Escolha uma cor e ícone para facilitar a identificação."
          >
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Cor</p>
                <div className="flex gap-2.5 flex-wrap">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color
                          ? "border-gray-900 dark:border-white scale-110 shadow-md"
                          : "border-transparent hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="relative w-8 h-8 rounded-full border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Ícone</p>
                <div className="grid grid-cols-4 gap-2">
                  {ICON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData({ ...formData, icon: option.value })}
                      className={`p-3 rounded-xl border transition-all text-center ${
                        formData.icon === option.value
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm"
                          : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                      }`}
                    >
                      <div className="text-xl mb-1">{option.icon}</div>
                      <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Field>

          <Field 
            label="Status" 
            description="Departamentos inativos não podem receber novos atendimentos."
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-800"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                Departamento Ativo
              </label>
            </div>
          </Field>

          <div className="flex justify-end gap-3 pt-8">
            <Button variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!formData.name.trim()}
            >
              {editingId ? "Salvar Alterações" : "Criar Departamento"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
