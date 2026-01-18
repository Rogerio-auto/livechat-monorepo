
import 'dotenv/config';
import db from '../src/pg.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlFile = path.join(__dirname, '../sql/047_admin_company_users_and_logs.sql');
  const seedFile = path.join(__dirname, '../sql/SEED_USAGE_AND_BILLING.sql');
  
  try {
    console.log('Applying migration 047...');
    const migrationSql = fs.readFileSync(sqlFile, 'utf8');
    await db.query(migrationSql);
    console.log('Migration 047 applied successfully.');

    console.log('Applying seed data...');
    const seedSql = fs.readFileSync(seedFile, 'utf8');
    await db.query(seedSql);
    console.log('Seed data applied successfully.');

    process.exit(0);
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

runMigration();
