import { Agent } from '@livechat/shared';
import { PromptEditor } from './PromptEditor';
import { PlaygroundChat } from './PlaygroundChat';
import { ModelParameters } from './ModelParameters';
import { AdvancedSettings } from './AdvancedSettings';
import { InboxSelector } from './InboxSelector';
import { useAgentConfig } from '@/hooks/useAgentConfig';
import { toast } from '@/hooks/useToast';

export function AgentConfigEditor({ agent: initialAgent }: { agent: Agent }) {
  const { config: agent, updateConfig, loading } = useAgentConfig(initialAgent.id);

  const handleUpdate = async (updates: Partial<Agent>) => {
    try {
      await updateConfig(updates);
      toast.success('Configuração atualizada com sucesso');
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
      console.error(error);
    }
  };

  if (loading || !agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <PromptEditor agent={agent} onUpdate={handleUpdate} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ModelParameters agent={agent} onUpdate={handleUpdate} />
          <AdvancedSettings agent={agent} onUpdate={handleUpdate} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InboxSelector agent={agent} onUpdate={handleUpdate} />
        </div>
      </div>
      
      <div className="lg:col-span-1">
        <PlaygroundChat agent={agent} />
      </div>
    </div>
  );
}
