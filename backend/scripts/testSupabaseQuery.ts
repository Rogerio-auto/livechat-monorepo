// Script to test Supabase query
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testSupabaseQuery() {
  try {
    // Use the chat ID from previous test
    const chatId = "9b4477fd-0330-431c-adf2-b38eb3f5c307";
    
    console.log(`\n🔍 Testing Supabase query for chat: ${chatId}`);
    
    const { data, error } = await supabase
      .from("chat_messages")
      .select(
        "id, chat_id, content, is_from_customer, sender_id, sender_name, sender_avatar_url, created_at, type, view_status"
      )
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (error) {
      console.error("❌ Supabase error:", error);
      return;
    }
    
    console.log(`\n✅ Supabase returned ${data?.length || 0} messages`);
    
    if (data && data.length > 0) {
      console.log("\n📝 First 3 messages:");
      data.slice(0, 3).forEach((m: any, i) => {
        console.log(`  ${i + 1}. [${m.type}] ${m.is_from_customer ? 'CUSTOMER' : 'AGENT'}: ${m.content?.substring(0, 50) || '(no content)'}`);
        console.log(`     Created: ${m.created_at}`);
        console.log(`     Sender: ${m.sender_name || m.sender_id || 'unknown'}`);
      });
    } else {
      console.log("\n❌ No messages returned!");
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    process.exit(0);
  }
}

testSupabaseQuery();
