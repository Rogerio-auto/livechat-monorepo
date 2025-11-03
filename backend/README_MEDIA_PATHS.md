# Sistema de Mídia Flexível - WAHA Integration

## Visão Geral

O sistema agora suporta **3 métodos diferentes** para servir arquivos de mídia do WAHA:

1. **Caminho de arquivo local** (file path)
2. **URL HTTP/HTTPS** (proxy)
3. **Base64 data URI**

## Configuração

### Variáveis de Ambiente

Adicione ao seu `.env`:

```env
# Diretório onde a WAHA armazena os arquivos de mídia
WAHA_MEDIA_DIR=/app/.media
```

**Nota:** Se a WAHA estiver em um container Docker, você pode:
- Montar o volume da WAHA no backend para acesso direto
- Ou deixar o sistema usar URLs (método 2)

## Como Funciona

### 1. Recebimento de Mensagem (Worker)

Quando uma mensagem com mídia chega da WAHA, o worker tenta extrair a mídia na seguinte ordem de prioridade:

```typescript
if (payload?.hasMedia) {
  if (payload?.media?.filePath) {
    mediaUrl = payload.media.filePath;  // Preferência: caminho do arquivo
  } else if (payload?.media?.file) {
    mediaUrl = payload.media.file;
  } else if (payload?.media?.url) {
    mediaUrl = payload.media.url;        // Fallback: URL HTTP
  } else if (payload?.media?.base64) {
    // Constrói data URI a partir do base64
    mediaUrl = `data:${mimeType};base64,${base64Data}`;
  }
}
```

O caminho/URL é então **criptografado** antes de ser armazenado no banco de dados.

### 2. Proxy de Mídia (Media Proxy)

O endpoint `/media/proxy?token=<encrypted_token>` suporta 3 formatos:

#### Método 1: Base64 Data URI
```
data:image/jpeg;base64,/9j/4AAQSkZJRg...
```
- Decodifica o base64 e serve diretamente
- Ideal para arquivos pequenos

#### Método 2: Caminho de Arquivo Local
```
file:///app/.media/sessions/default/files/true_123456789@c.us_ABC.jpg
/app/.media/sessions/default/files/image.jpg
sessions/default/files/audio.ogg  (relativo a WAHA_MEDIA_DIR)
```
- Lê o arquivo do disco e serve
- **Mais rápido** que fazer proxy HTTP
- Requer que o backend tenha acesso ao sistema de arquivos da WAHA

#### Método 3: URL HTTP/HTTPS
```
https://waha.7sion.com/api/files/sessions/default/files/image.jpg
http://localhost:3000/files/abc123.jpg
```
- Faz proxy via axios (streaming)
- Funciona mesmo sem acesso ao filesystem da WAHA
- Resolve problemas de CORS

### 3. Detecção de Content-Type

Para arquivos locais, o proxy detecta automaticamente o MIME type:

```typescript
const mimeTypes = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  // ... etc
};
```

## Cenários de Uso

### Cenário 1: Backend e WAHA no mesmo servidor (Docker Compose)

```yaml
# docker-compose.prod.yml
services:
  waha:
    image: devlikeapro/waha
    volumes:
      - waha-media:/app/.media
  
  api:
    volumes:
      - waha-media:/waha-media:ro  # Montar como read-only

volumes:
  waha-media:
```

```env
# backend/.env
WAHA_MEDIA_DIR=/waha-media
```

**Vantagem:** Acesso direto aos arquivos, **mais rápido**, sem requisições HTTP.

### Cenário 2: Backend e WAHA em servidores separados

```env
# backend/.env
WAHA_MEDIA_DIR=/app/.media  # Não usado neste caso
```

A WAHA envia URLs HTTP no webhook, e o proxy faz streaming via axios.

**Vantagem:** Funciona mesmo com servidores separados.

### Cenário 3: Mídia em Base64 (pequenos arquivos)

Se a WAHA enviar `payload.media.base64`, o sistema constrói um data URI e armazena diretamente.

**Vantagem:** Tudo em memória, ideal para stickers, thumbnails.

## Troubleshooting

### Erro "File not found"

1. Verifique se `WAHA_MEDIA_DIR` está correto
2. Verifique se o volume está montado corretamente no Docker
3. Verifique as permissões do diretório

### Erro "HTTP 500" no proxy

1. Verifique os logs do backend para ver qual método foi tentado
2. Se for URL HTTP, verifique se a WAHA está acessível
3. Se for file path, verifique se o arquivo existe

### Mídias não aparecem no frontend

1. Verifique se `BACKEND_BASE_URL` está correto no `.env`
2. Verifique se a criptografia está funcionando (logs do worker)
3. Teste o endpoint diretamente: `GET /media/proxy?token=<token>`

## Performance

**Ordem de performance (do mais rápido para o mais lento):**

1. ⚡ **Base64 data URI** (em memória)
2. 🚀 **File path local** (leitura de disco)
3. 🌐 **HTTP proxy** (requisição de rede)

## Segurança

- Todos os caminhos/URLs são **criptografados** com AES-256-GCM
- O proxy valida os tokens antes de servir
- CORS está habilitado apenas para mídias, não para APIs sensíveis
- Cache de 24 horas para reduzir requisições

## Exemplo de Debug

Para ver qual método está sendo usado, verifique os logs:

```bash
docker-compose -f docker-compose.prod.yml logs -f api | grep media.proxy
```

Você verá mensagens como:
```
[media.proxy] Processing media: file:///app/.media/sessions/default/files/image.jpg
[media.proxy] Serving file from disk: /app/.media/sessions/default/files/image.jpg (45632 bytes)
```

ou

```
[media.proxy] Processing media: https://waha.7sion.com/api/files/abc123.jpg
[media.proxy] Proxying HTTP media from: https://waha.7sion.com/api/...
```

## Próximos Passos

Se você tiver problemas, compartilhe:
1. Os logs do backend (`docker-compose logs api`)
2. A estrutura de diretórios da WAHA
3. Um exemplo de payload recebido do webhook
