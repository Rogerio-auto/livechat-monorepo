import { redis } from "../lib/redis.js";
import { getSubscription } from "./subscriptions.service.js";
import { logger } from "../lib/logger.js";

/**
 * Service to handle API rate limiting using Redis sliding window
 */
export class RateLimitService {
  /**
   * Checks if a company has reached its API request limit
   * @param companyId Company ID
   * @returns Object with limit info
   */
  static async checkRateLimit(companyId: string): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    // 1. Get company subscription to find the limit
    const subscription = await getSubscription(companyId);
    
    // Default limits if not specified in plan
    // Starter/Growth (if they somehow get here): 5 req/min
    // Professional: 60 req/min
    // Enterprise: 300 req/min
    let limit = 5; 
    
    if (subscription?.plan?.limits) {
        const planLimits = subscription.plan.limits as any;
        if (planLimits.api_requests_per_minute) {
            limit = planLimits.api_requests_per_minute;
        } else {
            // Fallback based on specific plan IDs if the JSON is not updated yet
            if (subscription.plan_id === 'professional') limit = 60;
            if (subscription.plan_id === 'enterprise') limit = 300;
        }
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const key = `ratelimit:api:v1:${companyId}`;
    
    try {
        // Use a Redis transaction (Multi) to ensure atomicity
        const multi = redis.multi();
        
        // Remove old entries outside the window
        multi.zremrangebyscore(key, 0, now - windowMs);
        // Add current request
        multi.zadd(key, now, now.toString());
        // Count total requests in window
        multi.zcard(key);
        // Set expiry to clean up idle keys
        multi.pexpire(key, windowMs);
        
        const results = await multi.exec();
        if (!results) throw new Error("Redis transaction failed");
        
        // Results index 2 is the ZCARD result
        const count = results[2][1] as number;
        
        const allowed = count <= limit;
        const remaining = Math.max(0, limit - count);
        const reset = now + windowMs;

        return {
            allowed,
            limit,
            remaining,
            reset
        };
    } catch (error) {
        logger.error(`[RateLimitService] Error checking limit for ${companyId}`, error);
        // Fail open to avoid blocking users if Redis is down, but log it
        return {
            allowed: true,
            limit,
            remaining: 1,
            reset: now + windowMs
        };
    }
  }
}
