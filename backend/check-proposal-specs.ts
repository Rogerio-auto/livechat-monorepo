import { supabaseAdmin } from './src/lib/supabase.js';

async function checkProposalSpecs() {
  try {
    console.log("\n=== VERIFICANDO PROPOSTA 202512-0002 ===\n");
    
    const { data, error } = await supabaseAdmin
      .from('proposals')
      .select('id, number, solar_panel_spec, solar_inverter_spec, solar_num_panels, solar_panel_power')
      .eq('number', '202512-0002')
      .single();
    
    if (error) {
      console.error("❌ Erro:", error);
      process.exit(1);
    }
    
    console.log("📋 Proposta encontrada:");
    console.log("ID:", data.id);
    console.log("Número:", data.number);
    console.log("\n🔍 Especificações:");
    console.log("solar_panel_spec:", data.solar_panel_spec);
    console.log("solar_inverter_spec:", data.solar_inverter_spec);
    console.log("solar_num_panels:", data.solar_num_panels);
    console.log("solar_panel_power:", data.solar_panel_power);
    
    if (!data.solar_panel_spec) {
      console.log("\n❌ solar_panel_spec está NULL ou vazio!");
      console.log("⚠️  Esta proposta foi criada ANTES da correção.");
      console.log("💡 Gere documento da proposta 202512-0003 (que tem os dados corretos)");
    } else {
      console.log("\n✅ solar_panel_spec preenchido com sucesso!");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

checkProposalSpecs();
