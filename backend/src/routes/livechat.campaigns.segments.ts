import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { rDelMatch } from "../lib/redis.js";

export function registerCampaignSegmentsRoutes(app: express.Application) {
  async function resolveCompanyId(req: any): Promise<string> {
    const companyId = req.profile?.company_id || req.user?.company_id;
    if (companyId) return companyId;

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.company_id) throw new Error("Usuário sem company_id");
    return data.company_id;
  }

  app.get("/livechat/campaigns/segments", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { data, error } = await supabaseAdmin
        .from("campaign_segments")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/livechat/campaigns/segments", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const b = req.body;
      const { data, error } = await supabaseAdmin
        .from("campaign_segments")
        .insert([{
          company_id: companyId,
          name: b.name,
          description: b.description,
          conditions: b.conditions || [],
          created_by: req.user.id,
        }])
        .select()
        .single();
      if (error) throw error;
      await rDelMatch(`livechat:campaigns:${companyId}:*`);
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
}
