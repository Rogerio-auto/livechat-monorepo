
import "dotenv/config";
import { EX_APP, publish } from "./src/queue/rabbit.js";

async function testPublish() {
  const executionId = 'b70d50f4-962f-4585-9bd9-b84b438b2e2e';
  console.log(`📤 Publicando execução ${executionId} na fila...`);
  
  const ok = await publish(EX_APP, "flow.execution", { executionId });
  console.log(`✅ Publicado: ${ok}`);
  
  setTimeout(() => process.exit(0), 2000);
}

testPublish();
