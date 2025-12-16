import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export const SubscriptionSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      navigate('/subscription');
    }
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center border border-gray-700">
        <div className="flex justify-center mb-6">
          <div className="bg-green-500/20 p-4 rounded-full">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-4">Pagamento Confirmado!</h1>
        
        <p className="text-gray-300 mb-8">
          Sua assinatura foi atualizada com sucesso. Você já pode aproveitar todos os benefícios do seu novo plano.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Ir para o Dashboard
          </button>
          
          <button
            onClick={() => navigate('/subscription')}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Ver Detalhes da Assinatura
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccessPage;
