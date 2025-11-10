// backend/src/services/buffer.ts
import { redis } from "../lib/redis.ts";

export type BufferItem = {
  companyId: string;
  inboxId?: string | null;
  chatId: string;
  provider: "META" | "WAHA";
  text: string;
  createdAt: string; // ISO string
};

// Redis keys helpers
const key = {
  list: (companyId: string, chatId: string) => `buf:list:${companyId}:${chatId}`,
  due: () => `buf:due:zset`,
  lock: (companyId: string, chatId: string) => `buf:lock:${companyId}:${chatId}`,
  paused: (companyId: string, chatId: string) => `buf:paused:${companyId}:${chatId}`,
};

function toEpoch(ms: number | Date): number {
  if (typeof ms === "number") return Math.floor(ms / 1000);
  return Math.floor(ms.getTime() / 1000);
}

export type BufferConfig = {
  windowSec: number; // inactivity window to flush
  maxBatch?: number | null; // optional max messages per flush
};

/** Add a message to the chat buffer and (re)arm its due time. */
export async function enqueueMessage(args: {
  companyId: string;
  inboxId?: string | null;
  chatId: string;
  provider: "META" | "WAHA";
  text: string;
  config: BufferConfig;
}): Promise<void> {
  const { companyId, inboxId, chatId, provider, text, config } = args;
  const pausedKey = key.paused(companyId, chatId);
  const isPaused = await redis.exists(pausedKey);
  if (isPaused) return; // don't buffer if paused

  const item: BufferItem = {
    companyId,
    inboxId: inboxId ?? null,
    chatId,
    provider,
    text,
    createdAt: new Date().toISOString(),
  };

  const listKey = key.list(companyId, chatId);
  const dueZ = key.due();
  const dueAt = toEpoch(Date.now() + Math.max(1, config.windowSec) * 1000);

  const pipeline = redis.multi();
  pipeline.rpush(listKey, JSON.stringify(item));
  if (typeof config.maxBatch === "number" && config.maxBatch > 0) {
    // keep only the last N items (but rpush grows right, so trim left if too big)
    pipeline.ltrim(listKey, -config.maxBatch, -1);
  }
  // score is seconds-based epoch. We reset it on every enqueue to implement inactivity window
  pipeline.zadd(dueZ, dueAt, listKey);
  // ensure list has a TTL so abandoned chats don't live forever (24h)
  pipeline.expire(listKey, 24 * 60 * 60);
  await pipeline.exec();
}

/** Remove any pending buffer for a chat and mark as paused (optional TTL). */
export async function pauseBuffer(companyId: string, chatId: string, ttlSec = 3600): Promise<void> {
  const listKey = key.list(companyId, chatId);
  const dueZ = key.due();
  const pausedKey = key.paused(companyId, chatId);
  const pipeline = redis.multi();
  pipeline.zrem(dueZ, listKey);
  pipeline.del(listKey);
  if (ttlSec > 0) {
    pipeline.set(pausedKey, "1", { EX: ttlSec } as any);
  } else {
    pipeline.set(pausedKey, "1");
  }
  await pipeline.exec();
}

/** Pop and return all buffered messages for a chat. */
export async function popBatch(listKey: string): Promise<BufferItem[]> {
  // atomically fetch all items and clear
  const items = await redis.lrange(listKey, 0, -1);
  if (items.length > 0) await redis.del(listKey);
  return items.map((raw) => {
    try {
      return JSON.parse(raw) as BufferItem;
    } catch {
      return null as unknown as BufferItem;
    }
  }).filter(Boolean);
}

/**
 * Return list keys due to be flushed at or before now.
 * We use the zset to locate chat list keys; the member value is the list key itself.
 */
export async function getDue(now = new Date()): Promise<string[]> {
  const nowSec = toEpoch(now);
  const due = await redis.zrangebyscore(key.due(), 0, nowSec);
  return due;
}

/** Remove a chat list key from due zset. */
export async function clearDue(listKey: string): Promise<void> {
  await redis.zrem(key.due(), listKey);
}

/** Convenience to derive companyId and chatId back from a listKey string. */
export function parseListKey(listKey: string): { companyId: string; chatId: string } | null {
  // format: buf:list:<companyId>:<chatId>
  const parts = listKey.split(":");
  if (parts.length >= 4 && parts[0] === "buf" && parts[1] === "list") {
    const companyId = parts[2];
    const chatId = parts.slice(3).join(":"); // chatId might contain ':' in theory
    return { companyId, chatId };
  }
  return null;
}

/** Try to acquire a short-lived lock for a chat buffer processing. */
export async function tryLock(companyId: string, chatId: string, ttlSec = 15): Promise<boolean> {
  const lockKey = key.lock(companyId, chatId);
  // SET NX EX implements a simple mutex with TTL to avoid deadlocks
  const res = await redis.set(lockKey, "1", {
    NX: true,
    EX: Math.max(1, ttlSec),
  } as any);
  return res === "OK";
}

/** Release a previously acquired lock. */
export async function releaseLock(companyId: string, chatId: string): Promise<void> {
  const lockKey = key.lock(companyId, chatId);
  try {
    await redis.del(lockKey);
  } catch {}
}
