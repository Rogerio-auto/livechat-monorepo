# Media SHA-256 Implementation

## Resumo
Implementação do campo `media_sha256` na tabela `chat_messages` para armazenar o hash SHA-256 do conteúdo de mídia quando proveniente de base64 do WAHA.

## Objetivo
- Permitir verificação de integridade de arquivos de mídia
- Possibilitar deduplicação de mídias idênticas no futuro
- Rastrear e validar conteúdo de mídia armazenado no Supabase Storage

## Mudanças Implementadas

### 1. Migration SQL (`backend/sql/005_message_media_sha256.sql`)
```sql
alter table if exists public.chat_messages
  add column if not exists media_sha256 text;

create index if not exists chat_messages_media_sha256_idx on public.chat_messages(media_sha256)
  where media_sha256 is not null;

comment on column public.chat_messages.media_sha256 is 'SHA-256 hash of media content for integrity verification and deduplication';
```

**Como executar:**
```bash
psql -h <HOST> -U <USER> -d <DATABASE> -f backend/sql/005_message_media_sha256.sql
```

### 2. Storage Helper (`backend/src/lib/storage.ts`)
- Adicionado `computeSha256(buffer: Buffer): string` - calcula hash SHA-256 do buffer
- Atualizado `uploadBufferToStorage()` - retorna objeto com `{ path, publicUrl, sha256 }`

**Antes:**
```typescript
return { path: data!.path, publicUrl };
```

**Depois:**
```typescript
const sha256 = computeSha256(args.buffer);
// ... upload
return { path: data!.path, publicUrl, sha256 };
```

### 3. Store Type (`backend/src/services/meta/store.ts`)
- Adicionado campo `mediaSha256?: string | null` no tipo `UpsertChatMessageArgs`
- Atualizada query SQL de `upsertChatMessage` para incluir `media_sha256`:
  - Adicionado na lista de colunas do INSERT
  - Adicionado no array de valores ($9)
  - Adicionado no UPDATE com `coalesce(excluded.media_sha256, ...)`

### 4. Worker (`backend/src/worker.ts`)
- Declarada variável `mediaSha256: string | null = null`
- Quando `payload.media.base64` é processado e faz upload para Supabase:
  ```typescript
  const uploadResult = await uploadBufferToStorage({ buffer, contentType: mimeType, path: storagePath });
  mediaUrl = uploadResult.publicUrl || null;
  mediaSha256 = uploadResult.sha256; // ← novo
  ```
- Passado `mediaSha256` para `upsertChatMessage()`

## Fluxo de Dados

```
WAHA Webhook (base64)
    ↓
Buffer.from(base64)
    ↓
computeSha256(buffer) → SHA-256 hash
    ↓
uploadBufferToStorage() → Supabase Storage
    ↓
{ publicUrl, sha256 }
    ↓
upsertChatMessage({ mediaUrl: encrypted(publicUrl), mediaSha256: sha256 })
    ↓
PostgreSQL: chat_messages.media_sha256 = "abc123..."
```

## Cenários de Uso

### ✅ Armazena SHA-256
- Mensagem WAHA com `payload.media.base64` → upload bem-sucedido para Supabase
- Hash é calculado do buffer antes do upload
- SHA-256 é salvo na coluna `media_sha256`

### ❌ Não armazena SHA-256
- Mensagem com `filePath`, `file`, ou `url` (não é base64)
- Upload de base64 falha (usa data URI como fallback)
- Mensagens sem mídia

## Validação

### Verificar coluna existe:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
  AND column_name = 'media_sha256';
```

### Verificar índice:
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'chat_messages' 
  AND indexname = 'chat_messages_media_sha256_idx';
```

### Testar insert:
1. Enviar mensagem WAHA com base64
2. Verificar registro na tabela:
```sql
SELECT id, type, media_url IS NOT NULL as has_media, media_sha256, created_at
FROM chat_messages
WHERE media_sha256 IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

## Notas Importantes

1. **Backward Compatibility**: Coluna é opcional (`NULL` permitido), não quebra dados antigos
2. **Performance**: Índice parcial criado apenas para registros com `media_sha256 NOT NULL`
3. **SHA-256 Format**: 64 caracteres hexadecimais (256 bits)
4. **Deduplicação**: Base para feature futura - detectar mídias duplicadas por hash
5. **Integridade**: Permite verificar se arquivo no Supabase corresponde ao hash armazenado

## Próximos Passos (Opcional)

- [ ] Adicionar endpoint para verificar integridade: `GET /media/verify/:messageId`
- [ ] Implementar deduplicação: antes de upload, verificar se SHA-256 já existe
- [ ] Calcular SHA-256 também para outras fontes de mídia (file, url)
- [ ] Dashboard de estatísticas de mídia por hash
- [ ] Limpeza de arquivos órfãos no Supabase baseado em SHA-256

## Rollback

Se necessário reverter:
```sql
-- Remove índice
DROP INDEX IF EXISTS public.chat_messages_media_sha256_idx;

-- Remove coluna
ALTER TABLE public.chat_messages DROP COLUMN IF EXISTS media_sha256;
```

Depois, fazer revert dos commits no Git.
