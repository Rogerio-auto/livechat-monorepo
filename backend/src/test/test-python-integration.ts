/**
 * Script de teste da integração Python
 * Testa o fluxo completo sem precisar do servidor HTTP
 */

import { generateWithPython } from "../services/python-generator.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPythonIntegration() {
  console.log("\n🧪 TESTE DE INTEGRAÇÃO PYTHON\n");
  console.log("=" + "=".repeat(50));

  // Caminhos
  const templatePath = "C:\\Users\\roger\\Downloads\\Proposta 2025 - CORRIGIDO.docx";
  const outputPath = path.join(__dirname, "..", "..", "temp", "teste_integracao.docx");

  console.log("📁 Template:", templatePath);
  console.log("📁 Output:", outputPath);
  console.log("=" + "=".repeat(50) + "\n");

  // Dados de teste
  const testData = {
    nome: "João da Silva Teste Integração",
    doc: "123.456.789-00",
    email: "joao@teste.com",
    telefone: "(11) 98765-4321",
    endereco: "Rua Teste, 123 - São Paulo/SP",
    valor_investimento: 32500.0,
    potencia: "7.5 kWp",
    num_paineis: "15",
    producao_media: "950 kWh",
    consumo_medio: "820 kWh",
    payback_anos: "4,2",
    vendedor: "Maria Vendedora",
    empresa: "Solar Tech Brasil LTDA",
  };

  console.log("📊 Dados do cliente:", JSON.stringify(testData, null, 2));
  console.log("\n" + "=" + "=".repeat(50));
  console.log("⏳ Chamando gerador Python...\n");

  try {
    const result = await generateWithPython(templatePath, outputPath, testData);

    console.log("\n" + "=" + "=".repeat(50));
    if (result.success) {
      console.log("✅ SUCESSO!");
      console.log("📁 Arquivo gerado:", result.generated_path);
      console.log("📏 Tamanho:", (result.file_size! / 1024).toFixed(2), "KB");
    } else {
      console.log("❌ FALHA!");
      console.log("Erro:", result.error);
      if (result.traceback) {
        console.log("\nTraceback:");
        console.log(result.traceback);
      }
    }
    console.log("=" + "=".repeat(50) + "\n");
  } catch (error: any) {
    console.log("\n" + "=" + "=".repeat(50));
    console.log("❌ ERRO NO TESTE!");
    console.log(error.message);
    console.log("=" + "=".repeat(50) + "\n");
  }
}

// Executar teste
testPythonIntegration();
