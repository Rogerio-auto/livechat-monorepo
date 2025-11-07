import { supabaseAdmin } from "../src/lib/supabase";
import fs from "fs";

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error("Usage: tsx scripts/executeSqlDirect.ts <sql-file>");
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, "utf8");
  console.log(`Executing SQL from: ${sqlFile}`);
  console.log("---");

  // Execute diretamente via query (não RPC)
  const { data, error } = await supabaseAdmin.rpc('exec', { sql });
  
  if (error) {
    // Tenta via conexão direta se RPC falhar
    console.warn("RPC exec failed, trying direct connection...");
    
    // Import pg if available
    try {
      const { db } = await import("../src/pg");
      await db.none(sql);
      console.log("✅ SQL executed successfully via pg");
    } catch (pgError: any) {
      console.error("❌ Error:", pgError.message || pgError);
      process.exit(1);
    }
  } else {
    console.log("✅ SQL executed successfully");
  }
}

main();
