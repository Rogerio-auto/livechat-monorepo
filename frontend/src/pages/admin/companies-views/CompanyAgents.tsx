// frontend/src/pages/admin/companies-views/CompanyAgents.tsx

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FiActivity, FiSettings, FiPlay, FiBarChart2 } from 'react-icons/fi';
import { AgentDashboard } from '@/components/agents/monitoring/AgentDashboard.tsx';
import { AgentConfigEditor } from '@/components/agents/configuration/AgentConfigEditor';
import { AgentTraining } from '@/components/agents/training/AgentTraining';
import { AgentAnalytics } from '@/components/agents/analytics/AgentAnalytics';
import { AgentSelector } from '@/components/agents/shared/AgentSelector';
import { Agent } from '@/types/agent';

type TabId = 'monitoring' | 'configuration' | 'training' | 'analytics';

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'monitoring', label: 'Monitoramento', icon:  FiActivity },
  { id: 'configuration', label: 'Configurações', icon: FiSettings },
  { id: 'training', label: 'Treinamento', icon: FiPlay },
  { id: 'analytics', label: 'Analytics', icon: FiBarChart2 },
];

export function CompanyAgents() {
  const { companyId, agentId } = useParams<{ companyId: string; agentId?:  string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'monitoring';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar agentes da empresa
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';
        const res = await fetch(`${API}/api/admin/companies/${companyId}/agents`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Falha ao carregar agentes');
        const data = await res.json();
        setAgents(data);
        
        // Selecionar agente se houver ID na URL
        if (agentId) {
          const agent = data.find((a: Agent) => a.id === agentId);
          if (agent) setSelectedAgent(agent);
        } else if (data.length > 0) {
          setSelectedAgent(data[0]);
        }
      } catch (error) {
        console.error('Erro ao carregar agentes:', error);
      } finally {
        setLoading(false);
      }
    };

    if (companyId) loadAgents();
  }, [companyId, agentId]);

  const handleTabChange = (tabId: TabId) => {
    setSearchParams({ tab: tabId });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!selectedAgent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Nenhum agente encontrado para esta empresa. </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gerenciamento de Agentes IA
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Monitore, configure e treine agentes de IA
          </p>
        </div>

        {/* Seletor de Agente */}
        <AgentSelector
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
        />
      </div>

      {/* Tabs de Navegação */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab. id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab. id)}
                className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm
                  transition-colors duration-200
                  ${
                    isActive
                      ?  'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo da Tab Ativa */}
      <div className="mt-6">
        {activeTab === 'monitoring' && <AgentDashboard agent={selectedAgent} />}
        {activeTab === 'configuration' && <AgentConfigEditor agent={selectedAgent} />}
        {activeTab === 'training' && <AgentTraining agent={selectedAgent} />}
        {activeTab === 'analytics' && <AgentAnalytics agent={selectedAgent} />}
      </div>
    </div>
  );
}
