
import { db } from './pg.js';

async function checkConstraints() {
  try {
    console.log('Checking tool_tests table...');
    const columns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tool_tests'
    `);
    console.log('Columns:', columns);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkConstraints();
