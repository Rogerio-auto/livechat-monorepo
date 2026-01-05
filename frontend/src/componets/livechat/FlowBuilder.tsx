import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FiX, FiSave, FiPlus, FiTrash2, FiChevronRight, FiMessageSquare, FiClock, FiTag, FiArrowRight, FiZap, FiList, FiActivity, FiEdit2 } from 'react-icons/fi';

import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { getAccessToken } from '../../utils/api';
import { 
  TriggerNode, 
  MessageNode, 
  InteractiveNode,
  WaitNode, 
  TagNode, 
  StageNode,
  ConditionNode,
  AIActionNode,
  StatusNode,
  SwitchNode,
  WaitForResponseNode,
  type FlowNodeData
} from './FlowNodes';

const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  interactive: InteractiveNode,
  ai_action: AIActionNode,
  wait: WaitNode,
  add_tag: TagNode,
  move_stage: StageNode,
  condition: ConditionNode,
  change_status: StatusNode,
  switch: SwitchNode,
  wait_for_response: WaitForResponseNode,
};


const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'trigger',
    data: { label: 'Início Manual', description: 'Inicia quando você aciona manualmente.' },
    position: { x: 250, y: 50 },
  },
];

const initialEdges: Edge[] = [];

type Props = {
  apiBase: string;
  flowId?: string;
  onClose: () => void;
};

export default function FlowBuilder({ apiBase, flowId, onClose }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [name, setName] = useState('Novo Fluxo');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Data for selectors
  const [tags, setTags] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  const fetchWithAuth = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers, credentials: "include" });
  };

  const updateNodeData = useCallback((nodeId: string, newData: Partial<FlowNodeData>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, [setNodes]);

  useEffect(() => {
    // Fetch helper data
    fetchWithAuth(`${apiBase}/livechat/tags`).then(res => res.json()).then(setTags).catch(() => {});
    
    // Buscar colunas do kanban corretamente
    fetchWithAuth(`${apiBase}/kanban/my-board`)
      .then(res => res.json())
      .then(board => {
        if (board?.id) {
          fetchWithAuth(`${apiBase}/kanban/boards/${board.id}/columns`)
            .then(res => res.json())
            .then(setColumns)
            .catch(() => {});
        }
      })
      .catch(() => {});

    fetchWithAuth(`${apiBase}/livechat/inboxes`).then(res => res.json()).then(setInboxes).catch(() => {});
    fetchWithAuth(`${apiBase}/agents`).then(res => res.json()).then(setAgents).catch(() => {});

    if (flowId) {
      fetchWithAuth(`${apiBase}/api/livechat/flows/${flowId}`)
        .then(res => res.json())
        .then(data => {
          setName(data.name);
          setDescription(data.description || '');
          if (data.nodes?.length) setNodes(data.nodes);
          if (data.edges?.length) setEdges(data.edges);
        });
    }
  }, [flowId]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  // Inject helper data and onChange into nodes whenever they or the helpers change
  useEffect(() => {
    setNodes((nds) => {
      const triggerNode = nds.find(n => n.type === 'trigger');
      const triggerData = triggerNode?.data as FlowNodeData | undefined;
      const triggerConfig = triggerData?.trigger_config;
      const inboxId = triggerConfig?.inbox_id;
      const activeInbox = inboxId ? inboxes.find(i => String(i.id) === String(inboxId)) : null;
      const triggerType = triggerConfig?.type;

      let changed = false;
      const newNodes = nds.map(node => {
        const nodeData = node.data as unknown as FlowNodeData;
        // Só atualiza se algo realmente mudou para evitar loops infinitos
        const needsUpdate = 
          nodeData.activeInbox?.id !== activeInbox?.id ||
          (nodeData as any).triggerType !== triggerType ||
          !nodeData.onChange ||
          !nodeData.onDelete ||
          nodeData.apiBase !== apiBase ||
          nodeData.tags !== tags ||
          nodeData.columns !== columns ||
          nodeData.inboxes !== inboxes ||
          nodeData.agents !== agents;

        if (!needsUpdate) return node;

        changed = true;
        return {
          ...node,
          data: { 
            ...node.data, 
            tags, 
            columns, 
            inboxes,
            agents,
            activeInbox,
            triggerType,
            apiBase,
            onChange: (newData: Partial<FlowNodeData>) => updateNodeData(node.id, newData),
            onDelete: () => deleteNode(node.id)
          }
        };
      });

      return changed ? newNodes : nds;
    });
  }, [nodes, tags, columns, inboxes, agents, apiBase, updateNodeData, deleteNode]);

  const onSave = async () => {
    setSaving(true);
    try {
      // Clean nodes before saving (remove helper data)
      const cleanNodes = nodes.map(({ data, ...rest }) => {
        const { tags, columns, inboxes, agents, onChange, onDelete, apiBase, activeInbox, triggerType, ...cleanData } = data;
        return { ...rest, data: cleanData };
      });

      const payload = {
        name,
        description,
        nodes: cleanNodes,
        edges,
        trigger_config: cleanNodes.find(n => n.type === 'trigger')?.data?.trigger_config || { type: 'MANUAL' }
      };

      const url = flowId ? `${apiBase}/api/livechat/flows/${flowId}` : `${apiBase}/api/livechat/flows`;
      const method = flowId ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onClose();
      }
    } catch (error) {
      console.error("Failed to save flow", error);
    } finally {
      setSaving(false);
    }
  };

  const addNode = (type: string) => {
    const id = `node_${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      data: { 
        label: type,
        tags,
        columns,
        inboxes,
        agents,
        apiBase,
        onChange: (newData: Partial<FlowNodeData>) => updateNodeData(id, newData),
        onDelete: () => deleteNode(id)
      },
      position: { x: 400, y: 200 },
    };

    // Default data based on type
    if (type === 'message') newNode.data.text = 'Olá! Como posso ajudar?';
    if (type === 'interactive') {
      newNode.data.text = 'Escolha uma opção:';
      newNode.data.buttons = [];
    }
    if (type === 'ai_action') {
      newNode.data.action = 'ACTIVATE';
      newNode.data.change_chat_status = 'AI';
    }
    if (type === 'change_status') {
      newNode.data.status = 'OPEN';
    }
    if (type === 'wait') newNode.data.delayMinutes = 5;
    if (type === 'switch') {
      newNode.data.variable = 'last_response';
      newNode.data.cases = ['sim', 'não'];
    }
    if (type === 'wait_for_response') {
      newNode.data.timeoutMinutes = 60;
    }
    if (type === 'trigger') newNode.data.trigger_config = { type: 'MANUAL' };
    
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div className="absolute inset-0 z-50 bg-white dark:bg-[#0a0f1c] flex flex-col font-sans">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Blocks */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0f172a]/50 p-4 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Componentes</h3>
            <div className="space-y-2">
              <button onClick={() => addNode('message')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiMessageSquare size={16} />
                </div>
                Enviar Mensagem
              </button>
              <button onClick={() => addNode('interactive')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiList size={16} />
                </div>
                Interativo (Meta)
              </button>
              <button onClick={() => addNode('ai_action')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiActivity size={16} />
                </div>
                Ações de IA
              </button>
              <button onClick={() => addNode('wait')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiClock size={16} />
                </div>
                Aguardar
              </button>
              <button onClick={() => addNode('add_tag')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiTag size={16} />
                </div>
                Adicionar Etiqueta
              </button>
              <button onClick={() => addNode('move_stage')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-400 dark:hover:border-green-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiArrowRight size={16} />
                </div>
                Mover Estágio
              </button>
              <button onClick={() => addNode('change_status')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiActivity size={16} />
                </div>
                Alterar Status
              </button>
              <button onClick={() => addNode('condition')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-red-400 dark:hover:border-red-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiZap size={16} />
                </div>
                Condição (Se/Então)
              </button>
              <button onClick={() => addNode('switch')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiList size={16} />
                </div>
                Switch (Múltiplos Caminhos)
              </button>
              <button onClick={() => addNode('wait_for_response')} className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-sm transition-all text-xs font-medium text-gray-600 dark:text-gray-300 group">
                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FiClock size={16} />
                </div>
                Aguardar Resposta
              </button>
            </div>
          </div>
        </div>

        {/* Main Editor */}
        <div className="flex-1 relative bg-gray-100 dark:bg-[#070a13]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[15, 15]}
            fitView
          >
            <Panel position="top-left" className="!bg-white dark:!bg-[#0f172a] p-4 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 flex flex-col gap-2 min-w-[300px] m-4">
              <div className="flex items-center gap-2 group">
                <FiEdit2 className="text-gray-400 group-hover:text-blue-500 transition-colors" size={14} />
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome do Fluxo"
                  className="bg-transparent font-bold text-lg text-gray-700 dark:text-gray-200 focus:outline-none border-b border-transparent focus:border-blue-500 w-full"
                />
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descrição do fluxo (opcional)"
                className="bg-transparent text-xs text-gray-500 dark:text-gray-400 focus:outline-none border-b border-transparent focus:border-blue-500 w-full resize-none h-12"
              />
            </Panel>

            <Panel position="top-right" className="flex items-center gap-2 m-4">
              <Button variant="ghost" onClick={onClose} className="bg-white dark:bg-gray-800 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700">
                <FiX className="mr-2" /> Fechar
              </Button>
              <Button variant="primary" onClick={onSave} disabled={saving} className="!bg-blue-600 hover:!bg-blue-700 !text-white px-6 rounded-lg shadow-lg shadow-blue-500/20">
                <FiSave className="mr-2" /> {saving ? 'Salvando...' : 'Salvar Fluxo'}
              </Button>
            </Panel>

            <Controls className="!bg-white dark:!bg-gray-800 border-gray-200 dark:border-gray-800 shadow-lg [&_button]:border-b [&_button]:border-gray-200 dark:[&_button]:border-gray-700 [&_button]:!bg-white dark:[&_button]:!bg-gray-800 [&_svg]:!fill-gray-600 dark:[&_svg]:!fill-gray-300 [&_svg]:!stroke-gray-600 dark:[&_svg]:!stroke-gray-300 [&_path]:!fill-gray-600 dark:[&_path]:!fill-gray-300 [&_path]:!stroke-gray-600 dark:[&_path]:!stroke-gray-300" />
            <Background color="#94a3b8" gap={20} size={1} className="opacity-30" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

