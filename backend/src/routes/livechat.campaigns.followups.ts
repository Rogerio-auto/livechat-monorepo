import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";

export function registerCampaignFollowupsRoutes(app: express.Application) {
  async function resolveCompanyId(req: any): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.company_id;
  }

  app.get("/livechat/campaigns/:id/followups", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabaseAdmin
        .from("campaign_followups")
        .select("id, trigger_event, delay_minutes, template_id, order_index, active")
        .eq("campaign_id", id)
        .order("order_index");
      if (error) throw error;
      return res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/livechat/campaigns/:id/followups", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const b = req.body;
      const { data, error } = await supabaseAdmin
        .from("campaign_followups")
        .insert([{
          campaign_id: id,
          trigger_event: b.trigger_event,
          delay_minutes: b.delay_minutes || 0,
          template_id: b.template_id,
          order_index: b.order_index || 1,
          active: true,
        }])
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
