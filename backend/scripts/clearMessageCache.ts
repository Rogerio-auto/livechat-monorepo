// Script to clear message cache for a specific chat
import { redis } from "../src/lib/redis.ts";
import "dotenv/config";

async function clearMessageCache() {
  try {
    const chatId = "9b4477fd-0330-431c-adf2-b38eb3f5c307"; // Chat with 416 messages
    
    console.log(`\n🗑️  Clearing cache for chat: ${chatId}`);
    
    // Get all keys related to this chat
    const pattern = `*msgs:${chatId}*`;
    const keys = await redis.keys(pattern);
    
    console.log(`\n📊 Found ${keys.length} cache keys:`);
    keys.forEach(k => console.log(`  - ${k}`));
    
    if (keys.length > 0) {
      const deleted = await redis.del(...keys);
      console.log(`\n✅ Deleted ${deleted} keys`);
    } else {
      console.log("\n❓ No cache keys found for this chat");
    }
    
    // Also check for any other chat cache patterns
    const allMsgKeys = await redis.keys("*msgs*");
    console.log(`\n📊 Total message cache keys: ${allMsgKeys.length}`);
    
    if (allMsgKeys.length > 0 && allMsgKeys.length < 20) {
      console.log("\nAll message cache keys:");
      allMsgKeys.forEach(k => console.log(`  - ${k}`));
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

clearMessageCache();
