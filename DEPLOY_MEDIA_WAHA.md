# Instruções de Deploy - Sistema de Mídia WAHA

## Opção 1: WAHA e Backend no mesmo Docker Compose (Recomendado)

Se você tem a WAHA rodando no mesmo servidor com Docker Compose, siga estes passos:

### 1. Identificar o volume da WAHA

Primeiro, descubra onde a WAHA está armazenando os arquivos:

```bash
# Ver o docker-compose da WAHA
cat docker-compose.waha.yml  # ou o nome do seu arquivo

# Procure por algo como:
# volumes:
#   - waha_media:/app/.media
```

### 2. Compartilhar o volume entre WAHA e Backend

Edite seu `docker-compose.prod.yml` para referenciar o mesmo volume:

```yaml
volumes:
  redis-data:
  rabbitmq-data:
  waha-media:
    external: true  # Se o volume já existe
    name: nome_do_volume_waha  # Nome do volume da WAHA

services:
  api:
    volumes:
      - waha-media:/waha-media:ro  # Mount como read-only

  worker-inbound:
    volumes:
      - waha-media:/waha-media:ro

  worker-outbound:
    volumes:
      - waha-media:/waha-media:ro
```

### 3. Atualizar o .env do backend

```env
WAHA_MEDIA_DIR=/waha-media
```

### 4. Rebuild e restart

```bash
# Pare os containers
docker-compose -f docker-compose.prod.yml down

# Rebuild (se necessário)
docker-compose -f docker-compose.prod.yml build

# Suba novamente
docker-compose -f docker-compose.prod.yml up -d

# Verifique os logs
docker-compose -f docker-compose.prod.yml logs -f api
```

---

## Opção 2: WAHA em servidor separado ou sem acesso ao filesystem

Se a WAHA está em outro servidor ou você não pode montar o volume:

### 1. Configurar .env

```env
# O sistema usará URLs HTTP automaticamente
WAHA_BASE_URL=https://waha.7sion.com
WAHA_API_KEY=seu_api_key
```

### 2. Garantir que a WAHA envie URLs nos webhooks

Verifique se a WAHA está configurada para incluir URLs de mídia:

```bash
# Teste o webhook manualmente
curl -X POST https://waha.7sion.com/api/sessions/default/messages \
  -H "X-Api-Key: seu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "5511999999999@c.us",
    "text": "teste"
  }'
```

### 3. Deploy normal

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## Opção 3: Usar volume externo já existente

Se a WAHA já está rodando e você quer apenas linkar o volume:

### 1. Descobrir o nome do volume

```bash
docker volume ls | grep media
# Exemplo de saída: waha_waha-files
```

### 2. Atualizar docker-compose.prod.yml

```yaml
volumes:
  redis-data:
  rabbitmq-data:
  waha-media:
    external: true
    name: waha_waha-files  # Nome real do volume

services:
  api:
    volumes:
      - waha-media:/waha-media:ro
  # ... mesmo para workers
```

### 3. Atualizar .env

```env
WAHA_MEDIA_DIR=/waha-media
```

### 4. Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## Verificando se está funcionando

### 1. Testar o proxy de mídia

```bash
# Envie uma imagem pelo WhatsApp para um dos seus chats
# Depois verifique os logs:

docker-compose -f docker-compose.prod.yml logs -f worker-inbound | grep media
```

Você deve ver algo como:

```
[worker] Processing media: file:///waha-media/sessions/default/files/image.jpg
```

ou

```
[worker] Processing media: https://waha.7sion.com/api/files/abc123.jpg
```

### 2. Verificar o proxy

```bash
# Abra o frontend e envie uma mídia
# Abra o DevTools (F12) > Network
# Procure por requisições para /media/proxy?token=...

# Ou teste diretamente (pegue um token dos logs):
curl "https://seu-backend.com/media/proxy?token=SEU_TOKEN_AQUI"
```

### 3. Logs do proxy

```bash
docker-compose -f docker-compose.prod.yml logs -f api | grep media.proxy
```

Você verá:
```
[media.proxy] Processing media: file:///waha-media/sessions/default/files/image.jpg
[media.proxy] Serving file from disk: /waha-media/sessions/default/files/image.jpg (45632 bytes)
```

ou em caso de erro:
```
[media.proxy] File not found: /waha-media/sessions/default/files/image.jpg
[media.proxy] Proxying HTTP media from: https://waha.7sion.com/api/files/image.jpg
```

---

## Troubleshooting

### Erro: "File not found"

**Causa:** O volume não está montado corretamente ou o caminho está errado.

**Solução:**

```bash
# Entre no container do backend
docker-compose -f docker-compose.prod.yml exec api sh

# Liste o diretório
ls -la /waha-media

# Se não existir, o volume não foi montado
# Verifique o docker-compose.prod.yml
```

### Erro: "Permission denied"

**Causa:** O container não tem permissão para ler o volume.

**Solução:**

```bash
# Ajuste as permissões no host
sudo chmod -R 755 /caminho/do/volume/waha
```

Ou monte como read-only (já está no exemplo):
```yaml
volumes:
  - waha-media:/waha-media:ro  # :ro = read-only
```

### Mídia não aparece no frontend

**Solução:**

1. Verifique se `BACKEND_BASE_URL` está correto no `.env`
2. Teste o endpoint de proxy manualmente
3. Verifique os logs do worker e do api

```bash
docker-compose -f docker-compose.prod.yml logs worker-inbound | tail -100
docker-compose -f docker-compose.prod.yml logs api | tail -100
```

### WAHA está enviando caminhos relativos

Se a WAHA enviar apenas `sessions/default/files/image.jpg` (sem `/app/.media`):

**Solução:** O proxy já trata isso! Ele adiciona `WAHA_MEDIA_DIR` automaticamente para caminhos relativos.

---

## Performance Tips

### 1. Use acesso ao filesystem quando possível

Montar o volume é **3-5x mais rápido** que fazer proxy HTTP:

```
File read:  ~5-20ms
HTTP proxy: ~50-200ms
```

### 2. Configure cache no NGINX (se usar)

```nginx
location /media/proxy {
    proxy_pass http://backend:5000;
    proxy_cache_valid 200 24h;
    proxy_cache_key $uri$is_args$args;
}
```

### 3. Monitore o uso de disco

```bash
# Ver tamanho do volume
docker system df -v | grep waha

# Limpar arquivos antigos (se necessário)
docker volume prune
```

---

## Comandos Úteis

```bash
# Ver todos os volumes
docker volume ls

# Inspecionar um volume
docker volume inspect waha_waha-files

# Ver containers usando um volume
docker ps -a --filter volume=waha_waha-files

# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f api worker-inbound

# Reiniciar apenas um serviço
docker-compose -f docker-compose.prod.yml restart api

# Rebuild forçado
docker-compose -f docker-compose.prod.yml up -d --build --force-recreate api
```

---

## Próximos Passos

Após o deploy:

1. ✅ Envie uma imagem pelo WhatsApp
2. ✅ Verifique se aparece no frontend
3. ✅ Verifique os logs para ver qual método foi usado (file ou HTTP)
4. ✅ Teste com diferentes tipos de mídia (imagem, vídeo, áudio, documento)

Se tiver problemas, compartilhe:
- Logs do `docker-compose logs api worker-inbound`
- Estrutura do volume da WAHA
- Um exemplo de payload recebido no webhook
