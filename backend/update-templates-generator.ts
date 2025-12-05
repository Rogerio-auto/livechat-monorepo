/**
 * Script para atualizar templates existentes com generator_type correto
 */

import { supabaseAdmin } from "./src/lib/supabase.js";

async function updateExistingTemplates() {
  console.log("\n" + "=".repeat(70));
  console.log("ATUALIZAR TEMPLATES EXISTENTES");
  console.log("=".repeat(70));
  
  try {
    // 1. Buscar todos os templates
    console.log("\n1️⃣  Buscando templates...");
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from("document_templates")
      .select("id, name, doc_type, company_id, generator_type");
    
    if (templatesError) {
      console.error("❌ Erro ao buscar templates:", templatesError.message);
      return;
    }
    
    if (!templates || templates.length === 0) {
      console.log("⚠️  Nenhum template encontrado");
      return;
    }
    
    console.log(`✅ ${templates.length} templates encontrados`);
    
    // 2. Para cada template, verificar o nicho da empresa
    console.log("\n2️⃣  Analisando e atualizando templates...");
    
    for (const template of templates) {
      console.log(`\n📄 Template: ${template.name}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   Tipo: ${template.doc_type}`);
      console.log(`   Gerador atual: ${template.generator_type || 'NULL'}`);
      
      // Buscar nicho da empresa
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("industry")
        .eq("id", template.company_id)
        .maybeSingle();
      
      const industry = company?.industry || 'generic';
      console.log(`   Nicho da empresa: ${industry}`);
      
      // Determinar generator_type correto
      const correctGeneratorType = 
        industry === 'solar_energy' && template.doc_type === 'PROPOSTA'
          ? 'python_solar'
          : 'generic';
      
      console.log(`   Gerador correto: ${correctGeneratorType}`);
      
      // Atualizar se necessário
      if (template.generator_type !== correctGeneratorType) {
        console.log(`   🔄 Atualizando de '${template.generator_type}' para '${correctGeneratorType}'...`);
        
        const { error: updateError } = await supabaseAdmin
          .from("document_templates")
          .update({ generator_type: correctGeneratorType })
          .eq("id", template.id);
        
        if (updateError) {
          console.error(`   ❌ Erro ao atualizar: ${updateError.message}`);
        } else {
          console.log(`   ✅ Atualizado com sucesso!`);
        }
      } else {
        console.log(`   ✅ Já está correto`);
      }
    }
    
    console.log("\n" + "=".repeat(70));
    console.log("ATUALIZAÇÃO CONCLUÍDA");
    console.log("=".repeat(70));
    
  } catch (error: any) {
    console.error("\n❌ Erro:", error.message);
    throw error;
  }
}

updateExistingTemplates()
  .then(() => {
    console.log("\n✅ Script concluído!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro fatal:", error);
    process.exit(1);
  });
