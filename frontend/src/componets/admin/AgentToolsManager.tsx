import { useEffect, useState, useCallback } from "react";
import { FiCpu, FiTool, FiPlus, FiX, FiCheck, FiAlertCircle, FiTrash2, FiEdit2 } from "react-icons/fi";

type Agent = {
  id: string;
  name: string;
  status: string;
  description: string | null;
};

type Tool = {
  id: string;
  key: string;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
};

type AgentTool = {
  id: string;
  agent_id: string;
  tool_id: string;
  is_enabled: boolean;
  overrides: Record<string, any>;
  tool: Tool;
};

export function AgentToolsManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

  // Carregar agentes
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const res = await fetch(`${API}/api/agents`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar agentes");
      const data = await res.json();
      setAgents(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Carregar ferramentas do agente selecionado
  useEffect(() => {
    if (!selectedAgent) return;
    loadAgentTools(selectedAgent.id);
  }, [selectedAgent]);

  const loadAgentTools = async (agentId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/agents/${agentId}/tools`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar ferramentas");
      const data = await res.json();
      setAgentTools(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Carregar ferramentas disponíveis para adicionar
  const loadAvailableTools = async () => {
    try {
      const res = await fetch(`${API}/api/tools?active=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar ferramentas");
      const data = await res.json();
      
      // Filtrar apenas ferramentas que o agente ainda não tem
      const toolIds = new Set(agentTools.map(at => at.tool_id));
      const available = data.filter((t: Tool) => !toolIds.has(t.id));
      setAvailableTools(available);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Adicionar ferramenta ao agente
  const handleAddTool = async (toolId: string) => {
    if (!selectedAgent) return;
    
    try {
      setSaving(true);
      const res = await fetch(`${API}/api/agents/${selectedAgent.id}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tool_id: toolId, is_enabled: true }),
      });

      if (!res.ok) throw new Error("Erro ao adicionar ferramenta");
      
      await loadAgentTools(selectedAgent.id);
      setShowAddModal(false);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Remover ferramenta do agente
  const handleRemoveTool = async (toolId: string) => {
    if (!selectedAgent) return;
    
    if (!confirm("Tem certeza que deseja remover esta ferramenta?")) return;

    try {
      setSaving(true);
      const res = await fetch(`${API}/api/agents/${selectedAgent.id}/tools/${toolId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Erro ao remover ferramenta");
      
      await loadAgentTools(selectedAgent.id);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Toggle enable/disable ferramenta
  const handleToggleTool = async (toolId: string, currentEnabled: boolean) => {
    if (!selectedAgent) return;

    try {
      setSaving(true);
      const res = await fetch(`${API}/api/agents/${selectedAgent.id}/tools/${toolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_enabled: !currentEnabled }),
      });

      if (!res.ok) throw new Error("Erro ao atualizar ferramenta");
      
      await loadAgentTools(selectedAgent.id);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-primary)"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Erro global */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <FiAlertCircle className="text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <FiX />
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Lista de Agentes */}
        <div className="col-span-12 lg:col-span-4">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
            <div className="bg-(--color-primary) p-4">
              <h3 className="text-lg font-semibold text-(--color-on-primary) flex items-center gap-2">
                <FiCpu />
                Agentes
              </h3>
              <p className="text-sm text-(--color-on-primary) opacity-80 mt-1">Selecione um agente</p>
            </div>

            <div className="divide-y divide-(--color-border) max-h-[600px] overflow-y-auto">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full text-left p-4 transition-colors ${
                    selectedAgent?.id === agent.id
                      ? "bg-(--color-highlight) border-l-4 border-(--color-primary)"
                      : "hover:bg-(--color-surface-muted)"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-(--color-heading) truncate">
                        {agent.name}
                      </p>
                      {agent.description && (
                        <p className="text-xs text-(--color-text-muted) mt-1 line-clamp-2">
                          {agent.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full shrink-0 ${
                        agent.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : "bg-(--color-surface-muted) text-(--color-text-muted)"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ferramentas do Agente */}
        <div className="col-span-12 lg:col-span-8">
          {!selectedAgent ? (
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-12 text-center">
              <FiCpu className="text-(--color-text-muted) text-5xl mx-auto mb-4" />
              <p className="text-(--color-text-muted)">
                Selecione um agente para gerenciar suas ferramentas
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
              <div className="bg-(--color-primary) p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-(--color-on-primary) flex items-center gap-2">
                    <FiTool />
                    Ferramentas de {selectedAgent.name}
                  </h3>
                  <p className="text-sm text-(--color-on-primary) opacity-80 mt-1">
                    {agentTools.length} ferramenta(s) configurada(s)
                  </p>
                </div>
                <button
                  onClick={() => {
                    loadAvailableTools();
                    setShowAddModal(true);
                  }}
                  className="px-4 py-2 bg-(--color-surface) text-(--color-primary) rounded-lg hover:bg-(--color-surface-muted) transition-colors flex items-center gap-2 font-medium"
                >
                  <FiPlus />
                  Adicionar
                </button>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-primary) mx-auto"></div>
                  </div>
                ) : agentTools.length === 0 ? (
                  <div className="p-8 text-center">
                    <FiTool className="text-(--color-text-muted) text-4xl mx-auto mb-3" />
                    <p className="text-(--color-text-muted)">
                      Nenhuma ferramenta configurada
                    </p>
                    <button
                      onClick={() => {
                        loadAvailableTools();
                        setShowAddModal(true);
                      }}
                      className="mt-4 text-(--color-primary) hover:text-(--color-highlight) font-medium"
                    >
                      Adicionar primeira ferramenta
                    </button>
                  </div>
                ) : (
                  agentTools.map((at) => (
                    <div
                      key={at.id}
                      className="p-4 hover:bg-(--color-surface-muted) transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-(--color-heading)">
                              {at.tool.name}
                            </h4>
                            {at.tool.category && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-(--color-highlight) text-(--color-on-primary)">
                                {at.tool.category}
                              </span>
                            )}
                          </div>
                          {at.tool.description && (
                            <p className="text-sm text-(--color-text-muted) mt-1">
                              {at.tool.description}
                            </p>
                          )}
                          <p className="text-xs text-(--color-text-muted) mt-2">
                            Key: <code className="bg-(--color-surface-muted) px-1.5 py-0.5 rounded">{at.tool.key}</code>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Toggle Enable/Disable */}
                          <button
                            onClick={() => handleToggleTool(at.tool_id, at.is_enabled)}
                            disabled={saving}
                            className={`w-12 h-6 rounded-full transition-colors relative ${
                              at.is_enabled ? "bg-green-600" : "bg-(--color-text-muted)"
                            } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div
                              className={`absolute top-1 w-4 h-4 bg-(--color-surface) rounded-full transition-transform ${
                                at.is_enabled ? "translate-x-7" : "translate-x-1"
                              }`}
                            />
                          </button>

                          {/* Remover */}
                          <button
                            onClick={() => handleRemoveTool(at.tool_id)}
                            disabled={saving}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Remover ferramenta"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Adicionar Ferramenta */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-md max-w-2xl w-full max-h-[80vh] overflow-hidden bg-(--color-surface) border border-(--color-border)">
            <div className="bg-(--color-primary) p-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-(--color-on-primary)">Adicionar Ferramenta</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-(--color-on-primary) hover:bg-(--color-highlight) rounded-lg p-2 transition-colors"
              >
                <FiX />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {availableTools.length === 0 ? (
                <div className="text-center py-8">
                  <FiCheck className="text-green-600 text-5xl mx-auto mb-4" />
                  <p className="text-(--color-text-muted)">
                    Todas as ferramentas disponíveis já foram adicionadas
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleAddTool(tool.id)}
                      disabled={saving}
                      className="w-full text-left p-4 border border-(--color-border) rounded-xl hover:bg-(--color-highlight) hover:border-(--color-primary) transition-all disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-(--color-heading)">
                              {tool.name}
                            </h4>
                            {tool.category && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-(--color-highlight) text-(--color-on-primary)">
                                {tool.category}
                              </span>
                            )}
                          </div>
                          {tool.description && (
                            <p className="text-sm text-(--color-text-muted) mt-1">
                              {tool.description}
                            </p>
                          )}
                        </div>
                        <FiPlus className="text-(--color-primary) text-xl shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

