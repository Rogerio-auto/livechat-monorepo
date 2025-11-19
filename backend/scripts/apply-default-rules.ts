/**
 * Script para aplicar regras de automação padrão em empresas existentes
 * 
 * Uso: tsx scripts/apply-default-rules.ts
 */

import { supabaseAdmin } from "../src/lib/supabase.js";

async function applyDefaultRules() {
  console.log("🚀 Iniciando aplicação de regras padrão...\n");

  try {
    // 1. Buscar todas as empresas que não têm regras ainda
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (companiesError) {
      throw companiesError;
    }

    console.log(`📊 Encontradas ${companies.length} empresas no sistema\n`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const company of companies) {
      try {
        // Verificar se a empresa já tem regras
        const { data: existingRules } = await supabaseAdmin
          .from("task_automation_rules")
          .select("id")
          .eq("company_id", company.id)
          .limit(1);

        if (existingRules && existingRules.length > 0) {
          console.log(`⏭️  ${company.name} - Já possui regras (pulando)`);
          skipped++;
          continue;
        }

        // Buscar um usuário admin/manager da empresa
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id, role")
          .eq("company_id", company.id)
          .in("role", ["ADMIN", "MANAGER"])
          .limit(1);

        if (!users || users.length === 0) {
          console.log(`⚠️  ${company.name} - Sem usuários admin/manager (pulando)`);
          skipped++;
          continue;
        }

        const userId = users[0].id;

        // Chamar a função SQL para criar regras padrão
        const { error: createError } = await supabaseAdmin
          .rpc("create_default_automation_rules", {
            p_company_id: company.id,
            p_user_id: userId,
          });

        if (createError) {
          console.error(`❌ ${company.name} - Erro ao criar regras:`, createError.message);
          failed++;
        } else {
          console.log(`✅ ${company.name} - 3 regras padrão criadas com sucesso`);
          created++;
        }

      } catch (err: any) {
        console.error(`❌ ${company.name} - Erro inesperado:`, err.message);
        failed++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 RESULTADO FINAL:");
    console.log("=".repeat(60));
    console.log(`✅ Regras criadas: ${created} empresas`);
    console.log(`⏭️  Puladas: ${skipped} empresas (já tinham regras ou sem admin)`);
    console.log(`❌ Falhas: ${failed} empresas`);
    console.log("=".repeat(60));

  } catch (error: any) {
    console.error("\n❌ ERRO CRÍTICO:", error.message);
    process.exit(1);
  }
}

// Executar script
applyDefaultRules()
  .then(() => {
    console.log("\n✨ Script concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Falha na execução:", error);
    process.exit(1);
  });
