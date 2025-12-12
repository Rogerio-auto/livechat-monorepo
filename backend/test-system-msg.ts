
import "dotenv/config";
import { supabaseAdmin } from "./src/lib/supabase";

async function testInsert() {
  console.log("Testing system message insert...");
  
  // Get a valid chat ID first
  const { data: chats } = await supabaseAdmin.from("chats").select("id").limit(1);
  if (!chats || chats.length === 0) {
    console.error("No chats found to test with");
    return;
  }
  
  const chatId = chats[0].id;
  console.log("Using chat ID:", chatId);

  const { data, error } = await supabaseAdmin.from("chat_messages").insert({
    chat_id: chatId,
    content: "Test System Message",
    type: "SYSTEM",
    sender_type: "SYSTEM",
    created_at: new Date().toISOString(),
  }).select();

  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert successful:", data);
  }
}

testInsert();
