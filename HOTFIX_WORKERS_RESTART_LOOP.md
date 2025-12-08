# 🚨 HOTFIX: Workers Inbound/Outbound em Loop de Restart

## 📋 Sintomas do Problema

```
[SingleInstance] ❌ Outra instância do worker já está rodando: 1-1765200217357
[SingleInstance] ❌ Esta instância (PID 1) será encerrada em 3 segundos...
worker-inbound-1 exited with code 1 (restarting)
worker-outbound-1 exited with code 1 (restarting)
```

- **Mensagens acumuladas**: 161 mensagens na fila `q.inbound.message`
- **0 consumidores**: Nenhum worker processando
- **RabbitMQ connections**: Abrem e fecham a cada 3 segundos
- **Workers**: Loop infinito de restart

## 🔍 Causa Raiz

O sistema `SingleInstance` usava **UMA única chave Redis** para TODOS os workers:

```typescript
const INSTANCE_KEY = "worker:instance:lock"; // ❌ COMPARTILHADA!
```

**Problema:**
1. `worker-media` inicia primeiro → consegue o lock ✅
2. `worker-inbound` tenta iniciar → detecta lock existente → **SE MATA** ❌
3. `worker-outbound` tenta iniciar → detecta lock existente → **SE MATA** ❌
4. Docker reinicia automaticamente → **LOOP INFINITO**

## ✅ Solução Implementada

Cada tipo de worker agora tem sua **própria chave Redis**:

```typescript
// ANTES (compartilhada)
const INSTANCE_KEY = "worker:instance:lock";

// DEPOIS (isolada por tipo)
const INSTANCE_KEY = `worker:instance:lock:${workerType}`;
```

**Locks criados:**
- `worker:instance:lock:inbound` → worker-inbound
- `worker:instance:lock:outbound` → worker-outbound  
- `worker:instance:lock:inbound-media` → worker-media

## 🛠️ Como Aplicar o Hotfix

### Opção 1: Script Automático (Recomendado)

```bash
cd ~/livechat-monorepo
chmod +x fix-workers-hotfix.sh
./fix-workers-hotfix.sh
```

### Opção 2: Passo a Passo Manual

```bash
cd ~/livechat-monorepo

# 1. Limpar locks antigos
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock:inbound
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock:outbound
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock:inbound-media

# 2. Rebuild backend (com código corrigido)
docker compose -f docker-compose.prod.yml build worker-inbound worker-outbound worker-media --no-cache

# 3. Reiniciar workers
docker compose -f docker-compose.prod.yml restart worker-inbound worker-outbound worker-media

# 4. Verificar status
docker compose -f docker-compose.prod.yml ps

# 5. Monitorar logs
docker compose -f docker-compose.prod.yml logs -f worker-inbound worker-outbound worker-media
```

## ✅ Como Validar a Correção

**Logs esperados (sucesso):**

```
worker-inbound-1   | [SingleInstance][inbound] ✅ Worker registrado: PID 1
worker-inbound-1   | [worker][inbound#1] starting (prefetch=5)
worker-inbound-1   | [worker][inbound#2] starting (prefetch=5)
worker-inbound-1   | [worker][inbound#1] listening on: q.inbound.message
worker-inbound-1   | [worker][inbound#2] listening on: q.inbound.message

worker-outbound-1  | [SingleInstance][outbound] ✅ Worker registrado: PID 1
worker-outbound-1  | [worker][outbound#1] starting (prefetch=5)
worker-outbound-1  | [worker][outbound#2] starting (prefetch=5)
worker-outbound-1  | [worker][outbound#1] listening on: q.outbound.request
worker-outbound-1  | [worker][outbound#2] listening on: q.outbound.request

worker-media-1     | [SingleInstance][inbound-media] ✅ Worker registrado: PID 1
worker-media-1     | [worker][media#1] starting (prefetch=5)
worker-media-1     | [worker][media#2] starting (prefetch=5)
```

**Indicadores de sucesso:**
- ✅ Nenhum `exit code 1` ou restart loop
- ✅ Workers mostram `✅ Worker registrado`
- ✅ Consumers conectados às filas
- ✅ Mensagens sendo processadas (`depth` diminuindo)

## 📊 Verificar Filas do RabbitMQ

```bash
# Ver status das filas
docker exec livechat-monorepo-rabbitmq-1 rabbitmqctl list_queues name messages consumers

# Resultado esperado:
# q.inbound.message    0-5     2-4  (consumers > 0)
# q.outbound.request   0       2-4  (consumers > 0)
# q.inbound.media      0       2-4  (consumers > 0)
```

## 🔄 Verificar Locks no Redis

```bash
# Listar todas as chaves de lock
docker exec livechat-monorepo-redis-1 redis-cli KEYS "worker:instance:lock:*"

# Resultado esperado:
# 1) "worker:instance:lock:inbound"
# 2) "worker:instance:lock:outbound"
# 3) "worker:instance:lock:inbound-media"
```

## 📝 Arquivos Modificados

1. **backend/src/lib/singleInstance.ts**
   - Adiciona parâmetro `workerType` à função
   - Muda chave para `worker:instance:lock:${workerType}`
   - Adiciona logs com tipo do worker

2. **backend/src/worker.ts**
   - Move `ensureSingleWorkerInstance()` para DEPOIS de determinar `target`
   - Passa `target` como parâmetro: `ensureSingleWorkerInstance(target)`

## 🚀 Rollback (Se Necessário)

Se algo der errado, reverter para versão anterior:

```bash
cd ~/livechat-monorepo
git log --oneline -5  # Ver últimos commits
git revert <commit-hash>  # Reverter commit do hotfix
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml restart worker-inbound worker-outbound worker-media
```

## ⏱️ Tempo Estimado

- Limpeza Redis: 5 segundos
- Rebuild containers: 2-3 minutos
- Restart workers: 10 segundos
- Validação: 30 segundos

**Total: ~4 minutos de downtime dos workers**

## 📞 Suporte

Se os workers continuarem em loop após aplicar o hotfix:
1. Verificar logs: `docker compose -f docker-compose.prod.yml logs --tail=50 worker-inbound`
2. Verificar Redis: `docker exec livechat-monorepo-redis-1 redis-cli PING`
3. Verificar RabbitMQ: `docker exec livechat-monorepo-rabbitmq-1 rabbitmqctl status`

---

**Data do Hotfix:** 2025-12-08  
**Issue:** Workers em loop infinito de restart  
**Resolução:** Locks Redis isolados por tipo de worker
