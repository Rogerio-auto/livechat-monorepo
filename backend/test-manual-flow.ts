
import "dotenv/config";
import { triggerManualFlow } from "./src/services/flow.engine.js";
import { supabaseAdmin } from "./src/lib/supabase.js";

/**
 * Script para testar o disparo manual de um fluxo em um chat real
 */
async function testManualFlow() {
  const companyId = 'b9cb707c-49b2-43b6-bb02-e8f932ba8153';
  const flowId = 'e550a58d-5d93-40c6-9c15-a8bf08ebe46a';
  const contactId = '2bd29c20-4f0c-4c14-bfc1-0f8b84cb0d54';
  const chatId = '367b10b9-e1b4-408f-b477-e050277405de';
  const userId = 'd18cad1b-6a7a-4c95-82a1-f9fd862fb140'; // kiusevensolar@gmail.com

  console.log(`🚀 Iniciando teste de fluxo manual...`);
  console.log(`Flow ID: ${flowId}`);
  console.log(`Chat ID: ${chatId}`);
  console.log(`User ID: ${userId}`);

  try {
    // 1. Verificar se o fluxo existe
    const { data: flow, error: flowErr } = await supabaseAdmin
      .from("automation_flows")
      .select("name")
      .eq("id", flowId)
      .single();

    if (flowErr || !flow) {
      console.error("❌ Erro: Fluxo não encontrado no banco de dados.");
      return;
    }
    console.log(`✅ Fluxo encontrado: "${flow.name}"`);

    // 2. Disparar o fluxo
    await triggerManualFlow({
      companyId,
      flowId,
      contactId,
      chatId,
      userId,
      variables: {
        test_run: true,
        triggered_at: new Date().toISOString()
      }
    });

    console.log("✅ Fluxo disparado com sucesso!");
    console.log("Check os logs do worker para ver a execução dos nós.");
    
  } catch (error) {
    console.error("❌ Erro ao disparar fluxo:", error);
  } finally {
    process.exit(0);
  }
}

testManualFlow();
