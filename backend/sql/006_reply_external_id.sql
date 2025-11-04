-- Alterar coluna replied_message_id para aceitar external_id (text) em vez de UUID
-- Isso permite armazenar o external_id do WhatsApp diretamente

-- 1. Remover a constraint de foreign key (se existir)
ALTER TABLE public.chat_messages 
  DROP CONSTRAINT IF EXISTS chat_messages_replied_message_id_fkey;

-- 2. Alterar o tipo da coluna de UUID para TEXT
ALTER TABLE public.chat_messages 
  ALTER COLUMN replied_message_id TYPE text USING replied_message_id::text;

-- 3. Renomear para deixar mais claro (opcional)
ALTER TABLE public.chat_messages 
  RENAME COLUMN replied_message_id TO replied_message_external_id;

-- 4. Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_replied_external_id 
  ON public.chat_messages(replied_message_external_id) 
  WHERE replied_message_external_id IS NOT NULL;

-- 5. Adicionar comentário
COMMENT ON COLUMN public.chat_messages.replied_message_external_id IS 
  'External ID (from WAHA/WhatsApp) of the message being replied to. Used to fetch and display quoted message preview.';
