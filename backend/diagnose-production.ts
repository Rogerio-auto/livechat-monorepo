/**
 * Diagnóstico completo: por que Python funciona em teste mas não em produção?
 */

import { supabaseAdmin } from "./src/lib/supabase.js";
import path from "path";
import fs from "fs";

async function diagnose() {
  console.log("\n" + "=".repeat(70));
  console.log("DIAGNÓSTICO DE PRODUÇÃO");
  console.log("=".repeat(70));
  
  // 1. Verificar templates no Supabase Storage
  console.log("\n1️⃣  VERIFICANDO TEMPLATES NO STORAGE");
  console.log("-".repeat(70));
  
  try {
    const { data: files, error } = await supabaseAdmin
      .storage
      .from("docs")
      .list("", {
        limit: 100,
        offset: 0,
      });
    
    if (error) {
      console.error("❌ Erro ao listar arquivos:", error.message);
    } else {
      console.log(`✅ Bucket 'docs' acessível`);
      console.log(`   Total de arquivos/pastas na raiz: ${files?.length || 0}`);
      
      if (files && files.length > 0) {
        console.log("\n   Pastas/arquivos encontrados:");
        for (const file of files.slice(0, 10)) {
          console.log(`   - ${file.name} (${file.id ? 'arquivo' : 'pasta'})`);
        }
      }
      
      // Tentar listar templates em uma pasta específica
      // Assumindo company_id = '01931ade-b06a-7a07-b88c-75bbee39bdc6' (ajuste conforme necessário)
      const testCompanyId = '01931ade-b06a-7a07-b88c-75bbee39bdc6';
      
      const { data: companyFiles, error: companyError } = await supabaseAdmin
        .storage
        .from("docs")
        .list(`${testCompanyId}/templates`, {
          limit: 100,
        });
      
      if (companyError) {
        console.log(`\n   ⚠️  Não foi possível listar templates da empresa ${testCompanyId}`);
        console.log(`   Erro: ${companyError.message}`);
      } else {
        console.log(`\n   Templates da empresa ${testCompanyId}:`);
        if (companyFiles && companyFiles.length > 0) {
          for (const file of companyFiles) {
            console.log(`   - ${file.name}`);
          }
        } else {
          console.log(`   ❌ Nenhum template encontrado!`);
        }
      }
    }
  } catch (error: any) {
    console.error("❌ Erro ao verificar storage:", error.message);
  }
  
  // 2. Verificar registros de templates no banco
  console.log("\n\n2️⃣  VERIFICANDO TEMPLATES NO BANCO DE DADOS");
  console.log("-".repeat(70));
  
  try {
    const { data: templates, error } = await supabaseAdmin
      .from("document_templates")
      .select("id, name, template_type, template_path, generator_type, company_id")
      .limit(10);
    
    if (error) {
      console.error("❌ Erro ao buscar templates:", error.message);
    } else {
      console.log(`✅ Templates cadastrados: ${templates?.length || 0}`);
      
      if (templates && templates.length > 0) {
        console.log("\n   Templates encontrados:");
        for (const tpl of templates) {
          console.log(`   - ${tpl.name}`);
          console.log(`     ID: ${tpl.id}`);
          console.log(`     Tipo: ${tpl.template_type}`);
          console.log(`     Gerador: ${tpl.generator_type || 'generic'}`);
          console.log(`     Path: ${tpl.template_path}`);
          console.log(`     Company: ${tpl.company_id}`);
          console.log("");
        }
      } else {
        console.log("   ❌ Nenhum template cadastrado!");
      }
    }
  } catch (error: any) {
    console.error("❌ Erro ao verificar templates:", error.message);
  }
  
  // 3. Verificar script Python
  console.log("\n3️⃣  VERIFICANDO SCRIPT PYTHON");
  console.log("-".repeat(70));
  
  const scriptPath = path.join(
    process.cwd(),
    "src",
    "services",
    "python",
    "proposal_generator.py"
  );
  
  console.log("   CWD:", process.cwd());
  console.log("   Script path:", scriptPath);
  console.log("   Existe?", fs.existsSync(scriptPath) ? "✅" : "❌");
  
  if (fs.existsSync(scriptPath)) {
    const stats = fs.statSync(scriptPath);
    console.log("   Tamanho:", (stats.size / 1024).toFixed(2), "KB");
  }
  
  // 4. Verificar propostas no banco
  console.log("\n\n4️⃣  VERIFICANDO PROPOSTAS NO BANCO");
  console.log("-".repeat(70));
  
  try {
    const { data: proposals, error } = await supabaseAdmin
      .from("proposals")
      .select("id, number, customer_id, lead_id, seller_id, company_id, status")
      .limit(5);
    
    if (error) {
      console.error("❌ Erro ao buscar propostas:", error.message);
    } else {
      console.log(`✅ Propostas cadastradas: ${proposals?.length || 0}`);
      
      if (proposals && proposals.length > 0) {
        console.log("\n   Propostas recentes:");
        for (const prop of proposals) {
          console.log(`   - #${prop.number} (ID: ${prop.id.substring(0, 8)}...)`);
          console.log(`     Status: ${prop.status}`);
          console.log(`     Customer: ${prop.customer_id ? '✅' : '❌'}`);
          console.log(`     Lead: ${prop.lead_id ? '✅' : '❌'}`);
          console.log(`     Seller: ${prop.seller_id ? '✅' : '❌'}`);
          console.log("");
        }
      } else {
        console.log("   ⚠️  Nenhuma proposta cadastrada!");
      }
    }
  } catch (error: any) {
    console.error("❌ Erro ao verificar propostas:", error.message);
  }
  
  // 5. Verificar Python instalado
  console.log("\n5️⃣  VERIFICANDO PYTHON");
  console.log("-".repeat(70));
  
  const { spawn } = await import("child_process");
  
  return new Promise<void>((resolve) => {
    const pythonProcess = spawn("python", ["--version"]);
    
    let output = "";
    
    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on("data", (data) => {
      output += data.toString();
    });
    
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Python instalado:", output.trim());
      } else {
        console.log("❌ Python não encontrado ou erro");
      }
      
      console.log("\n" + "=".repeat(70));
      console.log("DIAGNÓSTICO CONCLUÍDO");
      console.log("=".repeat(70));
      
      console.log("\n📋 RESUMO DAS VERIFICAÇÕES:");
      console.log("   1. Storage acessível");
      console.log("   2. Templates cadastrados no banco");
      console.log("   3. Script Python existe");
      console.log("   4. Propostas no banco");
      console.log("   5. Python instalado");
      
      console.log("\n💡 PRÓXIMOS PASSOS:");
      console.log("   1. Se não há templates no Storage → fazer upload");
      console.log("   2. Se não há templates no banco → cadastrar template");
      console.log("   3. Se não há propostas → criar proposta de teste");
      console.log("   4. Testar geração via API endpoint");
      
      resolve();
    });
  });
}

diagnose()
  .then(() => {
    console.log("\n✅ Diagnóstico completo!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro no diagnóstico:", error);
    process.exit(1);
  });
