
import "dotenv/config";
import crypto from "node:crypto";
import db from "../src/pg.js";
import { WebhookService } from "../src/services/webhook.service.js";
import { publish } from "../src/queue/rabbit.js";

async function smokeTest() {
  console.log("🚀 Starting E2E Smoke Test...");

  const TEST_COMPANY_ID = "b9cb707c-49b2-43b6-bb02-e8f932ba8153"; // Usar UUID válido se necessário
  
  try {
    // 1. Verificar Conexão com Banco
    console.log("--- 1. Database Connection ---");
    const now = await db.one("SELECT now()");
    console.log("✅ DB Connected:", now.now);

    // 2. Criar uma API Key Manualmente para teste (simulando o painel)
    console.log("\n--- 2. API Key Generation ---");
    const label = "E2E Smoke Test Key";
    const randomPart = crypto.randomBytes(24).toString("hex");
    const fullKey = `sk_live_${randomPart}`;
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");

    await db.none(
        `INSERT INTO public.api_keys (company_id, label, key_prefix, key_hash)
         VALUES ($1, $2, $3, $4)`,
        [TEST_COMPANY_ID, label, "sk_live_", keyHash]
    ).catch(e => {
        if (e.code === '23505') console.log("   (Key already exists in DB, continuing...)");
        else throw e;
    });
    console.log("✅ API Key created for testing.");
    console.log("   Key:", fullKey);

    // 3. Simular disparo de Webhook (Disparador -> Rabbit -> Fila)
    console.log("\n--- 3. Webhook Triggering ---");
    const testData = { message_id: "msg_123", text: "Hello from Smoke Test" };
    await WebhookService.trigger("message.created", TEST_COMPANY_ID, testData);
    console.log("✅ Webhook 'message.created' queued in RabbitMQ.");

    // 4. Instrução para o usuário
    console.log("\n--- TEST COMPLETE ---");
    console.log("Para validar o processamento:");
    console.log("1. Certifique-se de que o RabbitMQ está rodando.");
    console.log("2. Execute 'npm run worker' em um terminal separado.");
    console.log("3. Verifique se o worker logou '[worker][webhook] dispatching event message.created'.");
    
  } catch (err) {
    console.error("❌ Smoke Test Failed:", err);
  } finally {
    process.exit(0);
  }
}

smokeTest();
