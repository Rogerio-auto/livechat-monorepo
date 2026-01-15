import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  Key, 
  Webhook, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle,
  Clock,
  ExternalLink,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface ApiKey {
  id: string;
  label: string;
  apiKey?: string; // Only returned once on creation
  createdAt: string;
  lastUsedAt?: string;
}

interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret: string;
  createdAt: string;
}

export default function DeveloperPage() {
  const { user } = useAuth();
  const DEVELOPER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISOR'];

  if (!user || !DEVELOPER_ROLES.includes(user.role || '')) {
    return <Navigate to="/configuracoes/empresa" replace />;
  }

  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks'>('keys');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['message.created']);
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);

  const availableEvents = [
    { id: 'message.created', label: 'Mensagem Recebida', description: 'Disparado quando uma nova mensagem é recebida.' },
    { id: 'message.sent', label: 'Mensagem Enviada', description: 'Disparado quando uma mensagem é enviada.' },
    { id: 'contact.created', label: 'Contato Criado', description: 'Disparado quando um novo contato é registrado.' },
    { id: 'contact.updated', label: 'Contato Atualizado', description: 'Disparado quando dados de um contato mudam.' },
    { id: 'ticket.created', label: 'Ticket Criado', description: 'Disparado quando um novo ticket (atendimento) é aberto.' },
    { id: 'ticket.updated', label: 'Ticket Atualizado', description: 'Disparado quando o status ou dados de um ticket mudam.' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [keysRes, hooksRes] = await Promise.all([
        api.get('/api/settings/api-keys'),
        api.get('/api/settings/webhooks')
      ]);
      setApiKeys(keysRes.data || []);
      setWebhooks(hooksRes.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching developer settings:', err);
      setError('Falha ao carregar configurações de desenvolvedor.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsCreatingKey(true);
    try {
      const res = await api.post('/api/settings/api-keys', { label: newKeyName });
      setGeneratedKey(res.data.api_key);
      setApiKeys([res.data, ...apiKeys]);
      setNewKeyName('');
    } catch (err) {
      alert('Erro ao criar chave de API');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta chave de API? Aplicações usando esta chave perderão o acesso imediatamente.')) return;

    try {
      await api.delete(`/api/settings/api-keys/${id}`);
      setApiKeys(apiKeys.filter(k => k.id !== id));
    } catch (err) {
      alert('Erro ao excluir chave');
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;

    setIsCreatingWebhook(true);
    try {
      const res = await api.post('/api/settings/webhooks', { 
        url: newWebhookUrl, 
        events: selectedEvents 
      });
      setWebhooks([res.data, ...webhooks]);
      setNewWebhookUrl('');
      setSelectedEvents(['message.created']);
      setShowWebhookModal(false);
    } catch (err) {
      alert('Erro ao criar webhook');
    } finally {
      setIsCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este webhook?')) return;

    try {
      await api.delete(`/api/settings/webhooks/${id}`);
      setWebhooks(webhooks.filter(w => w.id !== id));
    } catch (err) {
      alert('Erro ao remover webhook');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const toggleEvent = (eventId: string) => {
    if (selectedEvents.includes(eventId)) {
      setSelectedEvents(selectedEvents.filter(id => id !== eventId));
    } else {
      setSelectedEvents([...selectedEvents, eventId]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Shield className="text-blue-600" size={32} />
          Desenvolvedor
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Gerencie suas chaves de API e webhooks para integrar com sistemas externos.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-8">
        <button
          onClick={() => setActiveTab('keys')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'keys' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Key size={18} />
          Chaves de API
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'webhooks' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Webhook size={18} />
          Webhooks
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* API Keys Content */}
          {activeTab === 'keys' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-2">Criar Nova Chave</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Dê um nome à sua chave para identificá-la posteriormente.
                </p>
                
                <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Ex: Integração CRM"
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    disabled={isCreatingKey}
                  />
                  <button
                    type="submit"
                    disabled={isCreatingKey || !newKeyName.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Plus size={18} />
                    {isCreatingKey ? 'Gerando...' : 'Gerar Chave'}
                  </button>
                </form>

                {generatedKey && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-green-800 dark:text-green-400">Aqui está sua nova chave de API!</span>
                      <button 
                        onClick={() => setGeneratedKey(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        Fechar
                      </button>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-500 mb-3">
                      Copie e guarde esta chave em um lugar seguro. Por motivos de segurança, você não poderá vê-la novamente.
                    </p>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-white dark:bg-gray-950 p-3 rounded border border-green-200 dark:border-green-900 font-mono text-sm break-all">
                        {generatedKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedKey)}
                        className="px-4 bg-white dark:bg-gray-950 border border-green-200 dark:border-green-900 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                      >
                        {copiedKey ? <Check className="text-green-600" size={20} /> : <Copy className="text-gray-500" size={20} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Criada em</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Último Uso</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {apiKeys.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          Nenhuma chave de API gerada até o momento.
                        </td>
                      </tr>
                    ) : (
                      apiKeys.map((key) => (
                        <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{key.label}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(key.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('pt-BR') : 'Nunca usada'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteKey(key.id)}
                              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              title="Revogar Chave"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Webhooks Content */}
          {activeTab === 'webhooks' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Webhooks</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Inscreva-se em eventos para receber notificações em tempo real na sua aplicação.
                  </p>
                </div>
                <button
                  onClick={() => setShowWebhookModal(true)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  Adicionar Webhook
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {webhooks.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-500 dark:text-gray-400 shadow-sm">
                    Nenhum webhook configurado.
                  </div>
                ) : (
                  webhooks.map((hook) => (
                    <div key={hook.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-4">
                          <h3 className="font-mono text-sm text-blue-600 dark:text-blue-400 break-all mb-1">{hook.url}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Clock size={12} /> Criado em {new Date(hook.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteWebhook(hook.id)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Eventos</h4>
                        <div className="flex flex-wrap gap-2">
                          {hook.events.map(event => (
                            <span key={event} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                              {event}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="w-full sm:w-auto">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Assinatura Secreta (Secret)</h4>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-50 dark:bg-gray-950 px-2 py-1 border border-gray-200 dark:border-gray-800 rounded font-mono truncate max-w-[200px]">
                              {hook.secret}
                            </code>
                            <button
                              onClick={() => copyToClipboard(hook.secret)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                              title="Copiar Secret"
                            >
                              <Copy size={14} className="text-gray-400" />
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button className="flex-1 sm:flex-initial px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2">
                            <ExternalLink size={14} /> Testar Webhook
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-xl font-bold">Novo Webhook</h3>
              <button onClick={() => setShowWebhookModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateWebhook} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">URL de Destino</label>
                <input
                  type="url"
                  required
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://seu-servidor.com/webhook"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="mt-1.5 text-xs text-gray-500">A URL que receberá os payloads POST em formato JSON.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Eventos a Escutar</label>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {availableEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => toggleEvent(event.id)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedEvents.includes(event.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{event.label}</span>
                        {selectedEvents.includes(event.id) && <Check className="text-blue-600" size={16} />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{event.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowWebhookModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWebhook || !newWebhookUrl.trim() || selectedEvents.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCreatingWebhook ? 'Criando...' : 'Salvar Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
