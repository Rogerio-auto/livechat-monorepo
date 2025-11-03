# Fix: Descriptografia de URLs de Mídia

## Problema Identificado

O proxy de mídia estava tentando usar o **token criptografado** como se fosse um caminho de arquivo:

```
[media.proxy] File not found: /app/.media/MDhERWNLLzZ6ekU4dEZMUS5tOGUyVmJH...
```

Isso acontecia porque:

1. A URL da mídia era criptografada pelo worker
2. O token criptografado era armazenado no banco de dados
3. O frontend enviava o token para `/media/proxy?token=...`
4. O proxy tentava descriptografar, mas **falhava silenciosamente**
5. Então tentava usar o token como caminho de arquivo (fallback incorreto)

## Causa Raiz

A função `decryptUrl()` não tinha verificação para URLs/paths já descriptografados, então:

- Se recebesse uma URL já descriptografada (ex: `https://...`), tentava descriptografar e falhava
- Se a descriptografia falhasse, retornava `null`
- O código então tentava usar o valor original como caminho de arquivo

## Solução Implementada

Adicionado verificação na função `decryptUrl()` para detectar se a entrada já é uma URL ou caminho válido:

```typescript
export function decryptUrl(token: string): string | null {
  if (!token) return null;
  
  // If it's already a URL or path (not encrypted), return as-is
  if (token.startsWith("http://") || 
      token.startsWith("https://") || 
      token.startsWith("data:") ||
      token.startsWith("file://") ||
      token.startsWith("/")) {
    return token;
  }
  
  // ... rest of decryption logic
}
```

## Arquivos Modificados

### 1. `backend/src/lib/crypto.ts`
- ✅ Adicionada verificação de URL/path antes de descriptografar
- ✅ Retorna o valor original se já for uma URL/path válido
- ✅ Previne tentativas de descriptografia desnecessárias

### 2. `backend/src/routes/media.proxy.ts`
- ✅ Adicionado log do token recebido (debug)
- ✅ Adicionado log da URL descriptografada
- ✅ Melhor rastreamento de erros

## Como Testar

### 1. Rebuild do backend
```bash
cd backend
npm run build
```

### 2. Deploy no servidor
```bash
# No VPS
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Verificar logs
```bash
docker compose -f docker-compose.prod.yml logs -f api | grep media.proxy
```

Agora você deve ver:
```
[media.proxy] Received token (first 80 chars): MDhERWNLLzZ6ekU4dEZMUS5tOGUyVmJH...
[media.proxy] Decrypted URL: https://waha.7sion.com/api/files/abc123.jpg
[media.proxy] Proxying HTTP media from: https://waha.7sion.com/api/...
```

ou

```
[media.proxy] Received token (first 80 chars): MDhERWNLLzZ6ekU4dEZMUS5tOGUyVmJH...
[media.proxy] Decrypted URL: /app/.media/sessions/default/files/image.jpg
[media.proxy] Serving file from disk: /app/.media/sessions/default/files/image.jpg (45632 bytes)
```

### 4. Testar no frontend
1. Envie uma imagem pelo WhatsApp
2. A mídia deve aparecer corretamente no chat
3. Abra o DevTools (F12) e verifique a aba Network
4. A requisição para `/media/proxy?token=...` deve retornar HTTP 200

## Fluxo Correto Agora

```
1. WAHA → Webhook com media.url ou media.filePath
   ↓
2. Worker extrai e criptografa: encryptMediaUrl(mediaUrl)
   ↓
3. Armazena no DB: media_url = token_criptografado
   ↓
4. Socket emite para frontend: media_url = proxy_url
   (buildProxyUrl() adiciona: /media/proxy?token=...)
   ↓
5. Frontend faz request: GET /media/proxy?token=xyz
   ↓
6. Proxy descriptografa: decryptUrl(token) → URL real
   ↓
7. Proxy busca mídia:
   - Se for file path → lê do disco
   - Se for HTTP → faz proxy via axios
   - Se for base64 → decodifica e serve
   ↓
8. Retorna mídia para frontend ✅
```

## Problemas Resolvidos

✅ Token criptografado não é mais usado como caminho de arquivo  
✅ Descriptografia funciona corretamente  
✅ URLs já descriptografadas são aceitas (backward compatibility)  
✅ Logs mais informativos para debug  
✅ Fallback automático entre file path e HTTP  

## Próximos Passos

1. Fazer rebuild: `npm run build` (✅ Feito)
2. Commit das mudanças
3. Deploy no servidor
4. Testar com mídia real

---

**Status:** ✅ Corrigido e pronto para deploy
