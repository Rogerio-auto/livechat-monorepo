import jwt from 'jsonwebtoken';
import { SUPABASE_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY } from '../config/env';

export function generateAgentToken(agentId: string): string {
  // Tenta usar o segredo JWT específico, senão fallback para a chave de serviço (comum em dev)
  const secret = SUPABASE_JWT_SECRET || SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    const msg = "Erro de Configuração: SUPABASE_JWT_SECRET não está definido no arquivo .env. Adicione esta chave para gerar tokens.";
    console.error(`❌ ${msg}`);
    throw new Error(msg);
  }
  
  const payload = {
    aud: 'authenticated',
    role: 'authenticated',
    sub: agentId,
    app_metadata: {
      provider: 'agent_service_account',
      agent_id: agentId
    },
    user_metadata: {
      is_agent: true,
      name: `Agent ${agentId}`
    },
    // 10 years expiration
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365 * 10) 
  };

  return jwt.sign(payload, secret);
}
