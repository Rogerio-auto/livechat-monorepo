/**
 * Teste da conversão DOCX para PDF
 */

import path from "path";
import { fileURLToPath } from "url";
import { convertDocxToPdf } from "../services/python-generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPdfConversion() {
  console.log("🧪 === TESTE DE CONVERSÃO DOCX → PDF ===\n");

  // Caminho do DOCX gerado anteriormente
  const docxPath = path.join(process.cwd(), "temp", "teste_integracao.docx");
  const pdfPath = path.join(process.cwd(), "temp", "teste_integracao.pdf");

  console.log("📄 DOCX de entrada:", docxPath);
  console.log("📕 PDF de saída:", pdfPath);
  console.log();

  console.log("⚙️  Convertendo...\n");

  const result = await convertDocxToPdf(docxPath, pdfPath);

  if (result.success) {
    console.log("✅ SUCESSO!");
    console.log();
    console.log("📕 Arquivo PDF gerado:", result.generated_path);
    console.log("📏 Tamanho:", (result.file_size! / 1024).toFixed(2), "KB");
  } else {
    console.error("❌ ERRO!");
    console.error();
    console.error("Mensagem:", result.error);
    if (result.traceback) {
      console.error();
      console.error("Traceback:");
      console.error(result.traceback);
    }
    process.exit(1);
  }
}

testPdfConversion().catch((err) => {
  console.error("❌ Erro no teste:", err);
  process.exit(1);
});
