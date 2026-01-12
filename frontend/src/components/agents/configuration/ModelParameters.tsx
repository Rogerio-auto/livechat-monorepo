import { Agent } from '@livechat/shared';
import { FiSettings } from 'react-icons/fi';

interface Props {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function ModelParameters({ agent, onUpdate }: Props) {
  const params = agent.model_params || {};

  const handleParamChange = (key: string, value: any) => {
    onUpdate({
      model_params: {
        ...params,
        [key]: value
      }
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-6">
        <FiSettings className="text-blue-600" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Parâmetros do Modelo</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Modelo Principal
          </label>
          <select 
            value={agent.model || 'gpt-4o-mini'}
            onChange={(e) => onUpdate({ model: e.target.value })}
            className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="gpt-4o">GPT-4o (Recomendado)</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Visão
            </label>
            <select 
              value={agent.vision_model || 'gpt-4o'}
              onChange={(e) => onUpdate({ vision_model: e.target.value })}
              className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Transcrição
            </label>
            <select 
              value={agent.transcription_model || 'whisper-1'}
              onChange={(e) => onUpdate({ transcription_model: e.target.value })}
              className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
            >
              <option value="whisper-1">Whisper-1</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Temperatura
            </label>
            <span className="text-xs text-gray-500">{params.temperature ?? 0.7}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1" 
            value={params.temperature ?? 0.7}
            onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" 
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Max Tokens
            </label>
            <span className="text-xs text-gray-500">{params.max_tokens ?? 2048}</span>
          </div>
          <input 
            type="range" 
            min="256" 
            max="4096" 
            step="256" 
            value={params.max_tokens ?? 2048}
            onChange={(e) => handleParamChange('max_tokens', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" 
          />
        </div>
      </div>
    </div>
  );
}
