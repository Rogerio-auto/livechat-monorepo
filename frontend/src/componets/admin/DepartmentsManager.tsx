import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  AlertCircle,
  Building2,
  Users,
  MessageSquare,
} from "lucide-react";
import { API, fetchJson } from "../../utils/api";

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

  // Carregar departamentos
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

  // Abrir modal para criar/editar
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

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  // Salvar departamento
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

  // Deletar departamento
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Departamentos
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Organize seus times e agentes em departamentos customizáveis
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Novo Departamento
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Lista de Departamentos */}
      {departments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Nenhum departamento criado ainda
          </p>
          <button
            onClick={() => openModal()}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Criar primeiro departamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const membersCount = dept.members?.[0]?.count || 0;
            const chatsCount = dept.active_chats?.[0]?.count || 0;

            return (
              <div
                key={dept.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                      style={{
                        backgroundColor: `${dept.color}20`,
                        color: dept.color,
                      }}
                    >
                      {ICON_OPTIONS.find((i) => i.value === dept.icon)?.icon || "🏢"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {dept.name}
                      </h3>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          dept.is_active
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {dept.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(dept)}
                      className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(dept.id)}
                      className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                      title="Deletar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Descrição */}
                {dept.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {dept.description}
                  </p>
                )}

                {/* Estatísticas */}
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Users size={16} />
                    <span>{membersCount} membros</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <MessageSquare size={16} />
                    <span>{chatsCount} chats</span>
                  </div>
                </div>

                {/* Confirmação de Delete */}
                {deleteConfirm === dept.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      Tem certeza que deseja deletar este departamento?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(dept.id)}
                        className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
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

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingId ? "Editar Departamento" : "Novo Departamento"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Departamento *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Vendas, Suporte, Financeiro..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  placeholder="Descreva as responsabilidades deste departamento..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Cor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cor do Departamento
                </label>
                <div className="flex gap-3 flex-wrap">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        formData.color === color
                          ? "border-gray-900 dark:border-white scale-110"
                          : "border-gray-200 dark:border-gray-600 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-600 cursor-pointer"
                    title="Escolher cor personalizada"
                  />
                </div>
              </div>

              {/* Ícone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ícone
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ICON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData({ ...formData, icon: option.value })}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        formData.icon === option.value
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500"
                      }`}
                    >
                      <div className="text-2xl mb-1">{option.icon}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Departamento ativo
                </label>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={20} />
                {editingId ? "Salvar Alterações" : "Criar Departamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
