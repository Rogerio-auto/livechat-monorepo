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
        <h3 className="text-xl font-bold theme-heading mb-2">Nenhum agente criado ainda</h3>
        <p className="theme-text-muted mb-6">Crie seu primeiro agente para começar a atender clientes</p>
        <button
          onClick={onNewAgent}
          className="theme-primary font-medium py-3 px-6 rounded-xl transition inline-flex items-center gap-2 shadow-sm"
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
          <h2 className="text-2xl font-bold theme-heading">Meus Agentes</h2>
          <p className="theme-text-muted text-sm">
            {agents.length} {agents.length === 1 ? "agente" : "agentes"} • Total de{" "}
            {agents.reduce((sum, a) => sum + a.total_chats, 0)} atendimentos realizados
          </p>
        </div>
        <button
          onClick={onNewAgent}
          className="theme-primary font-medium py-3 px-6 rounded-xl transition flex items-center gap-2 shadow-sm"
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
              className="group rounded-2xl border p-6 transition-all hover:shadow-xl hover:border-sky-400 theme-surface"
              style={{
                borderColor: "var(--color-border)",
                boxShadow: "0 24px 32px -24px var(--color-card-shadow)",
              }}
            >
              {/* Header com status */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold theme-heading">{agent.name}</h3>
                  {agent.template_name && (
                    <p className="text-xs theme-text-muted">{agent.template_name}</p>
                  )}
                </div>

                <button
                  onClick={() => toggleAgentStatus(agent.id, agent.is_active)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    agent.is_active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
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
                  <span
                    className="inline-block px-3 py-1 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--color-highlight) 12%, transparent)",
                      color: "var(--color-highlight-strong)",
                    }}
                  >
                    {agent.template_category}
                  </span>
                </div>
              )}

              {/* Métricas de desempenho */}
              <div className="space-y-3 mb-4">
                <div
                  className="rounded-lg p-3 border theme-surface-muted"
                  style={{ borderColor: "color-mix(in srgb, var(--color-border) 65%, transparent)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm theme-text-muted">Atendendo agora</span>
                    </div>
                    <span className="text-xl font-bold theme-heading">{agent.active_chats}</span>
                  </div>
                </div>

                <div
                  className="rounded-lg p-3 border theme-surface-muted"
                  style={{ borderColor: "color-mix(in srgb, var(--color-border) 65%, transparent)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-highlight)" }}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      <span className="text-sm theme-text-muted">Total atendido</span>
                    </div>
                    <span className="text-xl font-bold theme-heading">{agent.total_chats}</span>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                <button
                  onClick={() => onEditAgent(agent.id)}
                  className="flex-1 rounded-lg border font-medium py-2 px-4 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 theme-surface-muted"
                  style={{ borderColor: "color-mix(in srgb, var(--color-border) 55%, transparent)" }}
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
                  className="rounded-lg border border-transparent py-2 px-3 transition opacity-0 group-hover:opacity-100 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/40"
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
          <div
            className="rounded-2xl p-6 max-w-md w-full border theme-surface"
            style={{
              borderColor: "var(--color-border)",
              boxShadow: "0 24px 44px -24px var(--color-card-shadow)",
            }}
          >
            <h3 className="text-xl font-bold theme-heading mb-3">Confirmar exclusão</h3>
            <p className="theme-text-muted mb-6">
              Tem certeza que deseja deletar este agente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg transition theme-surface-muted border"
                style={{ borderColor: "var(--color-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg transition disabled:opacity-50 text-white font-medium"
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderColor: "color-mix(in srgb, var(--color-primary) 85%, var(--color-border))",
                }}
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
