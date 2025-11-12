import { useEffect, useRef, useState } from "react";
import { API, fetchJson } from "../../utils/api";
import { Input, Button } from "../../components/ui";

type AgentRow = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type NewAgentForm = {
  name: string;
  email: string;
  role: string;
};

const selectClasses = "w-full rounded-xl px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-60 transition-colors duration-200";

export default function AgentesPanel() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgentForm>({ name: "", email: "", role: "AGENT" });
  const inflight = useRef(false);

  const loadAgents = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const list = await fetchJson<AgentRow[]>(`${API}/settings/users`);
      setAgents(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  };

  useEffect(() => {
    loadAgents().catch(() => {});
  }, []);

  const saveAgent = async (id: string, patch: Partial<AgentRow>) => {
    await fetchJson(`${API}/settings/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)));
  };

  const removeAgent = async (id: string) => {
    await fetchJson(`${API}/settings/users/${id}`, { method: "DELETE" });
    setAgents((prev) => prev.filter((agent) => agent.id !== id));
  };

  const createAgent = async () => {
    if (!newAgent.name || !newAgent.email) return;
    const payload = { name: newAgent.name, email: newAgent.email, role: newAgent.role };
    const created = await fetchJson<AgentRow>(`${API}/settings/users`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAgents((prev) => [created, ...prev]);
    setNewAgent({ name: "", email: "", role: "AGENT" });
  };

  return (
    <section className="space-y-6">
      <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800 transition-colors duration-300">
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
          <div className="col-span-4">Nome</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Função</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>
        {loading && <div className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">Carregando...</div>}
        {!loading && agents.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">Nenhum usuário cadastrado.</div>
        )}
        {!loading && agents.map((agent) => (
          <div key={agent.id} className="px-6 py-4 grid grid-cols-12 gap-4 items-center border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
            <div className="col-span-4">
              <Input
                value={agent.name}
                onChange={(e) => saveAgent(agent.id, { name: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="col-span-4">
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
            <div className="col-span-2 text-right">
              <Button
                variant="danger"
                size="sm"
                onClick={() => removeAgent(agent.id)}
              >
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
