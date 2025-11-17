import { useEffect, useRef, useState } from "react";
import { API, fetchJson } from "../../utils/api";
import { Input, Button } from "../../components/ui";
import { useToast } from "../../hooks/useToast";
import ToastContainer from "../common/ToastContainer";

type AgentRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  inbox_ids?: string[];
};

type NewAgentForm = {
  name: string;
  email: string;
  role: string;
};

type Inbox = {
  id: string;
  name: string;
  phone_number?: string | null;
};

const selectClasses = "w-full rounded-xl px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-60 transition-colors duration-200";

export default function AgentesPanel() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [inboxesLoading, setInboxesLoading] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgentForm>({ name: "", email: "", role: "AGENT" });
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const inflight = useRef(false);
  const { toasts, showToast, dismissToast } = useToast();

  const loadAgents = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const list = await fetchJson<AgentRow[]>(`${API}/settings/users`);
      // For each agent, load their inbox associations
      const agentsWithInboxes = await Promise.all(
        (Array.isArray(list) ? list : []).map(async (agent) => {
          try {
            const inboxLinks = await fetchJson<{ inbox_id: string }[]>(
              `${API}/settings/users/${agent.id}/inboxes`
            );
            return {
              ...agent,
              inbox_ids: inboxLinks.map((link) => link.inbox_id),
            };
          } catch {
            return { ...agent, inbox_ids: [] };
          }
        })
      );
      setAgents(agentsWithInboxes);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  };

  const loadInboxes = async () => {
    setInboxesLoading(true);
    try {
      const list = await fetchJson<Inbox[]>(`${API}/livechat/inboxes`);
      setInboxes(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("Error loading inboxes:", e);
      setInboxes([]);
    } finally {
      setInboxesLoading(false);
    }
  };

  useEffect(() => {
    loadAgents().catch(() => {});
    loadInboxes().catch(() => {});
  }, []);

  const saveAgent = async (id: string, patch: Partial<AgentRow>) => {
    try {
      await fetchJson(`${API}/settings/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)));
      showToast("Colaborador atualizado com sucesso!", "success");
    } catch (e: any) {
      showToast(e?.message || "Erro ao atualizar colaborador", "error");
    }
  };

  const removeAgent = async (id: string) => {
    try {
      await fetchJson(`${API}/settings/users/${id}`, { method: "DELETE" });
      setAgents((prev) => prev.filter((agent) => agent.id !== id));
      showToast("Colaborador removido com sucesso!", "success");
    } catch (e: any) {
      showToast(e?.message || "Erro ao remover colaborador", "error");
    }
  };

  const createAgent = async () => {
    if (!newAgent.name || !newAgent.email) {
      showToast("Preencha nome e email do colaborador", "warning");
      return;
    }
    
    try {
      const payload = { name: newAgent.name, email: newAgent.email, role: newAgent.role };
      const created = await fetchJson<AgentRow>(`${API}/settings/users`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAgents((prev) => [created, ...prev]);
      setNewAgent({ name: "", email: "", role: "AGENT" });
      showToast("Colaborador criado com sucesso! Email de convite enviado.", "success");
    } catch (e: any) {
      // Verificar se é erro de limite atingido
      const errorData = e?.data || {};
      if (errorData.code === "LIMIT_REACHED") {
        showToast(
          errorData.message || `Limite de ${errorData.limit} colaboradores atingido. Faça upgrade do seu plano para adicionar mais usuários.`,
          "error"
        );
      } else {
        showToast(e?.message || "Erro ao criar colaborador", "error");
      }
    }
  };

  const resendInvite = async (userId: string, userEmail: string) => {
    try {
      await fetchJson(`${API}/settings/users/${userId}/resend-invite`, {
        method: "POST",
      });
      showToast(`Convite reenviado para ${userEmail} com sucesso!`, "success");
    } catch (e: any) {
      showToast(e?.message || "Erro ao reenviar convite", "error");
    }
  };

  const toggleInboxAccess = async (userId: string, inboxId: string, currentlyHasAccess: boolean) => {
    try {
      if (currentlyHasAccess) {
        // Remove access
        await fetchJson(`${API}/settings/users/${userId}/inboxes/${inboxId}`, {
          method: "DELETE",
        });
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === userId
              ? { ...agent, inbox_ids: (agent.inbox_ids || []).filter((id) => id !== inboxId) }
              : agent
          )
        );
        showToast("Acesso à caixa de entrada removido", "success");
      } else {
        // Add access
        await fetchJson(`${API}/settings/users/${userId}/inboxes`, {
          method: "POST",
          body: JSON.stringify({ inbox_id: inboxId }),
        });
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === userId
              ? { ...agent, inbox_ids: [...(agent.inbox_ids || []), inboxId] }
              : agent
          )
        );
        showToast("Acesso à caixa de entrada concedido", "success");
      }
    } catch (e: any) {
      showToast(e?.message || "Erro ao atualizar acesso", "error");
    }
  };

  return (
    <section className="space-y-6">
      <div className="p-6 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800 transition-colors duration-300">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-3-3h-2m-2.5-4a3 3 0 11-6 0 3 3 0 016 0zm-6 4a5 5 0 015 5H2a5 5 0 015-5h8z" />
              </svg>
              Adicionar Colaborador
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Novos usuários receberão um email do Supabase para criar a senha.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg transition-colors duration-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Input
            placeholder="Nome completo"
            value={newAgent.name}
            onChange={(e) => setNewAgent((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            type="email"
            placeholder="Email corporativo"
            value={newAgent.email}
            onChange={(e) => setNewAgent((prev) => ({ ...prev, email: e.target.value }))}
          />
          <select
            className={selectClasses}
            value={newAgent.role}
            onChange={(e) => setNewAgent((prev) => ({ ...prev, role: e.target.value }))}
          >
            <option value="AGENT">Agente</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="TECHNICIAN">Técnico</option>
            <option value="MANAGER">Gestor</option>
          </select>
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={createAgent}
            disabled={loading || !newAgent.name || !newAgent.email}
          >
            Adicionar usuário
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden transition-colors duration-300">
        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 grid grid-cols-12 gap-4 text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold">
          <div className="col-span-2">Nome</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Função</div>
          <div className="col-span-2">Caixas de Entrada</div>
          <div className="col-span-3 text-right">Ações</div>
        </div>
        {loading && <div className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">Carregando...</div>}
        {!loading && agents.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">Nenhum usuário cadastrado.</div>
        )}
        {!loading && agents.map((agent) => (
          <div key={agent.id} className="border-t border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
              <div className="col-span-2">
                <Input
                  value={agent.name}
                  onChange={(e) => saveAgent(agent.id, { name: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="email"
                  value={agent.email}
                  onChange={(e) => saveAgent(agent.id, { email: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="col-span-2">
                <select
                  className={selectClasses}
                  value={agent.role}
                  onChange={(e) => saveAgent(agent.id, { role: e.target.value })}
                >
                  <option value="AGENT">Agente</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="TECHNICIAN">Técnico</option>
                  <option value="MANAGER">Gestor</option>
                </select>
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => setExpandedAgentId(expandedAgentId === agent.id ? null : agent.id)}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {(agent.inbox_ids || []).length} de {inboxes.length}
                </button>
              </div>
              <div className="col-span-3 text-right flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => resendInvite(agent.id, agent.email)}
                  title="Reenviar email de convite"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Reenviar Convite
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeAgent(agent.id)}
                >
                  Remover
                </Button>
              </div>
            </div>
            
            {/* Expandable inbox access panel */}
            {expandedAgentId === agent.id && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-200 dark:border-gray-700">
                <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Gerenciar Acesso às Caixas de Entrada
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Selecione quais caixas de entrada {agent.name} pode acessar no livechat
                </div>
                
                {inboxesLoading ? (
                  <div className="text-center py-4 text-sm text-gray-600 dark:text-gray-400">
                    Carregando caixas de entrada...
                  </div>
                ) : inboxes.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-600 dark:text-gray-400">
                    Nenhuma caixa de entrada configurada
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {inboxes.map((inbox) => {
                      const hasAccess = (agent.inbox_ids || []).includes(inbox.id);
                      return (
                        <label
                          key={inbox.id}
                          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-white dark:hover:bg-gray-800"
                          style={{
                            borderColor: hasAccess
                              ? "rgba(59, 130, 246, 0.5)"
                              : "rgba(156, 163, 175, 0.3)",
                            backgroundColor: hasAccess
                              ? "rgba(59, 130, 246, 0.05)"
                              : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={hasAccess}
                            onChange={() => toggleInboxAccess(agent.id, inbox.id, hasAccess)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {inbox.name}
                            </div>
                            {inbox.phone_number && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {inbox.phone_number}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
}
