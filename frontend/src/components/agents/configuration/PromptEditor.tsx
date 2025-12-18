import { useState, useEffect } from 'react';
import { FiSave, FiRotateCcw, FiInfo } from 'react-icons/fi';
import { Agent } from '@/types/agent';

interface Props {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function PromptEditor({ agent, onUpdate }: Props) {
  const [prompt, setPrompt] = useState(agent.description || '');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setPrompt(agent.description || '');
    setIsDirty(false);
  }, [agent]);

  const handleSave = () => {
    onUpdate({ description: prompt });
    setIsDirty(false);
  };

  const handleReset = () => {
    setPrompt(agent.description || '');
    setIsDirty(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Prompt do Sistema</h3>
          <div className="group relative">
            <FiInfo className="text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Este é o prompt que define a personalidade e o comportamento do agente. Use variáveis como {'{customer_name}'} para personalização.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleReset}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Descartar alterações"
            >
              <FiRotateCcw />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isDirty 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <FiSave />
            Salvar
          </button>
        </div>
      </div>
      
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setIsDirty(true);
          }}
          className="w-full h-[400px] p-6 font-mono text-sm bg-transparent border-none focus:ring-0 resize-none text-gray-800 dark:text-gray-200 leading-relaxed"
          placeholder="Digite as instruções do sistema aqui..."
        />
        
        <div className="absolute bottom-4 right-4 flex gap-2">
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-[10px] font-mono text-gray-500 rounded">
            {prompt.length} caracteres
          </span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-[10px] font-mono text-gray-500 rounded">
            UTF-8
          </span>
        </div>
      </div>
    </div>
  );
}
