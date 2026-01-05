
import "dotenv/config";
import { processFlowStep } from "./src/services/flow.engine";

async function forceStep() {
  const executionId = 'b70d50f4-962f-4585-9bd9-b84b438b2e2e';
  console.log(`🚀 Forçando processamento da execução ${executionId}...`);
  
  try {
    await processFlowStep(executionId);
    console.log("✅ Processamento concluído.");
  } catch (error) {
    console.error("❌ Erro ao processar:", error);
  }
  
  process.exit(0);
}

forceStep();
