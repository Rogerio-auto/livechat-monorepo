// SimplifiedAgentList.tsx
// Lista simplificada de agentes com métricas de desempenho (sem detalhes técnicos)

import { useState, useEffect } from "react";
import { Plus, Settings, Trash2, MessageSquare, Activity, AlertCircle, Loader2, Bot, CheckCircle2, XCircle } from "lucide-react";
import { fetchJson } from "../../utils/api";
import { Modal } from "../../components/ui/Modal";

const API = import.meta.env.VITE_API_URL;

type AgentMetrics = {
  id: string;
  name: string;
  template_name: string | null;
  template_category: string | null;
  is_active: boolean;
  active_chats: number;
  total_chats: number;
  created_at: string;
};

type Props = {
  onNewAgent: () => void;
  onEditAgent: (agentId: string) => void;
};

export function SimplifiedAgentList({ onNewAgent, onEditAgent }: Props) {
  const [agents, setAgents] = useState<AgentMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      setLoading(true);
      const data = await fetchJson<AgentMetrics[]>(`${API}/api/agents/metrics`);
      setAgents(data);
    } catch (error) {
      console.error("Erro ao carregar agentes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAgentStatus(agentId: string, currentStatus: boolean) {
    try {
      await fetchJson(`${API}/api/agents/${agentId}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      loadAgents();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchJson(`${API}/api/agents/${deleteTarget}`, { method: "DELETE" });
      setAgents((prev) => prev.filter((a) => a.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao deletar agente:", error);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-500 animate-pulse">Carregando seus agentes...</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Bot size={40} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum agente criado</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
          Crie seu primeiro agente inteligente para automatizar seus atendimentos e escalar sua operação.
        </p>
        <button 
          onClick={onNewAgent} 
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-500/20"
        >
          <Plus size={20} />
          Criar Primeiro Agente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Meus Agentes</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie o status e as configurações de seus assistentes.
          </p>
        </div>
        <button 
          onClick={onNewAgent} 
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-sm"
        >
          <Plus size={18} />
          Novo Agente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all flex flex-col h-full"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${agent.is_active ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                  <Bot className={`w-7 h-7 ${agent.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {agent.name}
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {agent.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => toggleAgentStatus(agent.id, agent.is_active)}
                className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${
                  agent.is_active ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    agent.is_active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex-grow space-y-4">
              {agent.template_name && (
                <div className="py-2 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Template</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{agent.template_name}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="py-3 border-r border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Ativos</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{agent.active_chats}</p>
                </div>
                <div className="py-3 pl-4">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Total</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{agent.total_chats}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <button
                onClick={() => onEditAgent(agent.id)}
                className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Settings size={16} />
                Configurar
              </button>
              
              <button
                onClick={() => setDeleteTarget(agent.id)}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-all"
                title="Excluir Agente"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Agente"
      >
        <div className="p-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <p className="text-center text-gray-600 mb-8">
            Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita e todas as configurações serão perdidas.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-colors disabled:opacity-50"
            >
              {deleting ? "Excluindo..." : "Sim, Excluir"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

