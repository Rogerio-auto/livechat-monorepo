import { Database } from "lucide-react";
import { KnowledgeBasePanel } from "../../componets/knowledge/KnowledgeBasePanel";

export default function KnowledgeBasePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Base de Conhecimento
            </h1>
          </div>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
            Treine seus agentes com documentos e informações da sua empresa para respostas mais precisas.
          </p>
        </div>

        <KnowledgeBasePanel />
      </div>
    </div>
  );
}
