import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { resolve } from 'path';

// Carregar variáveis de ambiente do arquivo .env na raiz
config({ path: resolve(__dirname, '../../.env') });

const SECRET = process.env.SUPABASE_JWT_SECRET;

if (!SECRET) {
  console.error("❌ Erro: SUPABASE_JWT_SECRET não encontrado no arquivo .env");
  console.error("Certifique-se de que o arquivo .env existe e contém a chave secreta do Supabase.");
  process.exit(1);
}

const agentId = process.argv[2];
const toolName = process.argv[3];

if (!agentId || !toolName) {
  console.log("\n⚠️  Uso incorreto.");
  console.log("Uso: npx tsx scripts/generate_agent_token.ts <AGENT_ID> <TOOL_NAME>");
  console.log("Exemplo: npx tsx scripts/generate_agent_token.ts 550e8400-e29b-41d4-a716-446655440000 minha-ferramenta-http\n");
  process.exit(1);
}

// Payload do Token
// Estamos criando um token que simula um usuário autenticado ('authenticated')
// O 'sub' (subject) será o ID do agente, permitindo rastrear quem fez a chamada.
const payload = {
  aud: 'authenticated',
  role: 'authenticated',
  sub: agentId, // O ID do agente atua como o 'user_id'
  app_metadata: {
    provider: 'agent_service_account',
    agent_id: agentId
  },
  user_metadata: {
    is_agent: true,
    name: `Agent ${agentId}`
  },
  // Expiração longa (ex: 10 anos) para não precisar renovar constantemente
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365 * 10) 
};

try {
  const token = jwt.sign(payload, SECRET);

  console.log("\n✅ Token JWT gerado com sucesso!");
  console.log("---------------------------------------------------");
  console.log(token);
  console.log("---------------------------------------------------");
  
  console.log("\n📋 Execute o comando SQL abaixo no Supabase para configurar este agente:");
  console.log("---------------------------------------------------");
  console.log(`
UPDATE agent_tools
SET overrides = jsonb_set(
    COALESCE(overrides, '{}'::jsonb),
    '{headers}',
    '{"Authorization": "Bearer ${token}", "Content-Type": "application/json"}'::jsonb
)
WHERE agent_id = '${agentId}' 
  AND tool_id = (SELECT id FROM tools_catalog WHERE name = '${toolName}');
  `);
  console.log("---------------------------------------------------");

} catch (error) {
  console.error("Erro ao gerar token:", error);
}
