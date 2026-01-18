// frontend/src/pages/Admin/Templates/TemplateTester.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPlay, FiArrowLeft, FiCheckCircle, FiXCircle, FiClock, FiDatabase, FiSend, FiTrash2, FiUser, FiCpu, FiTerminal, FiChevronRight, FiBox, FiInfo } from 'react-icons/fi';
import { api } from '@/lib/api';
import { showToast } from '../../../hooks/useToast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  steps?: any[];
}

export default function TemplateTester() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [template, setTemplate] = useState<any>(null);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeLogs, setActiveLogs] = useState<any[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchData();
    }
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchData = async () => {
    try {
      const [tempRes, scenRes] = await Promise.all([
        api.get(`/api/admin/templates/${id}`),
        api.get('/api/admin/templates/scenarios')
      ]);
      setTemplate(tempRes.data);
      setScenarios(scenRes.data);
      if (scenRes.data.length > 0) {
        setSelectedScenario(scenRes.data[0]);
      }
    } catch (error) {
      showToast('Erro ao carregar dados do teste', 'error');
    }
  };

  const runTest = async () => {
    if (!selectedScenario) return showToast('Selecione um cenário', 'warning');
    
    try {
      setTesting(true);
      setTestResult(null);
      const response = await api.post(`/api/admin/templates/${id}/test`, {
        scenarioId: selectedScenario.id
      });
      setTestResult(response.data);
      
      // Adicionar ao chat para visualização
      const assistantMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.data.results?.output || 'Sem resposta do agente.',
        timestamp: new Date(),
        steps: response.data.steps || []
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      showToast('Teste concluído!', 'success');
    } catch (error) {
      showToast('Erro ao executar teste', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Usar o endpoint de teste mas com mensagem customizada
      const res = await api.post(`/api/admin/templates/${id}/test`, {
        message: input
      });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.results?.output || 'Sem resposta do agente.',
        timestamp: new Date(),
        steps: res.data.steps || []
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      if (res.data.steps) setActiveLogs(res.data.steps);
    } catch (error) {
      console.error('Erro no playground:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Erro ao processar mensagem.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setTestResult(null);
    setActiveLogs(null);
  };

  if (!template) return <div className="p-10 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/templates')}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition"
          >
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Testar Template: {template.name}</h1>
            <p className="text-slate-400">Valide o comportamento do agente v{template.version} contra cenários reais.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-bold uppercase">
            {template.model_config.model}
          </div>
          <div className="px-3 py-1 bg-slate-800 border border-white/5 rounded-full text-slate-400 text-xs font-bold uppercase">
            v{template.version}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Cenários e Instruções */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiDatabase className="text-indigo-400" /> Cenários de Teste
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {scenarios.map(scen => (
                <div
                  key={scen.id}
                  onClick={() => setSelectedScenario(scen)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedScenario?.id === scen.id 
                      ? 'bg-indigo-500/10 border-indigo-500/50 text-white' 
                      : 'bg-slate-950 border-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-medium text-sm">{scen.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">
                    {scen.category}
                  </div>
                </div>
              ))}
            </div>
            
            {selectedScenario && (
              <div className="bg-slate-950 border border-white/5 rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Input do Cenário</label>
                  <div className="text-sm text-white mt-1 bg-slate-900 p-2 rounded border border-white/5">
                    {typeof selectedScenario.input_data === 'string' ? selectedScenario.input_data : (selectedScenario.input_data?.message || JSON.stringify(selectedScenario.input_data))}
                  </div>
                </div>

                {/* Variáveis do Wizard no Cenário */}
                {selectedScenario.input_data && typeof selectedScenario.input_data === 'object' && Object.keys(selectedScenario.input_data).length > (selectedScenario.input_data?.message ? 1 : 0) && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Variáveis do Wizard</label>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(selectedScenario.input_data).map(([key, value]) => (
                        key !== 'message' && (
                          <div key={key} className="flex items-center justify-between bg-slate-900/50 px-2 py-1 rounded border border-white/5">
                            <span className="text-[10px] text-indigo-400 font-mono">{key}</span>
                            <span className="text-[10px] text-slate-300 truncate max-w-[150px]">{String(value)}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Resultado Esperado</label>
                  <div className="text-xs text-slate-400 mt-1 italic">
                    {selectedScenario.expected_output}
                  </div>
                </div>
                <button
                  onClick={runTest}
                  disabled={testing}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition font-bold text-sm"
                >
                  {testing ? <FiClock className="animate-spin" /> : <FiPlay />}
                  {testing ? 'EXECUTANDO...' : 'EXECUTAR CENÁRIO'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiInfo className="text-indigo-400" /> System Prompt
            </h2>
            <div className="p-4 bg-slate-950 rounded-lg border border-white/5 max-h-[300px] overflow-y-auto">
              <div className="prose prose-invert prose-sm max-w-none wrap-break-word">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {template.system_prompt || 'Nenhuma instrução definida.'}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Métricas do Último Teste */}
          {testResult && (
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FiTerminal className="text-emerald-400" /> Métricas do Teste
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase">Tokens</div>
                  <div className="text-lg font-bold text-white">{testResult.metrics?.tokens_used || 0}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase">Latência</div>
                  <div className="text-lg font-bold text-white">{testResult.metrics?.latency || 0}ms</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-white/5 col-span-2">
                  <div className="text-[10px] text-slate-500 uppercase">Status</div>
                  <div className={`text-sm font-bold mt-1 flex items-center gap-2 ${testResult.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.status === 'success' ? <FiCheckCircle /> : <FiXCircle />}
                    {testResult.status === 'success' ? 'SUCESSO' : 'FALHA'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coluna Direita: Playground (Chat) */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/50 border border-white/10 rounded-xl flex flex-col h-[700px] overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <h3 className="font-semibold text-white">Playground de Teste</h3>
              </div>
              <button
                onClick={clearChat}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                title="Limpar conversa"
              >
                <FiTrash2 size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950/30"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <div className="p-4 bg-slate-900 rounded-full">
                    <FiCpu size={40} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Inicie uma conversa</p>
                    <p className="text-sm text-slate-400">Teste o comportamento do template em tempo real.</p>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-800 border border-white/10'
                    }`}>
                      {msg.role === 'user' ? <FiUser size={16} className="text-white" /> : <FiCpu size={16} className="text-indigo-400" />}
                    </div>
                    <div className={`space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-4 rounded-xl text-sm leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-slate-900 border border-white/10 text-slate-200 rounded-tl-none'
                      }`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      <span className="text-[10px] text-slate-500 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center">
                      <FiCpu size={16} className="text-indigo-400 animate-pulse" />
                    </div>
                    <div className="bg-slate-900 border border-white/10 p-4 rounded-xl rounded-tl-none">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900/50 border-t border-white/10">
              <div className="relative">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Digite sua mensagem para testar..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-white text-sm outline-none focus:border-indigo-500 transition resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition"
                >
                  <FiSend size={18} />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                Pressione Enter para enviar. Shift + Enter para nova linha.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

