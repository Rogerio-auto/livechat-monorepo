import { useState, useEffect, useCallback } from "react";
import { 
  Book, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Tag, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  CheckCircle,
  AlertCircle,
  Filter,
  X
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";

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

export function KnowledgeBasePanel() {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header com estatísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Total</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
              <Book size={14} className="text-blue-500" />
            </div>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Ativos</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.active}</span>
              <CheckCircle size={14} className="text-green-500" />
            </div>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Consultas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total_usage}</span>
              <TrendingUp size={14} className="text-purple-500" />
            </div>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Taxa Útil</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{(stats.avg_helpful_rate * 100).toFixed(0)}%</span>
              <CheckCircle size={14} className="text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros e ações */}
      <div className="pb-8 border-b border-gray-100 dark:border-gray-800 mb-8">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Buscar por título, conteúdo ou tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
              />
            </div>
            
            <div className="flex gap-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
              >
                <option value="">Todas categorias</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          
          <Button variant="primary" onClick={handleCreate} className="flex items-center gap-2 shrink-0 px-6 py-2.5">
            <Plus size={18} />
            Novo Item
          </Button>
        </div>
      </div>

      {/* Lista de Itens */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0" size={20} />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-0">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Book size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Nenhum item encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-sm">
              Adicione informações à base de conhecimento para treinar seus agentes.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="group py-8 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-all"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.status === "ACTIVE" 
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : item.status === "DRAFT"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                        : "bg-gray-50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400"
                    }`}>
                      {item.status}
                    </span>
                    {!item.visible_to_agents && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <EyeOff size={10} />
                        Privado
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                    {item.content}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    {item.category && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg uppercase tracking-wider">
                        <Tag size={12} />
                        {item.category}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        {item.usage_count} usos
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                      <span className="flex items-center gap-1">
                        <CheckCircle size={12} />
                        {((item.helpful_count / (item.usage_count || 1)) * 100).toFixed(0)}% útil
                      </span>
                    </div>
                    
                    <div className="flex gap-1.5">
                      {item.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-800 uppercase tracking-tighter">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600">
                    <Edit2 size={16} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(item.id)}
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criar/Editar */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "Editar Item" : "Novo Item de Conhecimento"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-0">
          <Field 
            label="Título" 
            description="Como este item será identificado na busca."
          >
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Como configurar o Wi-Fi"
              required
            />
          </Field>

          <Field 
            label="Conteúdo" 
            description="A informação detalhada que o agente usará."
          >
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              placeholder="Descreva a informação aqui..."
              required
            />
          </Field>

          <Field 
            label="Classificação" 
            description="Organize por categoria e tags para facilitar a busca."
          >
            <div className="space-y-4">
              <Input
                label="Categoria"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Suporte Técnico, Financeiro..."
                list="categories-list"
              />
              <datalist id="categories-list">
                {categories.map(cat => <option key={cat} value={cat} />)}
              </datalist>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-medium rounded-lg border border-blue-100 dark:border-blue-800">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  placeholder="Pressione Enter para adicionar tags"
                  onKeyDown={handleTagInput}
                />
              </div>
            </div>
          </Field>

          <Field 
            label="Configurações" 
            description="Controle a visibilidade e o status do item."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-lg px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="DRAFT">Rascunho</option>
                    <option value="ARCHIVED">Arquivado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Prioridade</label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="visible_to_agents"
                  checked={formData.visible_to_agents}
                  onChange={(e) => setFormData({ ...formData, visible_to_agents: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-800"
                />
                <label htmlFor="visible_to_agents" className="text-sm text-gray-700 dark:text-gray-300">
                  Visível para agentes de IA
                </label>
              </div>
            </div>
          </Field>

          <div className="flex justify-end gap-3 pt-8">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingItem ? "Salvar Alterações" : "Criar Item"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

