// backend/src/lib/mediaProxy.ts
import { encryptUrl } from "./crypto.ts";

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT_BACKEND || 5000}`;

/**
 * Converts an encrypted media URL token to a proxy URL
 * This allows the frontend to fetch media through our backend proxy
 */
export function buildProxyUrl(encryptedToken: string | null | undefined): string | null {
  if (!encryptedToken) return null;
  
  // If already a full URL (not encrypted), encrypt it first then build proxy URL
  if (encryptedToken.startsWith("http://") || encryptedToken.startsWith("https://")) {
    const token = encryptUrl(encryptedToken);
    return `${BACKEND_BASE_URL}/media/proxy?token=${encodeURIComponent(token)}`;
  }
  
  return `${BACKEND_BASE_URL}/media/proxy?token=${encodeURIComponent(encryptedToken)}`;
}

/**
 * Transforms message objects to use proxy URLs for media
 * 
 * PRIORITY LOGIC (Storage-First Architecture):
 * 1. media_public_url (if exists & not sensitive) → Use CDN directly (fastest) ⚡
 * 2. media_storage_path (if exists) → Generate encrypted proxy URL 🔒
 * 3. media_url (legacy fallback) → Check if Supabase URL or decrypt
 */
export function transformMessageMediaUrl<T extends { 
  media_url?: string | null;
  media_public_url?: string | null;
  media_storage_path?: string | null;
  is_media_sensitive?: boolean;
}>(message: T): T {
  // No media at all? Return as-is
  if (!message.media_storage_path && !message.media_url && !message.media_public_url) {
    return message;
  }

  // ✅ PRIORITY 1: Public Storage URL (non-sensitive)
  // If media_public_url exists AND is_media_sensitive is false/null
  // → Use direct CDN URL (no proxy, no encryption, instant load)
  if (message.media_public_url && message.media_public_url.trim()) {
    if (!message.is_media_sensitive) {
      return {
        ...message,
        media_url: message.media_public_url
      };
    }
  }

  // ✅ PRIORITY 2: Storage Path (sensitive or no public URL)
  // If media_storage_path exists → Generate encrypted proxy URL
  if (message.media_storage_path && message.media_storage_path.trim()) {
    const proxyUrl = buildProxyUrl(encryptUrl(message.media_storage_path));
    return {
      ...message,
      media_url: proxyUrl
    };
  }

  // ⚠️ PRIORITY 3: Legacy media_url fallback
  // For old messages before storage-first migration
  if (message.media_url && message.media_url.trim()) {
    // If already a public Supabase Storage URL, keep it
    if (message.media_url.includes('supabase.co/storage') || 
        message.media_url.includes('supabase.in/storage')) {
      return message;
    }
    
    // If WAHA URL or other external URL, decrypt and proxy
    const proxyUrl = buildProxyUrl(message.media_url);
    return {
      ...message,
      media_url: proxyUrl
    };
  }

  // No usable media URL found
  return message;
}

/**
 * Transforms an array of messages to use appropriate media URLs
 */
export function transformMessagesMediaUrls<T extends { 
  media_url?: string | null;
  media_public_url?: string | null;
  media_storage_path?: string | null;
  is_media_sensitive?: boolean;
}>(messages: T[]): T[] {
  return messages.map(transformMessageMediaUrl);
}
