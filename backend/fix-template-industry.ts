/**
 * Script para corrigir o campo industry do template
 */

import { supabaseAdmin } from "./src/lib/supabase.js";

async function fixTemplateIndustry() {
  console.log("\n" + "=".repeat(70));
  console.log("CORRIGIR CAMPO INDUSTRY DO TEMPLATE");
  console.log("=".repeat(70));
  
  const templateId = "cd943df7-d361-44df-aeb0-a77b99613e82";
  
  // 1. Buscar template atual
  console.log("\n1️⃣  Buscando template...");
  const { data: template, error: fetchError } = await supabaseAdmin
    .from("document_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  
  if (fetchError) {
    console.error("❌ Erro ao buscar template:", fetchError.message);
    process.exit(1);
  }
  
  console.log("\n📄 Template atual:");
  console.log("   Nome:", template.name);
  console.log("   Industry atual:", template.industry || "NULL");
  console.log("   Generator type:", template.generator_type);
  console.log("   Template type:", template.template_type || "NULL");
  console.log("   Company ID:", template.company_id);
  
  // 2. Buscar nicho da empresa
  console.log("\n2️⃣  Buscando nicho da empresa...");
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("industry, name")
    .eq("id", template.company_id)
    .single();
  
  console.log("   Empresa:", company?.name);
  console.log("   Nicho da empresa:", company?.industry);
  
  // 3. Atualizar template
  console.log("\n3️⃣  Atualizando template...");
  
  const updates: any = {
    industry: company?.industry || 'solar_energy', // Usar nicho da empresa
  };
  
  // Se template_type estiver NULL, copiar de doc_type
  if (!template.template_type && template.doc_type) {
    updates.template_type = template.doc_type;
    console.log("   Também atualizando template_type:", template.doc_type);
  }
  
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("document_templates")
    .update(updates)
    .eq("id", templateId)
    .select()
    .single();
  
  if (updateError) {
    console.error("❌ Erro ao atualizar:", updateError.message);
    process.exit(1);
  }
  
  console.log("\n✅ Template atualizado com sucesso!");
  console.log("\n📄 Template atualizado:");
  console.log("   Industry:", updated.industry);
  console.log("   Template type:", updated.template_type);
  console.log("   Generator type:", updated.generator_type);
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ CORREÇÃO CONCLUÍDA!");
  console.log("=".repeat(70));
  console.log("\nAgora o template:");
  console.log("✅ Tem industry correto:", updated.industry);
  console.log("✅ Tem template_type:", updated.template_type);
  console.log("✅ Tem generator_type:", updated.generator_type);
  console.log("\n🎯 Próximo passo: Testar geração de documento!");
}

fixTemplateIndustry()
  .then(() => {
    console.log("\n✅ Script concluído!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
