# Correção do Erro 401 - CORS em Produção

## 🔴 Problema Identificado

O erro `401 Unauthorized` e respostas HTML ao invés de JSON acontecia porque:

1. **CORS estava bloqueando requisições**: O backend estava configurado com `FRONTEND_ORIGIN=http://localhost:3000` apenas
2. **Cookies não estavam sendo enviados**: Requisições cross-origin precisam de CORS configurado corretamente
3. **JWT_COOKIE_SECURE estava false**: Em produção com HTTPS, precisa ser `true`

## ✅ Solução Implementada

### 1. Criado `.env.production` para o Backend

```bash
# No VPS, criar o arquivo:
cd ~/sistem-livechat/app/backend
nano .env.production
```

**Configurações principais alteradas:**

```env
# CORS - Permitir origens dos frontends em produção
FRONTEND_ORIGIN=https://app.7sion.com,https://account.7sion.com

# Cookie seguro em HTTPS
JWT_COOKIE_SECURE=true

# URLs de produção
BACKEND_BASE_URL=https://api-back.7sion.com
MEDIA_PUBLIC_BASE=https://api-back.7sion.com/media

# Serviços internos do Docker (não usar localhost)
RABBIT_URL="amqp://app:app@rabbitmq:5672?heartbeat=30"
REDIS_URL=redis://:changeme@redis:6379/0
```

### 2. Atualizado docker-compose.prod.yml

Todos os serviços do backend agora usam `.env.production`:

```yaml
services:
  api:
    env_file:
      - ./backend/.env.production  # ✅ Era ./backend/.env

  worker-inbound:
    env_file:
      - ./backend/.env.production  # ✅ Era ./backend/.env

  worker-outbound:
    env_file:
      - ./backend/.env.production  # ✅ Era ./backend/.env

  worker-campaigns:
    env_file:
      - ./backend/.env.production  # ✅ Era ./backend/.env
```

## 📝 Setup no VPS

### Passo 1: Criar arquivo de produção

```bash
cd ~/sistem-livechat/app
git pull origin main

# Copiar exemplo e editar com valores reais
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
```

**⚠️ IMPORTANTE**: Substitua os valores de exemplo pelos reais:
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_VERIFY_TOKEN`
- `META_APP_SECRET`
- `ENCRYPTION_KEY`
- `PGPASSWORD`
- `WAHA_WEBHOOK_TOKEN`
- `WAHA_WEBHOOK_SECRET`
- `WAHA_API_KEY`
- `WAHA_DB_PASSWORD`
- `SESSION_SECRET`

### Passo 2: Rebuild dos serviços

```bash
cd ~/sistem-livechat/app

# Parar todos os serviços do backend
docker-compose -f docker-compose.prod.yml down api worker-inbound worker-outbound worker-campaigns

# Rebuild sem cache
docker-compose -f docker-compose.prod.yml build --no-cache api worker-inbound worker-outbound worker-campaigns

# Iniciar serviços
docker-compose -f docker-compose.prod.yml up -d api worker-inbound worker-outbound worker-campaigns
```

### Passo 3: Verificar logs

```bash
# Ver logs do API
docker-compose -f docker-compose.prod.yml logs -f api

# Verificar se CORS está correto
curl -I -H "Origin: https://app.7sion.com" https://api-back.7sion.com/auth/me
```

## 🧪 Como Testar

1. **Abrir DevTools no navegador** (F12)
2. **Ir para https://app.7sion.com**
3. **Verificar Network tab**:
   - `/auth/me` deve retornar 200 ou 401 válido (JSON)
   - Headers devem incluir `Access-Control-Allow-Origin: https://app.7sion.com`
   - Cookies `sb_access_token` devem ser enviados

## 🔍 Verificação de CORS

O backend agora aceita requisições de:
- `https://app.7sion.com` (frontend principal)
- `https://account.7sion.com` (onboarding)

E retorna headers corretos:
```
Access-Control-Allow-Origin: https://app.7sion.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## ⚠️ Segurança

**Arquivos com credenciais sensíveis** (não devem ir pro Git):
- `backend/.env.production` ✅ Ignorado pelo .gitignore
- `backend/.env` ✅ Ignorado pelo .gitignore
- `frontend/.env.production` ✅ Ignorado pelo .gitignore (mas já commitado antes)

**Arquivo de exemplo** (pode ir pro Git):
- `backend/.env.production.example` ✅ Sem valores reais

## 📊 Status Esperado

Após o deploy:

✅ `https://api-back.7sion.com/auth/me` → Retorna JSON (200 com dados ou 401 válido)  
✅ `https://app.7sion.com` → Carrega sidebar com plano do usuário  
✅ Console do navegador → Sem erros de CORS  
✅ Network tab → Cookies sendo enviados com requisições  

## 🚨 Troubleshooting

### Ainda aparece erro 401?
```bash
# Verificar se .env.production existe
ls -la ~/sistem-livechat/app/backend/.env.production

# Verificar conteúdo (sem expor senhas)
grep "FRONTEND_ORIGIN" ~/sistem-livechat/app/backend/.env.production
```

### Resposta HTML ao invés de JSON?
- Nginx pode estar retornando página de erro
- Verificar se serviço `api` está rodando: `docker-compose -f docker-compose.prod.yml ps api`
- Ver logs: `docker-compose -f docker-compose.prod.yml logs api`

### Cookies não estão sendo enviados?
- Verificar `JWT_COOKIE_SECURE=true` em `.env.production`
- Certificar que domínios têm HTTPS configurado
- Limpar cookies do navegador e fazer login novamente
