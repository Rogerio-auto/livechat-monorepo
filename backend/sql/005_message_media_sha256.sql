-- Add media_sha256 column to chat_messages for media integrity verification and deduplication
alter table if exists public.chat_messages
  add column if not exists media_sha256 text;

create index if not exists chat_messages_media_sha256_idx on public.chat_messages(media_sha256)
  where media_sha256 is not null;

comment on column public.chat_messages.media_sha256 is 'SHA-256 hash of media content for integrity verification and deduplication';
