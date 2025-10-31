import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://:changeme@127.0.0.1:6379";

export const redis = new IORedis(REDIS_URL, {
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
});

const DEFAULT_MSGS_TTL = Math.max(30, Number(process.env.CACHE_TTL_MSGS || 60));

redis.on("connect", () => console.log("[Redis] connect ok"));
redis.on("ready", () => console.log("[Redis] ready"));
redis.on("error", (e) => console.error("[Redis] error:", e?.message || e));
redis.on("end", () => console.warn("[Redis] connection ended"));

export function getRedis() {
  return redis;
}

export async function rGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function rSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  try {
    const payload = JSON.stringify(value);
    if (ttlSec > 0) {
      await redis.set(key, payload, "EX", ttlSec);
    } else {
      await redis.set(key, payload);
    }
  } catch {
    // swallow cache errors to avoid breaking handlers
  }
}

export async function rDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // swallow
  }
}

export async function rDelMatch(pattern: string): Promise<void> {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", "200");
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== "0");
  } catch {
    // swallow
  }
}

const SAFE_SEG_RE = /[^A-Za-z0-9._-]+/g;

function safeSegment(value: string | null | undefined, fallback: string) {
  if (value === undefined || value === null || value === "") return fallback;
  return value.replace(SAFE_SEG_RE, "-");
}

function encodeCursor(value?: string) {
  if (!value) return "nil";
  return Buffer.from(value).toString("base64url");
}

function encodeKeyValue(value?: string | null) {
  if (!value) return "nil";
  return Buffer.from(value).toString("base64url");
}

function encodeSearch(value?: string) {
  if (!value) return "-";
  return Buffer.from(value).toString("base64url").slice(0, 44);
}

export const k = {
  list: (
    companyId: string | null | undefined,
    inboxId?: string | null,
    status?: string | null,
    kind?: string | null,
    q?: string | null,
    offset?: number,
    limit?: number,
  ) => {
    const c = safeSegment(companyId || "", "x");
    const i = safeSegment(inboxId || "", "*");
    const s = safeSegment((status || "ALL").toUpperCase(), "ALL");
    const kindSeg = safeSegment((kind || "ALL").toUpperCase(), "ALL");
    const off = Math.max(0, offset ?? 0);
    const lim = Math.max(1, limit ?? 20);
    const qq = encodeSearch(q || undefined);
    return `lc:list:${c}:${i}:${s}:${kindSeg}:${off}:${lim}:${qq}`;
  },
  chat: (chatId: string) => `lc:chat:${chatId}`,
  msgsKey: (chatId: string, before?: string, limit?: number) =>
    `lc:msgs:${chatId}:${encodeCursor(before)}:${Math.max(1, limit ?? 50)}`,
  msgsPrefix: (chatId: string) => `lc:msgs:${chatId}:*`,
  msgsSet: (chatId: string) => `lc:msgs:set:${chatId}`,
  privateChat: (chatId: string) => `lc:priv:${chatId}`,
  listPrefixCompany: (companyId?: string | null) =>
    `lc:list:${safeSegment(companyId || "", "*")}:*`,
  avatar: (companyId: string | null | undefined, remoteId: string | null | undefined) =>
    `lc:avatar:${safeSegment(companyId || "", "x")}:${encodeKeyValue(remoteId)}`,
};

export async function clearMessageCache(
  chatId: string,
  filter?: (key: string) => boolean,
): Promise<void> {
  const setKey = k.msgsSet(chatId);
  try {
    const keys = await redis.smembers(setKey);
    if (!keys || keys.length === 0) return;
    const targets = filter ? keys.filter(filter) : keys;
    if (targets.length > 0) {
      const pipeline = redis.pipeline();
      pipeline.del(...targets);
      pipeline.srem(setKey, ...targets);
      await pipeline.exec();
    }
    if (!filter || targets.length === keys.length) {
      await redis.del(setKey);
    } else if (keys.length > 0) {
      await redis.expire(setKey, Math.max(1, DEFAULT_MSGS_TTL * 2));
    }
  } catch (err) {
    console.warn(
      "[Redis] clearMessageCache failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
