// frontend/src/components/agents/monitoring/AgentDashboard.tsx

import { MetricsCards } from './MetricsCards';
import { ErrorMonitor } from './ErrorMonitor';
import { ConversationHistory } from './ConversationHistory';
import { Agent } from '@livechat/shared';

interface Props {
  agent: Agent;
}

export function AgentDashboard({ agent }: Props) {
  return (
    <div className="space-y-6">
      {/* Cards de Métricas */}
      <MetricsCards agentId={agent.id} />

      {/* Grid:  Monitor de Erros + Conversas Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorMonitor agentId={agent.id} />
        <ConversationHistory agentId={agent.id} limit={10} />
      </div>
    </div>
  );
}
