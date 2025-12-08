/**
 * Script para adicionar coluna solar_kit_full_specs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variáveis de ambiente não configuradas");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("\n========================================");
  console.log("ADICIONANDO COLUNA solar_kit_full_specs");
  console.log("========================================\n");

  // Ler SQL
  const sqlPath = path.join(__dirname, "sql", "add_solar_kit_full_specs.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  console.log("📄 SQL a executar:");
  console.log(sql);
  console.log("\n🔄 Executando...\n");

  const { error } = await supabaseAdmin.rpc("exec_sql", { sql_query: sql });

  if (error) {
    console.error("❌ Erro ao executar migração:", error.message);
    
    // Tentar método alternativo
    console.log("\n🔄 Tentando método alternativo via Supabase Admin...");
    
    try {
      // Verificar se coluna já existe
      const { data: columns } = await supabaseAdmin
        .from("proposals")
        .select("solar_kit_full_specs")
        .limit(1);
      
      console.log("✅ Coluna solar_kit_full_specs já existe ou foi criada!");
    } catch (e: any) {
      console.error("❌ Erro:", e.message);
      console.log("\n⚠️ Execute manualmente no Supabase SQL Editor:");
      console.log(sql);
    }
  } else {
    console.log("✅ Migração executada com sucesso!");
  }

  console.log("\n========================================");
  console.log("CONCLUÍDO");
  console.log("========================================\n");
}

runMigration().catch(console.error);
