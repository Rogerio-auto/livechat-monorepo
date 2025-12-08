#!/bin/bash
# Hotfix: Corrige workers inbound/outbound em loop de restart
# Problema: Todos os workers compartilhavam a mesma chave Redis de lock

set -e

echo "🔧 Hotfix: Corrigindo SingleInstance locks dos workers"
echo ""

cd ~/livechat-monorepo

# 1. Limpa locks antigos do Redis
echo "1️⃣ Limpando locks antigos do Redis..."
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock:all
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock:inbound
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock:outbound
docker exec livechat-monorepo-redis-1 redis-cli DEL worker:instance:lock:inbound-media
echo "✅ Locks limpos"
echo ""

# 2. Rebuild backend
echo "2️⃣ Fazendo rebuild do backend com correção..."
docker compose -f docker-compose.prod.yml build worker-inbound worker-outbound worker-media --no-cache
echo "✅ Backend rebuilded"
echo ""

# 3. Reinicia workers afetados
echo "3️⃣ Reiniciando workers..."
docker compose -f docker-compose.prod.yml restart worker-inbound worker-outbound worker-media
echo "✅ Workers reiniciados"
echo ""

# 4. Verifica status
echo "4️⃣ Verificando status dos workers..."
sleep 5
docker compose -f docker-compose.prod.yml ps worker-inbound worker-outbound worker-media
echo ""

# 5. Mostra logs para validar
echo "5️⃣ Últimas 20 linhas dos logs (CTRL+C para sair):"
docker compose -f docker-compose.prod.yml logs --tail=20 -f worker-inbound worker-outbound worker-media
