/**
 * Adiciona coluna solar_kit_full_specs diretamente via SQL
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variáveis não configuradas");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
  console.log("\n🔧 Adicionando coluna solar_kit_full_specs...\n");

  // Primeiro, testar se já existe
  try {
    const { data, error } = await supabase
      .from("proposals")
      .select("solar_kit_full_specs")
      .limit(1);

    if (!error) {
      console.log("✅ Coluna já existe!");
      return;
    }
  } catch (e) {
    console.log("📌 Coluna não existe, criando...");
  }

  // Tentar inserir em uma proposta existente para forçar erro de schema
  const { error: insertError } = await supabase
    .from("proposals")
    .update({ solar_kit_full_specs: "teste" })
    .eq("id", "00000000-0000-0000-0000-000000000000"); // ID inexistente

  if (insertError) {
    console.log("\n⚠️ Erro esperado:", insertError.message);
    console.log("\n📋 EXECUTE ESTE SQL NO SUPABASE SQL EDITOR:\n");
    console.log("=" .repeat(60));
    console.log(`
ALTER TABLE proposals 
ADD COLUMN solar_kit_full_specs TEXT;

COMMENT ON COLUMN proposals.solar_kit_full_specs 
IS 'Especificação completa do kit solar (todos os componentes)';
    `.trim());
    console.log("=" .repeat(60));
    console.log("\n🔗 Acesse: https://supabase.com/dashboard/project/_/sql\n");
  }
}

addColumn().catch(console.error);
