/**
 * Script para preencher campos solares da proposta baseado no kit do catálogo
 */

import { supabaseAdmin } from "./src/lib/supabase.js";

async function fillProposalFromKit() {
  console.log("\n" + "=".repeat(70));
  console.log("PREENCHER PROPOSTA COM DADOS DO KIT");
  console.log("=".repeat(70));
  
  // ID da proposta que você está testando
  const proposalId = "15bbaab4-43e4-4363-9221-dc694aed9399";
  
  // 1. Buscar proposta
  console.log("\n1️⃣  Buscando proposta...");
  const { data: proposal, error: propError } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  
  if (propError || !proposal) {
    console.error("❌ Erro ao buscar proposta:", propError?.message);
    return;
  }
  
  console.log("✅ Proposta encontrada:", proposal.number);
  console.log("   Título:", proposal.title);
  console.log("   System Power:", proposal.system_power, "W");
  
  // 2. Buscar kit do catálogo baseado no título da proposta
  console.log("\n2️⃣  Buscando kit no catálogo...");
  
  // Primeiro tentar buscar pelo nome exato (titulo da proposta)
  console.log("   Buscando por nome exato:", proposal.title);
  
  let { data: kit, error: kitError } = await supabaseAdmin
    .from("catalog_items")
    .select("*")
    .eq("company_id", proposal.company_id)
    .eq("name", proposal.title)
    .single();
  
  // Se não encontrar, tentar buscar pelo nome parcial
  if (kitError || !kit) {
    console.log("   Não encontrado, tentando busca parcial...");
    const kitNameMatch = proposal.title.match(/^(.+?)-/);
    const kitSearch = kitNameMatch ? kitNameMatch[1].trim() : proposal.title;
    console.log("   Buscando por:", kitSearch);
    
    const result = await supabaseAdmin
      .from("catalog_items")
      .select("*")
      .eq("company_id", proposal.company_id)
      .ilike("name", `%${kitSearch}%`)
      .single();
    
    kit = result.data;
    kitError = result.error;
  }
  
  if (kitError || !kit) {
    console.error("⚠️  Kit não encontrado no catálogo");
    console.log("   Tentando buscar por system_power...");
    
    // Tentar buscar por potência aproximada
    const { data: kitByPower } = await supabaseAdmin
      .from("catalog_items")
      .select("*")
      .eq("company_id", proposal.company_id)
      .eq("item_type", "PRODUCT")
      .limit(5);
    
    if (kitByPower && kitByPower.length > 0) {
      console.log("\n   📦 Kits disponíveis:");
      for (const k of kitByPower) {
        console.log(`   - ${k.name} (${k.power}W)`);
      }
    }
    
    return;
  }
  
  console.log("✅ Kit encontrado:", kit.name);
  console.log("   Power:", kit.power, "W");
  console.log("   Size:", kit.size, "m²");
  console.log("   Specs:", kit.specs?.substring(0, 100));
  
  // 3. Extrair informações do kit
  console.log("\n3️⃣  Extraindo dados do kit...");
  
  const specsText = kit.specs || "";
  
  // Extrair número de painéis e potência individual (com suporte a quebras de linha)
  const panelMatch = specsText.match(/(\d+)\s*[-–]\s*PAINÉIS?\s+.*?(\d+)W/is);
  const numPanels = panelMatch ? parseInt(panelMatch[1]) : null;
  const panelPower = panelMatch ? parseInt(panelMatch[2]) : null;
  
  // Extrair modelo do painel
  const panelModelMatch = specsText.match(/PAINÉIS?\s+(?:MONOCRISTALINO|POLICRISTALINO)?\s*(\d+W)\s+.*?([A-Z][A-Z\s]+)/is);
  const panelModel = panelModelMatch ? panelModelMatch[2].trim().split(/\s{2,}/)[0] : null;
  
  // Extrair modelo do inversor
  const inverterMatch = specsText.match(/INVERSOR\s+SOLAR\s+([A-Z]+)\s+(\d+(?:KW|W))/i);
  const inverterModel = inverterMatch ? `${inverterMatch[1]} ${inverterMatch[2]}` : null;
  
  // Extrair geração estimada (do nome do kit)
  const generationMatch = kit.name.match(/(\d+)KMH/i) || kit.name.match(/(\d+)KWH/i);
  const monthlyGeneration = generationMatch ? parseInt(generationMatch[1]) : null;
  
  console.log("\n📊 Dados extraídos:");
  console.log("   Painéis:", numPanels);
  console.log("   Potência por painel:", panelPower, "W");
  console.log("   Modelo do painel:", panelModel);
  console.log("   Inversor:", inverterModel);
  console.log("   Geração mensal:", monthlyGeneration, "kWh");
  console.log("   Potência total:", kit.power, "W");
  console.log("   Área necessária:", kit.size, "m²");
  
  // 4. Calcular dados derivados
  const totalPowerKw = parseInt(kit.power) / 1000;
  const monthlyConsumption = monthlyGeneration ? Math.floor(monthlyGeneration * 0.9) : null;
  const currentBillValue = monthlyConsumption ? monthlyConsumption * 0.92 : null;
  const futureBillValue = 100; // Custo mínimo da conta
  const savingsValue = currentBillValue ? currentBillValue - futureBillValue : null;
  const paybackYears = proposal.total_value && savingsValue ? 
    (proposal.total_value / (savingsValue * 12)).toFixed(1) : null;
  
  console.log("\n🧮 Dados calculados:");
  console.log("   Consumo mensal estimado:", monthlyConsumption, "kWh");
  console.log("   Conta atual:", currentBillValue ? `R$ ${currentBillValue.toFixed(2)}` : "N/A");
  console.log("   Conta futura:", `R$ ${futureBillValue}`);
  console.log("   Economia mensal:", savingsValue ? `R$ ${savingsValue.toFixed(2)}` : "N/A");
  console.log("   Payback:", paybackYears ? `${paybackYears} anos` : "N/A");
  
  // 5. Atualizar proposta
  console.log("\n4️⃣  Atualizando proposta...");
  
  const updates: any = {
    // Dados técnicos do kit (valores numéricos ou texto)
    solar_total_power: totalPowerKw,
    solar_num_panels: numPanels,
    solar_panel_power: panelPower ? `${panelPower}W` : null,
    solar_panel_spec: panelPower ? `Painel ${panelModel || 'Genérico'} ${panelPower}W` : null,
    solar_inverter_spec: inverterModel,
    solar_area_needed: kit.size ? parseFloat(kit.size) : null,
    panel_model: panelModel,
    inverter_model: inverterModel,
    
    // Geração e consumo (valores numéricos)
    solar_monthly_production: monthlyGeneration,
    solar_monthly_consumption: monthlyConsumption,
    solar_annual_production: monthlyGeneration ? monthlyGeneration * 12 : null,
    solar_annual_consumption: monthlyConsumption ? monthlyConsumption * 12 : null,
    
    // Valores financeiros (numéricos)
    solar_current_bill_value: currentBillValue,
    solar_future_bill_value: futureBillValue,
    solar_savings_value: savingsValue,
    solar_payback_years: paybackYears ? Math.round(parseFloat(paybackYears)) : null,
    solar_payback_months: paybackYears ? Math.round(parseFloat(paybackYears) * 12) : null,
    
    // Garantias padrão (numéricos)
    solar_panel_warranty: 25,
    solar_inverter_warranty: 10,
    solar_structure_warranty: 10,
    solar_service_warranty: 1,
    
    // Tarifa média (valor numérico)
    solar_energy_tariff: 0.92,
    
    // Ambiental (estimativas - valores numéricos)
    solar_co2_1year: monthlyGeneration ? parseFloat((monthlyGeneration * 12 * 0.0006).toFixed(2)) : null,
    solar_co2_25years: monthlyGeneration ? parseFloat((monthlyGeneration * 12 * 25 * 0.0006).toFixed(2)) : null,
    solar_co2_trees: monthlyGeneration ? Math.floor(monthlyGeneration * 12 * 25 * 0.02) : null,
  };
  
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("proposals")
    .update(updates)
    .eq("id", proposalId)
    .select()
    .single();
  
  if (updateError) {
    console.error("❌ Erro ao atualizar:", updateError.message);
    return;
  }
  
  console.log("✅ Proposta atualizada com sucesso!");
  
  console.log("\n" + "=".repeat(70));
  console.log("RESUMO DAS ATUALIZAÇÕES");
  console.log("=".repeat(70));
  
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null) {
      console.log(`✅ ${key}: ${value}`);
    }
  }
  
  console.log("\n🎯 Próximo passo: Gere o documento novamente!");
}

fillProposalFromKit()
  .then(() => {
    console.log("\n✅ Script concluído!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
