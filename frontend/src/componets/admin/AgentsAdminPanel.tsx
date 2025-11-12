// AgentsAdminPanel.tsx
// Admin panel para gerenciar agentes de IA (agents table)

import { useState, useEffect } from "react";
import { API, fetchJson } from "../../utils/api";
import { FiEdit2, FiX, FiSave, FiTrash2, FiEye, FiEyeOff } from "react-icons/fi";

type JsonRecord = Record<string, unknown>;

type Agent = {
  id: string;
  company_id: string;
  company_name?: string; // Nome da empresa
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  integration_openai_id: string | null;
  model: string | null;
  model_params: JsonRecord | null;
  aggregation_enabled: boolean;
  aggregation_window_sec: number | null;
  max_batch_messages: number | null;
  reply_if_idle_sec: number | null;
  media_config: JsonRecord | null;
  tools_policy: JsonRecord | null;
  allow_handoff: boolean;
  ignore_group_messages: boolean;
  enabled_inbox_ids: string[];
  transcription_model?: string | null;
  vision_model?: string | null;
  created_at: string;
  updated_at: string | null;
};

export function AgentsAdminPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("");

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    setError(null);
    try {
      // Usar rota admin que retorna agentes de todas as empresas
      const data = await fetchJson<Agent[]>(`${API}/api/admin/agents`);
      setAgents(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar agentes");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(agentId: string, payload: Partial<Agent>) {
    try {
      await fetchJson(`${API}/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      alert("Agente atualizado!");
      setEditingAgent(null);
      loadAgents();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar agente");
    }
  }

  async function handleDelete(agentId: string) {
    if (!confirm("Tem certeza que deseja deletar este agente?")) return;
    try {
      await fetchJson(`${API}/api/agents/${agentId}`, { method: "DELETE" });
      alert("Agente deletado!");
      loadAgents();
    } catch (err: any) {
      alert(err.message || "Erro ao deletar agente");
    }
  }

  async function handleToggleStatus(agent: Agent) {
    const newStatus = agent.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await fetchJson(`${API}/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      alert(newStatus === "ACTIVE" ? "Agente ativado" : "Agente desativado");
      loadAgents();
    } catch (err: any) {
      alert(err.message || "Erro ao alterar status");
    }
  }

  // Filtrar agentes por busca e empresa
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch = 
      !searchTerm || 
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCompany = 
      !filterCompany || 
      agent.company_name === filterCompany;
    
    return matchesSearch && matchesCompany;
  });

  // Obter lista única de empresas para o filtro
  const companies = Array.from(new Set(agents.map(a => a.company_name).filter(Boolean)));

  return (
    <div className="p-6 max-w-7xl mx-auto bg-(--color-bg) text-(--color-text)">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-(--color-heading)">Gerenciar Agentes de IA</h1>
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-(--color-text)">Buscar</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nome, descrição ou ID do agente..."
            className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border) focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-(--color-text)">Filtrar por Empresa</label>
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border) focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as empresas</option>
            {companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-(--color-text-muted)">Carregando...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : (
        <section>
          <div className="mb-4 text-sm text-(--color-text-muted)">
            Total: {filteredAgents.length} agente(s)
            {searchTerm || filterCompany ? ` (filtrado de ${agents.length})` : ""}
          </div>
          <div className="grid gap-4">
            {filteredAgents.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                {searchTerm || filterCompany 
                  ? "Nenhum agente encontrado com os filtros aplicados." 
                  : "Nenhum agente encontrado."}
              </div>
            ) : (
              filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={() => setEditingAgent(agent)}
                  onDelete={() => handleDelete(agent.id)}
                  onToggleStatus={handleToggleStatus}
                />
              ))
            )}
          </div>
        </section>
      )}

      {/* Modal de Edição */}
      {editingAgent && (
        <AgentEditorModal
          agent={editingAgent}
          onSave={(payload) => handleSave(editingAgent.id, payload)}
          onClose={() => setEditingAgent(null)}
        />
      )}
    </div>
  );
}

// Card de Agente
function AgentCard({
  agent,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  agent: Agent;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: (agent: Agent) => void;
}) {
  const isActive = agent.status === "ACTIVE";
  
  return (
    <div className="border rounded-lg p-4 bg-(--color-surface) text-(--color-text) shadow-sm hover:shadow-md border-(--color-border) transition">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg text-(--color-heading)">{agent.name}</h3>
            
            {/* Badge da Empresa - DESTAQUE */}
            {agent.company_name && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full font-semibold">
                🏢 {agent.company_name}
              </span>
            )}
            
            <span className={`px-2 py-1 text-xs rounded ${
              isActive 
                ? "bg-green-100 text-green-700" 
                : "bg-gray-100 text-gray-600"
            }`}>
              {agent.status}
            </span>
            {agent.model && (
              <span className="px-2 py-1 bg-(--color-surface-muted) text-(--color-text-muted) text-xs rounded">
                {agent.model}
              </span>
            )}
          </div>
          <p className="text-sm text-(--color-text-muted) mb-2 line-clamp-2">
            {agent.description || "Sem descrição"}
          </p>
          <div className="text-xs text-(--color-text-muted) space-y-1">
            <div>ID: <span className="font-mono">{agent.id}</span></div>
            {agent.enabled_inbox_ids && agent.enabled_inbox_ids.length > 0 && (
              <div>Inboxes: {agent.enabled_inbox_ids.length}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {onToggleStatus && (
            <button
              onClick={() => onToggleStatus(agent)}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                isActive
                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              {isActive ? <FiEyeOff /> : <FiEye />}
              {isActive ? "Desativar" : "Ativar"}
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-3 py-1 text-sm bg-(--color-highlight) text-(--color-on-primary) rounded hover:bg-(--color-primary) flex items-center gap-1"
            >
              <FiEdit2 />
              Editar
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
            >
              <FiTrash2 />
              Deletar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal de Edição
function AgentEditorModal({
  agent,
  onSave,
  onClose,
}: {
  agent: Agent;
  onSave: (agent: Partial<Agent>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Agent>>({
    name: agent.name,
    description: agent.description || "",
    status: agent.status,
    model: agent.model || "",
    integration_openai_id: agent.integration_openai_id || "",
    aggregation_enabled: agent.aggregation_enabled,
    aggregation_window_sec: agent.aggregation_window_sec || 20,
    max_batch_messages: agent.max_batch_messages || 20,
    reply_if_idle_sec: agent.reply_if_idle_sec || null,
    allow_handoff: agent.allow_handoff,
    ignore_group_messages: agent.ignore_group_messages,
    transcription_model: agent.transcription_model || "",
    vision_model: agent.vision_model || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar tamanho do description
    if (form.description && form.description.length > 40000) {
      alert(`O campo Descrição/Prompt é muito longo (${form.description.length} caracteres). Máximo permitido: 40000 caracteres.`);
      return;
    }
    
    // Remover campos não aceitos pelo backend e enviar apenas com id
    const payload: any = {
      name: form.name,
      description: form.description,
      status: form.status,
      model: form.model,
      integration_openai_id: form.integration_openai_id,
      aggregation_enabled: form.aggregation_enabled,
      aggregation_window_sec: form.aggregation_window_sec,
      max_batch_messages: form.max_batch_messages,
      reply_if_idle_sec: form.reply_if_idle_sec,
      allow_handoff: form.allow_handoff,
      ignore_group_messages: form.ignore_group_messages,
      transcription_model: form.transcription_model,
      vision_model: form.vision_model,
    };
    
    // Remover campos vazios/null (exceto strings vazias que devem virar null)
    Object.keys(payload).forEach(key => {
      if (payload[key] === "" && (key === "transcription_model" || key === "vision_model")) {
        // Manter string vazia para transformar em null no backend
        return;
      }
      if (payload[key] === "" || payload[key] === null || payload[key] === undefined) {
        delete payload[key];
      }
    });
    
    // NÃO enviar o ID no payload - ele vai na URL
    onSave(payload);
  };

  const updateField = (field: keyof Agent, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-(--color-surface) text-(--color-text) rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-(--color-surface) border-b border-(--color-border) p-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-(--color-heading)">Editar Agente: {agent.name}</h2>
          {agent.company_name && (
            <p className="text-sm text-(--color-text-muted) mt-1">
              🏢 Empresa: <span className="font-semibold">{agent.company_name}</span>
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiX size={24} />
        </button>
      </div>        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium mb-2 text-(--color-text)">Nome</label>
            <input
              type="text"
              value={form.name || ""}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border) focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Descrição (Prompt) - DESTAQUE */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-(--color-text)">
                Descrição / Prompt do Agente
                <span className="ml-2 text-xs text-(--color-highlight) font-semibold">(PRINCIPAL)</span>
              </label>
              <span className={`text-xs ${
                (form.description?.length || 0) > 40000 
                  ? "text-red-600 font-bold" 
                  : (form.description?.length || 0) > 35000 
                    ? "text-orange-600 font-semibold"
                    : "text-(--color-text-muted)"
              }`}>
                {form.description?.length || 0} / 40000 caracteres
              </span>
            </div>
            <textarea
              value={form.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              rows={20}
              className={`w-full px-4 py-3 border rounded-lg bg-(--color-bg) text-(--color-text) focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                (form.description?.length || 0) > 40000
                  ? "border-red-500"
                  : "border-(--color-border)"
              }`}
              placeholder="Instruções do sistema para o agente de IA..."
            />
            <p className="text-xs text-(--color-text-muted) mt-1">
              Este é o prompt que define o comportamento e personalidade do agente. Máximo: 40000 caracteres.
            </p>
            {(form.description?.length || 0) > 40000 && (
              <p className="text-xs text-red-600 mt-1 font-semibold">
                ⚠️ Texto muito longo! Reduza em {(form.description?.length || 0) - 40000} caracteres.
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2 text-(--color-text)">Status</label>
            <select
              value={form.status || "INACTIVE"}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border)"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-sm font-medium mb-2 text-(--color-text)">Modelo OpenAI</label>
            <input
              type="text"
              value={form.model || ""}
              onChange={(e) => updateField("model", e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border)"
              placeholder="gpt-4o, gpt-4-turbo, etc."
            />
          </div>

          {/* Integration OpenAI ID */}
          <div>
            <label className="block text-sm font-medium mb-2 text-(--color-text)">Integration OpenAI ID</label>
            <input
              type="text"
              value={form.integration_openai_id || ""}
              onChange={(e) => updateField("integration_openai_id", e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border)"
              placeholder="UUID da integração OpenAI"
            />
          </div>

          {/* Agregação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.aggregation_enabled || false}
                onChange={(e) => updateField("aggregation_enabled", e.target.checked)}
                className="w-4 h-4"
              />
              <label className="text-sm text-(--color-text)">Agregação Habilitada</label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-(--color-text)">Janela (seg)</label>
              <input
                type="number"
                value={form.aggregation_window_sec || 20}
                onChange={(e) => updateField("aggregation_window_sec", parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-(--color-text)">Max Mensagens</label>
              <input
                type="number"
                value={form.max_batch_messages || 20}
                onChange={(e) => updateField("max_batch_messages", parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border)"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.allow_handoff || false}
                onChange={(e) => updateField("allow_handoff", e.target.checked)}
                className="w-4 h-4"
              />
              <label className="text-sm text-(--color-text)">Permitir Handoff (transferir para humano)</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.ignore_group_messages || false}
                onChange={(e) => updateField("ignore_group_messages", e.target.checked)}
                className="w-4 h-4"
              />
              <label className="text-sm text-(--color-text)">Ignorar Mensagens de Grupo</label>
            </div>
          </div>

          {/* Reply if Idle */}
          <div>
            <label className="block text-sm font-medium mb-2 text-(--color-text)">
              Responder se Inativo por (segundos)
            </label>
            <input
              type="number"
              value={form.reply_if_idle_sec || ""}
              onChange={(e) => updateField("reply_if_idle_sec", e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border)"
              placeholder="Deixe vazio para desabilitar"
            />
          </div>

          {/* Processamento de Mídia */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-(--color-text) border-b pb-2 border-(--color-border)">
              Processamento de Mídia
            </h3>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-(--color-text)">
                Modelo de Transcrição (Áudio)
              </label>
              <select
                value={form.transcription_model || ""}
                onChange={(e) => updateField("transcription_model", e.target.value || null)}
                className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border)"
              >
                <option value="">Nenhum (não processar áudio)</option>
                <option value="whisper-1">whisper-1 (OpenAI Whisper)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Modelo usado para transcrever mensagens de voz
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-(--color-text)">
                Modelo de Visão (Imagens)
              </label>
              <select
                value={form.vision_model || ""}
                onChange={(e) => updateField("vision_model", e.target.value || null)}
                className="w-full px-4 py-2 border rounded-lg bg-(--color-bg) text-(--color-text) border-(--color-border)"
              >
                <option value="">Nenhum (não processar imagens)</option>
                <option value="gpt-4-vision-preview">gpt-4-vision-preview (GPT-4 Vision)</option>
                <option value="gpt-4o">gpt-4o (GPT-4o com visão)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Modelo usado para analisar imagens enviadas pelo cliente
              </p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t border-(--color-border)">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-(--color-primary) text-(--color-on-primary) rounded-lg hover:bg-(--color-highlight) font-semibold flex items-center justify-center gap-2 transition"
            >
              <FiSave />
              Salvar Alterações
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
