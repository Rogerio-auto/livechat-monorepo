import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("📋 Running migration 024: Add unread_count column");

  try {
    const sqlPath = join(__dirname, "..", "sql", "024_add_unread_count.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    console.log("📄 SQL loaded from:", sqlPath);
    console.log("🔄 Executing migration...");

    const { data, error } = await supabase.rpc("exec_sql", { sql_string: sql });

    if (error) {
      console.error("❌ Migration failed:", error.message);
      console.error("Details:", error);
      process.exit(1);
    }

    console.log("✅ Migration completed successfully!");
    if (data) {
      console.log("📊 Result:", data);
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

runMigration();
