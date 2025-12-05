/**
 * Script de diagnóstico: testar chamada Python em modo produção
 * Simula exatamente o que o backend faz
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPythonProduction() {
  console.log("\n" + "=".repeat(70));
  console.log("TESTE PYTHON - MODO PRODUÇÃO");
  console.log("=".repeat(70));
  
  // Simular caminhos reais
  const scriptPath = path.join(
    process.cwd(),
    "src",
    "services",
    "python",
    "proposal_generator.py"
  );
  
  const templatePath = "C:\\Users\\roger\\Downloads\\Proposta 2025 - CORRIGIDO.docx";
  const outputPath = path.join(process.cwd(), "temp", "teste_producao.docx");
  
  console.log("\n📁 Caminhos:");
  console.log("   Script:", scriptPath);
  console.log("   Template:", templatePath);
  console.log("   Output:", outputPath);
  
  // Verificar arquivos
  console.log("\n🔍 Verificações:");
  console.log("   Script existe?", fs.existsSync(scriptPath) ? "✅" : "❌");
  console.log("   Template existe?", fs.existsSync(templatePath) ? "✅" : "❌");
  
  if (!fs.existsSync(scriptPath)) {
    console.error("\n❌ Script Python não encontrado!");
    process.exit(1);
  }
  
  if (!fs.existsSync(templatePath)) {
    console.error("\n❌ Template não encontrado!");
    process.exit(1);
  }
  
  // Criar diretório temp se não existir
  const tempDir = path.dirname(outputPath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Dados de teste
  const dadosCliente = {
    nome: "João da Silva Teste Produção",
    doc: "123.456.789-00",
    email: "joao@teste.com",
    telefone: "(11) 98765-4321",
    endereco: "Rua Teste, 123 - São Paulo/SP",
    valor_investimento: 32500,
    potencia: "7.5 kWp",
    num_paineis: "15",
    producao_media: "950 kWh",
    consumo_medio: "820 kWh",
    payback_anos: "4,2",
    vendedor: "Maria Vendedora",
    empresa: "Solar Tech Brasil LTDA"
  };
  
  const pythonInput = {
    template_path: templatePath,
    output_path: outputPath,
    dados_cliente: dadosCliente,
  };
  
  console.log("\n📦 Dados do cliente:", Object.keys(dadosCliente).length, "campos");
  
  return new Promise<void>((resolve, reject) => {
    console.log("\n🐍 Iniciando Python...");
    console.log("   Comando: python -u", scriptPath, "--production");
    console.log("   CWD:", path.dirname(scriptPath));
    
    // Spawnar Python exatamente como o backend faz
    const pythonProcess = spawn("python", ["-u", scriptPath, "--production"], {
      cwd: path.dirname(scriptPath),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONLEGACYWINDOWSSTDIO: '0'
      }
    });
    
    let stdout = "";
    let stderr = "";
    
    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString("utf-8");
      stdout += output;
      // Mostrar em tempo real
      process.stdout.write(output);
    });
    
    pythonProcess.stderr.on("data", (data) => {
      const output = data.toString("utf-8");
      stderr += output;
      // Mostrar em tempo real
      process.stderr.write(output);
    });
    
    // Enviar dados via stdin
    console.log("\n📤 Enviando dados via stdin...");
    pythonProcess.stdin.setDefaultEncoding('utf-8');
    pythonProcess.stdin.write(JSON.stringify(pythonInput));
    pythonProcess.stdin.end();
    
    pythonProcess.on("close", (code) => {
      console.log("\n\n" + "=".repeat(70));
      console.log("RESULTADO");
      console.log("=".repeat(70));
      console.log("Exit code:", code);
      
      if (stderr.trim()) {
        console.log("\n⚠️  STDERR capturado:");
        console.log(stderr);
      }
      
      // Tentar parsear JSON
      try {
        const lines = stdout.trim().split("\n");
        const lastLine = lines[lines.length - 1];
        
        console.log("\n📄 Última linha do stdout:");
        console.log(lastLine);
        
        if (lastLine.startsWith("{")) {
          const result = JSON.parse(lastLine);
          console.log("\n✅ JSON parseado com sucesso:");
          console.log(JSON.stringify(result, null, 2));
          
          if (result.success) {
            console.log("\n🎉 SUCESSO!");
            console.log("   Arquivo gerado:", result.generated_path);
            console.log("   Tamanho:", (result.file_size / 1024 / 1024).toFixed(2), "MB");
            
            // Verificar se arquivo existe
            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath);
              console.log("   Arquivo confirmado no disco:", (stats.size / 1024 / 1024).toFixed(2), "MB");
            } else {
              console.log("   ⚠️ Arquivo NÃO encontrado no disco!");
            }
            
            resolve();
          } else {
            console.log("\n❌ Python retornou erro:");
            console.log("   Erro:", result.error);
            if (result.traceback) {
              console.log("\n   Traceback:");
              console.log(result.traceback);
            }
            reject(new Error(result.error));
          }
        } else {
          console.log("\n❌ Última linha não é JSON válido");
          console.log("\n📄 Output completo:");
          console.log(stdout);
          reject(new Error("Python não retornou JSON"));
        }
      } catch (error: any) {
        console.log("\n❌ Erro ao parsear JSON:", error.message);
        console.log("\n📄 Output completo:");
        console.log(stdout);
        reject(error);
      }
    });
    
    pythonProcess.on("error", (error) => {
      console.error("\n❌ Erro ao executar Python:", error);
      reject(error);
    });
  });
}

// Executar teste
testPythonProduction()
  .then(() => {
    console.log("\n✅ Teste concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Teste falhou:", error.message);
    process.exit(1);
  });
