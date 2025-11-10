// Script to test message query directly
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testMessageQuery() {
  const client = await pool.connect();
  
  try {
    // Get a chat with messages
    const chats = await client.query(`
      SELECT c.id, COUNT(m.id) as message_count
      FROM chats c
      LEFT JOIN chat_messages m ON m.chat_id = c.id
      GROUP BY c.id
      HAVING COUNT(m.id) > 0
      ORDER BY COUNT(m.id) DESC
      LIMIT 5
    `);
    
    console.log("\n📊 Chats with messages:");
    chats.rows.forEach((c) => {
      console.log(`  ${c.id}: (${c.message_count} messages)`);
    });
    
    if (chats.rows.length === 0) {
      console.log("\n❌ No chats with messages found!");
      return;
    }
    
    const testChatId = chats.rows[0].id;
    console.log(`\n🔍 Testing query for chat: ${testChatId}`);
    
    // Test the actual query used by the API
    const messages = await client.query(`
      SELECT 
        id, 
        chat_id, 
        content, 
        is_from_customer, 
        sender_id, 
        sender_name, 
        sender_avatar_url, 
        created_at, 
        type, 
        view_status
      FROM chat_messages
      WHERE chat_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [testChatId]);
    
    console.log(`\n✅ Query returned ${messages.rows.length} messages`);
    
    if (messages.rows.length > 0) {
      console.log("\n📝 First 3 messages:");
      messages.rows.slice(0, 3).forEach((m, i) => {
        console.log(`  ${i + 1}. [${m.type}] ${m.is_from_customer ? 'CUSTOMER' : 'AGENT'}: ${m.content?.substring(0, 50) || '(no content)'}`);
        console.log(`     Created: ${m.created_at}`);
        console.log(`     Sender: ${m.sender_name || m.sender_id || 'unknown'}`);
      });
    }
    
    // Test with Supabase-like filtering
    const filtered = await client.query(`
      SELECT COUNT(*) as count
      FROM chat_messages
      WHERE chat_id = $1
        AND created_at < NOW()
    `, [testChatId]);
    
    console.log(`\n📊 Messages with timestamp filter: ${filtered.rows[0].count}`);
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

testMessageQuery();
