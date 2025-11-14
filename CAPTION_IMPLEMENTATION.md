# Implementação de Caption em Mensagens de Mídia

## 🎯 Problema Identificado

O sistema **não estava capturando nem armazenando** o caption (legenda) que vem junto com fotos, vídeos e documentos no WhatsApp.

### Diagnóstico:
1. ❌ Tabela `chat_messages` não tinha coluna `caption`
2. ❌ Função `insertInboundMessage()` não aceitava caption
3. ❌ Função `upsertChatMessage()` não tinha campo caption  
4. ❌ Função `extractContentAndType()` não retornava caption
5. ❌ Webhook META não estava extraindo caption das mensagens

## ✅ Solução Implementada

### 1. Migration SQL (`037_add_caption_to_messages.sql`)

```sql
-- Adiciona coluna caption
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS caption TEXT;

-- Índice para busca full-text em português
CREATE INDEX IF NOT EXISTS chat_messages_caption_idx 
ON public.chat_messages USING gin(to_tsvector('portuguese', caption)) 
WHERE caption IS NOT NULL;
```

### 2. Backend - Tipos TypeScript

**Atualizado `UpsertChatMessageArgs`:**
```typescript
type UpsertChatMessageArgs = {
  // ... outros campos
  caption?: string | null;  // 📝 Novo campo
};
```

**Atualizado `insertInboundMessage()`:**
```typescript
export async function insertInboundMessage(args: {
  chatId: string;
  externalId: string;
  content: string;
  type?: "TEXT" | string;
  caption?: string | null;  // 📝 Novo parâmetro
  // ... outros campos
});
```

### 3. Backend - Query SQL Atualizada

**Em `upsertChatMessage()`:**
- ✅ Adicionado `caption` na lista de colunas do INSERT
- ✅ Adicionado `$22` (caption) nos VALUES
- ✅ Adicionado `caption = coalesce(excluded.caption, public.chat_messages.caption)` no ON CONFLICT
- ✅ Ajustado índice dos parâmetros ($22 → caption, $23 → createdAt)

### 4. Backend - Extração de Caption

**Função `extractContentAndType()` atualizada:**
```typescript
function extractContentAndType(m: any): { 
  content: string; 
  type: string; 
  caption: string | null  // 📝 Novo retorno
} {
  switch (t) {
    case "image":
      return {
        content: m?.image?.caption ? `[IMAGE] ${m.image.caption}` : "[IMAGE]",
        type: "IMAGE",
        caption: m?.image?.caption ? String(m.image.caption) : null, // 🆕
      };
    case "video":
      return {
        content: m?.video?.caption ? `[VIDEO] ${m.video.caption}` : "[VIDEO]",
        type: "VIDEO",
        caption: m?.video?.caption ? String(m.video.caption) : null, // 🆕
      };
    case "document":
      return {
        content: m?.document?.filename ? `[DOCUMENT] ${m.document.filename}` : "[DOCUMENT]",
        type: "DOCUMENT",
        caption: m?.document?.caption ? String(m.document.caption) : null, // 🆕
      };
    // outros tipos retornam caption: null
  }
}
```

### 5. Backend - Worker Atualizado

**Processamento de mensagens inbound META:**
```typescript
// Extrair caption junto com content e type
const { content, type, caption } = extractContentAndType(m);  // 🆕 caption

// Passar caption para insertInboundMessage
const inserted = await insertInboundMessage({
  chatId,
  externalId: wamid,
  content,
  type,
  caption,  // 🆕 passando caption
  // ... outros campos
});
```

## 📊 Resultado

### Antes:
```json
{
  "content": "[IMAGE]",
  "type": "IMAGE",
  "caption": null  // ❌ Sempre null
}
```

### Depois:
```json
{
  "content": "[IMAGE] Olha que legal!",
  "type": "IMAGE",
  "caption": "Olha que legal!"  // ✅ Captura legenda
}
```

## 🔄 Fluxo Completo

```
WhatsApp → Webhook META
    ↓
worker.ts: extractContentAndType(m)
    ↓ retorna { content, type, caption }
    ↓
insertInboundMessage({ caption })
    ↓
upsertChatMessage({ caption })
    ↓
PostgreSQL: INSERT INTO chat_messages (..., caption)
    ↓
Frontend: Renderiza caption junto com mídia
```

## 🚀 Deployment

### 1. Executar Migration
```bash
psql $DATABASE_URL -f backend/sql/037_add_caption_to_messages.sql
```

### 2. Rebuild Backend
```bash
cd backend
npm run build
# Ou via Docker
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend
```

### 3. Restart Worker
```bash
docker compose -f docker-compose.prod.yml restart worker
```

## 🧪 Como Testar

1. **Enviar foto com legenda no WhatsApp:**
   - Foto: `imagem.jpg`
   - Caption: `"Olha essa vista incrível!"`

2. **Verificar no banco:**
   ```sql
   SELECT id, content, type, caption, created_at 
   FROM chat_messages 
   WHERE type = 'IMAGE' 
   AND caption IS NOT NULL
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. **Verificar no frontend:**
   - Abrir chat no livechat
   - Caption deve aparecer junto com a imagem

## 📝 Arquivos Modificados

### SQL:
- ✅ `backend/sql/037_add_caption_to_messages.sql` (novo)

### Backend:
- ✅ `backend/src/services/meta/store.ts` (3 mudanças)
  - Tipo `UpsertChatMessageArgs`
  - Função `insertInboundMessage()`
  - Query SQL em `upsertChatMessage()`
  
- ✅ `backend/src/worker.ts` (3 mudanças)
  - Função `extractContentAndType()`
  - Desestruturação `const { content, type, caption } = ...`
  - Chamada `insertInboundMessage({ caption })`

## 🎨 Frontend (Pendente)

O frontend precisa ser atualizado para **renderizar o caption** junto com a mídia:

```tsx
{message.type === 'IMAGE' && (
  <div>
    <img src={message.media_url} alt="Imagem" />
    {message.caption && (
      <p className="caption">{message.caption}</p>
    )}
  </div>
)}
```

## 🐛 Troubleshooting

### Caption não aparece após update:
1. ✅ Verificar se migration foi executada
2. ✅ Verificar se backend foi rebuilded
3. ✅ Verificar logs do worker: `docker logs -f <worker_container>`
4. ✅ Testar com mensagem nova (mensagens antigas não têm caption)

### Erro "column caption does not exist":
- **Causa:** Migration não executada
- **Solução:** Executar `037_add_caption_to_messages.sql`

---

**Documentado em:** 14/11/2025  
**Autor:** GitHub Copilot  
**Status:** ✅ Backend Completo | ⏳ Frontend Pendente | ⏳ Migration Pendente
