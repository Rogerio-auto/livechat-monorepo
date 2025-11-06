import "dotenv/config";
import { db } from "../src/pg";

async function checkAgentsColumns() {
  console.log("🔍 Verificando colunas da tabela agents...\n");
  
  try {
    const { rows } = await db.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string;
    }>(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'agents'
      ORDER BY ordinal_position
    `);
    
    console.log("📋 Estrutura da tabela agents:\n");
    console.log("Coluna                     | Tipo        | Permite NULL | Default");
    console.log("---------------------------|-------------|--------------|--------");
    
    rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '✅ SIM' : '❌ NÃO';
      const defaultVal = col.column_default ? col.column_default.substring(0, 20) : '-';
      console.log(`${col.column_name.padEnd(26)} | ${col.data_type.padEnd(11)} | ${nullable.padEnd(12)} | ${defaultVal}`);
    });
    
    console.log("\n");
    
    // Identificar colunas que NÃO permitem NULL mas são opcionais no schema Zod
    const optionalColumns = [
      'description',
      'integration_openai_id',
      'model',
      'model_params',
      'aggregation_window_sec',
      'max_batch_messages',
      'reply_if_idle_sec',
      'media_config',
      'tools_policy',
      'updated_at'
    ];
    
    const problematic = rows.filter(col => 
      optionalColumns.includes(col.column_name) && col.is_nullable === 'NO'
    );
    
    if (problematic.length > 0) {
      console.log("⚠️  Colunas opcionais que ainda têm NOT NULL constraint:");
      problematic.forEach(col => {
        console.log(`   ❌ ${col.column_name}`);
      });
    } else {
      console.log("✅ Todas as colunas opcionais permitem NULL corretamente!");
    }
    
  } catch (err) {
    console.error("❌ Erro ao verificar colunas:", err);
    process.exit(1);
  }
  
  process.exit(0);
}

checkAgentsColumns();
