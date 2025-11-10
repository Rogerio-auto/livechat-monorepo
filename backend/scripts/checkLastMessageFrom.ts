// Script to check and add last_message_from column to chats table
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAndAddLastMessageFrom() {
  const client = await pool.connect();
  
  try {
    // Check if column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'chats' 
        AND column_name = 'last_message_from'
    `);

    if (columnCheck.rows.length > 0) {
      console.log("✅ Column 'last_message_from' already exists");
      
      // Check some sample values
      const samples = await client.query(`
        SELECT id, last_message_from, last_message 
        FROM chats 
        WHERE last_message IS NOT NULL 
        LIMIT 10
      `);
      
      console.log("\n📊 Sample values:");
      samples.rows.forEach((s) => {
        console.log(`  Chat ${s.id}: last_message_from = ${s.last_message_from}`);
      });
      
    } else {
      console.log("❌ Column 'last_message_from' does NOT exist");
      console.log("📝 Adding column...");
      
      await client.query(`
        ALTER TABLE public.chats 
        ADD COLUMN IF NOT EXISTS last_message_from TEXT;
      `);
      
      console.log("✅ Column added successfully");
      
      // Update existing rows based on messages table
      console.log("📝 Updating existing values from messages...");
      
      await client.query(`
        UPDATE public.chats c
        SET last_message_from = CASE 
          WHEN m.sender_type = 'agent' THEN 'AGENT'
          WHEN m.sender_type = 'customer' THEN 'CUSTOMER'
          ELSE NULL
        END
        FROM (
          SELECT DISTINCT ON (chat_id) 
            chat_id, 
            sender_type,
            created_at
          FROM public.messages
          WHERE chat_id IS NOT NULL
          ORDER BY chat_id, created_at DESC
        ) m
        WHERE c.id = m.chat_id
          AND c.last_message IS NOT NULL;
      `);
      
      const updated = await client.query(`
        SELECT COUNT(*) as count 
        FROM public.chats 
        WHERE last_message_from IS NOT NULL
      `);
      
      console.log(`✅ Updated ${updated.rows[0].count} chats with last_message_from`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

checkAndAddLastMessageFrom();
