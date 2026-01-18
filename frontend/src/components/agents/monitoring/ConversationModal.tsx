import React from 'react';
import { FiX, FiUser, FiCpu, FiClock } from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Message {
  id: string;
  content: string;
  is_from_customer: boolean;
  sender_name: string | null;
  created_at: string;
  type: string;
  media_url?: string;
}

interface ConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  customerName: string;
  messages: Message[];
  loading: boolean;
}

export function ConversationModal({ 
  isOpen, 
  onClose, 
  chatId, 
  customerName, 
  messages, 
  loading 
}: ConversationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Histórico: {customerName}
            </h3>
            <p className="text-xs text-gray-500 font-mono">ID: {chatId}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <FiX size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500">Carregando mensagens...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              Nenhuma mensagem encontrada nesta conversa.
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.is_from_customer ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[80%] flex flex-col ${msg.is_from_customer ? 'items-start' : 'items-end'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {msg.is_from_customer ? (
                      <>
                        <FiUser size={12} className="text-gray-400" />
                        <span className="text-[10px] font-medium text-gray-500 uppercase">{customerName}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-medium text-blue-500 uppercase">{msg.sender_name || 'Agente IA'}</span>
                        <FiCpu size={12} className="text-blue-400" />
                      </>
                    )}
                  </div>
                  
                  <div className={`
                    p-3 rounded-2xl text-sm shadow-sm
                    ${msg.is_from_customer 
                      ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-600' 
                      : 'bg-blue-600 text-white rounded-tr-none'
                    }
                  `}>
                    {msg.content}
                  </div>
                  
                  <div className="mt-1 flex items-center gap-1 px-1 text-[9px] text-gray-400 uppercase">
                    <FiClock size={10} />
                    {format(new Date(msg.created_at), "HH:mm '•' dd/MM", { locale: ptBR })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-center">
          <p className="text-xs text-gray-500">
            Este é um modo de apenas visualização do histórico.
          </p>
        </div>
      </div>
    </div>
  );
}
