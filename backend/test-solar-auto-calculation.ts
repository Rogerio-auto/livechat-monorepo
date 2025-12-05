/**
 * Script de teste para validar implementação completa do cálculo automático de dados solares
 */

import { supabaseAdmin } from "./src/lib/supabase.js";

async function testSolarAutoCalculation() {
  console.log("\n" + "=".repeat(80));
  console.log("TESTE DE VALIDAÇÃO - CÁLCULO AUTOMÁTICO DE DADOS SOLARES");
  console.log("=".repeat(80));

  const companyId = "d56a5396-22df-486a-8fea-a82138e1f614";

  // 1. Verificar kits no catálogo
  console.log("\n1️⃣  Verificando kits solares no catálogo...");
  
  const { data: kits, error: kitsError } = await supabaseAdmin
    .from("catalog_items")
    .select("*")
    .eq("company_id", companyId)
    .eq("item_type", "PRODUCT")
    .not("power", "is", null)
    .not("size", "is", null)
    .limit(5);

  if (kitsError) {
    console.error("❌ Erro ao buscar kits:", kitsError.message);
    return;
  }

  if (!kits || kits.length === 0) {
    console.error("❌ Nenhum kit encontrado com power e size");
    return;
  }

  console.log(`✅ Encontrados ${kits.length} kits solares:`);
  for (const kit of kits) {
    console.log(`   - ${kit.name}`);
    console.log(`     Power: ${kit.power}W | Size: ${kit.size}m² | Price: R$ ${kit.sale_price || 'N/A'}`);
  }

  // 2. Verificar propostas recentes com dados solares
  console.log("\n2️⃣  Verificando propostas recentes...");
  
  const { data: proposals, error: propsError } = await supabaseAdmin
    .from("proposals")
    .select("id, number, title, solar_total_power, solar_num_panels, solar_monthly_production, solar_payback_years, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (propsError) {
    console.error("❌ Erro ao buscar propostas:", propsError.message);
    return;
  }

  console.log(`✅ Últimas ${proposals?.length || 0} propostas:`);
  for (const prop of proposals || []) {
    const hasSolarData = prop.solar_total_power || prop.solar_num_panels || prop.solar_monthly_production;
    const status = hasSolarData ? "✅ COM DADOS" : "⚪ SEM DADOS";
    console.log(`   ${status} ${prop.number} - ${prop.title}`);
    if (hasSolarData) {
      console.log(`     → Potência: ${prop.solar_total_power} kW | Painéis: ${prop.solar_num_panels} | Geração: ${prop.solar_monthly_production} kWh | Payback: ${prop.solar_payback_years} anos`);
    }
  }

  // 3. Verificar estrutura da tabela proposals
  console.log("\n3️⃣  Verificando campos solares na tabela proposals...");
  
  const solarFields = [
    'solar_total_power',
    'solar_num_panels',
    'solar_panel_power',
    'solar_panel_spec',
    'solar_inverter_spec',
    'solar_area_needed',
    'panel_model',
    'inverter_model',
    'solar_monthly_production',
    'solar_monthly_consumption',
    'solar_annual_production',
    'solar_annual_consumption',
    'solar_current_bill_value',
    'solar_future_bill_value',
    'solar_savings_value',
    'solar_payback_years',
    'solar_payback_months',
    'solar_panel_warranty',
    'solar_inverter_warranty',
    'solar_structure_warranty',
    'solar_service_warranty',
    'solar_energy_tariff',
    'solar_co2_1year',
    'solar_co2_25years',
    'solar_co2_trees'
  ];

  // Pegar primeira proposta para verificar estrutura
  if (proposals && proposals.length > 0) {
    const { data: fullProp, error } = await supabaseAdmin
      .from("proposals")
      .select("*")
      .eq("id", proposals[0].id)
      .single();

    if (error) {
      console.error("❌ Erro ao buscar proposta completa:", error.message);
    } else {
      const existingFields = solarFields.filter(field => field in (fullProp || {}));
      console.log(`✅ ${existingFields.length}/${solarFields.length} campos solares encontrados na tabela`);
      
      if (existingFields.length < solarFields.length) {
        const missingFields = solarFields.filter(field => !(field in (fullProp || {})));
        console.log("⚠️  Campos faltando:", missingFields.join(", "));
      }
    }
  }

  // 4. Resumo final
  console.log("\n" + "=".repeat(80));
  console.log("RESUMO DO TESTE");
  console.log("=".repeat(80));
  
  const kitsReady = kits && kits.length > 0;
  const hasProposals = proposals && proposals.length > 0;
  const hasFilledProposals = proposals?.some(p => p.solar_total_power || p.solar_num_panels);

  console.log(`\n✅ Kits no catálogo: ${kitsReady ? 'OK' : 'FALHA'}`);
  console.log(`✅ Propostas criadas: ${hasProposals ? 'OK' : 'FALHA'}`);
  console.log(`${hasFilledProposals ? '✅' : '⚪'} Propostas com dados solares: ${hasFilledProposals ? 'SIM' : 'NÃO'}`);

  if (kitsReady && hasProposals && hasFilledProposals) {
    console.log("\n🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!");
    console.log("   - Kits disponíveis no catálogo");
    console.log("   - Propostas sendo criadas com dados solares");
    console.log("   - Documentos podem ser gerados com campos preenchidos");
  } else if (kitsReady && hasProposals && !hasFilledProposals) {
    console.log("\n⚠️  SISTEMA PARCIALMENTE FUNCIONAL");
    console.log("   - Kits disponíveis ✅");
    console.log("   - Propostas sendo criadas ✅");
    console.log("   - Mas dados solares NÃO estão sendo preenchidos ❌");
    console.log("\n💡 Próximo passo:");
    console.log("   1. Teste criar uma nova proposta pelo frontend");
    console.log("   2. Selecione um kit do catálogo");
    console.log("   3. Verifique se o card verde aparece");
    console.log("   4. Salve e verifique se os dados foram para o banco");
  } else {
    console.log("\n❌ SISTEMA PRECISA DE CONFIGURAÇÃO");
    if (!kitsReady) console.log("   - Adicione kits no catálogo com power e size preenchidos");
    if (!hasProposals) console.log("   - Crie pelo menos uma proposta para testar");
  }

  console.log("\n" + "=".repeat(80));
}

testSolarAutoCalculation()
  .then(() => {
    console.log("\n✅ Teste concluído!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro no teste:", error);
    process.exit(1);
  });
