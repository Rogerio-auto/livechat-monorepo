
import "dotenv/config";
import pg from "pg";

const { DATABASE_URL } = process.env;

async function run() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    const res = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'customers'
      ORDER BY ordinal_position;
    `);
    console.log("CUSTOMERS TABLE SCHEMA:");
    console.table(res.rows);

    const triggers = await pool.query(`
      SELECT tgname, tgenabled 
      FROM pg_trigger 
      WHERE tgrelid = 'customers'::regclass;
    `);
    console.log("CUSTOMERS TRIGGERS:");
    console.table(triggers.rows);

    const leads = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads');
    `);
    console.log("LEADS TABLE EXISTS:", leads.rows[0].exists);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

run();
