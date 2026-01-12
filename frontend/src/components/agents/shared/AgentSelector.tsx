// frontend/src/components/agents/shared/AgentSelector.tsx

import { Agent } from '@livechat/shared';

interface Props {
  agents: Agent[];
  selectedAgent: Agent;
  onSelectAgent: (agent: Agent) => void;
}

export function AgentSelector({ agents, selectedAgent, onSelectAgent }: Props) {
  return (
    <div className="relative inline-block text-left">
      <select
        value={selectedAgent.id}
        onChange={(e) => {
          const agent = agents.find((a) => a.id === e.target.value);
          if (agent) onSelectAgent(agent);
        }}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
      >
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </div>
  );
}
