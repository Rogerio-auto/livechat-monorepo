import { useEffect, useRef, useState } from "react";
import { API, fetchJson } from "../../utils/api";

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

const inputClasses = "w-full rounded-xl px-3 py-2 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60";

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

  const fieldHeaderClasses = "text-xs text-gray-500";

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h3 className="text-lg font-semibold text-zinc-900 mb-2">Equipe</h3>
      <p className="text-sm text-gray-600 mb-4">Adicione colaboradores ou supervisores; eles receberao um email do Supabase para criar a senha.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <input
          className={inputClasses}
          placeholder="Nome"
          value={newAgent.name}
          onChange={(e) => setNewAgent((prev) => ({ ...prev, name: e.target.value }))}
        />
        <input
          className={inputClasses}
          placeholder="Email"
          value={newAgent.email}
          onChange={(e) => setNewAgent((prev) => ({ ...prev, email: e.target.value }))}
        />
        <select
          className={inputClasses}
          value={newAgent.role}
          onChange={(e) => setNewAgent((prev) => ({ ...prev, role: e.target.value }))}
        >
          <option value="AGENT">Agente</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="TECHNICIAN">Tecnico</option>
          <option value="MANAGER">Gestor</option>
        </select>
      </div>
      <div className="mb-4 flex justify-end">
        <button
          className="px-3 py-2 rounded-lg bg-[#204A34] text-white hover:bg-[#42CD55] disabled:opacity-60"
          onClick={createAgent}
          disabled={loading}
        >
          Adicionar usuario
        </button>
      </div>

      <div className="rounded-xl bg-white">
        <div className="px-3 py-2 grid grid-cols-12 gap-2">
          <div className={`${fieldHeaderClasses} col-span-4`}>Nome</div>
          <div className={`${fieldHeaderClasses} col-span-4`}>Email</div>
          <div className={`${fieldHeaderClasses} col-span-2`}>Papel</div>
          <div className={`${fieldHeaderClasses} col-span-2 text-right`}>Acoes</div>
        </div>
        {loading && <div className="px-3 py-4 text-sm text-gray-500">Carregando...</div>}
        {!loading && agents.length === 0 && (
          <div className="px-3 py-4 text-sm text-gray-500">Nenhum usuario cadastrado.</div>
        )}
        {!loading && agents.map((agent) => (
          <div key={agent.id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center border-t border-gray-100">
            <div className="col-span-4">
              <input
                className={inputClasses}
                value={agent.name}
                onChange={(e) => saveAgent(agent.id, { name: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="col-span-4">
              <input
                className={inputClasses}
                value={agent.email}
                onChange={(e) => saveAgent(agent.id, { email: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="col-span-2">
              <select
                className={inputClasses}
                value={agent.role}
                onChange={(e) => saveAgent(agent.id, { role: e.target.value })}
              >
                <option value="AGENT">Agente</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="TECHNICIAN">Tecnico</option>
                <option value="MANAGER">Gestor</option>
              </select>
            </div>
            <div className="col-span-2 text-right">
              <button
                className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-red-600"
                onClick={() => removeAgent(agent.id)}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
