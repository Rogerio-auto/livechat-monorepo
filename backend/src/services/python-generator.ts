/**
 * Serviço de integração com gerador Python de propostas
 * Chama proposal_generator.py com dados do sistema
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { supabaseAdmin } from "../lib/supabase.js";
import { DOCS_BUCKET } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PythonGeneratorData {
  // Dados do cliente
  nome?: string;
  doc?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  
  // Dados da empresa
  empresa?: string;
  empresa_doc?: string;
  empresa_endereco?: string;
  empresa_telefone?: string;
  empresa_email?: string;
  
  // Dados do vendedor
  vendedor?: string;
  vendedor_telefone?: string;
  
  // Dados do sistema solar
  valor_investimento?: number;
  potencia?: string;
  num_paineis?: string;
  producao_media?: string;
  consumo_medio?: string;
  tarifa?: string;
  payback_anos?: string;
  economia_mensal?: string;
  economia_anual?: string;
  
  // Dados de financiamento (simulações)
  simulacoes?: Array<{
    banco: string;
    parcelas: string;
    valor: string;
  }>;
  
  // Dados técnicos
  especificacao_painel?: string;
  especificacao_inversor?: string;
  area_necessaria?: string;
  garantia_painel?: string;
  garantia_inversor?: string;
  
  // Dados de localização
  latitude?: string;
  longitude?: string;
  cidade?: string;
  estado?: string;
  
  // Dados ambientais
  co2_evitado_anual?: string;
  co2_evitado_25anos?: string;
  arvores_equivalente?: string;
  
  // Datas e documentação
  num_proposta?: string;
  data_proposta?: string;
  validade?: string;
  prazo_instalacao?: string;
}

export interface PythonGeneratorResult {
  success: boolean;
  generated_path?: string;
  file_size?: number;
  error?: string;
  traceback?: string;
}

/**
 * Chama o gerador Python para criar documento de proposta
 */
export async function generateWithPython(
  templatePath: string,
  outputPath: string,
  data: PythonGeneratorData
): Promise<PythonGeneratorResult> {
  return new Promise((resolve) => {
    try {
      // Caminho do script Python relativo ao diretório atual
      const scriptPath = path.join(
        process.cwd(),
        "src",
        "services",
        "python",
        "proposal_generator.py"
      );
      
      console.log("[PythonGen] Iniciando geração...");
      console.log("[PythonGen] Script:", scriptPath);
      console.log("[PythonGen] Template:", templatePath);
      console.log("[PythonGen] Output:", outputPath);
      
      // Verificar se script existe
      if (!fs.existsSync(scriptPath)) {
        return resolve({
          success: false,
          error: `Script Python não encontrado: ${scriptPath}`,
        });
      }
      
      // Verificar se template existe
      if (!fs.existsSync(templatePath)) {
        return resolve({
          success: false,
          error: `Template não encontrado: ${templatePath}`,
        });
      }
      
      // Preparar dados para o Python
      const pythonInput = {
        template_path: templatePath,
        output_path: outputPath,
        dados_cliente: data,
      };
      
      console.log("[PythonGen] Dados do cliente:", Object.keys(data));
      
      // Chamar Python com spawn - usar -u para unbuffered output
      // PYTHONIOENCODING=utf-8 força UTF-8 no Windows
      const pythonProcess = spawn("python", ["-u", scriptPath, "--production"], {
        cwd: path.dirname(scriptPath),
        stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONLEGACYWINDOWSSTDIO: '0'
        }
      });
      
      let stdout = "";
      let stderr = "";
      
      // Capturar output
      pythonProcess.stdout.on("data", (data) => {
        const output = data.toString("utf-8");
        stdout += output;
      });
      
      pythonProcess.stderr.on("data", (data) => {
        const output = data.toString("utf-8");
        stderr += output;
      });
      
      // Enviar dados via stdin COM ENCODING UTF-8
      pythonProcess.stdin.setDefaultEncoding('utf-8');
      pythonProcess.stdin.write(JSON.stringify(pythonInput));
      pythonProcess.stdin.end();
      
      // Aguardar conclusão
      pythonProcess.on("close", (code) => {
        console.log("[PythonGen] Python finalizado com código:", code);
        
        // Tentar parsear JSON primeiro antes de verificar código
        try {
          // Pegar última linha do stdout (onde está o JSON)
          const lines = stdout.trim().split("\n");
          const lastLine = lines[lines.length - 1];
          
          // Verificar se a última linha é JSON válido
          if (lastLine.startsWith("{")) {
            const result = JSON.parse(lastLine);
            
            // Se o JSON indica sucesso, ignorar código de saída
            // (warnings do Python podem causar exit code 1)
            if (result.success) {
              console.log("[PythonGen] Resultado:", result);
              return resolve(result);
            }
            
            // JSON válido mas com erro
            console.error("[PythonGen] Erro no resultado:", result.error);
            return resolve(result);
          }
          
          // Não tem JSON válido na última linha
          if (code !== 0) {
            console.error("[PythonGen] STDERR:", stderr);
            return resolve({
              success: false,
              error: `Python falhou (código ${code})`,
              traceback: stderr,
            });
          }
          
          console.error("[PythonGen] Última linha não é JSON:", lastLine);
          console.error("[PythonGen] Output completo:", stdout);
          return resolve({
            success: false,
            error: "Python não retornou JSON válido",
            traceback: stdout,
          });
        } catch (parseError: any) {
          console.error("[PythonGen] Erro ao parsear output:", parseError);
          console.error("[PythonGen] Output completo:", stdout);
          resolve({
            success: false,
            error: "Erro ao parsear resposta do Python",
            traceback: stdout,
          });
        }
      });
      
      pythonProcess.on("error", (error) => {
        console.error("[PythonGen] Erro ao executar Python:", error);
        resolve({
          success: false,
          error: `Erro ao executar Python: ${error.message}`,
        });
      });
    } catch (error: any) {
      console.error("[PythonGen] Erro geral:", error);
      resolve({
        success: false,
        error: error.message || "Erro desconhecido",
      });
    }
  });
}

/**
 * Converte arquivo DOCX para PDF usando Python
 */
export async function convertDocxToPdf(
  docxPath: string,
  pdfPath?: string
): Promise<PythonGeneratorResult> {
  return new Promise((resolve) => {
    try {
      // Caminho do script Python
      const scriptPath = path.join(
        process.cwd(),
        "src",
        "services",
        "python",
        "docx_to_pdf.py"
      );

      if (!fs.existsSync(scriptPath)) {
        return resolve({
          success: false,
          error: `Script Python não encontrado: ${scriptPath}`,
        });
      }

      console.log("[PythonPDF] Iniciando conversão DOCX -> PDF");
      console.log("[PythonPDF] DOCX:", docxPath);
      if (pdfPath) {
        console.log("[PythonPDF] PDF:", pdfPath);
      }

      // Preparar dados JSON
      const inputData = {
        docx_path: docxPath,
        ...(pdfPath && { pdf_path: pdfPath }),
      };

      const jsonInput = JSON.stringify(inputData);
      console.log("[PythonPDF] JSON enviado:", jsonInput);

      // Spawn Python em modo produção
      const pythonProcess = spawn("python", ["-u", scriptPath, "--production"], {
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONLEGACYWINDOWSSTDIO: "0",
        },
      });

      let stdout = "";
      let stderr = "";

      // Enviar JSON via stdin
      pythonProcess.stdin.write(jsonInput, "utf-8");
      pythonProcess.stdin.end();

      pythonProcess.stdout.on("data", (data) => {
        const chunk = data.toString("utf-8");
        stdout += chunk;
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString("utf-8");
      });

      pythonProcess.on("close", (code) => {
        console.log(`[PythonPDF] Python finalizado com código: ${code}`);

        try {
          // Pegar última linha (deve ser o JSON)
          const lastLine = stdout.trim().split("\n").pop() || "";

          if (lastLine.startsWith("{")) {
            const result = JSON.parse(lastLine);

            // Se o JSON indica sucesso, ignorar código de saída
            if (result.success) {
              console.log("[PythonPDF] Conversão concluída:", result.pdf_path);
              return resolve({
                success: true,
                generated_path: result.pdf_path,
                file_size: result.file_size,
              });
            }

            // JSON válido mas com erro
            console.error("[PythonPDF] Erro na conversão:", result.error);
            return resolve(result);
          }

          // Não tem JSON válido
          if (code !== 0) {
            console.error("[PythonPDF] STDERR:", stderr);
            return resolve({
              success: false,
              error: `Python falhou (código ${code})`,
              traceback: stderr,
            });
          }

          console.error("[PythonPDF] Última linha não é JSON:", lastLine);
          return resolve({
            success: false,
            error: "Python não retornou JSON válido",
            traceback: stdout,
          });
        } catch (parseError: any) {
          console.error("[PythonPDF] Erro ao parsear output:", parseError);
          resolve({
            success: false,
            error: "Erro ao parsear resposta do Python",
            traceback: stdout,
          });
        }
      });

      pythonProcess.on("error", (error) => {
        console.error("[PythonPDF] Erro ao executar Python:", error);
        resolve({
          success: false,
          error: `Erro ao executar Python: ${error.message}`,
        });
      });
    } catch (error: any) {
      console.error("[PythonPDF] Erro geral:", error);
      resolve({
        success: false,
        error: error.message || "Erro desconhecido",
      });
    }
  });
}

/**
 * Faz upload do documento PDF para o Supabase Storage
 */
export async function uploadPdfDocument(
  localPath: string,
  storagePath: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    // Ler arquivo PDF
    const buffer = fs.readFileSync(localPath);

    // Upload para storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Erro ao fazer upload: ${uploadError.message}`,
      };
    }

    // Obter URL pública
    const { data: urlData } = supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .getPublicUrl(storagePath);

    // Limpar arquivo temporário
    try {
      fs.unlinkSync(localPath);
    } catch (e) {
      console.warn("[PythonPDF] Não foi possível limpar arquivo temporário:", e);
    }

    return {
      success: true,
      publicUrl: urlData?.publicUrl,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Baixa template do Supabase Storage para arquivo temporário
 */
export async function downloadTemplateToTemp(
  templatePath: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    // Baixar template do storage
    const { data, error } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .download(templatePath);

    if (error || !data) {
      return {
        success: false,
        error: `Erro ao baixar template: ${error?.message}`,
      };
    }

    // Criar arquivo temporário
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFileName = `template_${Date.now()}_${path.basename(templatePath)}`;
    const tempPath = path.join(tempDir, tempFileName);

    // Salvar buffer
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);

    return {
      success: true,
      localPath: tempPath,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Faz upload do documento gerado para o Supabase Storage
 */
export async function uploadGeneratedDocument(
  localPath: string,
  storagePath: string,
  deleteAfterUpload: boolean = true // Parâmetro para controlar se deleta após upload
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    // Ler arquivo gerado
    const buffer = fs.readFileSync(localPath);

    // Upload para storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .upload(storagePath, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Erro ao fazer upload: ${uploadError.message}`,
      };
    }

    // Obter URL pública
    const { data: urlData } = supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .getPublicUrl(storagePath);

    // Limpar arquivo temporário (somente se solicitado)
    if (deleteAfterUpload) {
      try {
        fs.unlinkSync(localPath);
      } catch (e) {
        console.warn("[PythonGen] Não foi possível limpar arquivo temporário:", e);
      }
    }

    return {
      success: true,
      publicUrl: urlData?.publicUrl,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Fluxo completo: Download template -> Gerar com Python -> Upload resultado
 * @param convertToPdf Se true, também converte para PDF e faz upload
 */
export async function generateSolarProposal(
  templateStoragePath: string,
  outputStoragePath: string,
  data: PythonGeneratorData,
  convertToPdf: boolean = false
): Promise<{
  success: boolean;
  generatedPath?: string;
  publicUrl?: string;
  pdfPath?: string;
  pdfUrl?: string;
  error?: string;
}> {
  try {
    console.log("[PythonGen] === INÍCIO DO FLUXO COMPLETO ===");
    
    // 1. Baixar template
    console.log("[PythonGen] 1. Baixando template...");
    const downloadResult = await downloadTemplateToTemp(templateStoragePath);
    if (!downloadResult.success) {
      return {
        success: false,
        error: downloadResult.error,
      };
    }
    const templateLocalPath = downloadResult.localPath!;
    console.log("[PythonGen] Template baixado:", templateLocalPath);

    // 2. Gerar output path temporário
    const tempDir = path.join(process.cwd(), "temp");
    const outputLocalPath = path.join(
      tempDir,
      `generated_${Date.now()}_${path.basename(outputStoragePath)}`
    );
    console.log("[PythonGen] Output local:", outputLocalPath);

    // 3. Gerar documento com Python
    console.log("[PythonGen] 2. Gerando documento com Python...");
    const generateResult = await generateWithPython(
      templateLocalPath,
      outputLocalPath,
      data
    );

    // Limpar template temporário
    try {
      fs.unlinkSync(templateLocalPath);
    } catch (e) {
      console.warn("[PythonGen] Não foi possível limpar template temporário:", e);
    }

    if (!generateResult.success) {
      return {
        success: false,
        error: generateResult.error,
      };
    }
    console.log("[PythonGen] Documento gerado com sucesso!");

    // 4. Upload DOCX para storage
    console.log("[PythonGen] 3. Fazendo upload do DOCX...");
    const uploadResult = await uploadGeneratedDocument(
      outputLocalPath,
      outputStoragePath,
      !convertToPdf // NÃO deletar se vamos converter para PDF
    );

    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error,
      };
    }

    const result: any = {
      success: true,
      generatedPath: outputStoragePath,
      publicUrl: uploadResult.publicUrl,
    };

    // 5. Converter para PDF (opcional)
    if (convertToPdf) {
      console.log("[PythonGen] 4. Convertendo para PDF...");
      
      // Caminho do PDF temporário
      const pdfLocalPath = outputLocalPath.replace(/\.docx$/i, '.pdf');
      
      // Converter
      const pdfResult = await convertDocxToPdf(outputLocalPath, pdfLocalPath);
      
      if (!pdfResult.success) {
        console.warn("[PythonGen] Erro ao converter PDF:", pdfResult.error);
        // Não falha a operação toda, apenas avisa
        result.pdfError = pdfResult.error;
      } else {
        console.log("[PythonGen] PDF gerado com sucesso!");
        
        // Upload do PDF
        console.log("[PythonGen] 5. Fazendo upload do PDF...");
        const pdfStoragePath = outputStoragePath.replace(/\.docx$/i, '.pdf');
        
        const pdfUploadResult = await uploadPdfDocument(
          pdfLocalPath,
          pdfStoragePath
        );
        
        if (!pdfUploadResult.success) {
          console.warn("[PythonGen] Erro ao fazer upload do PDF:", pdfUploadResult.error);
          result.pdfError = pdfUploadResult.error;
        } else {
          console.log("[PythonGen] PDF enviado com sucesso!");
          result.pdfPath = pdfStoragePath;
          result.pdfUrl = pdfUploadResult.publicUrl;
        }
      }
      
      // Limpar arquivo DOCX temporário após converter para PDF
      try {
        fs.unlinkSync(outputLocalPath);
        console.log("[PythonGen] Arquivo DOCX temporário removido após conversão PDF");
      } catch (e) {
        console.warn("[PythonGen] Não foi possível limpar DOCX temporário:", e);
      }
    }

    console.log("[PythonGen] === FLUXO COMPLETO FINALIZADO ===");
    console.log("[PythonGen] URL pública DOCX:", uploadResult.publicUrl);
    if (result.pdfUrl) {
      console.log("[PythonGen] URL pública PDF:", result.pdfUrl);
    }

    return result;
  } catch (error: any) {
    console.error("[PythonGen] Erro no fluxo completo:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido",
    };
  }
}
