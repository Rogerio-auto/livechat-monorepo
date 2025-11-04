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
 * NEW: Storage-first approach - prioritizes public URLs when not sensitive
 */
export function transformMessageMediaUrl<T extends { 
  media_url?: string | null;
  media_public_url?: string | null;
  media_storage_path?: string | null;
  is_media_sensitive?: boolean;
}>(message: T): T {
  // No media? Return as-is
  if (!message.media_storage_path && !message.media_url && !message.media_public_url) {
    return message;
  }

  // ✅ PRIORITY 1: If has public URL AND not sensitive, use CDN directly
  if (message.media_public_url && !message.is_media_sensitive) {
    return {
      ...message,
      media_url: message.media_public_url // CDN direct (fast!)
    };
  }

  // ✅ PRIORITY 2: If has storage path, generate proxy URL
  if (message.media_storage_path) {
    const proxyUrl = buildProxyUrl(encryptUrl(message.media_storage_path));
    return {
      ...message,
      media_url: proxyUrl // Via proxy (secure)
    };
  }

  // ⚠️ FALLBACK: Use legacy media_url field if exists
  if (message.media_url) {
    // If already a public Supabase URL, keep it
    if (message.media_url.includes('supabase.co/storage')) {
      return message;
    }
    
    // If encrypted/legacy, transform to proxy
    return {
      ...message,
      media_url: buildProxyUrl(message.media_url)
    };
  }

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
