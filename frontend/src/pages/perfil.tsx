import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiPhone, FiCheck, FiAlertCircle } from 'react-icons/fi';

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

export default function PerfilPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const requiresPhone = location.state?.requiresPhone || false;
  
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const formatPhone = (value: string) => {
    // Remove tudo exceto números
    const cleaned = value.replace(/\D/g, '');
    
    // Limitar a 13 dígitos (55 + 11 + 9 dígitos)
    const limited = cleaned.slice(0, 13);
    
    // Formatar: +55 (11) 99999-9999
    if (limited.length === 0) return '';
    if (limited.length <= 2) return `+${limited}`;
    if (limited.length <= 4) return `+${limited.slice(0, 2)} (${limited.slice(2)}`;
    if (limited.length <= 6) return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4)}`;
    if (limited.length <= 10) return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4)}`;
    return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4, 9)}-${limited.slice(9)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || phone.trim().length < 10) {
      setError('Por favor, insira um telefone válido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/auth/me/phone`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, '') })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atualizar telefone');
      }

      setSuccess(true);
      
      // Cache foi invalidado no backend, forçar reload para buscar dados atualizados
      // Aguardar 800ms para mostrar mensagem de sucesso ao usuário
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar telefone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen livechat-theme flex items-center justify-center p-4">
      <div className="max-w-md w-full livechat-card rounded-[28px] shadow-[0_32px_90px_-60px_rgba(8,12,20,0.85)] backdrop-blur-sm p-8">
        {requiresPhone && (
          <div className="mb-6 p-4 livechat-muted-surface rounded-xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <FiAlertCircle className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Configuração obrigatória
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                  Para acessar o sistema, você precisa cadastrar seu telefone.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 livechat-muted-surface rounded-full mb-4">
            <FiPhone className="text-emerald-600 dark:text-emerald-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Configure seu perfil
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Precisamos do seu telefone para contato
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Telefone <span className="text-red-500">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+55 (11) 99999-9999"
              required
              disabled={loading || success}
              className="w-full px-4 py-3 rounded-xl livechat-muted-surface backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Digite seu telefone com DDD (ex: +55 11 99999-9999)
            </p>
          </div>

          {error && (
            <div className="p-3 livechat-muted-surface rounded-xl backdrop-blur-sm border-l-4 border-red-500">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 livechat-muted-surface rounded-xl backdrop-blur-sm border-l-4 border-emerald-500 flex items-center gap-2">
              <FiCheck className="text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                Telefone atualizado com sucesso! Redirecionando...
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success || !phone}
            className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Salvando...' : success ? 'Salvo!' : 'Salvar e continuar'}
          </button>

          {!requiresPhone && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
              className="w-full px-4 py-3 livechat-muted-surface backdrop-blur-sm text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:scale-[1.02] transition-all disabled:cursor-not-allowed"
            >
              Voltar
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
