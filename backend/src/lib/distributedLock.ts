// src/lib/distributedLock.ts
import { redis } from "./redis.ts";

/**
 * Lock distribuído simples usando Redis SET NX
 * Permite múltiplos workers sem duplicação
 */
export class DistributedLock {
  private lockKey: string;
  private lockValue: string;
  private ttlSeconds: number;

  constructor(lockName: string, ttlSeconds: number = 50) {
    this.lockKey = `lock:${lockName}`;
    this.lockValue = `${process.pid}-${Date.now()}`;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Tenta adquirir o lock
   * @returns true se conseguiu, false se outro worker já tem o lock
   */
  async acquire(): Promise<boolean> {
    try {
      // ioredis usa: SET key value NX EX seconds
      const result = await redis.set(
        this.lockKey,
        this.lockValue,
        "NX", // SET if Not eXists
        "EX", // Expiration
        this.ttlSeconds
      );

      return result === "OK";
    } catch (error) {
      console.error(`[DistributedLock] Erro ao adquirir lock ${this.lockKey}:`, error);
      return false;
    }
  }

  /**
   * Libera o lock (apenas se este processo for o dono)
   */
  async release(): Promise<void> {
    try {
      // Verifica se ainda somos donos do lock antes de deletar
      const currentValue = await redis.get(this.lockKey);
      if (currentValue === this.lockValue) {
        await redis.del(this.lockKey);
      }
    } catch (error) {
      console.warn(`[DistributedLock] Erro ao liberar lock ${this.lockKey}:`, error);
    }
  }

  /**
   * Executa função com lock automático
   * @param fn Função a executar com lock
   * @param skipIfLocked Se true, retorna null se lock não disponível. Se false, aguarda.
   */
  static async executeWithLock<T>(
    lockName: string,
    fn: () => Promise<T>,
    options: {
      ttlSeconds?: number;
      skipIfLocked?: boolean;
      maxWaitMs?: number;
    } = {}
  ): Promise<T | null> {
    const { ttlSeconds = 50, skipIfLocked = true, maxWaitMs = 30000 } = options;
    const lock = new DistributedLock(lockName, ttlSeconds);

    const startTime = Date.now();
    let acquired = false;

    // Tenta adquirir lock (com retry se necessário)
    while (!acquired) {
      acquired = await lock.acquire();

      if (!acquired) {
        if (skipIfLocked) {
          console.log(`[DistributedLock] ${lockName} - outro worker processando, pulando`);
          return null;
        }

        // Aguarda um pouco antes de tentar novamente
        if (Date.now() - startTime > maxWaitMs) {
          console.error(`[DistributedLock] ${lockName} - timeout aguardando lock`);
          return null;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`[DistributedLock] ${lockName} - lock adquirido por PID ${process.pid}`);

    try {
      return await fn();
    } finally {
      await lock.release();
      console.log(`[DistributedLock] ${lockName} - lock liberado`);
    }
  }
}

/**
 * Helper para jobs recorrentes com lock
 */
export async function runWithDistributedLock<T>(
  lockName: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 50
): Promise<T | null> {
  return DistributedLock.executeWithLock(lockName, fn, {
    ttlSeconds,
    skipIfLocked: true, // Pula se outro worker já está rodando
  });
}
