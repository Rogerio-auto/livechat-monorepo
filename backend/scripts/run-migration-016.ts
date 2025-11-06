// Script to run migration 016: Add AI models columns to agents
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import db from "../src/pg.ts";

async function runMigration() {
  try {
    console.log("Running migration 016: Add transcription and vision models to agents...");
    
    const sql = readFileSync(join(process.cwd(), "sql", "016_agents_ai_models.sql"), "utf-8");
    
    await db.none(sql);
    
    console.log("✅ Migration 016 completed successfully!");
    
    // Verify columns were added
    const result = await db.any(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'agents' 
        AND column_name IN ('transcription_model', 'vision_model')
      ORDER BY column_name
    `);
    
    console.log("Verified columns:", result);
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    const pool = db.getPool();
    await pool.end();
  }
}

runMigration();
