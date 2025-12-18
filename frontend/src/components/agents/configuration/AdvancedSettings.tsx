import { Agent } from '@/types/agent';
import { FiCpu, FiMessageSquare, FiClock, FiShield } from 'react-icons/fi';

interface Props {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function AdvancedSettings({ agent, onUpdate }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-6">
        <FiCpu className="text-blue-600" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Configurações Avançadas</h3>
      </div>

      <div className="space-y-6">
        {/* Agregação de Mensagens */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiMessageSquare className="text-gray-400" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Agregação de Mensagens
              </label>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={agent.aggregation_enabled}
                onChange={(e) => onUpdate({ aggregation_enabled: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {agent.aggregation_enabled && (
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Janela (seg)</label>
                <input 
                  type="number" 
                  value={agent.aggregation_window_sec || 20}
                  onChange={(e) => onUpdate({ aggregation_window_sec: parseInt(e.target.value) })}
                  className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Max Mensagens</label>
                <input 
                  type="number" 
                  value={agent.max_batch_messages || 20}
                  onChange={(e) => onUpdate({ max_batch_messages: parseInt(e.target.value) })}
                  className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tempo de Resposta Ociosa */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FiClock className="text-gray-400" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Responder se ocioso (seg)
            </label>
          </div>
          <div className="pl-7">
            <input 
              type="number" 
              value={agent.reply_if_idle_sec || 90}
              onChange={(e) => onUpdate({ reply_if_idle_sec: parseInt(e.target.value) })}
              className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
              placeholder="Ex: 90"
            />
            <p className="mt-1 text-[10px] text-gray-500">Tempo de espera antes de enviar uma resposta automática se o cliente parar de digitar.</p>
          </div>
        </div>

        {/* Segurança e Grupos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiShield className="text-gray-400" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ignorar Mensagens de Grupo
              </label>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={agent.ignore_group_messages}
                onChange={(e) => onUpdate({ ignore_group_messages: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiShield className="text-gray-400" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Permitir Transbordo (Handoff)
              </label>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={agent.allow_handoff}
                onChange={(e) => onUpdate({ allow_handoff: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
