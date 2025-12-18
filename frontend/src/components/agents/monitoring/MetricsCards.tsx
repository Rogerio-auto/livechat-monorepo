// frontend/src/components/agents/monitoring/MetricsCards.tsx

import { useAgentMetrics } from '@/hooks/useAgentMetrics';
import { FiMessageCircle, FiAlertCircle, FiDollarSign, FiClock } from 'react-icons/fi';

interface Props {
  agentId: string;
}

export function MetricsCards({ agentId }: Props) {
  const { metrics, loading } = useAgentMetrics(agentId, 'day');

  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg" />
      ))}
    </div>;
  }

  const cards = [
    {
      title: 'Conversas Hoje',
      value: metrics?. total_conversations || 0,
      icon: FiMessageCircle,
      color: 'blue',
      subtitle: `${metrics?.active_conversations || 0} ativas`,
    },
    {
      title: 'Taxa de Sucesso',
      value: `${(metrics?.success_rate || 0).toFixed(1)}%`,
      icon: FiClock,
      color: 'green',
      subtitle: `Tempo médio: ${metrics?.avg_response_time_ms || 0}ms`,
    },
    {
      title: 'Taxa de Erro',
      value:  `${(metrics?.error_rate || 0).toFixed(1)}%`,
      icon: FiAlertCircle,
      color: 'red',
      subtitle: `${metrics?.timeout_count || 0} timeouts`,
    },
    {
      title: 'Custo Hoje',
      value: `R$ ${(metrics?.total_cost || 0).toFixed(2)}`,
      icon: FiDollarSign,
      color: 'yellow',
      subtitle: `${(metrics?.total_tokens || 0).toLocaleString()} tokens`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {card.title}
              </h3>
              <Icon className={`w-5 h-5 text-${card.color}-500`} />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
