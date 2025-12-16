
import dotenv from 'dotenv';
dotenv.config();

async function clearCache() {
  const { redis } = await import('../src/lib/redis');
  const companyId = 'd56a5396-22df-486a-8fea-a82138e1f614';
  const key = `subscription:${companyId}`;
  
  try {
    console.log(`Deleting cache key: ${key}`);
    await redis.del(key);
    console.log('Cache cleared successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing cache:', error);
    process.exit(1);
  }
}

clearCache();
