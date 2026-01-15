// src/lib/singleInstance.ts
import { redis } from "./redis.js";
import process from "node:process";

/**
 * Garante que apenas 1 instância do worker está rodando
 * Usa Redis para coordenação entre processos
 * @param workerType - Tipo do worker (inbound, outbound, media, all)
 */
export async function ensureSingleWorkerInstance(workerType: string = "all"): Promise<void> {
  const INSTANCE_KEY = `worker:instance:lock:${workerType}`;
  const INSTANCE_TTL = 60; // 60 segundos (aumentado de 30 para evitar perda por lag do event loop)
  const CHECK_INTERVAL = 15000; // 15 segundos (reduzido de 20 para ser mais proativo)

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

  console.log(`[SingleInstance][${workerType}] ✅ Worker registrado: PID ${process.pid} (ID: ${instanceId})`);

  // Renova o lock periodicamente (heartbeat)
  const heartbeat = setInterval(async () => {
    try {
      const current = await redis.get(INSTANCE_KEY);
      
      if (current === instanceId) {
        // Sou eu mesmo, renova
        await redis.expire(INSTANCE_KEY, INSTANCE_TTL);
        console.debug(`[SingleInstance][${workerType}] 💓 Heartbeat: PID ${process.pid}`);
      } else if (current === null) {
        // Lock expirou no Redis (provavelmente por lag exagerado do event loop)
        // Tenta recuperar se ninguém pegou ainda
        const reacquired = await (redis as any).set(INSTANCE_KEY, instanceId, "NX", "EX", INSTANCE_TTL);
        if (reacquired) {
          console.warn(`[SingleInstance][${workerType}] ♻️ Lock expirado recuperado (Auto-Healing): PID ${process.pid}`);
        } else {
          const newOwner = await redis.get(INSTANCE_KEY);
          console.error(`[SingleInstance][${workerType}] ⚠️ Lock expirado e assumido por outra instância: ${newOwner}`);
          clearInterval(heartbeat);
          process.exit(1);
        }
      } else {
        // Outro ID está lá (outra instância forçou a entrada?)
        console.error(`[SingleInstance][${workerType}] ⚠️ Lock perdido (Assumido por ${current})! Encerrando PID ${process.pid}...`);
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
