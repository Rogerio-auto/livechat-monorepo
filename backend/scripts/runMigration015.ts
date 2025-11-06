// Script para executar migration 015 - configurações de inbox e grupos
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente do backend
dotenv.config({ path: resolve(__dirname, "../.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration015() {
  console.log("🚀 Executando Migration 015: Configurações de Inbox e Grupos\n");

  try {
    // Ler arquivo SQL
    const sqlPath = resolve(__dirname, "../sql/015_agents_inbox_config.sql");
    const sql = await readFile(sqlPath, "utf-8");

    console.log("📄 Lendo migration de:", sqlPath);
    console.log("📝 Executando SQL...\n");

    // Executar migration
    await pool.query(sql);

    console.log("✅ Migration 015 executada com sucesso!\n");
    console.log("📊 Alterações aplicadas:");
    console.log("   ✓ Adicionado campo: ignore_group_messages (boolean, default TRUE)");
    console.log("   ✓ Adicionado campo: enabled_inbox_ids (jsonb array, default []");
    console.log("   ✓ Criado índice GIN: agents_enabled_inboxes_idx");
    console.log("   ✓ Adicionados comentários de documentação\n");

    // Verificar estrutura da tabela
      const { rows } = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'agents' 
        AND column_name IN ('ignore_group_messages', 'enabled_inbox_ids')
      ORDER BY column_name
    `);

    console.log("🔍 Verificação dos novos campos:");
      rows.forEach((row: any) => {
      const nullable = row.is_nullable === "YES" ? "✅ SIM" : "❌ NÃO";
      const defaultVal = row.column_default || "-";
      console.log(`   - ${row.column_name} (${row.data_type})`);
      console.log(`     Permite NULL: ${nullable}`);
      console.log(`     Default: ${defaultVal}`);
    });

    // Verificar quantos agentes existentes foram atualizados
      const { rows: [{ count }] } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM agents`
    );

    console.log(`\n📈 Total de agentes na base: ${count}`);
    console.log(`   Todos agora possuem os novos campos configurados!\n`);

      await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Erro ao executar migration:", error.message);
    console.error(error.stack);
      await pool.end();
    process.exit(1);
  }
}

runMigration015();
