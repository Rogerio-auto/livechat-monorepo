/**
 * Script para verificar estrutura da tabela proposals
 */

import { supabaseAdmin } from "./src/lib/supabase.js";

async function checkProposalsStructure() {
  console.log("\n" + "=".repeat(70));
  console.log("ESTRUTURA DA TABELA PROPOSALS");
  console.log("=".repeat(70));
  
  // Buscar uma proposta como exemplo
  const { data: proposal, error } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .limit(1)
    .single();
  
  if (error) {
    console.error("❌ Erro ao buscar proposta:", error.message);
    return;
  }
  
  if (!proposal) {
    console.log("⚠️  Nenhuma proposta encontrada no banco");
    return;
  }
  
  console.log("\n📋 Colunas disponíveis na tabela proposals:");
  console.log("=".repeat(70));
  
  const columns = Object.keys(proposal).sort();
  
  for (const col of columns) {
    const value = proposal[col];
    const type = typeof value;
    const hasValue = value !== null && value !== undefined;
    
    console.log(`${hasValue ? '✅' : '⚪'} ${col.padEnd(30)} = ${hasValue ? JSON.stringify(value).substring(0, 50) : 'NULL'}`);
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("CAMPOS RELACIONADOS A ENERGIA SOLAR:");
  console.log("=".repeat(70));
  
  const solarFields = columns.filter(col => 
    col.includes('solar') || 
    col.includes('power') || 
    col.includes('panel') ||
    col.includes('inverter') ||
    col.includes('payback') ||
    col.includes('energy')
  );
  
  if (solarFields.length > 0) {
    for (const field of solarFields) {
      console.log(`  - ${field}: ${proposal[field]}`);
    }
  } else {
    console.log("  ⚠️  Nenhum campo solar encontrado!");
    console.log("\n  💡 Campos disponíveis que podem ser úteis:");
    
    const usefulFields = columns.filter(col =>
      col.includes('total') ||
      col.includes('value') ||
      col.includes('description') ||
      col.includes('items') ||
      col.includes('metadata')
    );
    
    for (const field of usefulFields) {
      console.log(`  - ${field}`);
    }
  }
  
  console.log("\n" + "=".repeat(70));
}

checkProposalsStructure()
  .then(() => {
    console.log("\n✅ Verificação concluída!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
