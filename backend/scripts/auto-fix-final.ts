import AdmZip from "adm-zip";
import * as fs from "fs";

const docxPath = "C:\\Users\\roger\\Downloads\\Proposta 2025 - CORRIGIDOv1.docx";

console.log("🔧 CORREÇÃO AUTOMÁTICA FINAL\n");
console.log("=" .repeat(80));

// Fazer backup
const backupPath = docxPath.replace(".docx", ".BACKUP-AUTO.docx");
fs.copyFileSync(docxPath, backupPath);
console.log("✅ Backup criado:", backupPath);

const zip = new AdmZip(docxPath);
const entry = zip.getEntry("word/document.xml");
if (!entry) throw new Error("document.xml não encontrado");

let xml = entry.getData().toString("utf8");

console.log("\n📊 ANTES:");
const before = {
  openTags: (xml.match(/\{\{/g) || []).length,
  closeTags: (xml.match(/\}\}/g) || []).length,
};
console.log(`   {{ : ${before.openTags}`);
console.log(`   }} : ${before.closeTags}`);
console.log(`   Diferença: ${Math.abs(before.openTags - before.closeTags)}`);

// CORREÇÃO 1: Remover }} anos/meses/dias órfãos
console.log("\n🔪 Removendo }} anos/meses/dias...");
let removed = 0;

// Padrão: qualquer }} seguido de anos/meses/dias
const pattern = /<w:t[^>]*>\s*\}\}\s*<\/w:t>\s*<w:t[^>]*>\s*(anos|meses|dias)/gi;
xml = xml.replace(pattern, (match, word) => {
  removed++;
  // Remove o <w:t>}}</w:t>, mantém a palavra
  return match.replace(/<w:t[^>]*>\s*\}\}\s*<\/w:t>\s*/, "");
});

console.log(`   ✅ Removidos: ${removed}`);

// CORREÇÃO 2: Remover outros }} isolados óbvios
console.log("\n🔪 Removendo outros }} órfãos...");
let removed2 = 0;

// Remover APENAS }} que estão totalmente isolados em uma tag <w:t>}}</w:t>
// E que NÃO têm {{ próximo (checagem de contexto)
const xmlArray = xml.split("");
let i = 0;

while (i < xml.length) {
  // Procurar padrão <w:t xml:space="preserve">}}</w:t>
  const match = xml.substring(i).match(/^<w:t[^>]*xml:space="preserve">\s*\}\}\s*<\/w:t>/);
  
  if (match) {
    // Verificar se há {{ nos 500 chars anteriores
    const checkBefore = xml.substring(Math.max(0, i - 500), i);
    const lastOpen = checkBefore.lastIndexOf("{{");
    const lastClose = checkBefore.lastIndexOf("}}");
    
    // Se o último {{ está ANTES do último }}, então este }} é órfão
    if (lastOpen === -1 || lastClose > lastOpen) {
      // Remover este }}
      xml = xml.substring(0, i) + xml.substring(i + match[0].length);
      removed2++;
      continue; // Não avançar i, processar mesma posição novamente
    }
  }
  
  i++;
}

console.log(`   ✅ Removidos: ${removed2}`);

console.log("\n📊 DEPOIS:");
const after = {
  openTags: (xml.match(/\{\{/g) || []).length,
  closeTags: (xml.match(/\}\}/g) || []).length,
};
console.log(`   {{ : ${after.openTags}`);
console.log(`   }} : ${after.closeTags}`);
console.log(`   Diferença: ${Math.abs(after.openTags - after.closeTags)}`);

// Salvar
zip.updateFile("word/document.xml", Buffer.from(xml, "utf8"));
const outputPath = "C:\\Users\\roger\\Downloads\\Proposta 2025 - FINAL-CORRIGIDO.docx";
zip.writeZip(outputPath);

console.log(`\n✅ Arquivo corrigido salvo:`);
console.log(`   ${outputPath}`);

if (after.openTags === after.closeTags) {
  console.log(`\n🎉 PERFEITO! Tags balanceadas: ${after.openTags} = ${after.closeTags}`);
} else {
  console.log(`\n⚠️ Diferença de ${Math.abs(after.openTags - after.closeTags)} tags`);
}

console.log("\n" + "=".repeat(80));
