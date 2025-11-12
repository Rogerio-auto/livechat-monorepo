// Script para executar migration 025 - Adicionar ferramenta send_interactive_buttons
import { db } from "../src/pg";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration() {
  console.log("🔄 Executando migration 025: send_interactive_buttons...\n");

  try {
    const sqlPath = join(__dirname, "../sql/025_add_interactive_buttons_tool.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    console.log("📄 Lendo SQL da migration...");
    await db.none(sql);

    console.log("\n✅ Migration 025 executada com sucesso!");
    console.log("\n📋 Ferramenta criada:");
    console.log("   - Key: send_interactive_buttons");
    console.log("   - Handler: SOCKET");
    console.log("   - Provider: META_CLOUD apenas");
    console.log("   - Botões: 1 a 3 (máx 20 caracteres cada)");

    console.log("\n🔍 Verificando ferramenta...");
    const tool = await db.oneOrNone(
      `SELECT key, name, category, handler_type, is_active 
       FROM public.tools_catalog 
       WHERE key = 'send_interactive_buttons'`
    );

    if (tool) {
      console.log("\n✅ Ferramenta encontrada no catálogo:");
      console.log(`   - Name: ${tool.name}`);
      console.log(`   - Category: ${tool.category}`);
      console.log(`   - Handler: ${tool.handler_type}`);
      console.log(`   - Active: ${tool.is_active}`);
    } else {
      throw new Error("Ferramenta não encontrada após migration!");
    }

    console.log("\n✨ Para usar esta ferramenta:");
    console.log("   1. Vincule-a a um agente em /admin (Tools Manager)");
    console.log("   2. Configure o agente com inbox META_CLOUD");
    console.log("   3. Atualize o prompt do agente (veja exemplo no README)");
    console.log("   4. A ferramenta será executada automaticamente quando necessário");

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Erro ao executar migration:", error.message || error);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
