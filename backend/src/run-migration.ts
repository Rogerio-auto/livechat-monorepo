import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

async function runMigration() {
  const sqlPath = path.join(process.cwd(), "..", "CREATE_FLOW_BUILDER_TABLES.sql");
  console.log(`Reading migration from: ${sqlPath}`);
  
  if (!fs.existsSync(sqlPath)) {
    console.error("Migration file not found!");
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to database...");
    const client = await pool.connect();
    console.log("Connected. Executing migration...");
    
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    
    console.log("✅ Migration executed successfully!");
    client.release();
  } catch (error) {
    console.error("❌ Error executing migration:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
