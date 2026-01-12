import { useEffect, useRef, useState } from "react";
import { API, fetchJson } from "../../utils/api";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { toast } from "../../hooks/useToast";
import { 
  UserPlus, 
  Users, 
  Mail, 
  Trash2, 
  Eye, 
  Send,
  CheckCircle2,
  XCircle
} from "lucide-react";

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

const selectClasses = "w-full rounded-lg px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50";

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

const RoleBadge = ({ role }: { role: string }) => {
  const colors: Record<string, string> = {
    ADMIN: "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
    MANAGER: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    SUPERVISOR: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800",
    AGENT: "bg-gray-50 text-gray-700 border-gray-100 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800",
    TECHNICIAN: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors[role] || colors.AGENT}`}>
      {role}
    </span>
  );
};

export default function AgentesPanel() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [inboxesLoading, setInboxesLoading] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgentForm>({ name: "", email: "", role: "AGENT" });
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const inflight = useRef(false);

  const loadAgents = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const list = await fetchJson<AgentRow[]>(`${API}/settings/users`);
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
      toast.success("Colaborador atualizado com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar colaborador");
    }
  };

  const removeAgent = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este colaborador?")) return;
    try {
      await fetchJson(`${API}/settings/users/${id}`, { method: "DELETE" });
      setAgents((prev) => prev.filter((agent) => agent.id !== id));
      toast.success("Colaborador removido com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover colaborador");
    }
  };

  const createAgent = async () => {
    if (!newAgent.name || !newAgent.email) {
      toast.error("Preencha o nome e email");
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
      toast.success("Colaborador criado com sucesso! Email de convite enviado.");
    } catch (e: any) {
      const errorData = e?.data || {};
      if (errorData.code === "LIMIT_REACHED") {
        toast.error("Limite de usuários atingido para seu plano.");
      } else {
        toast.error(e?.message || "Erro ao criar colaborador");
      }
    }
  };

  const resendInvite = async (userId: string, userEmail: string) => {
    try {
      await fetchJson(`${API}/settings/users/${userId}/resend-invite`, {
        method: "POST",
      });
      toast.success(`Convite reenviado para ${userEmail}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reenviar convite");
    }
  };

  const toggleInboxAccess = async (userId: string, inboxId: string, currentlyHasAccess: boolean) => {
    try {
      if (currentlyHasAccess) {
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
      } else {
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
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar acesso");
    }
  };

  return (
    <div className="space-y-12">
      {/* Add Collaborator Section */}
      <section>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Adicionar Colaborador</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Convide novos membros para sua equipe. Eles receberão um email para configurar o acesso.
          </p>
        </div>

        <div className="overflow-hidden">
          <div className="">
            <Field label="Nome Completo" description="Como o colaborador será identificado no sistema.">
              <Input
                placeholder="Ex: João Silva"
                value={newAgent.name}
                onChange={(e) => setNewAgent((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Field>

            <Field label="Email Corporativo" description="Onde o convite de acesso será enviado.">
              <Input
                type="email"
                placeholder="joao@empresa.com"
                value={newAgent.email}
                onChange={(e) => setNewAgent((prev) => ({ ...prev, email: e.target.value }))}
              />
            </Field>

            <Field label="Função" description="Define o nível de permissão do usuário.">
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
            </Field>
          </div>

          <div className="py-4 flex justify-end">
            <Button
              variant="primary"
              onClick={createAgent}
              disabled={loading || !newAgent.name || !newAgent.email}
            >
              Enviar Convite
            </Button>
          </div>
        </div>
      </section>

      {/* Collaborators List Section */}
      <section>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Equipe</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Lista de todos os colaboradores ativos e suas permissões.
          </p>
        </div>

        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Colaborador</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Função</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acesso</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      Carregando colaboradores...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum colaborador encontrado.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id} className="group hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{agent.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{agent.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={agent.role} />
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedAgentId(agent.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          <Eye size={14} />
                          {(agent.inbox_ids || []).length} caixas
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resendInvite(agent.id, agent.email)}
                            title="Reenviar convite"
                          >
                            <Send size={16} />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => removeAgent(agent.id)}
                            title="Remover colaborador"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Expanded Inbox Access Panel */}
      <Modal
        isOpen={!!expandedAgentId}
        onClose={() => setExpandedAgentId(null)}
        title="Acesso às Caixas de Entrada"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Defina quais canais <span className="font-semibold text-gray-900 dark:text-white">{agents.find(a => a.id === expandedAgentId)?.name}</span> pode visualizar.
          </p>

          <div className="max-h-[60vh] overflow-y-auto pr-2">
            {inboxesLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : inboxes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Nenhuma caixa de entrada encontrada.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {inboxes.map((inbox) => {
                  const agent = agents.find(a => a.id === expandedAgentId);
                  const hasAccess = (agent?.inbox_ids || []).includes(inbox.id);
                  return (
                    <label
                      key={inbox.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        hasAccess 
                          ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800' 
                          : 'bg-white border-gray-100 hover:border-gray-200 dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={hasAccess}
                        onChange={() => toggleInboxAccess(expandedAgentId!, inbox.id, hasAccess)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{inbox.name}</div>
                        {inbox.phone_number && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{inbox.phone_number}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <Button variant="primary" onClick={() => setExpandedAgentId(null)}>
              Concluído
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

