/**
 * Script para preencher campos faltantes na proposta
 */

import { supabaseAdmin } from "./src/lib/supabase.js";

async function fillProposalData() {
  console.log("\n" + "=".repeat(70));
  console.log("PREENCHER DADOS FALTANTES DA PROPOSTA");
  console.log("=".repeat(70));
  
  const proposalId = "15bbaab4-43e4-4363-9221-dc694aed9399"; // ID da proposta 202511-0001
  
  // 1. Buscar proposta atual
  console.log("\n1️⃣  Buscando proposta...");
  const { data: proposal, error: fetchError } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  
  if (fetchError) {
    console.error("❌ Erro ao buscar proposta:", fetchError.message);
    process.exit(1);
  }
  
  console.log("\n📄 Proposta atual:");
  console.log("   Número:", proposal.number);
  console.log("   Valor:", proposal.total_value);
  console.log("   Potência:", proposal.solar_total_power || "VAZIO");
  console.log("   Produção média:", proposal.solar_monthly_production || "VAZIO");
  console.log("   Consumo médio:", proposal.solar_monthly_consumption || "VAZIO");
  console.log("   Área necessária:", proposal.solar_area_needed || "VAZIO");
  
  // 2. Calcular valores baseados no investimento
  console.log("\n2️⃣  Calculando valores...");
  
  const valorInvestimento = proposal.total_value || 28276.66;
  
  // Estimativas baseadas no valor do investimento
  // Aproximadamente R$ 4.50/Wp
  const potenciaWp = Math.round(valorInvestimento / 4.5); // Em Wp
  const potenciaKwp = (potenciaWp / 1000).toFixed(2); // Em kWp
  
  // Número de painéis (assumindo 550W por painel)
  const numPaineis = Math.round(potenciaWp / 550);
  
  // Produção mensal (média de 4.5 horas de sol por dia)
  const producaoMensalKwh = Math.round(potenciaWp * 4.5 * 30 / 1000);
  
  // Consumo médio (assumindo 80% da produção)
  const consumoMedioKwh = Math.round(producaoMensalKwh * 0.8);
  
  // Área necessária (aproximadamente 2m² por painel de 550W)
  const areaNecessaria = Math.round(numPaineis * 2);
  
  // Economia mensal (assumindo tarifa de R$ 0.80/kWh)
  const tarifaKwh = 0.80;
  const economiaMensal = Math.round(producaoMensalKwh * tarifaKwh);
  const economiaAnual = economiaMensal * 12;
  
  // Payback (anos) = Investimento / Economia Anual
  const paybackAnos = (valorInvestimento / economiaAnual).toFixed(1);
  
  console.log("\n📊 Valores calculados:");
  console.log(`   Potência: ${potenciaKwp} kWp (${potenciaWp} Wp)`);
  console.log(`   Número de painéis: ${numPaineis} unidades`);
  console.log(`   Produção mensal: ${producaoMensalKwh} kWh`);
  console.log(`   Consumo médio: ${consumoMedioKwh} kWh`);
  console.log(`   Área necessária: ${areaNecessaria} m²`);
  console.log(`   Economia mensal: R$ ${economiaMensal.toFixed(2)}`);
  console.log(`   Economia anual: R$ ${economiaAnual.toFixed(2)}`);
  console.log(`   Payback: ${paybackAnos} anos`);
  
  // 3. Atualizar proposta
  console.log("\n3️⃣  Atualizando proposta...");
  
  const updates: any = {
    solar_total_power: `${potenciaKwp} kWp`,
    solar_num_panels: numPaineis,
    solar_monthly_production: `${producaoMensalKwh} kWh`,
    solar_monthly_consumption: `${consumoMedioKwh} kWh`,
    solar_area_needed: `${areaNecessaria} m²`,
    solar_energy_tariff: `R$ ${tarifaKwh.toFixed(2)}/kWh`,
    solar_savings_value: economiaMensal,
    solar_annual_savings: economiaAnual,
    solar_payback_years: paybackAnos,
    
    // Dados técnicos
    solar_panel_spec: "Módulo Fotovoltaico 550W Monocristalino",
    solar_inversor_spec: "Inversor Solar 5kW Monofásico",
    solar_panel_warranty: 25,
    solar_inverter_warranty: 10,
    
    // Dados ambientais (estimados)
    solar_co2_1year: `${(producaoMensalKwh * 12 * 0.0847).toFixed(0)} kg`, // 0.0847 kg CO2/kWh
    solar_co2_25years: `${(producaoMensalKwh * 12 * 25 * 0.0847 / 1000).toFixed(1)} ton`,
    solar_co2_trees: Math.round(producaoMensalKwh * 12 * 25 * 0.0847 / 21.77), // 1 árvore absorve ~21.77kg CO2/ano
    
    // Prazo de instalação
    installation_days: 30,
    valid_until: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 dias
  };
  
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("proposals")
    .update(updates)
    .eq("id", proposalId)
    .select()
    .single();
  
  if (updateError) {
    console.error("❌ Erro ao atualizar:", updateError.message);
    process.exit(1);
  }
  
  console.log("\n✅ Proposta atualizada com sucesso!");
  
  console.log("\n📄 Dados após atualização:");
  console.log("   Potência:", updated.solar_total_power);
  console.log("   Painéis:", updated.solar_num_panels);
  console.log("   Produção:", updated.solar_monthly_production);
  console.log("   Consumo:", updated.solar_monthly_consumption);
  console.log("   Área:", updated.solar_area_needed);
  console.log("   Payback:", updated.solar_payback_years, "anos");
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ DADOS PREENCHIDOS COM SUCESSO!");
  console.log("=".repeat(70));
  console.log("\n🎯 Próximo passo:");
  console.log("1. Reinicie o backend para carregar código atualizado");
  console.log("2. Tente gerar o documento novamente");
  console.log("3. Todos os campos devem aparecer preenchidos!");
}

fillProposalData()
  .then(() => {
    console.log("\n✅ Script concluído!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
