// frontend/src/components/tools/ToolsAdminPanel.tsx
// Admin panel para gerenciar o catálogo global de ferramentas

import React, { useState, useEffect } from "react";
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiCopy, 
  FiBox, FiCpu, FiGlobe, FiCode, FiActivity,
  FiCheckCircle, FiAlertCircle, FiX, FiSave
} from "react-icons/fi";
import { api } from "@/lib/api";
import { showToast } from "../../hooks/useToast";

interface Tool {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string;
  handler_type: string;
  handler_config: any;
  schema: any;
  is_active: boolean;
  url?: string;
  method?: string;
  company_id?: string | null;
  created_at?: string;
}

export function ToolsAdminPanel() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Tool>>({});
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTools();
  }, []);

  async function loadTools() {
    setLoading(true);
    try {
      const response = await api.get("/api/tools");
      setTools(response.data || []);
    } catch (err: any) {
      showToast("Erro ao carregar ferramentas", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(tool: Partial<Tool>) {
    try {
      if (tool.id) {
        await api.put(`/api/tools/${tool.id}`, tool);
        showToast("Ferramenta atualizada!", "success");
      } else {
        const { id, company_id, created_at, ...createData } = tool as any;
        await api.post("/api/tools", createData);
        showToast("Ferramenta criada!", "success");
      }
      setEditingTool(null);
      setIsCreating(false);
      loadTools();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Erro ao salvar ferramenta", "error");
    }
  }

  async function handleDelete(toolId: string) {
    if (!confirm("Tem certeza que deseja deletar esta ferramenta?")) return;
    try {
      await api.delete(`/api/tools/${toolId}`);
      showToast("Ferramenta deletada!", "success");
      loadTools();
    } catch (err: any) {
      showToast("Erro ao deletar ferramenta", "error");
    }
  }

  async function handleDuplicate(tool: Tool) {
    if (!confirm(`Duplicar ferramenta "${tool.name}"?`)) return;
    try {
      const response = await api.post(`/api/tools/${tool.id}/duplicate`, { 
        name: `${tool.name} (cópia)` 
      });
      showToast(`Ferramenta duplicada: ${response.data.name}`, "success");
      loadTools();
    } catch (err: any) {
      showToast("Erro ao duplicar ferramenta", "error");
    }
  }

  async function handleToggleActive(tool: Tool) {
    try {
      await api.put(`/api/tools/${tool.id}`, { is_active: !tool.is_active });
      showToast(tool.is_active ? "Ferramenta desativada" : "Ferramenta ativada", "info");
      loadTools();
    } catch (err: any) {
      showToast("Erro ao alterar status", "error");
    }
  }

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.key.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase())
  );

  const globalTools = filteredTools.filter((t) => !t.company_id);
  const companyTools = filteredTools.filter((t) => t.company_id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Catálogo de Ferramentas</h1>
          <p className="text-slate-400">Gerencie as capacidades que os agentes podem executar.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
        >
          <FiPlus /> Nova Ferramenta
        </button>
      </div>

      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, chave ou categoria..."
            className="w-full bg-slate-950 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Carregando ferramentas...</div>
      ) : (
        <div className="space-y-8">
          {/* Ferramentas Globais */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FiGlobe className="text-indigo-400" /> Ferramentas do Sistema
              <span className="text-xs font-normal text-slate-500 ml-2">Disponíveis para todas as empresas</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {globalTools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isReadOnly={false}
                  onToggleActive={handleToggleActive}
                  onDuplicate={handleDuplicate}
                  onEdit={() => setEditingTool(tool)}
                  onDelete={() => handleDelete(tool.id)}
                />
              ))}
            </div>
          </section>

          {/* Ferramentas Customizadas */}
          {companyTools.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FiCode className="text-emerald-400" /> Ferramentas Customizadas
                <span className="text-xs font-normal text-slate-500 ml-2">Criadas por empresas específicas</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {companyTools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onEdit={() => setEditingTool(tool)}
                    onDelete={() => handleDelete(tool.id)}
                    onToggleActive={handleToggleActive}
                    onDuplicate={handleDuplicate}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal de Edição/Criação */}
      {(editingTool || isCreating) && (
        <ToolEditorModal
          tool={editingTool || undefined}
          onSave={handleSave}
          onClose={() => {
            setEditingTool(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}

function ToolCard({
  tool,
  isReadOnly = false,
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate,
}: {
  tool: Tool;
  isReadOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleActive?: (tool: Tool) => void;
  onDuplicate?: (tool: Tool) => void;
}) {
  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-xl p-5 hover:border-white/20 transition group flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white truncate">{tool.name}</h3>
            {!tool.is_active && (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded border border-rose-400/20">
                <FiAlertCircle /> Inativa
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-mono mb-2 truncate">{tool.key}</div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={onEdit}
            className="p-1.5 text-indigo-400 hover:bg-indigo-400/10 rounded transition"
            title="Editar"
          >
            <FiEdit2 size={16} />
          </button>
          <button
            onClick={() => onDuplicate?.(tool)}
            className="p-1.5 text-amber-400 hover:bg-amber-400/10 rounded transition"
            title="Duplicar"
          >
            <FiCopy size={16} />
          </button>
          <button
            onClick={() => onToggleActive?.(tool)}
            className={`p-1.5 ${tool.is_active ? 'text-slate-400 hover:bg-slate-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'} rounded transition`}
            title={tool.is_active ? "Desativar" : "Ativar"}
          >
            <FiActivity size={16} />
          </button>
          {!isReadOnly && (
            <button
              onClick={onDelete}
              className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded transition"
              title="Excluir"
            >
              <FiTrash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-400 line-clamp-2 mb-4 h-10">
        {tool.description || "Sem descrição."}
      </p>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getHandlerTypeStyles(tool.handler_type)}`}>
          {tool.handler_type}
        </span>
        {tool.category && (
          <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase font-medium">
            {tool.category}
          </span>
        )}
      </div>
    </div>
  );
}

function getHandlerTypeStyles(type: string) {
  switch (type) {
    case "INTERNAL_DB": return "bg-indigo-400/10 text-indigo-400 border-indigo-400/20";
    case "HTTP": return "bg-emerald-400/10 text-emerald-400 border-emerald-400/20";
    case "WORKFLOW": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
    case "SOCKET": return "bg-amber-400/10 text-amber-400 border-amber-400/20";
    default: return "bg-slate-400/10 text-slate-400 border-slate-400/20";
  }
}

function ToolEditorModal({
  tool,
  onSave,
  onClose,
}: {
  tool?: Tool;
  onSave: (tool: Partial<Tool>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Partial<Tool>>({});
  const [activeTab, setActiveTab] = useState<'basic' | 'config' | 'schema'>('basic');

  useEffect(() => {
    if (tool) {
      setFormData({
        ...tool,
        key: tool.company_id ? tool.key : `${tool.key}_custom_${Date.now()}`,
        name: tool.company_id ? tool.name : `${tool.name} (Customizado)`,
      });
    } else {
      setFormData({
        key: "",
        name: "",
        category: "CUSTOM",
        description: "",
        handler_type: "INTERNAL_DB",
        method: "GET",
        schema: {
          type: "object",
          properties: {},
          required: [],
        },
        is_active: true,
      });
    }
  }, [tool]);

  const [schemaJson, setSchemaJson] = useState("");
  const [configJson, setConfigJson] = useState("");

  useEffect(() => {
    if (formData.schema) setSchemaJson(JSON.stringify(formData.schema, null, 2));
    if (formData.handler_config) setConfigJson(JSON.stringify(formData.handler_config, null, 2));
  }, [formData.id]); // Only update when the tool changes

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const schema = JSON.parse(schemaJson);
      const handler_config = configJson ? JSON.parse(configJson) : {};
      onSave({ ...formData, schema, handler_config });
    } catch (err) {
      alert("JSON inválido em Schema ou Config");
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-950 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-white">
              {tool?.id ? "Editar Ferramenta" : "Nova Ferramenta"}
            </h2>
            <p className="text-sm text-slate-400">Configure as definições e comportamento da ferramenta</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition">
            <FiX size={24} />
          </button>
        </div>

        <div className="flex border-b border-white/10 bg-white/5">
          {(['basic', 'config', 'schema'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab === 'basic' ? 'Básico' : tab === 'config' ? 'Configuração' : 'Schema JSON'}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'basic' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Nome da Ferramenta</label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 transition"
                    placeholder="Ex: Consultar Saldo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Chave Única (slug)</label>
                  <input
                    type="text"
                    value={formData.key || ""}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 transition font-mono"
                    placeholder="ex: get_balance"
                    required
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Categoria</label>
                  <input
                    type="text"
                    value={formData.category || ""}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 transition"
                    placeholder="Ex: Financeiro"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Tipo de Handler</label>
                  <select
                    value={formData.handler_type}
                    onChange={(e) => setFormData({ ...formData, handler_type: e.target.value as any })}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 transition"
                  >
                    <option value="INTERNAL_DB">Database Local (JS)</option>
                    <option value="HTTP">Webhook HTTP (External)</option>
                    <option value="WORKFLOW">Workflow N8N/Make</option>
                    <option value="SOCKET">Socket em Tempo Real</option>
                  </select>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Descrição (Para o Agent)</label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 transition h-24 resize-none"
                  placeholder="Explique ao agente quando e como usar esta ferramenta..."
                />
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Endpoint / URL</label>
                  <input
                    type="text"
                    value={formData.url || ""}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 transition font-mono"
                    placeholder="https://sua-api.com/v1/user"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Método</label>
                  <select
                    value={formData.method || 'GET'}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 transition"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Configuração Adicional (JSON)</label>
                <textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 transition h-[300px] font-mono text-sm"
                  placeholder='{"headers": {"Authorization": "Bearer ..."}}'
                />
              </div>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estrutura de Parâmetros (JSON Schema)</label>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 uppercase font-bold">
                  Padrão OpenAPI/Functions
                </span>
              </div>
              <textarea
                value={schemaJson}
                onChange={(e) => setSchemaJson(e.target.value)}
                className="flex-1 w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition font-mono text-xs h-[400px]"
              />
            </div>
          )}
        </form>

        <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <FiSave size={18} />
            {tool?.id ? 'Salvar Alterações' : 'Criar Ferramenta'}
          </button>
        </div>
      </div>
    </div>
  );
}
