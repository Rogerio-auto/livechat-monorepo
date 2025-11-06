import "dotenv/config";
import { db } from "../src/pg";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log("🔄 Executando migration 014...\n");
  
  try {
    const sql = readFileSync(join(__dirname, "../sql/014_fix_agents_nullable_columns.sql"), "utf-8");
    
    await db.none(sql);
    
    console.log("✅ Migration 014 executada com sucesso!");
    console.log("   • aggregation_window_sec: NULL permitido");
    console.log("   • max_batch_messages: NULL permitido");
    console.log("   • reply_if_idle_sec: NULL permitido");
    console.log("   • media_config: NULL permitido");
    console.log("   • tools_policy: NULL permitido\n");
    
  } catch (err) {
    console.error("❌ Erro ao executar migration:", err);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigration();
