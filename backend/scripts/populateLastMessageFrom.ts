// Script to populate last_message_from based on messages table
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function populateLastMessageFrom() {
  const client = await pool.connect();
  
  try {
    console.log("📝 Updating last_message_from for all chats...");
    
    const result = await client.query(`
      UPDATE public.chats c
      SET last_message_from = CASE 
        WHEN m.is_from_customer = true THEN 'CUSTOMER'
        WHEN m.is_from_customer = false THEN 'AGENT'
        ELSE NULL
      END
      FROM (
        SELECT DISTINCT ON (chat_id) 
          chat_id, 
          is_from_customer,
          created_at
        FROM public.chat_messages
        WHERE chat_id IS NOT NULL
        ORDER BY chat_id, created_at DESC
      ) m
      WHERE c.id = m.chat_id;
    `);
    
    console.log(`✅ Updated ${result.rowCount} chats`);
    
    // Check updated values
    const samples = await client.query(`
      SELECT id, last_message_from, last_message, last_message_at
      FROM chats 
      WHERE last_message_from IS NOT NULL
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT 10
    `);
    
    console.log("\n📊 Sample updated values:");
    samples.rows.forEach((s) => {
      console.log(`  Chat ${s.id}: last_message_from = ${s.last_message_from}`);
    });
    
    // Stats
    const stats = await client.query(`
      SELECT 
        last_message_from,
        COUNT(*) as count
      FROM chats
      GROUP BY last_message_from
      ORDER BY count DESC
    `);
    
    console.log("\n📊 Statistics:");
    stats.rows.forEach((s) => {
      console.log(`  ${s.last_message_from || 'NULL'}: ${s.count} chats`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

populateLastMessageFrom();
