# 🔧 Atualização Urgente - Fix de Descriptografia de Mídia

## ⚠️ Problema
As mídias não estavam carregando porque o sistema estava tentando usar o token criptografado como caminho de arquivo.

## ✅ Solução
Corrigida a função de descriptografia para detectar URLs/paths já descriptografados.

---

## 📋 Comandos para Atualizar no Servidor

Execute esses comandos no seu VPS:

```bash
# 1. Navegar para o diretório do projeto
cd ~/sistem-livechat/app

# 2. Atualizar código
git pull origin main

# 3. Rebuild e restart dos containers
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build api worker-inbound worker-outbound
docker compose -f docker-compose.prod.yml up -d

# 4. Verificar se está funcionando
docker compose -f docker-compose.prod.yml logs -f api | grep media.proxy
```

---

## ✅ Como Verificar se Funcionou

### 1. Enviar mídia pelo WhatsApp
Envie uma imagem para um dos chats conectados.

### 2. Verificar logs
Você deve ver logs assim:

```
[media.proxy] Received token (first 80 chars): MDhERWNLLzZ6ekU4dEZMUS5t...
[media.proxy] Decrypted URL: https://waha.7sion.com/api/files/abc123.jpg
[media.proxy] Proxying HTTP media from: https://waha.7sion.com/api/...
```

✅ **Correto:** URL descriptografada corretamente  
❌ **Errado:** `File not found: /app/.media/MDhERWNL...`

### 3. Verificar no frontend
- A mídia deve aparecer no chat
- Sem erros de CORS ou 404 no DevTools

---

## 🐛 Se Continuar Dando Erro

### Erro: "Invalid or expired token"
```bash
# Verifique se ENCRYPTION_KEY está configurada
docker compose -f docker-compose.prod.yml exec api sh -c 'echo $ENCRYPTION_KEY'
```

Deve retornar algo como:
```
a5673efc2874e522ef961e1dd1323664da48595a3c65dc25c7d257a7d102fe86
```

Se estiver vazio:
```bash
# Edite o .env
nano backend/.env

# Adicione:
ENCRYPTION_KEY=a5673efc2874e522ef961e1dd1323664da48595a3c65dc25c7d257a7d102fe86

# Restart
docker compose -f docker-compose.prod.yml restart api worker-inbound worker-outbound
```

### Erro: "Media source unavailable"
```bash
# Verifique se WAHA está acessível
curl https://waha.7sion.com/api/health

# Ou dentro do container
docker compose -f docker-compose.prod.yml exec api sh -c 'curl https://waha.7sion.com/api/health'
```

### Erro: CORS
```bash
# Verifique BACKEND_BASE_URL
nano backend/.env

# Deve ser HTTPS (não HTTP):
BACKEND_BASE_URL=https://api.seu-dominio.com
```

---

## 📊 Verificação Completa

```bash
# 1. Status dos containers
docker compose -f docker-compose.prod.yml ps

# 2. Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f api worker-inbound

# 3. Testar proxy diretamente (pegue um token dos logs)
curl "https://api.seu-dominio.com/media/proxy?token=SEU_TOKEN_AQUI"
```

---

## ⏱️ Tempo Estimado
- Pull do código: ~10 segundos
- Rebuild: ~2-3 minutos
- Restart: ~30 segundos
- **Total: ~4 minutos**

---

## 📝 Resumo das Mudanças

- ✅ `backend/src/lib/crypto.ts` - Fix na função `decryptUrl()`
- ✅ `backend/src/routes/media.proxy.ts` - Logs melhorados
- ✅ Build verificado localmente (sem erros)

---

**Após a atualização, teste enviando uma imagem pelo WhatsApp!**
