# Deploy Guide

## Requisitos
- Node.js 20 LTS ou superior (`node -v`)
- npm 9 ou superior
- Git
- PostgreSQL/Supabase com as tabelas/views exigidas
- Redis 6+ (cluster opcional)
- RabbitMQ 3.13+ (com plugin `management` para monitoramento)
- Domínio(s) configurados no proxy (Traefik/Nginx) para API e frontend

## Passo a passo (Bare Metal / VPS)
1. **Clonar o projeto**
   ```bash
   git clone <repo> && cd react-vite-taiwind
   ```
2. **Instalar dependências**
   ```bash
   npm install
   ```
3. **Configurar variáveis de ambiente**
   - Copie `backend/.env.example` para `backend/.env` e preencha as chaves.
   - Copie `frontend/.env.example` para `frontend/.env` (ou `.env.production` para build Docker).
   - Nunca comite arquivos `.env` com segredos reais.
4. **Gerar build de produção**
   ```bash
   npm run build:all
   ```
5. **Rodar localmente (verificação)**
   ```bash
   # API + preview estático
   npm run start:backend   # (abre http://localhost:5000)
   npm run preview --workspace frontend  # (abre http://localhost:4173)
   ```
6. **Trabalhadores**
   ```bash
   npm run worker:inbound
   npm run worker:outbound
   npm run worker:campaigns
   ```
   Recomenda-se gerenciar via PM2 (ver próximo item) ou systemd.

## PM2
1. Instalar globalmente (na VPS):
   ```bash
   npm install -g pm2
   ```
2. Fazer o build (se ainda não fez):
   ```bash
   npm run build:backend --workspace backend
   ```
3. Subir os processos:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup  # gera comando para iniciar com o sistema
   ```
4. Logs:
   ```bash
   pm2 logs livechat-api
   pm2 logs livechat-worker-inbound
   ```

## systemd (alternativa)
- Criar serviços que apontem para `node backend/dist/index.js`, `node backend/dist/worker.js inbound`, etc.
- Exemplo de serviço (API):
  ```
  [Unit]
  Description=Livechat API
  After=network.target

  [Service]
  WorkingDirectory=/opt/livechat/backend
  ExecStart=/usr/bin/node dist/index.js
  Restart=always
  Environment=NODE_ENV=production

  [Install]
  WantedBy=multi-user.target
  ```
- Repita para cada worker mudando `ExecStart`.

## Docker / Compose
1. Crie os arquivos de ambiente:
   - `backend/.env`
   - `frontend/.env.production`
2. Ajuste `docker-compose.prod.yml` com seus domínios/registry.
3. Build + deploy:
   ```bash
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d
   ```
4. Volumes persistem Redis e RabbitMQ (`redis-data`, `rabbitmq-data`).

## Checagens de saúde
- API: `curl http://localhost:5000/health`
- Redis: `curl http://localhost:5000/_debug/redis/ping`
- Workers: monitore filas no RabbitMQ (`http://localhost:15672`, user/pass em `.env`).
- Frontend: `npm run preview --workspace frontend` ou Traefik.

## Migrations / Supabase
- As tabelas/views utilizadas devem existir no Supabase. Use a interface SQL do Supabase ou scripts próprios.
- Variáveis em uso: `VIEW_USER_AGENDA`, `VIEW_EVENTS_WITH_PARTICIPANTS`, `TABLE_CALENDARS`, `TABLE_EVENTS`, `TABLE_EVENT_PARTICIPANTS`, `PRODUCTS_TABLE`.

## Reinício seguro dos workers
- PM2: `pm2 restart livechat-worker-outbound`
- systemd: `systemctl restart livechat-worker-outbound`
- Compose: `docker compose -f docker-compose.prod.yml restart worker-outbound`
  Nenhuma dessas ações derruba a API.

## Portas e protocolos
- API Express + Socket.IO: `:5000` (configurável via `PORT_BACKEND`)
- Frontend estático (Vite preview ou Nginx): `:4173` por padrão
- Socket.IO compartilha a porta da API
- Redis: `:6379`
- RabbitMQ: `:5672` (AMQP) e `:15672` painel

## Serviços externos / Secrets
- **Supabase**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Meta / WhatsApp**: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_GRAPH_VERSION`
- **WAHA**: `WAHA_BASE_URL`, `WAHA_API_KEY`, tokens/credenciais de webhook
- **RabbitMQ**: credenciais de usuário (produzidas manualmente ou usar variáveis do compose)
- **Redis**: senha via `REDIS_URL`

## CI/CD (GitHub Actions)
- Workflow em `.github/workflows/build.yml` executa:
  - Instalação com cache
  - `npm run build:all`
  - Upload de artefatos (`backend/dist`, `frontend/dist`)
- Configure secrets no repositório (Supabase, WAHA, RabbitMQ, etc.) caso expanda o pipeline para deploy.

## Troubleshooting
- Certifique-se de rodar `npm run build:backend` após qualquer alteração TS para publicar novo `dist`.
- Em caso de erro nos workers, verifique filas mortas (`RABBIT_Q_OUTBOUND_DLQ`).
- Ajuste CORS (`FRONTEND_ORIGIN`) quando publicar novos domínios.
