import { useState } from 'react';
import { Bell, Volume2, VolumeX, Download } from 'lucide-react';

const SOUND_TYPES = ['default', 'success', 'warning', 'error', 'message', 'urgent'];

type NotificationType = 
  | 'CHAT_MESSAGE'
  | 'NEW_LEAD' 
  | 'PROPOSAL_ACCEPTED'
  | 'TASK_OVERDUE'
  | 'CAMPAIGN_COMPLETED'
  | 'PAYMENT_RECEIVED'
  | 'SYSTEM_ALERT';

interface TestNotification {
  title: string;
  message: string;
  type: NotificationType;
  category: string;
}

const EXAMPLE_NOTIFICATIONS: TestNotification[] = [
  {
    title: '💬 Nova mensagem',
    message: 'João Silva: Olá! Preciso de ajuda',
    type: 'CHAT_MESSAGE',
    category: 'chat',
  },
  {
    title: '🎯 Novo Lead',
    message: 'Lead capturado: Maria Santos - Interesse em produto X',
    type: 'NEW_LEAD',
    category: 'lead',
  },
  {
    title: '🎉 Proposta Aceita',
    message: 'Cliente ABC aceitou a proposta #1234',
    type: 'PROPOSAL_ACCEPTED',
    category: 'proposal',
  },
  {
    title: '⚠️ Tarefa Atrasada',
    message: 'A tarefa "Ligar para cliente" está 2 dias atrasada',
    type: 'TASK_OVERDUE',
    category: 'task',
  },
  {
    title: '📢 Campanha Finalizada',
    message: 'Campanha "Black Friday" enviada para 1.500 contatos',
    type: 'CAMPAIGN_COMPLETED',
    category: 'campaign',
  },
  {
    title: '💰 Pagamento Recebido',
    message: 'Pagamento de R$ 2.500,00 confirmado',
    type: 'PAYMENT_RECEIVED',
    category: 'payment',
  },
  {
    title: '🚨 Alerta do Sistema',
    message: 'Servidor com alta utilização de CPU (95%)',
    type: 'SYSTEM_ALERT',
    category: 'system',
  },
];

export function NotificationTestPage() {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [testingSound, setTestingSound] = useState<string | null>(null);

  const testSound = (soundType: string) => {
    setTestingSound(soundType);
    const audio = new Audio(`/sounds/notification-${soundType}.mp3`);
    audio.play().catch(err => {
      alert(`Erro ao reproduzir som: ${err.message}\nVerifique se o arquivo /sounds/notification-${soundType}.mp3 existe`);
    }).finally(() => {
      setTimeout(() => setTestingSound(null), 1000);
    });
  };

  const sendTestNotification = async (example: typeof EXAMPLE_NOTIFICATIONS[0]) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
      
      const res = await fetch(`${API_URL}/api/notifications`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: example.title,
          message: example.message,
          type: example.type,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao criar notificação');
      }

      alert('✅ Notificação enviada! Verifique o sino no canto superior.');
    } catch (error: any) {
      alert(`❌ Erro: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                🔔 Central de Testes - Notificações
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Teste o sistema de notificações em tempo real
              </p>
            </div>

            <button
              onClick={() => setSoundsEnabled(!soundsEnabled)}
              className={`p-3 rounded-lg ${
                soundsEnabled 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
              }`}
            >
              {soundsEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
          </div>

          {/* Seção: Download dos Sons */}
          <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-4">
              <Download className="text-blue-600 dark:text-blue-400 shrink-0 mt-1" size={24} />
              <div className="flex-1">
                <h2 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                  📥 Baixar Arquivos de Som
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Para o sistema funcionar, você precisa baixar os arquivos de som e colocá-los em{' '}
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    frontend/public/sounds/
                  </code>
                </p>
                
                <div className="space-y-2">
                  <p className="font-medium text-gray-900 dark:text-white">Fontes recomendadas:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                    <li>
                      <a href="https://www.zapsplat.com/sound-effect-categories/notification-sounds/" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="text-blue-600 hover:underline">
                        Zapsplat - Notification Sounds
                      </a>
                    </li>
                    <li>
                      <a href="https://freesound.org/search/?q=notification" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="text-blue-600 hover:underline">
                        Freesound - Notifications
                      </a>
                    </li>
                    <li>
                      <a href="https://mixkit.co/free-sound-effects/notification/" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="text-blue-600 hover:underline">
                        Mixkit - Notification Effects
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Testar Sons */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🎵 Testar Sons
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SOUND_TYPES.map(soundType => (
                <button
                  key={soundType}
                  onClick={() => testSound(soundType)}
                  disabled={testingSound === soundType}
                  className={`p-4 rounded-lg border-2 font-medium transition-all ${
                    testingSound === soundType
                      ? 'bg-blue-500 text-white border-blue-600 scale-95'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {testingSound === soundType ? '🔊 Tocando...' : `🔔 ${soundType}`}
                </button>
              ))}
            </div>
          </div>

          {/* Seção: Notificações de Exemplo */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📬 Enviar Notificação de Teste
            </h2>
            <div className="grid gap-4">
              {EXAMPLE_NOTIFICATIONS.map((example, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {example.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {example.message}
                    </p>
                    <span className="inline-block mt-2 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                      {example.type} · {example.category}
                    </span>
                  </div>
                  <button
                    onClick={() => sendTestNotification(example)}
                    className="ml-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Bell size={16} />
                    Enviar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              💡 <strong>Dica:</strong> Abra o DevTools (F12) para ver os logs de WebSocket e notificações
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
