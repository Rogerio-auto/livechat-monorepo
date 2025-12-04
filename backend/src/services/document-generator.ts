/**
 * Serviço de geração de documentos a partir de templates DOCX
 * Usa docxtemplater para substituir variáveis nos templates
 */

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { supabaseAdmin } from "../lib/supabase.js";
import { DOCS_BUCKET } from "../config/env.js";
import { mapDocumentVariables, DocumentData } from "./document-variables.js";

export interface GenerateDocumentOptions {
  templatePath: string; // caminho do template no storage
  outputFileName: string; // nome do arquivo de saída
  companyId: string;
  data: DocumentData;
  customVariables?: Record<string, any>; // variáveis adicionais customizadas
}

export interface GenerateDocumentResult {
  success: boolean;
  generatedPath?: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Gera um documento DOCX a partir de um template
 */
export async function generateDocument(
  options: GenerateDocumentOptions
): Promise<GenerateDocumentResult> {
  const { templatePath, outputFileName, companyId, data, customVariables } = options;

  try {
    console.log(`[DocGen] Iniciando geração: ${outputFileName} usando template: ${templatePath}`);

    // 1. Baixar template do Storage
    const { data: templateFile, error: downloadError } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .download(templatePath);

    if (downloadError || !templateFile) {
      console.error("[DocGen] Erro ao baixar template:", downloadError);
      return {
        success: false,
        error: `Erro ao baixar template: ${downloadError?.message || "Template não encontrado"}`,
      };
    }

    // 2. Converter template para buffer
    const templateBuffer = Buffer.from(await templateFile.arrayBuffer());

    // 3. Criar instância do PizZip
    const zip = new PizZip(templateBuffer);

    // 4. Criar instância do Docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{", end: "}" }, // Explicitamente definir delimitadores
      nullGetter: (part) => {
        console.log(`[DocGen] Variável não encontrada: ${part}`);
        return ""; // Retorna string vazia para variáveis não encontradas
      },
    });

    // 5. Mapear variáveis do sistema
    const systemVariables = mapDocumentVariables(data);

    // 6. Mesclar com variáveis customizadas
    const allVariables = {
      ...systemVariables,
      ...(customVariables || {}),
    };

    console.log(`[DocGen] Variáveis mapeadas: ${Object.keys(allVariables).length} variáveis`);
    console.log("[DocGen] Primeiras 10 variáveis:", Object.keys(allVariables).slice(0, 10));
    console.log("[DocGen] ========================================");
    console.log("[DocGen] 📄 VALORES DAS VARIÁVEIS:");
    console.log("[DocGen] ========================================");
    console.log("[DocGen] NOME_CLIENTE:", allVariables.NOME_CLIENTE);
    console.log("[DocGen] CPF_CNPJ_CLIENTE:", allVariables.CPF_CNPJ_CLIENTE);
    console.log("[DocGen] NUM_PROPOSTA:", allVariables.NUM_PROPOSTA);
    console.log("[DocGen] VAL_INVEST:", allVariables.VAL_INVEST);
    console.log("[DocGen] NOME_EMPRESA_DOC:", allVariables.NOME_EMPRESA_DOC);
    console.log("[DocGen] NOME_VENDEDOR:", allVariables.NOME_VENDEDOR);
    console.log("[DocGen] POT_TOTAL:", allVariables.POT_TOTAL);
    console.log("[DocGen] FINANC_BANCO:", allVariables.FINANC_BANCO);
    console.log("[DocGen] FINANC_PARCELAS:", allVariables.FINANC_PARCELAS);
    console.log("[DocGen] FINANC_VALOR_PARCELA:", allVariables.FINANC_VALOR_PARCELA);
    console.log("[DocGen] ========================================");
    console.log("[DocGen] Total de variáveis disponíveis:", Object.keys(allVariables).length);
    console.log("[DocGen] ========================================");

    // 7. Setar os dados no template
    doc.setData(allVariables);

    // 8. Renderizar o documento
    try {
      console.log("[DocGen] 🔄 Renderizando documento...");
      doc.render();
      console.log("[DocGen] ✅ Documento renderizado com sucesso!");
    } catch (renderError: any) {
      console.error("[DocGen] Erro ao renderizar template:", renderError);
      return {
        success: false,
        error: `Erro ao renderizar template: ${renderError.message || "Erro desconhecido"}`,
      };
    }

    // 9. Gerar buffer do documento final
    const generatedBuffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    // 10. Fazer upload do documento gerado para o Storage
    const outputPath = `${companyId}/generated/${outputFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .upload(outputPath, generatedBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      console.error("[DocGen] Erro ao fazer upload do documento gerado:", uploadError);
      return {
        success: false,
        error: `Erro ao fazer upload: ${uploadError.message}`,
      };
    }

    // 11. Obter URL pública (ou signed URL)
    const { data: urlData } = supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .getPublicUrl(outputPath);

    console.log(`[DocGen] ========================================`);
    console.log(`[DocGen] ✅ DOCUMENTO GERADO COM SUCESSO!`);
    console.log(`[DocGen] ========================================`);
    console.log(`[DocGen] 📁 Arquivo: ${outputFileName}`);
    console.log(`[DocGen] 📂 Caminho: ${outputPath}`);
    console.log(`[DocGen] 🔗 URL: ${urlData?.publicUrl}`);
    console.log(`[DocGen] ========================================`);

    return {
      success: true,
      generatedPath: outputPath,
      publicUrl: urlData?.publicUrl,
    };
  } catch (error: any) {
    console.error("[DocGen] Erro geral na geração:", error);
    return {
      success: false,
      error: `Erro ao gerar documento: ${error.message || "Erro desconhecido"}`,
    };
  }
}

/**
 * Gera um documento a partir de um template_id
 */
export async function generateDocumentFromTemplate(
  templateId: string,
  companyId: string,
  data: DocumentData,
  customVariables?: Record<string, any>
): Promise<GenerateDocumentResult> {
  try {
    // Buscar template no banco
    const { data: template, error: templateError } = await supabaseAdmin
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (templateError || !template) {
      return {
        success: false,
        error: "Template não encontrado ou inativo",
      };
    }

    // Gerar nome do arquivo
    const timestamp = Date.now();
    const docType = template.doc_type.toLowerCase();
    const outputFileName = `${docType}_${timestamp}.docx`;

    return await generateDocument({
      templatePath: template.template_path,
      outputFileName,
      companyId,
      data,
      customVariables,
    });
  } catch (error: any) {
    console.error("[DocGen] Erro ao gerar documento do template:", error);
    return {
      success: false,
      error: error.message || "Erro ao gerar documento",
    };
  }
}

/**
 * Baixa um documento gerado como buffer
 */
export async function downloadGeneratedDocument(
  generatedPath: string
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .download(generatedPath);

    if (error || !data) {
      return {
        success: false,
        error: "Documento não encontrado",
      };
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    return {
      success: true,
      buffer,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erro ao baixar documento",
    };
  }
}

/**
 * Cria signed URL para download temporário
 */
export async function createSignedUrl(
  generatedPath: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .createSignedUrl(generatedPath, expiresIn);

    if (error || !data) {
      return {
        success: false,
        error: "Erro ao criar URL de download",
      };
    }

    return {
      success: true,
      signedUrl: data.signedUrl,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erro ao criar signed URL",
    };
  }
}
