/**
 * Script para atualizar templates de proposta solar para usar gerador Python
 */

import { supabaseAdmin } from "./src/lib/supabase.js";

async function updateTemplates() {
  console.log("\n" + "=".repeat(70));
  console.log("ATUALIZANDO TEMPLATES PARA GERADOR PYTHON");
  console.log("=".repeat(70));
  
  // 1. Buscar templates de proposta que contêm "solar" ou "proposta" no nome
  console.log("\n1️⃣  Buscando templates de proposta solar...");
  
  const { data: templates, error } = await supabaseAdmin
    .from("document_templates")
    .select("id, name, template_type, generator_type, template_path")
    .or('name.ilike.%solar%,name.ilike.%proposta%,template_type.eq.PROPOSTA');
  
  if (error) {
    console.error("❌ Erro ao buscar templates:", error.message);
    process.exit(1);
  }
  
  console.log(`✅ Encontrados ${templates?.length || 0} templates`);
  
  if (!templates || templates.length === 0) {
    console.log("\n⚠️  Nenhum template encontrado para atualizar");
    process.exit(0);
  }
  
  // 2. Listar templates encontrados
  console.log("\n📋 Templates encontrados:");
  for (const tpl of templates) {
    console.log(`\n   ${tpl.name}`);
    console.log(`   ID: ${tpl.id}`);
    console.log(`   Tipo: ${tpl.template_type || 'N/A'}`);
    console.log(`   Gerador atual: ${tpl.generator_type || 'generic'}`);
    console.log(`   Path: ${tpl.template_path}`);
  }
  
  // 3. Perguntar confirmação (para modo interativo)
  console.log("\n" + "=".repeat(70));
  console.log("ATUALIZANDO PARA GERADOR PYTHON...");
  console.log("=".repeat(70));
  
  // 4. Atualizar todos para python_solar
  const idsToUpdate = templates.map(t => t.id);
  
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("document_templates")
    .update({ generator_type: 'python_solar' })
    .in('id', idsToUpdate)
    .select();
  
  if (updateError) {
    console.error("\n❌ Erro ao atualizar:", updateError.message);
    process.exit(1);
  }
  
  console.log(`\n✅ ${updated?.length || 0} templates atualizados com sucesso!`);
  
  // 5. Verificar atualização
  console.log("\n📋 Templates após atualização:");
  for (const tpl of updated || []) {
    console.log(`\n   ✅ ${tpl.name}`);
    console.log(`      Gerador: ${tpl.generator_type}`);
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ ATUALIZAÇÃO CONCLUÍDA!");
  console.log("=".repeat(70));
  console.log("\n💡 Próximo passo: Testar geração de documento novamente");
  console.log("   O template agora usará o gerador Python com:");
  console.log("   - Gráficos automáticos (comparativo + retorno)");
  console.log("   - Tabelas de fluxo de caixa (25 anos)");
  console.log("   - Tabelas de rentabilidade");
  console.log("   - Todos os cálculos financeiros");
}

updateTemplates()
  .then(() => {
    console.log("\n✅ Script concluído!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
