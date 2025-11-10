import pg from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL must be set");
  process.exit(1);
}

async function runMigration() {
  console.log("📋 Running migration 024: Add unread_count column");

  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    const sqlPath = join(__dirname, "..", "sql", "024_add_unread_count.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    console.log("📄 SQL loaded from:", sqlPath);
    console.log("🔄 Executing migration...\n");

    const result = await client.query(sql);

    console.log("\n✅ Migration completed successfully!");
    console.log("📊 Result:", result.rows);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
