/**
 * Script para verificar se as colunas necessárias existem no banco
 */

import { supabaseAdmin } from "./src/lib/supabase.js";

async function checkColumns() {
  console.log("\n" + "=".repeat(70));
  console.log("VERIFICAÇÃO DE COLUNAS NO BANCO DE DADOS");
  console.log("=".repeat(70));
  
  const checks = [
    {
      table: 'document_templates',
      column: 'template_type',
      description: 'Tipo do template'
    },
    {
      table: 'document_templates',
      column: 'generator_type',
      description: 'Tipo de gerador (generic ou python_solar)'
    },
    {
      table: 'proposals',
      column: 'seller_id',
      description: 'ID do vendedor'
    },
    {
      table: 'documents',
      column: 'pdf_path',
      description: 'Caminho do PDF gerado'
    }
  ];
  
  console.log("\n📋 Verificando colunas necessárias...\n");
  
  let allExist = true;
  
  for (const check of checks) {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = '${check.table}' 
          AND column_name = '${check.column}'
        ) as exists
      `
    }).maybeSingle();
    
    if (error) {
      // Método alternativo - tentar query direta
      const { data: testData, error: testError } = await supabaseAdmin
        .from(check.table)
        .select(check.column)
        .limit(1);
      
      const exists = !testError || !testError.message.includes('does not exist');
      
      const status = exists ? '✅' : '❌';
      console.log(`${status} ${check.table}.${check.column}`);
      console.log(`   ${check.description}`);
      
      if (!exists) {
        console.log(`   ⚠️  COLUNA NÃO ENCONTRADA!`);
        allExist = false;
      }
    } else {
      const exists = data?.exists || false;
      const status = exists ? '✅' : '❌';
      console.log(`${status} ${check.table}.${check.column}`);
      console.log(`   ${check.description}`);
      
      if (!exists) {
        console.log(`   ⚠️  COLUNA NÃO ENCONTRADA!`);
        allExist = false;
      }
    }
    console.log();
  }
  
  console.log("=".repeat(70));
  
  if (allExist) {
    console.log("✅ TODAS AS COLUNAS EXISTEM!");
    console.log("O sistema está pronto para uso.");
  } else {
    console.log("❌ FALTAM COLUNAS NO BANCO!");
    console.log("\n📝 AÇÃO NECESSÁRIA:");
    console.log("1. Abra o Supabase Dashboard");
    console.log("2. Vá em SQL Editor");
    console.log("3. Cole o conteúdo do arquivo:");
    console.log("   backend/sql/043_add_missing_columns.sql");
    console.log("4. Execute o script");
    console.log("5. Execute este diagnóstico novamente");
  }
  
  console.log("=".repeat(70));
}

checkColumns()
  .then(() => {
    console.log("\n✅ Verificação concluída!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error.message);
    process.exit(1);
  });
