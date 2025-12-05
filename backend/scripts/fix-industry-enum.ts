import { supabaseAdmin } from "../src/lib/supabase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixIndustryEnum() {
  console.log("\n🔧 Corrigindo enum company_industry...\n");

  const sqlPath = path.join(__dirname, "../sql/fix-industry-enum.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  // Executar o SQL
  const { data, error } = await supabaseAdmin.rpc("exec_sql", { sql_query: sql });

  if (error) {
    console.error("❌ Erro ao executar SQL:", error);
    
    // Tentar método alternativo: adicionar valores individualmente
    console.log("\n⚠️ Tentando método alternativo...\n");
    
    const industries = [
      "education",
      "accounting", 
      "clinic",
      "solar_energy",
      "construction",
      "real_estate",
      "events",
      "law"
    ];

    for (const industry of industries) {
      console.log(`Adicionando ${industry}...`);
      const addSql = `
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = '${industry}' AND enumtypid = 'company_industry'::regtype) THEN
            ALTER TYPE company_industry ADD VALUE '${industry}';
            RAISE NOTICE 'Adicionado: ${industry}';
          ELSE
            RAISE NOTICE 'Já existe: ${industry}';
          END IF;
        END $$;
      `;
      
      const { error: addError } = await supabaseAdmin.rpc("exec_sql", { sql_query: addSql });
      if (addError) {
        console.error(`  ❌ Erro ao adicionar ${industry}:`, addError.message);
      } else {
        console.log(`  ✅ ${industry} processado`);
      }
    }
  } else {
    console.log("✅ SQL executado com sucesso!");
    console.log("Data:", data);
  }

  // Verificar valores atuais
  console.log("\n📋 Verificando valores do enum...\n");
  const checkSql = `
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = 'company_industry'::regtype 
    ORDER BY enumsortorder;
  `;
  
  const { data: enumData, error: enumError } = await supabaseAdmin.rpc("exec_sql", { sql_query: checkSql });
  
  if (enumError) {
    console.error("❌ Erro ao verificar enum:", enumError);
  } else {
    console.log("Valores atuais do enum company_industry:");
    console.log(enumData);
  }
}

fixIndustryEnum()
  .then(() => {
    console.log("\n✅ Processo concluído!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Erro:", err);
    process.exit(1);
  });
