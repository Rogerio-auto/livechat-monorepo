import { Agent } from '@livechat/shared';
import { KnowledgeBaseManager } from '../configuration/KnowledgeBaseManager';
import { PlaygroundChat } from './PlaygroundChat';
import { FiInfo } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function AgentTraining({ agent }: { agent: Agent }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex gap-3">
          <FiInfo className="text-blue-600 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">Como treinar seu agente?</p>
            <p>
              O treinamento do agente é feito através da Base de Conhecimento. 
              Você pode subir arquivos PDF, DOCX ou TXT com informações sobre sua empresa, 
              produtos e serviços. O agente usará esses dados para responder aos clientes.
            </p>
          </div>
        </div>

        <KnowledgeBaseManager agent={agent} />
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Instruções de Comportamento</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Estas instruções definem a personalidade e o tom de voz do agente. 
            Você pode editá-las na aba de Configurações.
          </p>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 max-h-[400px] overflow-y-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {agent.description || 'Nenhuma instrução definida.'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="sticky top-6">
          <PlaygroundChat agent={agent} />
        </div>
      </div>
    </div>
  );
}
