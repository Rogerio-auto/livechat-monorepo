import { useState, useEffect, useCallback } from "react";
import { FiBook, FiPlus, FiEdit2, FiTrash2, FiSearch, FiTag, FiEye, FiEyeOff, FiTrendingUp, FiCheckCircle } from "react-icons/fi";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

type KnowledgeBaseItem = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  priority: number;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  visible_to_agents: boolean;
  usage_count: number;
  helpful_count: number;
  unhelpful_count: number;
  created_at: string;
  updated_at: string | null;
};

type KnowledgeBaseStats = {
  total: number;
  active: number;
  draft: number;
  archived: number;
  total_usage: number;
  avg_helpful_rate: number;
};

export function KnowledgeBasePanel() {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "",
    tags: [] as string[],
    priority: 0,
    status: "ACTIVE" as "ACTIVE" | "DRAFT" | "ARCHIVED",
    visible_to_agents: true,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (filterCategory) params.append("category", filterCategory);
      if (filterStatus) params.append("status", filterStatus);
      
      const response = await fetch(`${API}/api/knowledge-base?${params}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Erro ao carregar knowledge base");
      
      const data = await response.json();
      setItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterCategory, filterStatus]);

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API}/api/knowledge-base/categories`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API}/api/knowledge-base/stats`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    }
  };

  useEffect(() => {
    loadData();
    loadCategories();
    loadStats();
  }, [loadData]);

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      content: "",
      category: "",
      tags: [],
      priority: 0,
      status: "ACTIVE",
      visible_to_agents: true,
    });
    setShowModal(true);
  };

  const handleEdit = (item: KnowledgeBaseItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      content: item.content,
      category: item.category || "",
      tags: item.tags || [],
      priority: item.priority,
      status: item.status,
      visible_to_agents: item.visible_to_agents,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        category: formData.category || null,
      };
      
      const url = editingItem
        ? `${API}/api/knowledge-base/${editingItem.id}`
        : `${API}/api/knowledge-base`;
      
      const response = await fetch(url, {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao salvar");
      }
      
      setShowModal(false);
      loadData();
      loadCategories();
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este item?")) return;
    
    try {
      const response = await fetch(`${API}/api/knowledge-base/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Erro ao deletar");
      
      loadData();
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.currentTarget;
      const tag = input.value.trim();
      if (tag && !formData.tags.includes(tag)) {
        setFormData({ ...formData, tags: [...formData.tags, tag] });
        input.value = "";
      }
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FiBook className="text-3xl opacity-50" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Ativos</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
              <FiCheckCircle className="text-3xl opacity-50" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Consultas</p>
                <p className="text-2xl font-bold">{stats.total_usage}</p>
              </div>
              <FiTrendingUp className="text-3xl opacity-50" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Taxa Útil</p>
                <p className="text-2xl font-bold">{(stats.avg_helpful_rate * 100).toFixed(0)}%</p>
              </div>
              <FiCheckCircle className="text-3xl opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros e ações */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-col md:flex-row gap-3 flex-1 w-full">
            {/* Busca */}
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por título, conteúdo ou tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Filtro Categoria */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            {/* Filtro Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos status</option>
              <option value="ACTIVE">Ativo</option>
              <option value="DRAFT">Rascunho</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
          </div>
          
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors whitespace-nowrap"
          >
            <FiPlus /> Novo FAQ
          </button>
        </div>
      </div>

      {/* Lista de itens */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {items.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700">
            <FiBook className="mx-auto text-6xl text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Nenhum FAQ encontrado. Comece criando o primeiro!
            </p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              <FiPlus /> Criar primeiro FAQ
            </button>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {item.title}
                    </h3>
                    {!item.visible_to_agents && (
                      <FiEyeOff className="text-gray-400" title="Não visível para IA" />
                    )}
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                    {item.content}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {item.category && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium">
                        {item.category}
                      </span>
                    )}
                    
                    {item.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs flex items-center gap-1"
                      >
                        <FiTag className="text-xs" /> {tag}
                      </span>
                    ))}
                    
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        item.status === "ACTIVE"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : item.status === "DRAFT"
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {item.status === "ACTIVE" ? "Ativo" : item.status === "DRAFT" ? "Rascunho" : "Arquivado"}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>Prioridade: {item.priority}</span>
                    <span>Consultas: {item.usage_count}</span>
                    <span>Útil: {item.helpful_count} / Não útil: {item.unhelpful_count}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Deletar"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de criar/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {editingItem ? "Editar FAQ" : "Novo FAQ"}
                </h2>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Título */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Título / Pergunta *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Como funciona o cancelamento?"
                  />
                </div>
                
                {/* Conteúdo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Resposta / Conteúdo *
                  </label>
                  <textarea
                    required
                    maxLength={5000}
                    rows={6}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite a resposta completa que a IA deve fornecer..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.content.length} / 5000 caracteres
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Categoria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Categoria
                    </label>
                    <input
                      type="text"
                      list="categories-list"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Vendas, Suporte, Produto"
                    />
                    <datalist id="categories-list">
                      {categories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                  </div>
                  
                  {/* Prioridade */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Prioridade (0-10)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags (pressione Enter para adicionar)
                  </label>
                  <input
                    type="text"
                    onKeyDown={handleTagInput}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite e pressione Enter"
                  />
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm flex items-center gap-2"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ACTIVE">Ativo</option>
                      <option value="DRAFT">Rascunho</option>
                      <option value="ARCHIVED">Arquivado</option>
                    </select>
                  </div>
                  
                  {/* Visível para IA */}
                  <div className="flex items-center gap-2 pt-7">
                    <input
                      type="checkbox"
                      id="visible-agents"
                      checked={formData.visible_to_agents}
                      onChange={(e) => setFormData({ ...formData, visible_to_agents: e.target.checked })}
                      className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="visible-agents" className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <FiEye /> Visível para agentes de IA
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                >
                  {editingItem ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
