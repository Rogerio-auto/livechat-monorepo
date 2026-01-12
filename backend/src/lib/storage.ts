import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase.js";
import { SUPABASE_MEDIA_BUCKET } from "../config/env.js";

export function getMediaBucket(): string {
  return SUPABASE_MEDIA_BUCKET || "chat-uploads";
}

export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sanitizeFilename(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$|^\.+/g, "")
    .slice(0, 120) || "file";
}

export function extFromMime(mime?: string | null, fallback = "bin"): string {
  if (!mime) return fallback;
  // Normalize mime by stripping parameters like "; codecs=opus"
  const m = mime.toLowerCase().split(";")[0].trim();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "video/mp4") return "mp4";
  if (m === "video/webm") return "webm";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/ogg") return "ogg";
  if (m === "audio/mp4") return "m4a";
  if (m === "audio/wav") return "wav";
  if (m === "application/pdf") return "pdf";
  if (m === "text/plain") return "txt";
  return fallback;
}

export function pickFilename(filenameHint: string | null | undefined, mime: string | null | undefined): string {
  const base = filenameHint && filenameHint.trim() ? sanitizeFilename(filenameHint.trim()) : "file";
  if (base.includes(".")) return base;
  return `${base}.${extFromMime(mime)}`;
}

export async function ensurePublicBucket(bucket: string): Promise<void> {
  // Create if not exists; ignore errors on existing bucket
  try {
    await (supabaseAdmin as any).storage.createBucket(bucket, { public: true });
  } catch (e) {
    // noop
  }
}

export async function uploadBufferToStorage(args: {
  buffer: Buffer;
  contentType?: string;
  path: string;
  bucket?: string;
}): Promise<{ path: string; publicUrl: string | null; sha256: string }>{
  const bucket = args.bucket || getMediaBucket();
  const sha256 = computeSha256(args.buffer);
  await ensurePublicBucket(bucket);
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(args.path, args.buffer, { contentType: args.contentType || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message || "upload failed");
  const pub = supabaseAdmin.storage.from(bucket).getPublicUrl(data!.path);
  const publicUrl = (pub as any)?.data?.publicUrl || null;
  return { path: data!.path, publicUrl, sha256 };
}

export function buildStoragePath(opts: {
  companyId?: string | null;
  chatId?: string | null;
  filename: string;
  prefix?: string; // optional custom prefix
}): string {
  const safeCompany = (opts.companyId || "company").replace(/[^a-zA-Z0-9_-]+/g, "-");
  const safeChat = (opts.chatId || "chat").replace(/[^a-zA-Z0-9_-]+/g, "-");
  const stamp = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 8);
  const fname = sanitizeFilename(opts.filename);
  const prefix = opts.prefix?.replace(/^\/+|\/+$|[^a-zA-Z0-9/_-]+/g, "").replace(/\/+/, "/") || "";
  return `${prefix ? prefix + "/" : ""}${safeCompany}/${safeChat}/${stamp}/${Date.now()}_${rand}_${fname}`;
}

// ========== NEW: WAHA Media Processing Functions ==========

/**
 * Upload de mídia WAHA para Supabase Storage
 * Retorna tanto a URL pública quanto o path para storage
 */
export async function uploadWahaMedia(args: {
  buffer: Buffer;
  contentType: string;
  filename: string;
  companyId: string;
  chatId: string;
  source: 'waha_file' | 'waha_url' | 'waha_base64';
}): Promise<{
  storagePath: string;
  publicUrl: string;
  sha256: string;
  source: 'waha_file' | 'waha_url' | 'waha_base64';
}> {
  const storagePath = buildStoragePath({
    companyId: args.companyId,
    chatId: args.chatId,
    filename: args.filename,
    prefix: 'waha'
  });

  const result = await uploadBufferToStorage({
    buffer: args.buffer,
    contentType: args.contentType,
    path: storagePath
  });

  if (!result.publicUrl) {
    throw new Error('Failed to get public URL from storage');
  }

  return {
    storagePath: result.path,
    publicUrl: result.publicUrl,
    sha256: result.sha256,
    source: args.source
  };
}

/**
 * Download de mídia de qualquer fonte e normaliza para Buffer
 */
export async function downloadMediaToBuffer(args: {
  source: 'file' | 'url' | 'base64';
  data: string;
  mimeType?: string;
  headers?: Record<string, string>;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const fs = await import('node:fs/promises');
  const axios = (await import('axios')).default;
  const path = await import('node:path');
  
  let buffer: Buffer;
  let detectedMime = args.mimeType || 'application/octet-stream';

  switch (args.source) {
    case 'file': {
      // Ler arquivo local WAHA
      const filePath = args.data.replace('file://', '');
      buffer = await fs.readFile(filePath);
      detectedMime = args.mimeType || detectMimeFromPath(filePath);
      break;
    }
    
    case 'url': {
      // Download HTTP/HTTPS
      const response = await axios.get(args.data, { 
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: args.headers || undefined,
      });
      buffer = Buffer.from(response.data);
      detectedMime = args.mimeType || response.headers['content-type'] || 'application/octet-stream';
      break;
    }
    
    case 'base64': {
      // Decodificar base64
      buffer = Buffer.from(args.data, 'base64');
      detectedMime = args.mimeType || 'application/octet-stream';
      break;
    }
    
    default:
      throw new Error(`Unknown media source: ${args.source}`);
  }

  return { buffer, mimeType: detectedMime };
}

function detectMimeFromPath(filePath: string): string {
  const path = require('node:path');
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
  };
  return mimeMap[ext] || 'application/octet-stream';
}
