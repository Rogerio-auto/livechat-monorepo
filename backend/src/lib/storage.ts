import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase.ts";
import { SUPABASE_MEDIA_BUCKET } from "../config/env.ts";

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
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "video/mp4") return "mp4";
  if (m === "video/webm") return "webm";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/ogg") return "ogg";
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
