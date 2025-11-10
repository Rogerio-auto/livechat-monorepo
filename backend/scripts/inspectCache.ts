// Script to inspect cache content
import { redis } from "../src/lib/redis.ts";
import "dotenv/config";

async function inspectCache() {
  try {
    const chatId = "103f5d1c-bf84-447b-9810-accb9b8c2b31"; // Chat from logs
    
    // Find all cache keys for this chat
    const pattern = `*msgs*${chatId}*`;
    const keys = await redis.keys(pattern);
    
    console.log(`\n🔍 Cache keys for chat ${chatId}:`);
    console.log(`Found ${keys.length} keys\n`);
    
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      const type = await redis.type(key);
      
      console.log(`📦 Key: ${key}`);
      console.log(`   Type: ${type}`);
      console.log(`   TTL: ${ttl}s (${Math.floor(ttl / 60)}min)`);
      
      if (type === "string") {
        const value = await redis.get(key);
        if (value) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              console.log(`   Content: Array with ${parsed.length} items`);
            } else if (parsed.data && Array.isArray(parsed.data)) {
              console.log(`   Content: Envelope with ${parsed.data.length} messages`);
              console.log(`   Last-Modified: ${parsed.lastModified || 'N/A'}`);
              console.log(`   ETag: ${parsed.etag || 'N/A'}`);
            } else {
              console.log(`   Content: Object with keys: ${Object.keys(parsed).join(', ')}`);
            }
          } catch {
            console.log(`   Content: String (${value.length} chars)`);
          }
        }
      } else if (type === "zset") {
        const count = await redis.zcard(key);
        console.log(`   Members: ${count}`);
      } else if (type === "set") {
        const members = await redis.smembers(key);
        console.log(`   Members: ${members.length}`);
        if (members.length > 0 && members.length <= 10) {
          members.forEach(m => console.log(`     - ${m}`));
        }
      }
      console.log();
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

inspectCache();
