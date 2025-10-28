// src/routes/adminWebhooks.ts
import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

export async function listWebhookEvents(req: Request, res: Response) {
  const { inboxId, limit = "50" } = req.query as any;
  const q = supabaseAdmin.from("webhook_events")
    .select("id,inbox_id,provider,event_uid,received_at,raw")
    .eq("provider","META")
    .order("received_at", { ascending: false })
    .limit(Number(limit));
  if (inboxId) q.eq("inbox_id", String(inboxId));
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}
