import { supabaseAdmin } from "../src/lib/supabase";
import fs from "fs";
import path from "path";

async function main() {
  const sqlFile = process.argv[2];
  
  if (!sqlFile) {
    console.error("Usage: tsx scripts/runSql.ts <sql-file>");
    process.exit(1);
  }

  const sqlPath = path.resolve(sqlFile);
  const sql = fs.readFileSync(sqlPath, "utf8");

  console.log(`Executing SQL from: ${sqlPath}`);
  console.log("---");
  
  // Split by semicolon and execute each statement
  const statements = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s && !s.startsWith("--"));

  for (const statement of statements) {
    console.log(`\nExecuting:\n${statement.substring(0, 100)}...`);
    
    const { error } = await supabaseAdmin.rpc("exec_sql", { 
      sql: statement + ";" 
    });

    if (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
    
    console.log("✅ Success");
  }

  console.log("\n✅ All SQL statements executed successfully");
}

main();
