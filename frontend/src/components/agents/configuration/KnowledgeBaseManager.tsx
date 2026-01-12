import { Agent } from '@livechat/shared';
import { FiBook, FiPlus, FiFileText } from 'react-icons/fi';

export function KnowledgeBaseManager({ agent }: { agent: Agent }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FiBook className="text-blue-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Base de Conhecimento</h3>
        </div>
        <button className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
          <FiPlus />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
          <FiFileText className="text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Manual_Produtos_v2.pdf</p>
            <p className="text-[10px] text-gray-500">Sincronizado em 12/12/2025</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
          <FiFileText className="text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">FAQ_Atendimento.docx</p>
            <p className="text-[10px] text-gray-500">Sincronizado em 10/12/2025</p>
          </div>
        </div>

        <button className="w-full py-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-colors border border-dashed border-blue-200 dark:border-blue-900/30">
          Ver todos os documentos
        </button>
      </div>
    </div>
  );
}
