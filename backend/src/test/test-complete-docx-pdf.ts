/**
 * Teste completo: Geração DOCX + Conversão PDF
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { generateWithPython, convertDocxToPdf } from "../services/python-generator.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testCompleteFlow() {
  console.log("🧪 === TESTE COMPLETO: DOCX + PDF ===\n");

  // Dados de teste
  const mockData = {
    nome: "João da Silva",
    doc: "123.456.789-00",
    email: "joao@example.com",
    telefone: "(11) 98765-4321",
    endereco: "Rua das Flores, 123, Centro, São Paulo, SP",
    
    empresa: "Energia Solar Ltda",
    empresa_doc: "12.345.678/0001-90",
    empresa_endereco: "Av. Paulista, 1000",
    empresa_telefone: "(11) 3333-4444",
    empresa_email: "contato@energiasolar.com",
    
    vendedor: "Maria Vendedora",
    vendedor_telefone: "(11) 99999-8888",
    NOME_VENDEDOR: "Maria Vendedora",
    CELULAR_VENDEDOR: "(11) 99999-8888",
    
    valor_investimento: 50000,
    potencia: "10 kWp",
    num_paineis: "25",
    producao_media: "1.200 kWh/mês",
    consumo_medio: "1.000 kWh/mês",
    tarifa: "R$ 0,75",
    payback_anos: "5,5",
    economia_mensal: "R$ 750,00",
    economia_anual: "R$ 9.000,00",
    
    simulacoes: [
      { banco: "Banco Solar", parcelas: "60x", valor: "R$ 1.200,00" },
      { banco: "Banco Verde", parcelas: "48x", valor: "R$ 1.350,00" },
    ],
    
    especificacao_painel: "450W Monocristalino",
    especificacao_inversor: "Inversor 10kW",
    area_necessaria: "60 m²",
    garantia_painel: "25 anos",
    garantia_inversor: "10 anos",
    
    latitude: "-23.550520",
    longitude: "-46.633308",
    cidade: "São Paulo",
    estado: "SP",
    
    co2_evitado_anual: "8,4 toneladas",
    co2_evitado_25anos: "210 toneladas",
    arvores_equivalente: "1.500 árvores",
    
    num_proposta: "PROP-2024-001",
    data_proposta: "04/12/2024",
    validade: "04/01/2025",
    prazo_instalacao: "45 dias",
  };

  // Caminhos
  const templatePath = "C:\\Users\\roger\\Downloads\\Proposta 2025 (1).docx";
  const tempDir = path.join(process.cwd(), "temp");
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const docxPath = path.join(tempDir, "teste_completo.docx");
  const pdfPath = path.join(tempDir, "teste_completo.pdf");

  // Limpar arquivos antigos
  [docxPath, pdfPath].forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log("🗑️  Arquivo antigo removido:", path.basename(file));
    }
  });
  console.log();

  // ETAPA 1: Gerar DOCX
  console.log("📄 ETAPA 1: Gerando DOCX...\n");
  
  const docxResult = await generateWithPython(templatePath, docxPath, mockData);
  
  if (!docxResult.success) {
    console.error("❌ Erro ao gerar DOCX:", docxResult.error);
    process.exit(1);
  }
  
  console.log("✅ DOCX gerado!");
  console.log("   Caminho:", docxResult.generated_path);
  console.log("   Tamanho:", (docxResult.file_size! / 1024).toFixed(2), "KB");
  console.log();

  // ETAPA 2: Converter para PDF
  console.log("📕 ETAPA 2: Convertendo para PDF...\n");
  
  const pdfResult = await convertDocxToPdf(docxPath, pdfPath);
  
  if (!pdfResult.success) {
    console.error("❌ Erro ao converter PDF:", pdfResult.error);
    if (pdfResult.traceback) {
      console.error(pdfResult.traceback);
    }
    process.exit(1);
  }
  
  console.log("✅ PDF gerado!");
  console.log("   Caminho:", pdfResult.generated_path);
  console.log("   Tamanho:", (pdfResult.file_size! / 1024).toFixed(2), "KB");
  console.log();

  // RESUMO FINAL
  console.log("═".repeat(60));
  console.log("🎉 TESTE COMPLETO FINALIZADO COM SUCESSO!");
  console.log("═".repeat(60));
  console.log();
  console.log("📊 Arquivos gerados:");
  console.log();
  console.log("  📄 DOCX:", docxPath);
  console.log("     Tamanho:", (docxResult.file_size! / 1024).toFixed(2), "KB");
  console.log();
  console.log("  📕 PDF:", pdfPath);
  console.log("     Tamanho:", (pdfResult.file_size! / 1024).toFixed(2), "KB");
  console.log();
  console.log("💾 Compressão:", 
    ((1 - pdfResult.file_size! / docxResult.file_size!) * 100).toFixed(1), 
    "% menor que DOCX"
  );
  console.log();
}

testCompleteFlow().catch((err) => {
  console.error("❌ Erro no teste:", err);
  process.exit(1);
});
