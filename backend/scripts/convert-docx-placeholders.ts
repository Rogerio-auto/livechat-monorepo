/**
 * Script para converter placeholders em templates DOCX
 * Converte de #VARIAVEL para {VARIAVEL}
 * 
 * Uso:
 * npm run convert-docx -- caminho/do/arquivo.docx
 * ou
 * npm run convert-docx -- caminho/da/pasta
 */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// Padrões para IGNORAR (cores, números puros, etc)
const IGNORE_PATTERNS = [
  /^[0-9A-F]{6}$/i,          // Cores hex de 6 dígitos EXATOS (FFFFFF, 008EC4, FEFEFE)
  /^[0-9A-F]{3}$/i,          // Cores hex de 3 dígitos (FFF, 000)
  /^[0-9]{6}$/,              // 6 números (385523)
  /^_+$/,                     // Apenas underscores (_)
];

/**
 * Verifica se um match deve ser ignorado
 */
function shouldIgnore(match: string): boolean {
  // Remover caracteres especiais para testar apenas o conteúdo
  const cleanMatch = match.replace(/[#\{\}\[\]<>$]/g, "");
  
  // Casos especiais primeiro
  if (cleanMatch === "_" || cleanMatch.length === 0) {
    return true; // Ignorar underscore sozinho ou vazio
  }
  
  // Se tem underscore + letras, SEMPRE é uma variável válida
  if (/_[A-Z]/.test(cleanMatch) || /[A-Z]_/.test(cleanMatch)) {
    return false; // NÃO ignorar - é claramente uma variável (NOME_CLIENTE, T_COMPOSICAO, etc)
  }
  
  // Verificar se é cor hex ou número puro
  const isColorOrNumber = IGNORE_PATTERNS.some(pattern => pattern.test(cleanMatch));
  if (isColorOrNumber) {
    return true; // IGNORAR - é cor ou número
  }
  
  return false; // Por padrão, converter
}

// Padrões de conversão
const CONVERSION_PATTERNS = [
  // #VARIAVEL -> {VARIAVEL} (mas ignora cores e números)
  { 
    from: /#([A-Z_0-9]+)/g, 
    to: (match: string, p1: string) => shouldIgnore(p1) ? match : `{${p1}}`
  },
  
  // #{VARIAVEL} -> {VARIAVEL}
  { 
    from: /#{([A-Z_0-9]+)}/g, 
    to: (match: string, p1: string) => shouldIgnore(p1) ? match : `{${p1}}`
  },
  
  // #VARIAVEL# -> {VARIAVEL}
  { 
    from: /#([A-Z_0-9]+)#/g, 
    to: (match: string, p1: string) => shouldIgnore(p1) ? match : `{${p1}}`
  },
  
  // [VARIAVEL] -> {VARIAVEL}
  { 
    from: /\[([A-Z_0-9]+)\]/g, 
    to: (match: string, p1: string) => shouldIgnore(p1) ? match : `{${p1}}`
  },
  
  // <VARIAVEL> -> {VARIAVEL}
  { 
    from: /<([A-Z_0-9]+)>/g, 
    to: (match: string, p1: string) => shouldIgnore(p1) ? match : `{${p1}}`
  },
  
  // $VARIAVEL -> {VARIAVEL}
  { 
    from: /\$([A-Z_0-9]+)/g, 
    to: (match: string, p1: string) => shouldIgnore(p1) ? match : `{${p1}}`
  },
  
  // {{VARIAVEL}} -> {VARIAVEL}
  { 
    from: /{{([A-Z_0-9]+)}}/g, 
    to: (match: string, p1: string) => shouldIgnore(p1) ? match : `{${p1}}`
  },
];

interface ConversionResult {
  success: boolean;
  originalFile: string;
  convertedFile: string;
  replacements: number;
  patterns: string[];
  error?: string;
}

/**
 * Converte placeholders em um arquivo DOCX
 */
async function convertDocxFile(inputPath: string): Promise<ConversionResult> {
  try {
    console.log(`\n🔍 Processando: ${inputPath}`);

    // Ler arquivo
    const content = fs.readFileSync(inputPath);
    const zip = new PizZip(content);

    // Extrair document.xml (onde está o conteúdo principal)
    const documentXml = zip.file("word/document.xml")?.asText();
    if (!documentXml) {
      throw new Error("Arquivo document.xml não encontrado no DOCX");
    }

    let modifiedXml = documentXml;
    let totalReplacements = 0;
    const patternsFound: string[] = [];
    const ignoredPatterns: string[] = [];

    // Aplicar todas as conversões
    for (const pattern of CONVERSION_PATTERNS) {
      const matches = modifiedXml.match(pattern.from);
      if (matches && matches.length > 0) {
        const uniqueMatches = [...new Set(matches)];
        const validMatches: string[] = [];
        
        // Filtrar matches válidos e ignorados
        uniqueMatches.forEach(match => {
          const extractedValue = match.match(pattern.from)?.[1] || match;
          const ignored = shouldIgnore(extractedValue);
          
          if (ignored) {
            ignoredPatterns.push(match);
          } else {
            validMatches.push(match);
          }
        });
        
        if (validMatches.length > 0) {
          console.log(`  ✓ Encontrados ${validMatches.length} placeholders válidos:`);
          validMatches.slice(0, 15).forEach(match => {
            const result = match.replace(pattern.from, pattern.to as any);
            console.log(`    - ${match} → ${result}`);
          });
          
          if (validMatches.length > 15) {
            console.log(`    ... e mais ${validMatches.length - 15} variáveis`);
          }
          
          patternsFound.push(...validMatches);
          
          // Contar substituições reais
          const beforeCount = modifiedXml.length;
          modifiedXml = modifiedXml.replace(pattern.from, pattern.to as any);
          const afterCount = modifiedXml.length;
          
          // Estimar substituições pela mudança de tamanho
          totalReplacements += validMatches.length;
        }
      }
    }

    // Mostrar padrões ignorados
    if (ignoredPatterns.length > 0) {
      const uniqueIgnored = [...new Set(ignoredPatterns)];
      console.log(``);
      console.log(`  🚫 ${uniqueIgnored.length} padrões ignorados (cores hex, números):`);
      uniqueIgnored.slice(0, 8).forEach(match => {
        console.log(`     · ${match} (mantido)`);
      });
      if (uniqueIgnored.length > 8) {
        console.log(`     · ... e mais ${uniqueIgnored.length - 8}`);
      }
      console.log(``);
    }

    if (totalReplacements === 0) {
      console.log("  ℹ️  Nenhum placeholder encontrado para converter");
      return {
        success: true,
        originalFile: inputPath,
        convertedFile: inputPath,
        replacements: 0,
        patterns: [],
      };
    }

    // Atualizar o XML no ZIP
    zip.file("word/document.xml", modifiedXml);

    // Gerar novo arquivo
    const outputBuffer = zip.generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    // Criar nome do arquivo convertido
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const name = path.basename(inputPath, ext);
    const outputPath = path.join(dir, `${name}_convertido${ext}`);

    // Salvar arquivo convertido
    fs.writeFileSync(outputPath, outputBuffer);

    console.log(`  ✅ Conversão concluída!`);
    console.log(`  📊 Total de substituições: ${totalReplacements}`);
    console.log(`  💾 Arquivo salvo em:`);
    console.log(`     ${outputPath}`);
    console.log(`  `);

    return {
      success: true,
      originalFile: inputPath,
      convertedFile: outputPath,
      replacements: totalReplacements,
      patterns: [...new Set(patternsFound)],
    };
  } catch (error: any) {
    console.error(`  ❌ Erro: ${error.message}`);
    return {
      success: false,
      originalFile: inputPath,
      convertedFile: "",
      replacements: 0,
      patterns: [],
      error: error.message,
    };
  }
}

/**
 * Processa um diretório inteiro
 */
async function convertDirectory(dirPath: string): Promise<ConversionResult[]> {
  const files = fs.readdirSync(dirPath);
  const results: ConversionResult[] = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursivo para subpastas
      const subResults = await convertDirectory(fullPath);
      results.push(...subResults);
    } else if (file.toLowerCase().endsWith(".docx") && !file.includes("_convertido")) {
      const result = await convertDocxFile(fullPath);
      results.push(result);
    }
  }

  return results;
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🔄 Conversor de Placeholders DOCX                            ║
╚════════════════════════════════════════════════════════════════╝

Converte automaticamente placeholders de templates DOCX:
  #VARIAVEL      → {VARIAVEL}
  #{VARIAVEL}    → {VARIAVEL}
  #VARIAVEL#     → {VARIAVEL}
  [VARIAVEL]     → {VARIAVEL}
  <VARIAVEL>     → {VARIAVEL}
  $VARIAVEL      → {VARIAVEL}
  {{VARIAVEL}}   → {VARIAVEL}

📖 Uso:
  npm run convert-docx -- arquivo.docx
  npm run convert-docx -- pasta/com/templates

📝 Exemplos:
  npm run convert-docx -- template.docx
  npm run convert-docx -- ./templates
  npm run convert-docx -- "C:\\Users\\Usuario\\Documents\\template.docx"

ℹ️  O arquivo original será mantido e uma cópia "_convertido.docx" será criada.
    `);
    process.exit(0);
  }

  const targetPath = args[0];

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Caminho não encontrado: ${targetPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(targetPath);
  let results: ConversionResult[] = [];

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🔄 Conversor de Placeholders DOCX                            ║
╚════════════════════════════════════════════════════════════════╝
  `);

  if (stat.isDirectory()) {
    console.log(`📁 Processando diretório: ${targetPath}\n`);
    results = await convertDirectory(targetPath);
  } else if (targetPath.toLowerCase().endsWith(".docx")) {
    results = [await convertDocxFile(targetPath)];
  } else {
    console.error("❌ O arquivo deve ter extensão .docx");
    process.exit(1);
  }

  // Resumo final
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   📊 RESUMO DA CONVERSÃO                                       ║
╚════════════════════════════════════════════════════════════════╝
  `);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalReplacements = successful.reduce((sum, r) => sum + r.replacements, 0);

  console.log(`✅ Arquivos processados: ${successful.length}`);
  console.log(`❌ Arquivos com erro: ${failed.length}`);
  console.log(`📊 Total de substituições: ${totalReplacements}`);

  if (successful.length > 0) {
    console.log(`\n📄 Arquivos convertidos:`);
    successful.forEach(r => {
      if (r.replacements > 0) {
        console.log(`  ✓ ${path.basename(r.convertedFile)} (${r.replacements} substituições)`);
        console.log(`    📁 Local: ${r.convertedFile}`);
      }
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ Arquivos com erro:`);
    failed.forEach(r => {
      console.log(`  ✗ ${path.basename(r.originalFile)}: ${r.error}`);
    });
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   ✨ Conversão concluída!                                      ║
╚════════════════════════════════════════════════════════════════╝

📝 Próximos passos:
  1. Abra os arquivos "_convertido.docx" para verificar
  2. Faça upload dos templates convertidos no sistema
  3. Teste a geração de documentos
  4. Se tudo estiver ok, substitua os originais
  `);
}

main().catch(console.error);
