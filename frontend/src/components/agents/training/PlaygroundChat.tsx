import { PlaygroundChat as SharedPlayground } from '../configuration/PlaygroundChat';
import { Agent } from '@livechat/shared';

export function PlaygroundChat({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Playground de Treinamento</h2>
        <p className="text-sm text-gray-500 mt-1">
          Teste o comportamento do agente em um ambiente seguro. As conversas aqui não afetam o histórico real.
        </p>
      </div>
      
      <div className="max-w-4xl mx-auto w-full">
        <SharedPlayground agent={agent} />
      </div>
    </div>
  );
}
