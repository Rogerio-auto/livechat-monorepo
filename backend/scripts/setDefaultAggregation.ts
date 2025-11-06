// Script para configurar valores padrão de agregação em agentes existentes
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente do backend
dotenv.config({ path: resolve(__dirname, "../.env") });

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setDefaultAggregation() {
  console.log("🔄 Configurando agregação padrão para agentes existentes...\n");

  try {
    // Buscar todos os agentes que não têm agregação configurada
    const result = await db.query(`
      SELECT id, name, aggregation_enabled, aggregation_window_sec, max_batch_messages
      FROM agents
      WHERE aggregation_enabled IS NULL OR aggregation_enabled = false
    `);

    const agents = result.rows;

    if (agents.length === 0) {
      console.log("✅ Todos os agentes já possuem agregação configurada!");
      await db.end();
      return;
    }

    console.log(`📊 Encontrados ${agents.length} agentes para atualizar:\n`);
    
    for (const agent of agents) {
      console.log(`  - ${agent.name} (${agent.id})`);
      console.log(`    Antes: enabled=${agent.aggregation_enabled}, window=${agent.aggregation_window_sec}, max=${agent.max_batch_messages}`);
    }

    // Atualizar todos de uma vez
    await db.query(`
      UPDATE agents
      SET 
        aggregation_enabled = true,
        aggregation_window_sec = 20,
        max_batch_messages = 20
      WHERE aggregation_enabled IS NULL OR aggregation_enabled = false
    `);

    console.log("\n✅ Todos os agentes atualizados com sucesso!");
    console.log("   Valores padrão aplicados:");
    console.log("   - aggregation_enabled: true");
    console.log("   - aggregation_window_sec: 20");
    console.log("   - max_batch_messages: 20");

    await db.end();
  } catch (error) {
    console.error("❌ Erro:", error);
    await db.end();
    process.exit(1);
  }
}

setDefaultAggregation();
