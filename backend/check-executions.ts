
import "dotenv/config";
import { supabaseAdmin } from "./src/lib/supabase";

async function checkExecutions() {
  const flowId = 'e550a58d-5d93-40c6-9c15-a8bf08ebe46a';
  const contactId = '2bd29c20-4f0c-4c14-bfc1-0f8b84cb0d54';

  console.log(`🔍 Verificando execuções para Flow ${flowId} e Contato ${contactId}...`);

  const { data: executions, error } = await supabaseAdmin
    .from("flow_executions")
    .select("*")
    .eq("flow_id", flowId)
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("❌ Erro ao buscar execuções:", error);
    return;
  }

  if (!executions || executions.length === 0) {
    console.log("ℹ️ Nenhuma execução encontrada.");
  } else {
    console.table(executions.map(e => ({
      id: e.id,
      status: e.status,
      current_node: e.current_node_id,
      next_step_at: e.next_step_at,
      created_at: e.created_at
    })));
  }

  process.exit(0);
}

checkExecutions();
