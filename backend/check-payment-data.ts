/**
 * Script para verificar dados de pagamento e financiamento nas propostas
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variáveis de ambiente não configuradas");
  console.error("SUPABASE_URL:", supabaseUrl ? "✅" : "❌");
  console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "✅" : "❌");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkPaymentData() {
  console.log("\n========================================");
  console.log("VERIFICANDO DADOS DE PAGAMENTO");
  console.log("========================================\n");

  // Verificar proposta mais recente
  const { data: proposals, error } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) {
    console.error("❌ Erro ao buscar propostas:", error.message);
    return;
  }

  if (!proposals || proposals.length === 0) {
    console.log("⚠️ Nenhuma proposta encontrada");
    return;
  }

  for (const proposal of proposals) {
    console.log(`\n📄 PROPOSTA: ${proposal.number}`);
    console.log("─".repeat(50));

    // 1. DADOS FINANCEIROS BÁSICOS
    console.log("\n💰 VALORES:");
    console.log("  total_value:", proposal.total_value || "null");
    console.log("  payment_method:", proposal.payment_method || "null");
    console.log("  description:", proposal.description || "null");

    // 2. DADOS DE FINANCIAMENTO
    console.log("\n🏦 FINANCIAMENTO:");
    console.log("  financing_bank:", proposal.financing_bank || "null");
    console.log("  financing_installments:", proposal.financing_installments || "null");
    console.log("  financing_installment_value:", proposal.financing_installment_value || "null");
    console.log("  financing_interest_rate:", proposal.financing_interest_rate || "null");
    console.log("  financing_total_amount:", proposal.financing_total_amount || "null");
    console.log("  financing_entry_value:", proposal.financing_entry_value || "null");
    console.log("  financing_cet:", proposal.financing_cet || "null");
    console.log("  financing_iof:", proposal.financing_iof || "null");
    console.log("  financing_type:", proposal.financing_type || "null");
    console.log("  financing_first_due_date:", proposal.financing_first_due_date || "null");

    // 3. DADOS SOLARES - PAYBACK
    console.log("\n📊 DADOS SOLARES - RETORNO:");
    console.log("  solar_payback_years:", proposal.solar_payback_years || "null");
    console.log("  solar_payback_months:", proposal.solar_payback_months || "null");
    console.log("  solar_current_bill_value:", proposal.solar_current_bill_value || "null");
    console.log("  solar_future_bill_value:", proposal.solar_future_bill_value || "null");
    console.log("  solar_savings_value:", proposal.solar_savings_value || "null");
    console.log("  solar_energy_tariff:", proposal.solar_energy_tariff || "null");

    // 4. CÁLCULO DE PAYBACK MANUAL
    if (proposal.total_value && proposal.solar_savings_value) {
      const calculatedPaybackYears = Math.round(proposal.total_value / (proposal.solar_savings_value * 12));
      const calculatedPaybackMonths = calculatedPaybackYears * 12;
      
      console.log("\n🧮 CÁLCULO MANUAL DE PAYBACK:");
      console.log(`  Fórmula: total_value / (solar_savings_value × 12)`);
      console.log(`  ${proposal.total_value} / (${proposal.solar_savings_value} × 12) = ${calculatedPaybackYears} anos`);
      console.log(`  Calculado: ${calculatedPaybackYears} anos (${calculatedPaybackMonths} meses)`);
      console.log(`  Armazenado: ${proposal.solar_payback_years || "null"} anos (${proposal.solar_payback_months || "null"} meses)`);
      
      if (proposal.solar_payback_years !== calculatedPaybackYears) {
        console.log("  ⚠️ DIVERGÊNCIA: Valor calculado diferente do armazenado!");
      } else {
        console.log("  ✅ Valores conferem!");
      }
    } else {
      console.log("\n⚠️ Não é possível calcular payback (faltam dados)");
    }

    // 5. VALIDAÇÃO DE FINANCIAMENTO
    if (proposal.payment_method === "FINANCIAMENTO") {
      console.log("\n🔍 VALIDAÇÃO DE FINANCIAMENTO:");
      const issues: string[] = [];
      
      if (!proposal.financing_bank) issues.push("❌ Banco não informado");
      if (!proposal.financing_installments) issues.push("❌ Número de parcelas não informado");
      if (!proposal.financing_installment_value) issues.push("❌ Valor da parcela não informado");
      if (!proposal.financing_interest_rate) issues.push("❌ Taxa de juros não informada");
      
      // Verificar cálculo do total
      if (proposal.financing_installments && proposal.financing_installment_value) {
        const expectedTotal = proposal.financing_installments * proposal.financing_installment_value;
        const storedTotal = proposal.financing_total_amount || 0;
        
        console.log(`  Parcelas × Valor = ${proposal.financing_installments} × ${proposal.financing_installment_value} = ${expectedTotal}`);
        console.log(`  Total armazenado: ${storedTotal}`);
        
        if (Math.abs(expectedTotal - storedTotal) > 0.01) {
          issues.push(`⚠️ Total calculado (${expectedTotal}) diferente do armazenado (${storedTotal})`);
        } else {
          console.log("  ✅ Total conferido corretamente");
        }
      }
      
      if (issues.length === 0) {
        console.log("  ✅ Todos os dados de financiamento estão corretos!");
      } else {
        console.log("  Problemas encontrados:");
        issues.forEach(issue => console.log(`    ${issue}`));
      }
    }
  }

  console.log("\n========================================");
  console.log("VERIFICAÇÃO CONCLUÍDA");
  console.log("========================================\n");
}

checkPaymentData().catch(console.error);
