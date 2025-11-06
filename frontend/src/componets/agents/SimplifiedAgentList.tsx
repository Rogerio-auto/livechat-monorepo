// SimplifiedAgentList.tsx
// Lista simplificada de agentes com métricas de desempenho (sem detalhes técnicos)

import { useState, useEffect } from "react";
import { fetchJson } from "../../utils/api";

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
      alert("Erro ao carregar seus agentes");
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
      alert("Erro ao alterar status do agente");
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
      alert("Erro ao deletar agente");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-16">
        <h3 className="text-xl font-bold text-white mb-2">Nenhum agente criado ainda</h3>
        <p className="text-gray-400 mb-6">Crie seu primeiro agente para começar a atender clientes</p>
        <button
          onClick={onNewAgent}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Criar Primeiro Agente
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Meus Agentes</h2>
          <p className="text-gray-400 text-sm">
            {agents.length} {agents.length === 1 ? "agente" : "agentes"} • Total de{" "}
            {agents.reduce((sum, a) => sum + a.total_chats, 0)} atendimentos realizados
          </p>
        </div>
        <button
          onClick={onNewAgent}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Agente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => {
          return (
            <div
              key={agent.id}
              className="bg-linear-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 hover:border-blue-500 transition-all hover:shadow-xl group"
            >
              {/* Header com status */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{agent.name}</h3>
                  {agent.template_name && (
                    <p className="text-xs text-gray-400">{agent.template_name}</p>
                  )}
                </div>

                <button
                  onClick={() => toggleAgentStatus(agent.id, agent.is_active)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    agent.is_active ? "bg-green-600" : "bg-gray-600"
                  }`}
                  title={agent.is_active ? "Agente ativo" : "Agente pausado"}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      agent.is_active ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Badge da categoria */}
              {agent.template_category && (
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-blue-900/50 text-blue-300 text-xs font-medium rounded-full">
                    {agent.template_category}
                  </span>
                </div>
              )}

              {/* Métricas de desempenho */}
              <div className="space-y-3 mb-4">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm text-gray-400">Atendendo agora</span>
                    </div>
                    <span className="text-xl font-bold text-white">{agent.active_chats}</span>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      <span className="text-sm text-gray-400">Total atendido</span>
                    </div>
                    <span className="text-xl font-bold text-white">{agent.total_chats}</span>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                <button
                  onClick={() => onEditAgent(agent.id)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Configurar
                </button>
                <button
                  onClick={() => setDeleteTarget(agent.id)}
                  className="bg-red-900/30 hover:bg-red-900/50 text-red-400 font-medium py-2 px-3 rounded-lg transition opacity-0 group-hover:opacity-100"
                  title="Deletar agente"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de confirmação de exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-3">Confirmar exclusão</h3>
            <p className="text-gray-400 mb-6">
              Tem certeza que deseja deletar este agente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {deleting ? "Deletando..." : "Deletar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
