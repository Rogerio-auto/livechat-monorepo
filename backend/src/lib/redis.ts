// src/lib/redis.ts
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://:changeme@127.0.0.1:6379";

export const redis = new IORedis(REDIS_URL, {
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
});

redis.on("connect", () => console.log("[Redis] connect ok"));
redis.on("ready",   () => console.log("[Redis] ready"));
redis.on("error",   (e) => console.error("[Redis] error:", e?.message || e));
redis.on("end",     () => console.warn("[Redis] connection ended"));

/** compat com arquivos que esperam getRedis() */
export function getRedis() {
  return redis;
}

// helpers (se já tiver, mantenha)
export async function rGet<T = any>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

export async function rSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  try { await redis.set(key, JSON.stringify(value), "EX", ttlSec); } catch {}
}

export async function rDel(key: string): Promise<void> {
  try { await redis.del(key); } catch {}
}

export async function rDelMatch(pattern: string): Promise<void> {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", "200");
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== "0");
  } catch {}
}

export const k = {
  list: (companyId: string | null | undefined, inboxId?: string, status?: string, q?: string, offset?: number, limit?: number) => {
    const c = companyId || "x";
    const i = inboxId || "all";
    const s = (status || "ALL").toUpperCase();
    const qq = q ? Buffer.from(q).toString("base64").slice(0, 32) : "-";
    return `lc:list:${c}:${i}:${s}:${qq}:${offset ?? 0}:${limit ?? 20}`;
  },
  chat: (chatId: string) => `lc:chat:${chatId}`,
  msgsKey: (chatId: string, before?: string, limit?: number) =>
    `lc:msgs:${chatId}:${before || "nil"}:${limit ?? 50}`,
  msgsPrefix: (chatId: string) => `lc:msgs:${chatId}:*`,
  listPrefixCompany: (companyId?: string | null) =>
    `lc:list:${companyId || "*"}:*`,
};
