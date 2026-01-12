import { Request, Response } from "express";
import { getRedis, rGet, rSet } from "../lib/redis.js";

export class SystemController {
  static healthCheck(_req: Request, res: Response) {
    res.json({ status: "ok", time: new Date().toISOString() });
  }

  static async redisPing(_req: Request, res: Response) {
    try {
      const pong = await getRedis().ping();
      res.json({ ok: true, pong });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }

  static async redisSetGet(_req: Request, res: Response) {
    try {
      await rSet("test:hello", { ok: true, t: new Date().toISOString() }, 300);
      const got = await rGet("test:hello");
      res.json({ got });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
}
