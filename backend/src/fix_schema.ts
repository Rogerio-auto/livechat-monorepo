
import db from './pg.ts';

async function fixSchema() {
  try {
    console.log('Fixing tool_statistics table and trigger...');
    
    // 1. Drop existing trigger and function
    await db.none('DROP TRIGGER IF EXISTS trg_update_tool_stats ON tool_execution_logs');
    await db.none('DROP FUNCTION IF EXISTS update_tool_stats()');

    // 2. Ensure columns match the interface
    await db.none(`
      ALTER TABLE tool_statistics 
      RENAME COLUMN last_used_at TO last_executed_at;
    `).catch(() => console.log('Column last_used_at already renamed or not found'));

    await db.none(`
      ALTER TABLE tool_statistics 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    // 3. Recreate the function with correct column names
    await db.none(`
      CREATE OR REPLACE FUNCTION update_tool_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO tool_statistics (
            tool_id, 
            total_calls, 
            error_count, 
            avg_latency_ms, 
            last_executed_at,
            updated_at
        )
        VALUES (
            NEW.tool_id, 
            1, 
            CASE WHEN NEW.status = 'error' THEN 1 ELSE 0 END, 
            NEW.latency_ms, 
            NEW.created_at,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (tool_id) DO UPDATE SET
            total_calls = tool_statistics.total_calls + 1,
            error_count = tool_statistics.error_count + (CASE WHEN NEW.status = 'error' THEN 1 ELSE 0 END),
            avg_latency_ms = (tool_statistics.avg_latency_ms * tool_statistics.total_calls + NEW.latency_ms) / (tool_statistics.total_calls + 1),
            last_executed_at = NEW.created_at,
            updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 4. Recreate the trigger
    await db.none(`
      CREATE TRIGGER trg_update_tool_stats
      AFTER INSERT ON tool_execution_logs
      FOR EACH ROW
      EXECUTE FUNCTION update_tool_stats();
    `);

    console.log('Schema fixed successfully!');
  } catch (error) {
    console.error('Error fixing schema:', error);
  } finally {
    process.exit();
  }
}

fixSchema();
