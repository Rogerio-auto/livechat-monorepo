import { useState, useRef, useEffect } from 'react';
import { FiSend, FiTrash2, FiUser, FiCpu, FiTerminal, FiChevronRight, FiBox } from 'react-icons/fi';
import { Agent } from '@/types/agent';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  steps?: any[];
}

export function PlaygroundChat({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeLogs, setActiveLogs] = useState<any[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';
      const res = await fetch(`${API}/api/admin/agents/${agent.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao processar resposta do agente');
      
      const data = await res.json();
      
      let assistantContent = data.reply;
      
      if (data.skipped) {
        assistantContent = `⚠️ Agente ignorou a mensagem: ${data.reason || 'Motivo desconhecido'}`;
      } else if (!assistantContent) {
        assistantContent = 'O agente não retornou uma resposta. Verifique as configurações de modelo e prompt.';
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        steps: data.steps || []
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      if (data.steps) setActiveLogs(data.steps);
    } catch (error) {
      console.error('Erro no playground:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Verifique a integração com a OpenAI.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex gap-6 h-[600px]">
      {/* Chat Panel */}
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${activeLogs ? 'w-2/3' : 'w-full'}`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Playground de Teste</h3>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setActiveLogs(activeLogs ? null : messages[messages.length - 1].steps || [])}
                className={`p-2 rounded-lg transition-colors ${activeLogs ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                title="Ver logs de execução"
              >
                <FiTerminal />
              </button>
            )}
            <button
              onClick={clearChat}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Limpar chat"
            >
              <FiTrash2 />
            </button>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FiCpu size={32} />
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium mb-2">Inicie um teste</h4>
              <p className="text-gray-500 text-sm max-w-xs">
                Envie uma mensagem para ver como o agente {agent.name} responde com as configurações atuais.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {msg.role === 'user' ? <FiUser size={14} /> : <FiCpu size={14} />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className={`p-3 rounded-xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.steps && msg.steps.some(s => s.role === 'tool') && (
                      <button 
                        onClick={() => setActiveLogs(msg.steps || [])}
                        className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline mt-1"
                      >
                        <FiBox size={10} />
                        {msg.steps.filter(s => s.role === 'tool').length} ferramentas utilizadas
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <FiCpu size={14} className="text-gray-400" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl rounded-tl-none flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite sua mensagem de teste..."
              className="w-full pl-4 pr-12 py-3 bg-gray-100 dark:bg-gray-700 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiSend size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Logs Panel */}
      {activeLogs && (
        <div className="w-1/3 bg-gray-900 rounded-xl border border-gray-800 flex flex-col overflow-hidden shadow-xl animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
            <div className="flex items-center gap-2 text-gray-300">
              <FiTerminal className="text-blue-400" />
              <span className="text-sm font-mono font-semibold">Logs de Execução</span>
            </div>
            <button 
              onClick={() => setActiveLogs(null)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <FiChevronRight size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px]">
            {activeLogs.map((step, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                    step.role === 'assistant' ? 'bg-blue-900/40 text-blue-400' :
                    step.role === 'tool' ? 'bg-purple-900/40 text-purple-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {step.role}
                  </span>
                  {step.name && <span className="text-gray-300 font-bold">{step.name}</span>}
                </div>
                
                {step.tool_calls && step.tool_calls.map((tc: any, j: number) => (
                  <div key={j} className="ml-4 p-2 bg-gray-800/50 rounded border border-gray-800 text-gray-400">
                    <div className="text-blue-400 mb-1">call: {tc.function.name}</div>
                    <pre className="whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(JSON.parse(tc.function.arguments), null, 2)}
                    </pre>
                  </div>
                ))}

                {step.content && (
                  <div className={`ml-4 p-2 rounded border ${
                    step.role === 'tool' 
                      ? 'bg-purple-900/10 border-purple-900/30 text-purple-300/80' 
                      : 'bg-gray-800/30 border-gray-800 text-gray-400'
                  }`}>
                    <pre className="whitespace-pre-wrap overflow-x-auto">
                      {step.role === 'tool' ? (
                        (() => {
                          try {
                            return JSON.stringify(JSON.parse(step.content), null, 2);
                          } catch {
                            return step.content;
                          }
                        })()
                      ) : step.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

