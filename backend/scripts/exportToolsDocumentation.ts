// Script para exportar documentação de todas as ferramentas do tools_catalog
// Gera um arquivo markdown com instruções de uso para cada ferramenta

import { supabaseAdmin } from "../src/lib/supabase.js";
import { writeFileSync } from "fs";
import { join } from "path";

interface Tool {
  id: string;
  key: string;
  name: string;
  category: string | null;
  description: string | null;
  schema: any;
  handler_type: string;
  handler_config: any;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string | null;
}

async function exportToolsDocumentation() {
  try {
    console.log("🔍 Buscando ferramentas no banco de dados...");

    const { data, error } = await supabaseAdmin
      .from("tools_catalog")
      .select("*")
      .order("company_id", { ascending: true, nullsFirst: true })
      .order("category", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar ferramentas: ${error.message}`);
    }

    const tools = data as Tool[];
    console.log(`✅ Encontradas ${tools.length} ferramentas`);

    // Agrupar por categoria
    const toolsByCategory = tools.reduce((acc, tool) => {
      const category = tool.category || "Sem Categoria";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tool);
      return acc;
    }, {} as Record<string, Tool[]>);

    // Gerar Markdown
    let markdown = generateMarkdown(toolsByCategory);

    // Salvar arquivo
    const outputPath = join(process.cwd(), "TOOLS_DOCUMENTATION.md");
    writeFileSync(outputPath, markdown, "utf-8");

    console.log(`\n✅ Documentação gerada com sucesso!`);
    console.log(`📄 Arquivo: ${outputPath}`);
    console.log(`\n📊 Resumo por categoria:`);
    
    Object.entries(toolsByCategory).forEach(([category, tools]) => {
      console.log(`   ${category}: ${tools.length} ferramenta(s)`);
    });

  } catch (error) {
    console.error("❌ Erro ao exportar documentação:", error);
    throw error;
  }
}

function generateMarkdown(toolsByCategory: Record<string, Tool[]>): string {
  const lines: string[] = [];

  // Header
  lines.push("# 🛠️ Documentação de Ferramentas (Tools)");
  lines.push("");
  lines.push("Este documento contém instruções de uso para todas as ferramentas disponíveis no sistema.");
  lines.push("Use estas instruções no prompt dos agentes de IA para que eles saibam como e quando usar cada ferramenta.");
  lines.push("");
  lines.push("---");
  lines.push("");

  // Índice
  lines.push("## 📑 Índice por Categoria");
  lines.push("");
  Object.keys(toolsByCategory).sort().forEach(category => {
    const tools = toolsByCategory[category];
    lines.push(`- **${category}** (${tools.length} ferramenta(s))`);
    tools.forEach(tool => {
      lines.push(`  - [${tool.name}](#${slugify(tool.key)})`);
    });
  });
  lines.push("");
  lines.push("---");
  lines.push("");

  // Ferramentas por categoria
  Object.entries(toolsByCategory).sort().forEach(([category, tools]) => {
    lines.push(`## 📂 ${category}`);
    lines.push("");

    tools.forEach(tool => {
      lines.push(`### ${tool.name}`);
      lines.push("");
      lines.push(`**Chave:** \`${tool.key}\``);
      lines.push("");
      
      if (tool.description) {
        lines.push(`**Descrição:**`);
        lines.push(tool.description);
        lines.push("");
      }

      // Handler info
      lines.push(`**Tipo de Handler:** \`${tool.handler_type}\``);
      
      // Provider restrictions
      if (tool.handler_config?.allowed_providers) {
        lines.push("");
        lines.push(`**⚠️ Restrição de Provider:**`);
        lines.push(`Esta ferramenta funciona APENAS com: ${tool.handler_config.allowed_providers.map((p: string) => `\`${p}\``).join(", ")}`);
      }
      
      lines.push("");

      // Schema de parâmetros
      if (tool.schema?.properties) {
        lines.push("**Parâmetros:**");
        lines.push("");
        
        const properties = tool.schema.properties;
        const required = tool.schema.required || [];

        Object.entries(properties).forEach(([paramName, paramSchema]: [string, any]) => {
          const isRequired = required.includes(paramName);
          const requiredBadge = isRequired ? " *(obrigatório)*" : " *(opcional)*";
          
          lines.push(`- **\`${paramName}\`**${requiredBadge}`);
          lines.push(`  - **Tipo:** \`${paramSchema.type}\``);
          
          if (paramSchema.description) {
            lines.push(`  - **Descrição:** ${paramSchema.description}`);
          }
          
          if (paramSchema.enum) {
            lines.push(`  - **Valores permitidos:** ${paramSchema.enum.map((v: any) => `\`${v}\``).join(", ")}`);
          }
          
          if (paramSchema.minItems !== undefined || paramSchema.maxItems !== undefined) {
            const min = paramSchema.minItems !== undefined ? `mínimo ${paramSchema.minItems}` : "";
            const max = paramSchema.maxItems !== undefined ? `máximo ${paramSchema.maxItems}` : "";
            const range = [min, max].filter(Boolean).join(", ");
            lines.push(`  - **Quantidade:** ${range}`);
          }
          
          if (paramSchema.maxLength !== undefined) {
            lines.push(`  - **Tamanho máximo:** ${paramSchema.maxLength} caracteres`);
          }
          
          if (paramSchema.items) {
            lines.push(`  - **Items do array:**`);
            if (paramSchema.items.properties) {
              Object.entries(paramSchema.items.properties).forEach(([itemProp, itemSchema]: [string, any]) => {
                lines.push(`    - \`${itemProp}\`: ${itemSchema.description || itemSchema.type}`);
              });
            }
          }
          
          lines.push("");
        });
      }

      // Exemplo de uso
      lines.push("**Exemplo de uso no prompt:**");
      lines.push("");
      lines.push("```markdown");
      lines.push(generateUsageExample(tool));
      lines.push("```");
      lines.push("");

      // Status
      const statusEmoji = tool.is_active ? "✅" : "❌";
      const statusText = tool.is_active ? "Ativa" : "Inativa";
      lines.push(`**Status:** ${statusEmoji} ${statusText}`);
      
      if (tool.company_id) {
        lines.push(`**Escopo:** Customizada (company_id: ${tool.company_id})`);
      } else {
        lines.push(`**Escopo:** Global (disponível para todas as empresas)`);
      }
      
      lines.push("");
      lines.push("---");
      lines.push("");
    });
  });

  // Footer
  lines.push("## 💡 Dicas de Uso");
  lines.push("");
  lines.push("1. **Leia a descrição com atenção** - Ela explica quando e como usar cada ferramenta");
  lines.push("2. **Respeite os parâmetros obrigatórios** - Ferramentas não funcionarão sem eles");
  lines.push("3. **Verifique restrições de provider** - Algumas ferramentas só funcionam em tipos específicos de inbox");
  lines.push("4. **Use exemplos como base** - Adapte os exemplos para seu caso de uso");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`*Documentação gerada automaticamente em ${new Date().toLocaleString("pt-BR")}*`);

  return lines.join("\n");
}

function generateUsageExample(tool: Tool): string {
  const lines: string[] = [];
  
  lines.push(`Quando você precisar ${tool.description?.toLowerCase().split(".")[0] || "usar esta ferramenta"},`);
  lines.push(`use a ferramenta "${tool.key}" com os seguintes parâmetros:`);
  lines.push("");

  if (tool.schema?.properties) {
    const properties = tool.schema.properties;
    const required = tool.schema.required || [];

    Object.entries(properties).forEach(([paramName, paramSchema]: [string, any]) => {
      const isRequired = required.includes(paramName);
      if (isRequired) {
        lines.push(`- ${paramName}: ${getExampleValue(paramName, paramSchema)}`);
      }
    });
  }

  return lines.join("\n");
}

function getExampleValue(paramName: string, schema: any): string {
  if (schema.type === "string") {
    if (schema.enum) {
      return `"${schema.enum[0]}"`;
    }
    if (paramName.includes("message") || paramName.includes("text")) {
      return '"[Sua mensagem aqui]"';
    }
    return '"[texto]"';
  }
  
  if (schema.type === "array") {
    if (schema.items?.properties) {
      const itemExample: any = {};
      Object.keys(schema.items.properties).forEach(key => {
        itemExample[key] = "[valor]";
      });
      return `[${JSON.stringify(itemExample)}]`;
    }
    return "[]";
  }
  
  if (schema.type === "object") {
    return "{}";
  }
  
  if (schema.type === "number" || schema.type === "integer") {
    return "0";
  }
  
  if (schema.type === "boolean") {
    return "true";
  }
  
  return "[valor]";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Executar
exportToolsDocumentation()
  .then(() => {
    console.log("\n✨ Processo concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erro fatal:", error);
    process.exit(1);
  });
