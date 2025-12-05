/**
 * Script para gerar documento através da API e verificar campos
 */

import { supabaseAdmin } from "./src/lib/supabase.js";
import { generateSolarProposal } from "./src/services/python-generator.js";
import { mapDatabaseToPython } from "./src/services/python-data-mapper.js";
import fs from "fs";

async function testGenerateDocument() {
  console.log("\n" + "=".repeat(70));
  console.log("TESTE DE GERAÇÃO DE DOCUMENTO");
  console.log("=".repeat(70));
  
  // IDs
  const proposalId = "15bbaab4-43e4-4363-9221-dc694aed9399";
  const templateId = "cd943df7-d361-44df-aeb0-a77b99613e82";
  const companyId = "d56a5396-22df-486a-8fea-a82138e1f614";
  
  console.log("\n1️⃣  Buscando dados...");
  
  // Buscar proposta
  const { data: proposal, error: propError } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  
  if (propError || !proposal) {
    console.error("❌ Erro ao buscar proposta:", propError?.message);
    return;
  }
  
  console.log("✅ Proposta:", proposal.number);
  console.log("   Potência total:", proposal.solar_total_power, "kW");
  console.log("   Painéis:", proposal.solar_num_panels || "N/A");
  console.log("   Produção mensal:", proposal.solar_monthly_production, "kWh");
  console.log("   Consumo mensal:", proposal.solar_monthly_consumption, "kWh");
  console.log("   Inversor:", proposal.solar_inverter_spec || "N/A");
  console.log("   Área necessária:", proposal.solar_area_needed, "m²");
  
  // Buscar template
  const { data: template, error: templateError } = await supabaseAdmin
    .from("document_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  
  if (templateError || !template) {
    console.error("❌ Erro ao buscar template:", templateError?.message);
    return;
  }
  
  console.log("✅ Template:", template.name);
  console.log("   Generator:", template.generator_type);
  console.log("   Path:", template.template_path);
  
  // Buscar dados relacionados
  console.log("\n2️⃣  Carregando dados relacionados...");
  
  const [companyRes, customerRes, leadRes, sellerRes] = await Promise.all([
    supabaseAdmin.from("companies").select("*").eq("id", companyId).single(),
    proposal.customer_id
      ? supabaseAdmin.from("customers").select("*").eq("id", proposal.customer_id).single()
      : Promise.resolve({ data: null }),
    proposal.lead_id
      ? supabaseAdmin.from("leads").select("*").eq("id", proposal.lead_id).single()
      : Promise.resolve({ data: null }),
    proposal.seller_id
      ? supabaseAdmin.from("users").select("id, name, phone").eq("id", proposal.seller_id).single()
      : Promise.resolve({ data: null }),
  ]);
  
  console.log("✅ Company:", companyRes.data?.name || "N/A");
  console.log("✅ Customer:", customerRes.data?.name || "N/A");
  console.log("✅ Lead:", leadRes.data?.name || "N/A");
  console.log("✅ Seller:", sellerRes.data?.name || "N/A");
  
  // Mapear dados para Python
  console.log("\n3️⃣  Mapeando dados para formato Python...");
  
  const pythonData = mapDatabaseToPython({
    company: companyRes.data,
    customer: customerRes.data,
    lead: leadRes.data,
    proposal,
    seller: sellerRes.data,
  });
  
  console.log("✅ Dados mapeados");
  console.log("   Potência:", pythonData.potencia);
  console.log("   Painéis:", pythonData.num_paineis);
  console.log("   Produção:", pythonData.producao_media);
  console.log("   Consumo:", pythonData.consumo_medio);
  
  // Gerar documento
  console.log("\n4️⃣  Gerando documento...");
  
  const timestamp = Date.now();
  const outputFileName = `test_proposta_${timestamp}.docx`;
  const outputStoragePath = `${companyId}/generated/${outputFileName}`;
  
  try {
    const result = await generateSolarProposal(
      template.template_path,
      outputStoragePath,
      pythonData,
      false // convertToPdf
    );
    
    if (!result.success) {
      console.error("❌ Erro na geração:", result.error);
      return;
    }
    
    console.log("✅ Documento gerado com sucesso!");
    console.log("   Path gerado:", result.generatedPath);
    console.log("   Public URL:", result.publicUrl);
    
    // Verificar tamanho do arquivo se existe localmente
    if (result.generatedPath && fs.existsSync(result.generatedPath)) {
      const stats = fs.statSync(result.generatedPath);
      console.log("   Tamanho:", (stats.size / 1024 / 1024).toFixed(2), "MB");
    }
    
  } catch (error: any) {
    console.error("❌ Erro ao gerar documento:", error.message);
    console.error(error.stack);
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ Teste concluído!");
  console.log("=".repeat(70));
}

testGenerateDocument()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });

