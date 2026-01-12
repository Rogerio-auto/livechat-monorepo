import { getRedis } from "./redis.js";
// @ts-ignore
import Redlock from "redlock";

/** Redlock p/ single-flight (evita stampede quando muitos pedem o mesmo) */
const redlock = new Redlock([getRedis()], {
  retryCount: 0, // sem re-tentativa; se não pegar o lock, segue sem lock
});

/** Jitter básico pra espalhar expiração */
function withJitter(ttlSec: number, jitterPct = 0.1): number {
  const jitter = Math.floor(ttlSec * jitterPct * Math.random());
  return Math.max(1, ttlSec - jitter);
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const r = await getRedis().get(key);
  if (!r) return null;
  try {
    return JSON.parse(r) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSec: number
): Promise<void> {
  const payload = JSON.stringify(value);
  await getRedis().set(key, payload, "EX", withJitter(ttlSec));
}

export async function cacheDel(key: string): Promise<void> {
  await getRedis().del(key);
}

/**
 * cacheWrap: tenta o cache; se perder, usa um lock curto para evitar N chamadas
 * simultâneas ao mesmo "loader". TTL padrão + lock TTL curto.
 */
export async function cacheWrap<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
  opts?: { lockMs?: number }
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const lockKey = `lock:${key}`;
  let lock: Awaited<ReturnType<typeof redlock.acquire>> | null = null;

  try {
    lock = await redlock.acquire([lockKey], opts?.lockMs ?? 3000);
  } catch {
    // não conseguiu lock → outro processo deve estar carregando
  }

  // Tenta de novo (talvez o outro já preencheu)…
  const secondTry = await cacheGet<T>(key);
  if (secondTry !== null) {
    if (lock) await lock.release().catch(() => {});
    return secondTry;
  }

  // Carrega, escreve, libera lock
  const fresh = await loader();
  await cacheSet(key, fresh, ttlSec);
  if (lock) await lock.release().catch(() => {});
  return fresh;
}

/**
 * "Version key": em vez de sair deletando várias chaves, você usa uma chave de versão
 * (por escopo) que entra na montagem do cache key. Ao "bump", tudo invalida de uma vez.
 * Ex: scopeKey = `v:chatlist:inbox:${inboxId}`
 */
export async function getScopeVersion(scopeKey: string): Promise<string> {
  const r = await getRedis().get(scopeKey);
  if (r) return r;
  // inicia em "1" e deixa expirar em 7 dias
  await getRedis().set(scopeKey, "1", "EX", 7 * 24 * 3600);
  return "1";
}

/**
 * bumpScopeVersion
 * Aceita tanto bumpScopeVersion("scopeKey") quanto bumpScopeVersion(companyId, scope)
 */
export async function bumpScopeVersion(a: string, b?: string): Promise<void> {
  const scopeKey = b ? `v:${a}:${b}` : a; // suporta os dois formatos
  const redis = getRedis();
  try {
    const tx = await redis
      .multi()
      .incr(scopeKey)
      .expire(scopeKey, 7 * 24 * 3600)
      .exec();
    if (!tx) {
      await redis.set(scopeKey, "2", "EX", 7 * 24 * 3600);
    }
  } catch (err) {
    console.warn("[cache] bumpScopeVersion failed:", (err as any)?.message || err);
  }
}

/** helper pra montar chave com versão embutida */
export async function versionedCacheKey(
  scopeKey: string,
  topic: string,
  params: Record<string, unknown>
): Promise<string> {
  const v = await getScopeVersion(scopeKey);
  const p = JSON.stringify(params);
  return `v${v}:${topic}:${p}`;
}
