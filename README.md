# LiveChat Monorepo

Sistema completo de atendimento ao cliente com WhatsApp, chat ao vivo e automações.

## 🚀 Stack Tecnológico

### Backend
- Node.js 20 + TypeScript
- Express + Socket.io
- PostgreSQL (Supabase)
- Redis (cache e sessões)
- RabbitMQ (mensageria)
- WAHA (WhatsApp API)

### Frontend
- React 19
- Vite
- TailwindCSS 4
- Socket.io Client
- React Router DOM

### Onboarding
- React 19
- Aplicação separada para fluxo de cadastro

## 📁 Estrutura do Projeto

```
.
├── backend/          # API e Workers
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── frontend/         # Interface principal
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── onboarding/       # Interface de cadastro
│   ├── src/
│   └── package.json
├── docker-compose.prod.yml
├── package.json      # Monorepo root
└── DEPLOY.md         # Guia de deploy
```

## 🛠️ Desenvolvimento Local

### Pré-requisitos

- Node.js >= 20.11.0
- npm >= 9.0.0
- Docker e Docker Compose (para serviços)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/Rogerio-auto/livechat-monorepo.git
cd livechat-monorepo

# Instalar dependências (workspace aware)
npm install

# Configurar variáveis de ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.production

# Editar os arquivos .env com suas configurações
```

### Executar em Desenvolvimento

```bash
# Backend
npm run dev:backend

# Frontend
npm run dev:frontend

# Onboarding
npm run dev:onboarding

# Todos simultaneamente
npm run dev
```

### Build

```bash
# Build completo
npm run build

# Build individual
npm run build:backend
npm run build:frontend
npm run build:onboarding
```

## 🐳 Deploy com Docker

### Deploy Completo

```bash
# Build e start
docker-compose -f docker-compose.prod.yml up -d --build

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Parar
docker-compose -f docker-compose.prod.yml down
```

### Usando o Script de Deploy

```bash
# Tornar executável
chmod +x deploy.sh

# Build
./deploy.sh build

# Start
./deploy.sh start

# Update (pull + build + restart)
./deploy.sh update

# Logs
./deploy.sh logs
```

## 📦 Serviços Docker

- **api** (5000): Backend API
- **worker-inbound**: Processamento de mensagens recebidas
- **worker-outbound**: Envio de mensagens
- **worker-campaigns**: Processamento de campanhas
- **frontend** (3002): Interface web
- **redis** (6379): Cache
- **rabbitmq** (5672): Fila de mensagens

## 🔧 Comandos Úteis

```bash
# Limpar tudo
npm run clean

# Lint
npm run lint
npm run lint:fix

# Workers específicos
npm run worker:inbound
npm run worker:outbound
npm run worker:campaigns
```

## 📝 Variáveis de Ambiente

### Backend (.env)

- `NODE_ENV`: Ambiente (production/development)
- `PORT`: Porta do servidor (5000)
- `SUPABASE_URL`: URL do Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `REDIS_URL`: URL do Redis
- `RABBITMQ_URL`: URL do RabbitMQ
- `WAHA_URL`: URL da API WAHA

### Frontend (.env.production)

- `VITE_API_URL`: URL da API backend
- `VITE_SOCKET_URL`: URL do Socket.io
- `VITE_SUPABASE_URL`: URL do Supabase
- `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase

## 🚀 Deploy na VPS

Consulte o arquivo [DEPLOY.md](./DEPLOY.md) para instruções completas de deploy.

### Quick Start VPS

```bash
# 1. Clone na VPS
git clone https://github.com/Rogerio-auto/livechat-monorepo.git
cd livechat-monorepo

# 2. Configure .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.production
nano backend/.env
nano frontend/.env.production

# 3. Deploy
./deploy.sh build
./deploy.sh start
```

## 🔒 Segurança

- ⚠️ **NUNCA** commite arquivos `.env` com valores reais
- Use `.env.example` como template
- Configure firewall na VPS
- Use HTTPS em produção
- Mantenha dependências atualizadas

## 🐛 Troubleshooting

### Build falha na VPS

```bash
# Limpar cache do Docker
docker system prune -a -f
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Erro de módulo não encontrado

```bash
# Reinstalar dependências
rm -rf node_modules backend/node_modules frontend/node_modules
npm install
```

### Worker não processa mensagens

```bash
# Verificar logs do worker
docker-compose -f docker-compose.prod.yml logs -f worker-inbound

# Verificar RabbitMQ
docker-compose -f docker-compose.prod.yml exec rabbitmq rabbitmqctl list_queues
```

## 📚 Documentação Adicional

- [DEPLOY.md](./DEPLOY.md) - Guia completo de deploy
- [backend/README.md](./backend/README.md) - Documentação do backend
- [frontend/README.md](./frontend/README.md) - Documentação do frontend

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é privado.

## 👥 Autores

- Rogério - [Rogerio-auto](https://github.com/Rogerio-auto)

## 🙏 Agradecimentos

- Supabase
- WAHA WhatsApp API
- React + Vite
- TailwindCSS
