// src/services/pg.ts
import pg from "pg";
import type { QueryResultRow } from "pg";

const { Pool } = pg;

const {
  DATABASE_URL,
  SUPABASE_DB_URL,
  POSTGRES_URL,
  DIRECT_URL,
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  PGSSL,
  ENCRYPTION_KEY,
  DB_TIMEZONE = "America/Porto_Velho",
  PG_MAX_RETRIES,
  PG_RETRY_DELAY_MS,
} = process.env;

const DEFAULT_POOL_SIZE = 20;
const MAX_RETRY_ATTEMPTS = Math.max(1, Number(PG_MAX_RETRIES ?? 3));
const RETRY_DELAY_BASE_MS = Math.max(0, Number(PG_RETRY_DELAY_MS ?? 200));

const RETRYABLE_SQLSTATE_CODES = new Set(["57P01"]);
const RETRYABLE_MESSAGES = [
  "connection terminated",
  "terminating connection due to administrator command",
];

const isLocal = (s?: string | null) => !!s && /localhost|127\.0\.0\.1/i.test(s ?? "");
const isSslForced = typeof PGSSL === "string" && ["1", "true", "t", "yes", "on", "require"].includes(PGSSL.toLowerCase());

function resolveSsl(target?: string | null) {
  // Force SSL for Supabase/Supavisor connections unless explicitly disabled
  if (target && (target.includes('supabase.com') || target.includes('supabase.co'))) {
    return { rejectUnauthorized: false };
  }
  if (isSslForced) return { rejectUnauthorized: false };
  if (!target) return undefined;
  return isLocal(target) ? undefined : { rejectUnauthorized: false };
}

function buildPoolConfig() {
  const url = DATABASE_URL || SUPABASE_DB_URL || POSTGRES_URL || DIRECT_URL;

  if (url && url.trim()) {
    return {
      connectionString: url,
      ssl: resolveSsl(url),
      max: DEFAULT_POOL_SIZE,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    };
  }

  if (!(PGHOST && PGUSER && PGDATABASE)) {
    throw new Error("DATABASE_URL/PGHOST não definido. Configure sua conexão do Postgres.");
  }

  return {
    host: PGHOST,
    port: PGPORT ? Number(PGPORT) : 5432,
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE,
    ssl: resolveSsl(PGHOST),
    max: DEFAULT_POOL_SIZE,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}

const globalForPg = globalThis as typeof globalThis & { __sharedPgPool?: pg.Pool };

function createPool(): pg.Pool {
  const instance = new Pool(buildPoolConfig());

  instance.on("error", (error) => {
    console.error("[PG] idle client error", error);
  });

  instance.on("connect", async (client) => {
    const pid = (client as any)?.processID ?? "unknown";
    console.info(`[PG] client connected (pid=${pid})`);
    if (ENCRYPTION_KEY && ENCRYPTION_KEY.length > 0) {
      try {
        await client.query("select set_config($1, $2, false)", ["app.encryption_key", ENCRYPTION_KEY]);
      } catch (err) {
        console.error("[PG] failed to set encryption key", err);
      }
    }
    if (DB_TIMEZONE) {
      try {
        await client.query("select set_config($1, $2, false)", ["TimeZone", DB_TIMEZONE]);
      } catch (err) {
        console.error("[PG] failed to set timezone", err);
      }
    }
  });

  return instance;
}

const pool = globalForPg.__sharedPgPool ?? createPool();
if (!globalForPg.__sharedPgPool) {
  globalForPg.__sharedPgPool = pool;
  const max = (pool as any)?.options?.max ?? DEFAULT_POOL_SIZE;
  console.info(`[PG] pool initialized (max=${max})`);
}

function formatPgError(error: any): string {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  const message = typeof error?.message === "string" ? error.message : "unknown";
  return `code=${code} message=${message}`;
}

function isRetryablePgError(error: any): boolean {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code : undefined;
  if (code && RETRYABLE_SQLSTATE_CODES.has(code)) return true;

  const message = (error.message ?? "").toString().toLowerCase();
  return RETRYABLE_MESSAGES.some((fragment) => message.includes(fragment));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry<T>(operation: () => Promise<T>, attempt = 1): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= MAX_RETRY_ATTEMPTS || !isRetryablePgError(error)) {
      throw error;
    }
    console.warn(
      `[PG] retrying query (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}) after ${formatPgError(error)}`,
    );
    await delay(RETRY_DELAY_BASE_MS * attempt);
    return runWithRetry(operation, attempt + 1);
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
) {
  return runWithRetry(() => pool.query<T>(text, params));
}

export async function none(text: string, params?: any[]) {
  await runWithRetry(() => pool.query(text, params));
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<T> {
  const { rows } = await runWithRetry(() => pool.query<T>(text, params));
  if (rows.length !== 1) {
    throw new Error(`Expected 1 row, got ${rows.length}`);
  }
  return rows[0] as T;
}

export async function oneOrNone<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<T | null> {
  const { rows } = await runWithRetry(() => pool.query<T>(text, params));
  return (rows[0] as T) || null;
}

export async function any<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<T[]> {
  const { rows } = await runWithRetry(() => pool.query<T>(text, params));
  return rows as T[];
}

type TransactionSql = {
  query: typeof query;
  none: typeof none;
  one: typeof one;
  oneOrNone: typeof oneOrNone;
  any: typeof any;
};

export async function withTransaction<T>(
  fn: (sql: TransactionSql) => Promise<T>,
  attempt = 1,
): Promise<T> {
  const client = await pool.connect();
  let began = false;

  const sql = {
    query: <R extends QueryResultRow = QueryResultRow>(t: string, p?: any[]) =>
      client.query<R>(t, p),
    none: async (t: string, p?: any[]) => {
      await client.query(t, p);
    },
    one: async <R extends QueryResultRow = QueryResultRow>(t: string, p?: any[]) => {
      const { rows } = await client.query<R>(t, p);
      if (rows.length !== 1) {
        throw new Error(`Expected 1 row, got ${rows.length}`);
      }
      return rows[0] as R;
    },
    oneOrNone: async <R extends QueryResultRow = QueryResultRow>(t: string, p?: any[]) => {
      const { rows } = await client.query<R>(t, p);
      if (rows.length === 0) {
        return null;
      }
      return rows[0] as R;
    },
    any: async <R extends QueryResultRow = QueryResultRow>(t: string, p?: any[]) => {
      const { rows } = await client.query<R>(t, p);
      return rows as R[];
    },
  };

  try {
    await client.query("BEGIN");
    began = true;
    const result = await fn(sql);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("[PG] rollback failed", rollbackError);
      }
    }
    if (attempt < MAX_RETRY_ATTEMPTS && isRetryablePgError(error)) {
      console.warn(
        `[PG] retrying transaction (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}) after ${formatPgError(error)}`,
      );
      await delay(RETRY_DELAY_BASE_MS * attempt);
      return withTransaction(fn, attempt + 1);
    }
    throw error;
  } finally {
    client.release();
  }
}

export function getPool() {
  return pool;
}

export const db = { query, none, one, oneOrNone, any, withTransaction, getPool };
export default db;
