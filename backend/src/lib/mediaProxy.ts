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
 */
export function transformMessageMediaUrl<T extends { media_url?: string | null }>(message: T): T {
  if (!message.media_url) return message;
  
  return {
    ...message,
    media_url: buildProxyUrl(message.media_url),
  };
}

/**
 * Transforms an array of messages to use proxy URLs for media
 */
export function transformMessagesMediaUrls<T extends { media_url?: string | null }>(messages: T[]): T[] {
  return messages.map(transformMessageMediaUrl);
}
