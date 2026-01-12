import React, { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { 
  FiMessageSquare, FiClock, FiTag, FiArrowRight, FiZap, 
  FiSettings, FiChevronDown, FiChevronUp, FiTrash2,
  FiFileText, FiImage, FiVideo, FiInbox, FiPlus, FiList, FiLink, FiPhone, FiMessageCircle, FiX,
  FiUser, FiActivity, FiMic, FiFilter, FiBell, FiHelpCircle
} from 'react-icons/fi';
import MediaLibraryModal from './MediaLibraryModal';
import AudioRecorderModal from './AudioRecorderModal';

export const AVAILABLE_VARIABLES = [
  { 
    group: 'Tarefa', 
    variables: [
      { label: 'Título da Tarefa', value: '{{task_title}}', description: 'O nome da tarefa que disparou o evento' },
      { label: 'Status da Tarefa', value: '{{task_status}}', description: 'Status atual (ex: PENDING, DONE)' },
      { label: 'Prioridade', value: '{{task_priority}}', description: 'Nível de prioridade da tarefa' },
      { label: 'Data de Entrega', value: '{{task_due_date}}', description: 'Prazo final da tarefa' },
      { label: 'Nome do Responsável', value: '{{responsible_name}}', description: 'Nome do usuário atribuído à tarefa' },
      { label: 'WhatsApp do Responsável', value: '{{responsible_phone}}', description: 'Número do WhatsApp do responsável' },
    ]
  },
  { 
    group: 'Projeto', 
    variables: [
      { label: 'Nome do Projeto', value: '{{project_title}}', description: 'Nome do projeto da tarefa' },
      { label: 'Status do Projeto', value: '{{project_status}}', description: 'Status atual do projeto' },
      { label: 'Número do Projeto', value: '{{project_number}}', description: 'Identificador único do projeto' },
      { label: 'Nome do Cliente', value: '{{customer_name}}', description: 'Nome do cliente vinculado ao projeto/tarefa' },
      { label: 'WhatsApp do Cliente', value: '{{customer_phone}}', description: 'WhatsApp do cliente vinculado' },
    ]
  },
  { 
    group: 'Contato', 
    variables: [
      { label: 'Nome do Contato', value: '{{name}}', description: 'Nome do cliente atendido no chat' },
      { label: 'WhatsApp do Contato', value: '{{phone}}', description: 'WhatsApp do cliente atendido no chat' },
    ]
  },
  { 
    group: 'Sistema', 
    variables: [
      { label: 'Última Resposta', value: '{{last_response}}', description: 'Texto da última resposta recebida ou botão clicado' },
      { label: 'Criador', value: '{{created_by_name}}', description: 'Nome de quem criou a tarefa/projeto' },
    ]
  }
];

export const VariableGuide = ({ side = 'right', categories }: { side?: 'right' | 'left', categories?: ('Tarefa' | 'Projeto' | 'Contato' | 'Sistema')[] }) => {
  const filtered = AVAILABLE_VARIABLES.filter(group => !categories || categories.includes(group.group as any));
  
  return (
    <div className={`absolute ${side === 'right' ? 'left-full ml-4' : 'right-full mr-4'} top-0 w-64 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur shadow-2xl border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 z-[100] animate-in fade-in slide-in-from-left-2 duration-200 opacity-0 group-hover/node:opacity-100 hover:!opacity-100 transition-opacity pointer-events-auto`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg flex items-center justify-center">
          <FiHelpCircle size={14} />
        </div>
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Variáveis</span>
      </div>
      
      <div className="space-y-4">
        {filtered.map(group => (
          <div key={group.group} className="space-y-2">
            <p className="text-[10px] text-gray-400 font-bold uppercase border-b border-gray-100 dark:border-gray-800 pb-1">{group.group}</p>
            <div className="grid grid-cols-1 gap-2">
              {group.variables.map(v => (
                <div key={v.value} 
                  className="flex flex-col group cursor-copy p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" 
                  title="Clique para copiar"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(v.value);
                  }}
                >
                  <code className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">{v.value}</code>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[9px] text-gray-400 italic text-center">Clique na variável para copiar.</p>
      </div>
    </div>
  );
};

export interface FlowNodeData {
  label?: string;
  text?: string;
  media_url?: string | null;
  media_type?: string | null;
  media_name?: string | null;
  media_type_filter?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  buttons?: any[];
  list_sections?: any[];
  list_button_text?: string | null;
  delayMinutes?: number;
  tag_id?: string;
  column_id?: string;
  status?: string;
  action?: string;
  agent_id?: string;
  destination_status?: string;
  change_chat_status?: string | null;
  condition_type?: string;
  variable?: string;
  value?: string;
  field?: string;
  target?: 'RESPONSIBLE' | 'ENTITY_CUSTOMER' | 'FLOW_CONTACT' | 'CUSTOM';
  custom_phone?: string;
  cases?: string[];
  timeoutMinutes?: number;
  trigger_config?: {
    type: string;
    event?: string;
    message_types?: string[];
    inbox_id?: string;
    column_id?: string;
    filter_stage_id?: string;
    filter_tag_ids?: string[];
  };
  inboxes?: any[];
  columns?: any[];
  tags?: any[];
  agents?: any[];
  activeInbox?: any;
  inbox_id?: string;
  wait_for_response?: boolean;
  apiBase: string;
  onChange: (newData: Partial<FlowNodeData>) => void;
  onDelete: () => void;
  renderSettings?: () => React.ReactNode;
}

const NodeWrapper = ({ children, title, icon: Icon, color, selected, onToggleSettings, showSettings, data }: { 
  children: React.ReactNode, 
  title: string, 
  icon: any, 
  color: string, 
  selected?: boolean, 
  onToggleSettings: () => void, 
  showSettings: boolean, 
  data: FlowNodeData 
}) => (
  <div className={`
    min-w-[240px] max-w-[300px] transition-all duration-200
    bg-white dark:bg-[#0f172a] 
    rounded-xl shadow-sm border
    ${selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-800'}
    overflow-hidden
  `}>
    <div className="p-3 flex items-center justify-between gap-3 border-b border-gray-50 dark:border-gray-800/50">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${color} bg-opacity-10 ${color.replace('bg-', 'text-')}`}>
          <Icon size={16} />
        </div>
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.();
          }}
          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors text-gray-400 hover:text-red-500"
          title="Remover Node"
        >
          <FiTrash2 size={14} />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleSettings();
          }}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-400"
        >
          {showSettings ? <FiChevronUp size={16} /> : <FiSettings size={16} />}
        </button>
      </div>
    </div>

    <div className="p-3">
      {children}
    </div>

    {showSettings && (
      <div className="p-3 border-t border-gray-50 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-900/30 animate-in fade-in slide-in-from-top-1 duration-200">
        {data.renderSettings && data.renderSettings()}
      </div>
    )}
  </div>
);

export const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  
  const triggerTypeLabels: any = {
    'MANUAL': 'Manual',
    'STAGE_CHANGE': 'Mudança de Estágio',
    'TAG_ADDED': 'Etiqueta Adicionada',
    'LEAD_CREATED': 'Novo Lead',
    'NEW_MESSAGE': 'Nova Mensagem',
    'SYSTEM_EVENT': 'Evento de Sistema'
  };

  const config = nodeData.trigger_config || { type: 'MANUAL' };

  return (
    <div className="relative">
      <NodeWrapper 
        title="Gatilho" 
        icon={FiZap} 
        color="bg-yellow-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo de Gatilho</label>
                <select 
                  className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                  value={config.type}
                  onChange={(e) => nodeData.onChange({ trigger_config: { ...config, type: e.target.value } })}
                >
                  {Object.entries(triggerTypeLabels).map(([val, label]: any) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {config.type === 'NEW_MESSAGE' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Tipos de Mensagem</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {['text', 'image', 'video', 'document'].map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            const types = config.message_types || [];
                            const newTypes = types.includes(t) ? types.filter((x: string) => x !== t) : [...types, t];
                            nodeData.onChange({ trigger_config: { ...config, message_types: newTypes } });
                          }}
                          className={`px-2 py-1 rounded text-[10px] border ${
                            (config.message_types || []).includes(t) 
                              ? 'bg-blue-50 border-blue-200 text-blue-600' 
                              : 'bg-white border-gray-200 text-gray-500'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Inboxes (Opcional)</label>
                    <select 
                      className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                      value={config.inbox_id || ''}
                      onChange={(e) => nodeData.onChange({ trigger_config: { ...config, inbox_id: e.target.value } })}
                    >
                      <option value="">Todas as Inboxes</option>
                      {(nodeData.inboxes || []).map((i: any) => (
                        <option key={i.id} value={String(i.id)}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {config.type === 'LEAD_CREATED' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Inboxes (Opcional)</label>
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={config.inbox_id || ''}
                    onChange={(e) => nodeData.onChange({ trigger_config: { ...config, inbox_id: e.target.value } })}
                  >
                    <option value="">Todas as Inboxes</option>
                    {(nodeData.inboxes || []).map((i: any) => (
                      <option key={i.id} value={String(i.id)}>{i.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {config.type === 'SYSTEM_EVENT' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Evento de Sistema</label>
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={config.event || ''}
                    onChange={(e) => nodeData.onChange({ trigger_config: { ...config, event: e.target.value } })}
                  >
                    <option value="">Todos</option>
                    <option value="TASK_CREATED">Tarefa Criada</option>
                    <option value="TASK_ASSIGNED">Tarefa Atribuída</option>
                    <option value="TASK_COMPLETED">Tarefa Concluída</option>
                    <option value="TASK_DUE_TODAY">Tarefa Vencendo Hoje</option>
                    <option value="TASK_DUE_TOMORROW">Tarefa Vence Amanhã</option>
                    <option value="TASK_OVERDUE">Tarefa Atrasada</option>
                    <option value="PROJECT_CREATED">Projeto Criado</option>
                    <option value="PROJECT_ASSIGNED">Projeto Atribuído</option>
                    <option value="PROJECT_STAGE_CHANGED">Estágio do Projeto Alterado</option>
                    <option value="PROJECT_DEADLINE_TODAY">Projeto Vencendo Hoje</option>
                    <option value="PROJECT_DEADLINE_TOMORROW">Projeto Vence Amanhã</option>
                    <option value="PROJECT_DEADLINE_WARNING">Projeto - Aviso de Prazo (3 dias)</option>
                    <option value="PROJECT_OVERDUE">Projeto Atrasado</option>
                  </select>
                </div>
              )}

              {config.type === 'STAGE_CHANGE' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Coluna</label>
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={config.column_id || ''}
                    onChange={(e) => nodeData.onChange({ trigger_config: { ...config, column_id: e.target.value } })}
                  >
                    <option value="">Selecione...</option>
                    {(nodeData.columns || []).map((c: any) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Condições Adicionais (Filtros) */}
              {config.type !== 'MANUAL' && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                  <label className="text-[10px] font-bold text-blue-500 uppercase">Condições Adicionais</label>
                  
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Estágio do Lead (Opcional)</label>
                    <select 
                      className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                      value={config.filter_stage_id || ''}
                      onChange={(e) => nodeData.onChange({ trigger_config: { ...config, filter_stage_id: e.target.value || undefined } })}
                    >
                      <option value="">Qualquer Estágio</option>
                      {(nodeData.columns || []).map((c: any) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Etiquetas (Opcional - OU)</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(nodeData.tags || []).map((t: any) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            const current = config.filter_tag_ids || [];
                            const next = current.includes(t.id) ? current.filter((id: string) => id !== t.id) : [...current, t.id];
                            nodeData.onChange({ trigger_config: { ...config, filter_tag_ids: next } });
                          }}
                          className={`px-2 py-0.5 rounded-full text-[9px] border transition-colors ${
                            (config.filter_tag_ids || []).includes(t.id)
                              ? 'bg-blue-500 border-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        }}
      >
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {triggerTypeLabels[config.type] || 'Configurar...'}
          {config.type === 'NEW_MESSAGE' && config.message_types && config.message_types.length > 0 && (
            <div className="mt-1 flex gap-1">
              {config.message_types.map((t: string) => <span key={t} className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-[9px]">{t}</span>)}
            </div>
          )}
          
          {/* Visualização dos Filtros no Card */}
          {(config.filter_stage_id || (config.filter_tag_ids && config.filter_tag_ids.length > 0)) && (
            <div className="mt-2 pt-1 border-t border-gray-100 dark:border-gray-800/50 text-[9px] space-y-0.5">
              {config.filter_stage_id && (
                <div className="flex items-center gap-1">
                  <FiFilter className="text-blue-500" size={8} />
                  <span className="truncate">Estágio: {(nodeData.columns || []).find(c => String(c.id) === String(config.filter_stage_id))?.name || '...'}</span>
                </div>
              )}
              {config.filter_tag_ids && config.filter_tag_ids.length > 0 && (
                <div className="flex items-center gap-1">
                  <FiTag className="text-blue-500" size={8} />
                  <span>{config.filter_tag_ids.length} etiqueta(s)</span>
                </div>
              )}
            </div>
          )}
        </div>
      </NodeWrapper>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-yellow-500 border-2 border-gray-200 dark:border-[#0f172a]" />
    </div>
  );
});

export const MessageNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  
  return (
    <div className="relative group/node">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      
      {showSettings && <VariableGuide categories={['Tarefa', 'Projeto', 'Contato', 'Sistema']} />}

      <NodeWrapper 
        title="Enviar Mensagem" 
        icon={FiMessageSquare} 
        color="bg-blue-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Conteúdo do Texto</label>
                <textarea 
                  className="w-full mt-1 p-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                  rows={3}
                  value={nodeData.text || ''}
                  onChange={(e) => nodeData.onChange({ text: e.target.value })}
                  placeholder="Digite sua mensagem..."
                />
              </div>

              {/* Mídia */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Mídia (Opcional)</label>
                {nodeData.media_url ? (
                  <div className="relative group rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    {nodeData.media_type === 'IMAGE' && <img src={nodeData.media_url} className="w-full h-20 object-cover" />}
                    {(nodeData.media_type === 'VIDEO' || nodeData.media_type === 'AUDIO' || nodeData.media_type === 'VOICE' || nodeData.media_type === 'DOCUMENT') && (
                      <div className="p-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800">
                        {nodeData.media_type === 'VOICE' ? <FiPhone size={16} /> : <FiFileText size={16} />}
                        <span className="text-[10px] truncate">{nodeData.media_name || (nodeData.media_type === 'VOICE' ? 'Áudio Gravado' : 'Arquivo')}</span>
                      </div>
                    )}
                    <button 
                      onClick={() => nodeData.onChange({ media_url: null, media_type: null, media_name: null })}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <FiX size={10} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        nodeData.onChange({ media_type_filter: undefined });
                        setMediaModalOpen(true);
                      }}
                      className="flex-1 p-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-md text-gray-400 hover:text-blue-500 hover:border-blue-500 transition-all flex items-center justify-center gap-2"
                    >
                      <FiPlus size={14} />
                      <span className="text-[10px]">Mídia</span>
                    </button>
                    <button 
                      onClick={() => {
                        setRecorderOpen(true);
                      }}
                      className="p-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-md text-gray-400 hover:text-green-500 hover:border-green-500 transition-all flex items-center justify-center gap-2"
                      title="Gravar Áudio"
                    >
                      <FiMic size={14} />
                      <span className="text-[10px]">Gravar</span>
                    </button>
                  </div>
                )}
              </div>

              <MediaLibraryModal 
                apiBase={nodeData.apiBase}
                open={mediaModalOpen}
                onClose={() => setMediaModalOpen(false)}
                selectionMode={true}
                mediaType={nodeData.media_type_filter}
                onSelect={(media) => {
                  nodeData.onChange({ 
                    media_url: media.public_url, 
                    media_type: media.media_type,
                    media_name: media.filename
                  });
                  setMediaModalOpen(false);
                }}
              />

              <AudioRecorderModal
                apiBase={nodeData.apiBase}
                open={recorderOpen}
                onClose={() => setRecorderOpen(false)}
                onSelect={(media) => {
                  nodeData.onChange({ 
                    media_url: media.public_url, 
                    media_type: 'VOICE',
                    media_name: media.filename
                  });
                  setRecorderOpen(false);
                }}
              />
            </div>
          )
        }}
      >
        <div className="space-y-2">
          <div className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-2">
            {nodeData.text || 'Nenhuma mensagem...'}
          </div>
          {nodeData.media_url && (
            <div className="flex items-center gap-1 text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded w-fit">
              {nodeData.media_type === 'IMAGE' ? <FiImage size={10} /> : <FiFileText size={10} />}
              Mídia anexada
            </div>
          )}
        </div>
      </NodeWrapper>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-500 border-2 border-gray-200 dark:border-[#0f172a]" />
    </div>
  );
});

export const InteractiveNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  
  const provider = nodeData.activeInbox?.provider?.toUpperCase();
  const isMeta = (provider === 'META' || provider === 'META_CLOUD');

  const handleAddButton = () => {
    const buttons = nodeData.buttons || [];
    if (buttons.length >= 3) return;
    nodeData.onChange({ buttons: [...buttons, { type: 'QUICK_REPLY', text: 'Novo Botão' }] });
  };

  const handleAddListRow = (sectionIndex: number) => {
    const sections = [...(nodeData.list_sections || [{ title: 'Opções', rows: [] }])];
    sections[sectionIndex].rows.push({ id: `opt_${Date.now()}`, title: 'Nova Opção' });
    nodeData.onChange({ list_sections: sections });
  };

  return (
    <div className="relative group/node">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      
      {showSettings && <VariableGuide categories={['Tarefa', 'Projeto', 'Contato', 'Sistema']} />}

      <NodeWrapper 
        title="Interativo (Meta)" 
        icon={FiList} 
        color="bg-indigo-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-4">
              {!isMeta && (
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[10px] text-amber-700 dark:text-amber-400">
                  ⚠️ Este componente funciona melhor com a API Oficial da Meta. Em outras Inboxes, as opções serão enviadas como texto numerado.
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Texto do Cabeçalho</label>
                <textarea 
                  className="w-full mt-1 p-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                  rows={2}
                  value={nodeData.text || ''}
                  onChange={(e) => nodeData.onChange({ text: e.target.value })}
                  placeholder="Digite o texto principal..."
                />
              </div>

              {/* Botões */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Botões (Máx 3)</label>
                  {(nodeData.buttons?.length || 0) < 3 && (
                    <button onClick={handleAddButton} className="text-blue-500 hover:text-blue-600"><FiPlus size={14} /></button>
                  )}
                </div>
                <div className="space-y-1">
                  {(nodeData.buttons || []).map((btn: any, idx: number) => (
                    <div key={idx} className="flex gap-1">
                      <input 
                        className="flex-1 p-1 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                        value={btn.text}
                        onChange={(e) => {
                          const newBtns = [...(nodeData.buttons || [])];
                          newBtns[idx].text = e.target.value;
                          nodeData.onChange({ buttons: newBtns });
                        }}
                      />
                      <button 
                        onClick={() => nodeData.onChange({ buttons: (nodeData.buttons || []).filter((_: any, i: number) => i !== idx) })}
                        className="p-1 text-red-400 hover:text-red-500"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Menu de Opções (Lista)</label>
                  {!nodeData.list_sections && (
                    <button 
                      onClick={() => nodeData.onChange({ 
                        list_button_text: 'Ver Opções',
                        list_sections: [{ title: 'Opções', rows: [] }] 
                      })} 
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <FiPlus size={14} />
                    </button>
                  )}
                </div>
                {nodeData.list_sections && (
                  <div className="space-y-2">
                    <input 
                      placeholder="Texto do Botão (ex: Ver Opções)"
                      className="w-full p-1 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                      value={nodeData.list_button_text || ''}
                      onChange={(e) => nodeData.onChange({ list_button_text: e.target.value })}
                    />
                    {nodeData.list_sections.map((sec: any, sIdx: number) => (
                      <div key={sIdx} className="space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-800">
                        <div className="flex items-center justify-between">
                          <input 
                            className="text-[10px] font-bold bg-transparent border-none focus:ring-0 p-0"
                            value={sec.title}
                            onChange={(e) => {
                              const newSecs = [...(nodeData.list_sections || [])];
                              newSecs[sIdx].title = e.target.value;
                              nodeData.onChange({ list_sections: newSecs });
                            }}
                          />
                          <button onClick={() => handleAddListRow(sIdx)} className="text-blue-500"><FiPlus size={12} /></button>
                        </div>
                        {sec.rows.map((row: any, rIdx: number) => (
                          <div key={rIdx} className="flex gap-1">
                            <input 
                              className="flex-1 p-1 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                              value={row.title}
                              onChange={(e) => {
                                const newSecs = [...(nodeData.list_sections || [])];
                                newSecs[sIdx].rows[rIdx].title = e.target.value;
                                nodeData.onChange({ list_sections: newSecs });
                              }}
                            />
                            <button 
                              onClick={() => {
                                const newSecs = [...(nodeData.list_sections || [])];
                                newSecs[sIdx].rows = newSecs[sIdx].rows.filter((_: any, i: number) => i !== rIdx);
                                nodeData.onChange({ list_sections: newSecs });
                              }}
                              className="p-1 text-red-400 hover:text-red-500"
                            >
                              <FiTrash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                    <button 
                      onClick={() => nodeData.onChange({ list_sections: undefined, list_button_text: null })}
                      className="text-[9px] text-red-400 hover:text-red-500"
                    >
                      Remover Lista
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        }}
      >
        <div className="space-y-2">
          <div className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-2">
            {nodeData.text || 'Configurar interativo...'}
          </div>
          <div className="flex gap-1 flex-wrap">
            {(nodeData.buttons || []).map((b: any, i: number) => (
              <span key={i} className="text-[9px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-1 rounded border border-indigo-100 dark:border-indigo-800">
                🔘 {b.text}
              </span>
            ))}
            {nodeData.list_sections && (
              <span className="text-[9px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-1 rounded border border-indigo-100 dark:border-indigo-800">
                📋 {nodeData.list_button_text}
              </span>
            )}
          </div>
        </div>
      </NodeWrapper>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 border-2 border-gray-200 dark:border-[#0f172a]" />
    </div>
  );
});

export const WaitNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      <NodeWrapper 
        title="Aguardar" 
        icon={FiClock} 
        color="bg-orange-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Minutos</label>
              <input 
                type="number"
                className="w-full p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                value={nodeData.delayMinutes || 1}
                onChange={(e) => nodeData.onChange({ delayMinutes: parseInt(e.target.value) })}
              />
            </div>
          )
        }}
      >
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Pausa de {nodeData.delayMinutes || 1} minuto(s)
        </div>
      </NodeWrapper>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-orange-500 border-2 border-gray-200 dark:border-[#0f172a]" />
    </div>
  );
});

export const TagNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  const tagName = nodeData.tags?.find((t: any) => String(t.id) === String(nodeData.tag_id))?.name || 'Não selecionada';

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-purple-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      <NodeWrapper 
        title="Etiqueta" 
        icon={FiTag} 
        color="bg-purple-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Selecionar</label>
              <select 
                className="w-full p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                value={nodeData.tag_id || ''}
                onChange={(e) => nodeData.onChange({ tag_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {(nodeData.tags || []).map((t: any) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>
          )
        }}
      >
        <div className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded inline-block">
          {tagName}
        </div>
      </NodeWrapper>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-purple-500 border-2 border-gray-200 dark:border-[#0f172a]" />
    </div>
  );
});

export const StageNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  const columnName = nodeData.columns?.find((c: any) => String(c.id) === String(nodeData.column_id))?.name || 'Não selecionada';

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-green-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      <NodeWrapper 
        title="Mover Estágio" 
        icon={FiArrowRight} 
        color="bg-green-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Coluna</label>
              <select 
                className="w-full p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                value={nodeData.column_id || ''}
                onChange={(e) => nodeData.onChange({ column_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {(nodeData.columns || []).map((c: any) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          )
        }}
      >
        <div className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded inline-block">
          {columnName}
        </div>
      </NodeWrapper>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-green-500 border-2 border-gray-200 dark:border-[#0f172a]" />
    </div>
  );
});

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  const tagName = nodeData.tags?.find((t: any) => String(t.id) === String(nodeData.tag_id))?.name || '...';

  return (
    <div className="relative group/node">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-red-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      
      {showSettings && <VariableGuide categories={['Tarefa', 'Projeto', 'Contato', 'Sistema']} />}

      <NodeWrapper 
        title="Condição" 
        icon={FiZap} 
        color="bg-red-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo</label>
                <select 
                  className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                  value={nodeData.condition_type || ''}
                  onChange={(e) => nodeData.onChange({ condition_type: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  <option value="HAS_TAG">Tem Etiqueta</option>
                  <option value="IN_STAGE">Está no Estágio</option>
                  <option value="BUSINESS_HOURS">Horário Comercial</option>
                  <option value="HAS_VALUE">Campo preenchido</option>
                  <option value="MSG_CONTAINS">Mensagem contém...</option>
                  <option value="MSG_EQUALS">Mensagem é igual a...</option>
                </select>
              </div>

              {(nodeData.condition_type === 'MSG_CONTAINS' || nodeData.condition_type === 'MSG_EQUALS') && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Texto para comparar</label>
                  <input 
                    type="text"
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    placeholder="Digite o texto..."
                    value={nodeData.value || ''}
                    onChange={(e) => nodeData.onChange({ value: e.target.value })}
                  />
                </div>
              )}

              {nodeData.condition_type === 'HAS_TAG' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Etiqueta</label>
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={nodeData.tag_id || ''}
                    onChange={(e) => nodeData.onChange({ tag_id: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {(nodeData.tags || []).map((t: any) => (
                      <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {nodeData.condition_type === 'IN_STAGE' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Coluna</label>
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={nodeData.column_id || ''}
                    onChange={(e) => nodeData.onChange({ column_id: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {(nodeData.columns || []).map((c: any) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {nodeData.condition_type === 'HAS_VALUE' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Campo</label>
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={nodeData.field || ''}
                    onChange={(e) => nodeData.onChange({ field: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    <option value="name">Nome</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                  </select>
                </div>
              )}
            </div>
          )
        }}
      >
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {nodeData.condition_type === 'HAS_TAG' && `Se tem etiqueta: ${tagName}`}
          {nodeData.condition_type === 'IN_STAGE' && `Se está no estágio: ${nodeData.columns?.find((c: any) => String(c.id) === String(nodeData.column_id))?.name || '...'}`}
          {nodeData.condition_type === 'BUSINESS_HOURS' && `Se é Horário Comercial`}
          {nodeData.condition_type === 'HAS_VALUE' && `Se tem o campo: ${nodeData.field}`}
          {nodeData.condition_type === 'MSG_CONTAINS' && `Se mensagem contém: "${nodeData.value || '...'}"`}
          {nodeData.condition_type === 'MSG_EQUALS' && `Se mensagem é igual: "${nodeData.value || '...'}"`}
          {!nodeData.condition_type && 'Configurar...'}
        </div>
        <div className="flex justify-between mt-4 px-2">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold text-green-500">SIM</span>
            <Handle type="source" position={Position.Bottom} id="true" className="!w-3 !h-3 !bg-green-500 !static border-2 border-gray-200 dark:border-[#0f172a]" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold text-red-500">NÃO</span>
            <Handle type="source" position={Position.Bottom} id="false" className="!w-3 !h-3 !bg-red-500 !static border-2 border-gray-200 dark:border-[#0f172a]" />
          </div>
        </div>
      </NodeWrapper>
    </div>
  );
});

export const AIActionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  
  const actions = [
    { id: 'ACTIVATE', label: 'Ativar Agente IA', icon: FiZap, color: 'text-green-500' },
    { id: 'DEACTIVATE', label: 'Desativar IA (Humano)', icon: FiUser, color: 'text-blue-500' },
    { id: 'TRANSFER', label: 'Transferir Agente', icon: FiArrowRight, color: 'text-purple-500' },
  ];

  const currentAction = actions.find(a => a.id === nodeData.action) || actions[0];
  const agentName = nodeData.agents?.find((a: any) => String(a.id) === String(nodeData.agent_id))?.name || 'Não selecionado';

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-purple-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      <NodeWrapper 
        title="Ação de IA" 
        icon={FiActivity} 
        color="bg-purple-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Ação</label>
                <select 
                  className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                  value={nodeData.action || 'ACTIVATE'}
                  onChange={(e) => {
                    const newAction = e.target.value;
                    const updates: any = { action: newAction };
                    // Se ativar IA, por padrão muda o status para IA
                    if (newAction === 'ACTIVATE') {
                      updates.change_chat_status = 'AI';
                    }
                    nodeData.onChange(updates);
                  }}
                >
                  {actions.map(a => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>

              {(nodeData.action === 'ACTIVATE' || nodeData.action === 'TRANSFER') && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Agente</label>
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={nodeData.agent_id || ''}
                    onChange={(e) => nodeData.onChange({ agent_id: e.target.value })}
                  >
                    <option value="">Selecione um Agente...</option>
                    {(nodeData.agents || []).map((a: any) => (
                      <option key={a.id} value={String(a.id)}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {nodeData.action === 'DEACTIVATE' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Status de Destino</label>
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={nodeData.destination_status || 'OPEN'}
                    onChange={(e) => nodeData.onChange({ destination_status: e.target.value })}
                  >
                    <option value="OPEN">Aberto (Fila)</option>
                    <option value="PENDING">Pendente</option>
                    <option value="CLOSED">Fechado</option>
                  </select>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={nodeData.change_chat_status !== undefined && nodeData.change_chat_status !== null}
                    onChange={(e) => nodeData.onChange({ change_chat_status: e.target.checked ? (nodeData.action === 'ACTIVATE' ? 'AI' : 'OPEN') : null })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Alterar Status do Chat</span>
                </label>
                {(nodeData.change_chat_status !== undefined && nodeData.change_chat_status !== null) && (
                  <select 
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={nodeData.change_chat_status}
                    onChange={(e) => nodeData.onChange({ change_chat_status: e.target.value })}
                  >
                    <option value="OPEN">Aberto</option>
                    <option value="AI">Agente de IA</option>
                    <option value="PENDING">Pendente</option>
                    <option value="CLOSED">Fechado</option>
                  </select>
                )}
              </div>
            </div>
          )
        }}
      >
        <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <currentAction.icon className={currentAction.color} size={14} />
            <div className="flex flex-col">
              <span className="font-medium">{currentAction.label}</span>
              {(nodeData.action === 'ACTIVATE' || nodeData.action === 'TRANSFER') && (
                <span className="text-[10px] opacity-70">Agente: {agentName}</span>
              )}
              {nodeData.action === 'DEACTIVATE' && (
                <span className="text-[10px] opacity-70">Status: {nodeData.destination_status || 'OPEN'}</span>
              )}
            </div>
          </div>
          {nodeData.change_chat_status && (
            <div className="mt-1 pt-1 border-t border-gray-50 dark:border-gray-800/50 flex items-center gap-1 text-[10px] text-blue-500">
              <FiActivity size={10} />
              Status → {nodeData.change_chat_status}
            </div>
          )}
        </div>
      </NodeWrapper>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-purple-500 border-2 border-gray-200 dark:border-[#0f172a]" />
    </div>
  );
});

export const StatusNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  
  const statusLabels: any = {
    'OPEN': 'Aberto',
    'AI': 'Agente de IA',
    'PENDING': 'Pendente',
    'CLOSED': 'Fechado'
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-cyan-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      <NodeWrapper 
        title="Alterar Status" 
        icon={FiActivity} 
        color="bg-cyan-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Novo Status</label>
              <select 
                className="w-full p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                value={nodeData.status || 'OPEN'}
                onChange={(e) => nodeData.onChange({ status: e.target.value })}
              >
                {Object.entries(statusLabels).map(([val, label]: any) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          )
        }}
      >
        <div className="text-xs font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-1 rounded inline-block">
          Status: {statusLabels[nodeData.status || 'OPEN']}
        </div>
      </NodeWrapper>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-cyan-500 border-2 border-gray-200 dark:border-[#0f172a]" />
    </div>
  );
});

export const SwitchNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  const [newCase, setNewCase] = useState('');

  const cases = nodeData.cases || [];

  const addCase = () => {
    if (!newCase.trim()) return;
    nodeData.onChange({ cases: [...cases, newCase.trim().toLowerCase()] });
    setNewCase('');
  };

  const removeCase = (index: number) => {
    const newCases = [...cases];
    newCases.splice(index, 1);
    nodeData.onChange({ cases: newCases });
  };

  return (
    <div className="relative group/node">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      
      {showSettings && <VariableGuide categories={['Tarefa', 'Projeto', 'Contato', 'Sistema']} />}

      <NodeWrapper 
        title="Switch / Case" 
        icon={FiList} 
        color="bg-indigo-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Variável</label>
                <input 
                  className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                  value={nodeData.variable || 'last_response'}
                  onChange={(e) => nodeData.onChange({ variable: e.target.value })}
                  placeholder="Ex: last_response"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Casos (Valores)</label>
                <div className="flex gap-1 mt-1">
                  <input 
                    className="flex-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={newCase}
                    onChange={(e) => setNewCase(e.target.value)}
                    placeholder="Valor..."
                    onKeyDown={(e) => e.key === 'Enter' && addCase()}
                  />
                  <button onClick={addCase} className="p-1.5 bg-indigo-500 text-white rounded-md"><FiPlus size={14} /></button>
                </div>
                <div className="mt-2 space-y-1">
                  {cases.map((c: string, i: number) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                      <span>{c}</span>
                      <button onClick={() => removeCase(i)} className="text-red-500"><FiX size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        }}
      >
        <div className="text-xs text-gray-500">
          Switch: <span className="font-bold text-indigo-500">{nodeData.variable || 'last_response'}</span>
          <div className="mt-1 opacity-70">{cases.length} casos configurados</div>
        </div>
      </NodeWrapper>
      {cases.map((c: string, i: number) => (
        <div key={i} className="relative">
          <Handle 
            type="source" 
            position={Position.Right} 
            id={c}
            style={{ top: -60 + (i * 30) }}
            className="!w-3 !h-3 !bg-indigo-500 border-2 border-gray-200 dark:border-[#0f172a]" 
          />
          <div className="absolute right-4 text-[9px] text-gray-400 font-bold uppercase" style={{ top: -66 + (i * 30) }}>{c}</div>
        </div>
      ))}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="default"
        className="!w-3 !h-3 !bg-gray-400 border-2 border-gray-200 dark:border-[#0f172a]" 
      />
    </div>
  );
});

export const WaitForResponseNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  
  return (
    <div className="relative group/node">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-500 border-2 border-gray-200 dark:border-[#0f172a]" />
      
      {showSettings && <VariableGuide categories={['Contato', 'Sistema']} />}

      <NodeWrapper 
        title="Aguardar Resposta" 
        icon={FiClock} 
        color="bg-orange-500" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Mensagem (Opcional)</label>
                <textarea 
                  className="w-full mt-1 p-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                  rows={2}
                  value={nodeData.text || ''}
                  onChange={(e) => nodeData.onChange({ text: e.target.value })}
                  placeholder="Pergunta ao cliente..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tempo Limite (Minutos)</label>
                <input 
                  type="number"
                  className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                  value={nodeData.timeoutMinutes || 60}
                  onChange={(e) => nodeData.onChange({ timeoutMinutes: parseInt(e.target.value) })}
                />
              </div>
            </div>
          )
        }}
      >
        <div className="text-xs text-gray-500">
          Aguardando resposta por até <span className="font-bold text-orange-500">{nodeData.timeoutMinutes || 60} min</span>
        </div>
      </NodeWrapper>
      
      <div className="relative">
        <Handle 
          type="source" 
          position={Position.Right} 
          id="response"
          style={{ top: -40 }}
          className="!w-3 !h-3 !bg-green-500 border-2 border-gray-200 dark:border-[#0f172a]" 
        />
        <div className="absolute right-4 text-[9px] text-green-600 font-bold uppercase" style={{ top: -46 }}>Respondeu</div>
      </div>

      <div className="relative">
        <Handle 
          type="source" 
          position={Position.Bottom} 
          id="timeout"
          className="!w-3 !h-3 !bg-red-500 border-2 border-gray-200 dark:border-[#0f172a]" 
        />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-[9px] text-red-600 font-bold uppercase">Timeout</div>
      </div>
    </div>
  );
});

export const ExternalNotifyNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const [showSettings, setShowSettings] = useState(false);
  
  const targets = {
    'RESPONSIBLE': 'Responsável pela Tarefa',
    'ENTITY_CUSTOMER': 'Cliente da Tarefa/Projeto',
    'FLOW_CONTACT': 'Contato do Fluxo (Cliente)',
    'CUSTOM': 'Número Personalizado'
  };

  const handleAddButton = () => {
    const buttons = nodeData.buttons || [];
    if (buttons.length >= 3) return;
    nodeData.onChange({ buttons: [...buttons, { type: 'QUICK_REPLY', text: 'Novo Botão' }] });
  };

  const selectedInbox = nodeData.inboxes?.find((i: any) => String(i.id) === String(nodeData.inbox_id));
  const provider = selectedInbox?.provider?.toUpperCase();
  const isMeta = (provider === 'META' || provider === 'META_CLOUD');

  return (
    <div className="relative group/node">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-600 border-2 border-gray-200 dark:border-[#0f172a]" />
      
      {showSettings && <VariableGuide categories={['Tarefa', 'Projeto', 'Sistema', 'Contato']} />}

      <NodeWrapper 
        title="Notificar Externo" 
        icon={FiBell} 
        color="bg-blue-600" 
        selected={selected}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        data={{
          ...nodeData,
          renderSettings: () => (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Destinatário</label>
                <select 
                  className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                  value={nodeData.target || 'RESPONSIBLE'}
                  onChange={(e) => nodeData.onChange({ target: e.target.value as any })}
                >
                  {Object.entries(targets).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {nodeData.target === 'CUSTOM' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Número (Ex: 5569999...)</label>
                  <input 
                    type="text"
                    className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                    value={nodeData.custom_phone || ''}
                    onChange={(e) => nodeData.onChange({ custom_phone: e.target.value })}
                    placeholder="{{custom_variable}} ou número"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <label className="text-[10px] font-bold text-blue-600 uppercase">Canal de Saída (Inbox)</label>
                <select 
                  className="w-full mt-1 p-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500"
                  value={nodeData.inbox_id || ''}
                  onChange={(e) => nodeData.onChange({ inbox_id: e.target.value })}
                >
                  <option value="">Selecione a Inbox...</option>
                  {(nodeData.inboxes || []).map((i: any) => (
                    <option key={i.id} value={String(i.id)}>{i.name} ({i.provider})</option>
                  ))}
                </select>
                {!isMeta && nodeData.inbox_id && (
                  <p className="text-[9px] text-amber-600 mt-1 italic">
                    * Provedor {provider}: Botões serão convertidos em texto numerado.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Mensagem</label>
                <textarea 
                  className="w-full mt-1 p-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                  rows={3}
                  value={nodeData.text || ''}
                  onChange={(e) => nodeData.onChange({ text: e.target.value })}
                  placeholder="Use {{task_title}}, {{responsible_name}}..."
                />
              </div>

              {/* Botões Interativos */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Botões (Opcional - Máx 3)</label>
                  <button 
                    onClick={handleAddButton}
                    disabled={(nodeData.buttons || []).length >= 3}
                    className="text-blue-500 hover:text-blue-600 disabled:text-gray-300"
                  >
                    <FiPlus size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {(nodeData.buttons || []).map((btn: any, index: number) => (
                    <div key={index} className="flex gap-1 items-center bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                      <input 
                        type="text"
                        className="flex-1 bg-transparent text-[10px] focus:outline-none"
                        value={btn.text}
                        onChange={(e) => {
                          const newButtons = [...(nodeData.buttons || [])];
                          newButtons[index].text = e.target.value;
                          nodeData.onChange({ buttons: newButtons });
                        }}
                      />
                      <button 
                        onClick={() => {
                          const newButtons = (nodeData.buttons || []).filter((_: any, i: number) => i !== index);
                          nodeData.onChange({ buttons: newButtons });
                        }}
                        className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aguardar Resposta */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="wait_external"
                    checked={nodeData.wait_for_response || false}
                    onChange={(e) => nodeData.onChange({ wait_for_response: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="wait_external" className="text-[10px] font-bold text-gray-600 dark:text-gray-400 cursor-pointer">
                    AGUARDAR RESPOSTA DO DESTINATÁRIO
                  </label>
                </div>
                
                {nodeData.wait_for_response && (
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase">Tempo Limite (Minutos)</label>
                    <input 
                      type="number"
                      className="w-full mt-1 p-1 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                      value={nodeData.timeoutMinutes || 60}
                      onChange={(e) => nodeData.onChange({ timeoutMinutes: parseInt(e.target.value) })}
                    />
                    <p className="text-[8px] text-gray-500 mt-1 italic">
                      O fluxo ficará parado neste nó até que o destinatário responda ou o tempo acabe.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        }}
      >
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-500">
            Destino: <span className="font-bold text-blue-600">{targets[nodeData.target || 'RESPONSIBLE']}</span>
          </div>
          {nodeData.inbox_id && (
            <div className="text-[9px] text-gray-400 flex items-center gap-1">
              <FiInbox size={10} /> {selectedInbox?.name}
            </div>
          )}
          <div className="text-[10px] text-gray-600 dark:text-gray-400 italic line-clamp-1 border-t border-gray-50 pt-1 mt-1">
            {nodeData.text || 'Sem mensagem...'}
          </div>
          {(nodeData.buttons || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(nodeData.buttons || []).map((b: any, i: number) => (
                <span key={i} className="text-[8px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-1 rounded border border-blue-100 dark:border-blue-800">
                  {b.text}
                </span>
              ))}
            </div>
          )}
          {nodeData.wait_for_response && (
            <div className="mt-1 flex items-center gap-1 text-[8px] text-amber-600 dark:text-amber-500 font-bold uppercase border-t border-amber-100 dark:border-amber-900/40 pt-1">
              <FiClock size={10} /> Aguardando {nodeData.timeoutMinutes || 60}m
            </div>
          )}
        </div>
      </NodeWrapper>

      {!nodeData.wait_for_response ? (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-600 border-2 border-gray-200 dark:border-[#0f172a]" />
      ) : (
        <div className="flex justify-between px-3 -mt-3">
          <div className="relative">
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="response"
              className="!w-3 !h-3 !bg-green-500 border-2 border-gray-200 dark:border-[#0f172a]" 
            />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-[9px] text-green-600 font-bold uppercase">Resposta</div>
          </div>
          <div className="relative">
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="timeout"
              className="!w-3 !h-3 !bg-red-500 border-2 border-gray-200 dark:border-[#0f172a]" 
            />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-[9px] text-red-600 font-bold uppercase">Timeout</div>
          </div>
        </div>
      )}
    </div>
  );
});


