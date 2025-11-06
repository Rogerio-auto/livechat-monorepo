import "dotenv/config";
import { db } from "../src/pg";

async function run() {
  console.log("🔄 Executando migration 013_populate_template_tools...");
  
  try {
    // Buscar templates
    const { rows: templates } = await db.query<{ id: string; key: string }>(`
      select id, key from public.agent_templates 
      where key in ('sales', 'reception') and company_id is null
    `);
    
    console.log(`📋 Templates encontrados: ${templates.length}`);
    
    // Buscar ferramentas
    const { rows: tools } = await db.query<{ id: string; key: string }>(`
      select id, key from public.tools_catalog 
      where key in ('query_contact_data', 'update_contact_data', 'add_contact_tag') 
      and company_id is null
    `);
    
    console.log(`🔧 Ferramentas encontradas: ${tools.length}`);
    
    // Mapeamento: qual template recebe quais ferramentas
    const associations = [
      { template: 'sales', tools: ['query_contact_data', 'add_contact_tag'] },
      { template: 'reception', tools: ['query_contact_data', 'update_contact_data', 'add_contact_tag'] },
    ];
    
    let count = 0;
    for (const assoc of associations) {
      const template = templates.find((t: { key: string }) => t.key === assoc.template);
      if (!template) {
        console.warn(`⚠️ Template ${assoc.template} não encontrado`);
        continue;
      }
      
      for (const toolKey of assoc.tools) {
        const tool = tools.find((t: { key: string }) => t.key === toolKey);
        if (!tool) {
          console.warn(`⚠️ Tool ${toolKey} não encontrada`);
          continue;
        }
        
        await db.none(`
          insert into public.agent_template_tools(template_id, tool_id, required, overrides)
          values ($1, $2, false, '{}'::jsonb)
          on conflict (template_id, tool_id) do nothing
        `, [template.id, tool.id]);
        
        count++;
        console.log(`  ✅ ${assoc.template} ← ${toolKey}`);
      }
    }
    
    console.log(`\n✅ Migration concluída! ${count} associações criadas.`);
    
  } catch (err) {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
  }
  
  process.exit(0);
}

run();
