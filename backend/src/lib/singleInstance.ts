// src/lib/singleInstance.ts
import { redis } from "./redis.ts";
import process from "node:process";

/**
 * Garante que apenas 1 instância do worker está rodando
 * Usa Redis para coordenação entre processos
 * @param workerType - Tipo do worker (inbound, outbound, media, all)
 */
export async function ensureSingleWorkerInstance(workerType: string = "all"): Promise<void> {
  const INSTANCE_KEY = `worker:instance:lock:${workerType}`;
  const INSTANCE_TTL = 30; // 30 segundos
  const CHECK_INTERVAL = 20000; // 20 segundos

  const instanceId = `${process.pid}-${Date.now()}`;

  // Tenta registrar esta instância
  const registered = await (redis as any).set(INSTANCE_KEY, instanceId, "NX", "EX", INSTANCE_TTL);

  if (!registered) {
    // Outra instância já está rodando
    const currentInstance = await redis.get(INSTANCE_KEY);
    console.error(`[SingleInstance][${workerType}] ❌ Outra instância do worker já está rodando: ${currentInstance}`);
    console.error(`[SingleInstance][${workerType}] ❌ Esta instância (PID ${process.pid}) será encerrada em 3 segundos...`);
    
    setTimeout(() => {
      console.error(`[SingleInstance][${workerType}] ❌ Encerrando PID ${process.pid}`);
      process.exit(1);
    }, 3000);
    
    return;
  }

  console.log(`[SingleInstance][${workerType}] ✅ Worker registrado: PID ${process.pid}`);

  // Renova o lock periodicamente (heartbeat)
  const heartbeat = setInterval(async () => {
    try {
      const current = await redis.get(INSTANCE_KEY);
      if (current === instanceId) {
        await redis.expire(INSTANCE_KEY, INSTANCE_TTL);
        console.log(`[SingleInstance][${workerType}] 💓 Heartbeat: PID ${process.pid}`);
      } else {
        console.error(`[SingleInstance][${workerType}] ⚠️  Lock perdido! Encerrando...`);
        clearInterval(heartbeat);
        process.exit(1);
      }
    } catch (error) {
      console.error(`[SingleInstance][${workerType}] ❌ Erro no heartbeat:`, error);
    }
  }, CHECK_INTERVAL);

  // Cleanup ao encerrar
  process.on("SIGINT", async () => {
    console.log(`[SingleInstance][${workerType}] 🛑 SIGINT recebido, limpando lock...`);
    clearInterval(heartbeat);
    const current = await redis.get(INSTANCE_KEY);
    if (current === instanceId) {
      await redis.del(INSTANCE_KEY);
    }
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log(`[SingleInstance][${workerType}] 🛑 SIGTERM recebido, limpando lock...`);
    clearInterval(heartbeat);
    const current = await redis.get(INSTANCE_KEY);
    if (current === instanceId) {
      await redis.del(INSTANCE_KEY);
    }
    process.exit(0);
  });
}
