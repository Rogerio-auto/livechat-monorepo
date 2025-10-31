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
2. Ajuste `docker-compose.prod.yml` com sua registry (ou use as imagens locais padrão).
3. Faça build e suba os serviços:
   ```bash
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d
   ```
4. Volumes persistem Redis e RabbitMQ (`redis-data`, `rabbitmq-data`).

### Expondo via Nginx (sem Traefik)
O compose publica:
- API em `localhost:5000`
- Frontend (Nginx dentro do container) em `localhost:4173`

No host aponte os domínios para esses ports. Exemplo `/etc/nginx/sites-available/app.7sion.com.conf`:
```nginx
server {
    listen 80;
    server_name app.7sion.com;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api-back.7sion.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Habilite os blocos, teste com `nginx -t` e faça reload (`systemctl reload nginx`). Para HTTPS, envolva cada bloco com `listen 443 ssl` + certificados (Let’s Encrypt etc.). O Nginx existente da WAHA pode compartilhar a pasta `sites-enabled` usando blocos separados.

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
- Certifique-se de rodar `npm run build:backend` apos qualquer alteracao TS para publicar novo `dist`.
- Ajuste CORS (`FRONTEND_ORIGIN`) quando publicar novos dominios.
- Em caso de erro nos workers, verifique filas mortas (`RABBIT_Q_OUTBOUND_DLQ`).

## Telemetria de Mensagens
Os workers e o frontend geram logs estruturados com a chave `durationMs` para acompanhar o tempo de processamento ponta a ponta:
- `[metrics][ui]` mede do clique de envio ate a confirmacao via socket na interface.
- `[metrics][api]` mostra o tempo que a rota `POST /livechat/messages` levou para persistir a mensagem e acionar a fila.
- `[metrics][worker]` cobre as etapas internas dos workers (`inbound`, `inboundMedia`, `outbound`) incluindo `chatId`/`externalId` quando disponiveis.
Use esses registros para identificar gargalos sem depender de ferramentas externas.
