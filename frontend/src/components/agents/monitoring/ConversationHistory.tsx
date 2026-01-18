// frontend/src/components/agents/monitoring/ConversationHistory.tsx
import { useState, useEffect } from 'react';
import { FiMessageSquare, FiUser, FiClock, FiChevronRight } from 'react-icons/fi';
import { api } from '@/lib/api';
import { ConversationModal } from './ConversationModal';

export function ConversationHistory({ agentId, limit }: { agentId: string; limit: number }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedChat, setSelectedChat] = useState<{ id: string, name: string } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await api.get(`/api/admin/agents/${agentId}/conversations`);
        setConversations(response.data.slice(0, limit));
      } catch (error) {
        console.error('Erro ao buscar histórico:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 60000);
    return () => clearInterval(interval);
  }, [agentId, limit]);

  const handleOpenConversation = async (chatId: string, customerName: string) => {
    setSelectedChat({ id: chatId, name: customerName });
    setLoadingMessages(true);
    setMessages([]);
    
    try {
      const response = await api.get(`/api/admin/agents/chats/${chatId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded"></div>)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[400px]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiMessageSquare className="text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Conversas Recentes</h3>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 p-4">
              <FiMessageSquare size={32} className="mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Nenhuma conversa encontrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {conversations.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleOpenConversation(chat.id, chat.customer_name)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <FiUser className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {chat.customer_name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          chat.status === 'OPEN' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {chat.status}
                        </span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <FiClock size={10} />
                          {new Date(chat.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <FiChevronRight className="text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConversationModal
        isOpen={!!selectedChat}
        onClose={() => setSelectedChat(null)}
        chatId={selectedChat?.id || ''}
        customerName={selectedChat?.name || ''}
        messages={messages}
        loading={loadingMessages}
      />
    </>
  );
}
