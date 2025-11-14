-- 037_add_caption_to_messages.sql
-- Adiciona suporte para caption em mensagens de mídia (fotos, vídeos, documentos)

-- Adicionar coluna caption à tabela chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS caption TEXT;

-- Criar índice para busca por caption (útil para pesquisa de mensagens)
CREATE INDEX IF NOT EXISTS chat_messages_caption_idx 
ON public.chat_messages USING gin(to_tsvector('portuguese', caption)) 
WHERE caption IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.chat_messages.caption IS 'Legenda/caption que acompanha mídia (imagens, vídeos, documentos) enviada pelo WhatsApp';

-- Exemplo de busca por caption:
-- SELECT id, content, caption, type FROM chat_messages WHERE to_tsvector('portuguese', caption) @@ to_tsquery('portuguese', 'palavra_busca');
