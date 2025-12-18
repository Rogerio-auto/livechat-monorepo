
import db from './pg.ts';

async function checkView() {
  try {
    console.log('Enabling uuid-ossp...');
    await db.none('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    console.log('Checking tools_statistics view...');
    const viewInfo = await db.oneOrNone(`
      SELECT definition 
      FROM pg_views 
      WHERE viewname = 'tools_statistics'
    `);
    
    if (viewInfo) {
      console.log('View definition:', viewInfo.definition);
    } else {
      console.log('View tools_statistics not found.');
    }

    console.log('\nChecking tools_catalog table...');
    const catalogColumns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tools_catalog'
    `);
    console.log('Catalog Columns:', catalogColumns);

    console.log('\nChecking tool_execution_logs table...');
    const logColumns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tool_execution_logs'
    `);
    console.log('Log Columns:', logColumns);

    console.log('\nChecking tool_statistics table...');
    const tableInfo = await db.oneOrNone(`
      SELECT * FROM information_schema.tables 
      WHERE table_name = 'tool_statistics'
    `);
    if (tableInfo) {
      console.log('Table tool_statistics exists.');
      const columns = await db.any(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tool_statistics'
      `);
      console.log('Columns:', columns);
    } else {
      console.log('Table tool_statistics not found.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkView();
