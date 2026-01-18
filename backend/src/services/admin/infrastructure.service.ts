import { redis } from "../../lib/redis.js";
import { getQueueInfo, 
  Q_INBOUND, Q_OUTBOUND, Q_OUTBOUND_DLQ, 
  Q_CAMPAIGN_FOLLOWUP, Q_FLOW_EXECUTION, 
  Q_INBOUND_MEDIA, Q_SOCKET_LIVECHAT, Q_WEBHOOK_DISPATCH 
} from "../../queue/rabbit.js";
import db from "../../pg.js";

export class InfrastructureService {
  async getRedisStats() {
    try {
      const rawInfo = await redis.info();
      const stats: Record<string, string> = {};
      
      rawInfo.split("\n").forEach(line => {
        if (line && !line.startsWith("#")) {
          const [key, value] = line.split(":");
          if (key && value) stats[key.trim()] = value.trim();
        }
      });

      return {
        version: stats.redis_version,
        uptime_seconds: parseInt(stats.uptime_in_seconds || "0"),
        used_memory_human: stats.used_memory_human,
        connected_clients: parseInt(stats.connected_clients || "0"),
        total_commands_processed: parseInt(stats.total_commands_processed || "0"),
        keyspace_hits: parseInt(stats.keyspace_hits || "0"),
        keyspace_misses: parseInt(stats.keyspace_misses || "0"),
        mem_fragmentation_ratio: parseFloat(stats.mem_fragmentation_ratio || "0"),
      };
    } catch (error) {
       console.error('[InfraService] Redis Error:', error);
       return { error: true, message: 'Redis indisponível' };
    }
  }

  async getRabbitMQStats() {
    const queues = [
      Q_INBOUND, Q_OUTBOUND, Q_OUTBOUND_DLQ, 
      Q_CAMPAIGN_FOLLOWUP, Q_FLOW_EXECUTION, 
      Q_INBOUND_MEDIA, Q_SOCKET_LIVECHAT, Q_WEBHOOK_DISPATCH
    ];

    try {
      const stats = await Promise.all(
        queues.map(async (q) => {
          try {
            return await getQueueInfo(q);
          } catch (error) {
            // Se a fila não existir, tenta criar ela via topology ou apenas reporta erro
            return { queue: q, messageCount: 0, consumerCount: 0, error: true };
          }
        })
      );
      return stats;
    } catch (error) {
      console.error('[InfraService] RabbitMQ Error:', error);
      return [];
    }
  }

  async getDatabaseStats() {
    try {
      const [connCount, tableSizes] = await Promise.all([
        db.query("SELECT count(*) as count FROM pg_stat_activity"),
        db.query(`
          SELECT 
            relname as table_name, 
            pg_size_pretty(pg_total_relation_size(relid)) as total_size,
            n_live_tup as row_count
          FROM pg_stat_user_tables 
          ORDER BY pg_total_relation_size(relid) DESC 
          LIMIT 10
        `)
      ]);

      return {
        activeConnections: parseInt(connCount.rows[0].count),
        topTables: tableSizes.rows,
      };
    } catch (error) {
       console.error('[InfraService] DB Error:', error);
       return { error: true, activeConnections: 0, topTables: [] };
    }
  }

  async getWorkerStatus() {
    // Adicionado "all" que é o padrão do worker principal
    const workerTypes = ["all", "inbound", "outbound", "inbound-media", "campaigns", "flows", "webhooks"];
    try {
      const statuses = await Promise.all(
        workerTypes.map(async (type) => {
          const key = `worker:instance:lock:${type}`;
          const val = await redis.get(key);
          const ttl = await redis.ttl(key);
          return {
            type,
            active: !!val,
            instanceId: val,
            ttl: ttl > 0 ? ttl : null
          };
        })
      );

      return statuses;
    } catch (error) {
      console.error('[InfraService] Worker Scan Error:', error);
      return [];
    }
  }

  async getSummary() {
    // Usando .reflect ou similar não é necessário pois já tratamos no nível individual
    const [redis, rabbit, db, workers] = await Promise.all([
      this.getRedisStats(),
      this.getRabbitMQStats(),
      this.getDatabaseStats(),
      this.getWorkerStatus()
    ]);

    return {
      redis,
      rabbit,
      db,
      workers,
      timestamp: new Date().toISOString()
    };
  }
}
