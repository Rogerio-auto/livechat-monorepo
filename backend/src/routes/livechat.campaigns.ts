import express from "express";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { publish, EX_APP } from "../queue/rabbit.ts";
import { rGet, rSet, rDelMatch } from "../lib/redis.ts";
import { bumpScopeVersion } from "../lib/cache.ts";

export function registerCampaignRoutes(app: express.Application) {
async function resolveCompanyId(req: any): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, user_id, company_id")
    .eq("user_id", req.user.id) // req.user.id = UID do auth
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as any;
  const companyId = row?.company_id;
  if (!companyId) throw new Error("Usuário sem company_id");

  // anota no req para reuso
  req.user.company_id ||= companyId;
  req.user.db_user_id = row?.id ?? null;     // PK da tabela users
  req.user.user_uid  = row?.user_id ?? null; // UID de auth (coluna user_id)

  return companyId;
}


  // -------------------------------
  // LISTAR CAMPANHAS (com cache e paginação)
  // -------------------------------
  app.get("/livechat/campaigns", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const limit = Number(req.query.limit ?? 20);
      const offset = Number(req.query.offset ?? 0);
      const cacheKey = `livechat:campaigns:${companyId}:${limit}:${offset}`;

      const cached = await rGet<any>(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }

      const { data, error, count } = await supabaseAdmin
        .from("campaigns")
        .select(
          "id, name, status, type, inbox_id, start_at, rate_limit_per_minute, auto_handoff, created_at",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);

      const payload = { items: data || [], total: count ?? 0, limit, offset };
      await rSet(cacheKey, payload, 60 * 3); // 3 min cache

      return res.json(payload);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao listar campanhas" });
    }
  });

  // -------------------------------
  // CRIAR CAMPANHA
  // -------------------------------
app.post("/livechat/campaigns", requireAuth, async (req: any, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    const b = req.body || {};

    // Se não vier inbox_id e a coluna for NOT NULL, tenta pegar a primeira inbox da empresa
    let inboxId = b.inbox_id ?? null;
    if (!inboxId) {
      const { data: inbox } = await supabaseAdmin
        .from("inboxes")
        .select("id")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!inbox?.id) {
        return res.status(400).json({ error: "Nenhuma inbox disponível. Crie uma inbox antes de criar campanhas." });
      }
      inboxId = inbox.id;
    }

const insert = {
  company_id: companyId,
  inbox_id: b.inbox_id || null,
  name: String(b.name || "Campanha"),
  type: String(b.type || "BROADCAST"),
  status: "DRAFT",
  rate_limit_per_minute: Number(b.rate_limit_per_minute || 30),
  auto_handoff: !!b.auto_handoff,
  // use a PK real da tabela users. Se o seu FK apontar para users.user_id, troque para user_uid.
  created_by: req.user.db_user_id ?? req.user.user_uid,
};
    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .insert([insert])
      .select("id, name, status, type, inbox_id, rate_limit_per_minute, auto_handoff")
      .single();

    if (error) throw new Error(error.message);

    await bumpScopeVersion(companyId, "livechat:campaigns");
    await rDelMatch(`livechat:campaigns:${companyId}:*`);

    return res.status(201).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao criar campanha" });
  }
});


  // -------------------------------
  // ATUALIZAR CAMPANHA
  // -------------------------------
  app.patch("/livechat/campaigns/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const b = req.body || {};

      const { data, error } = await supabaseAdmin
        .from("campaigns")
        .update({
          name: b.name,
          inbox_id: b.inbox_id ?? null,
          rate_limit_per_minute: b.rate_limit_per_minute ?? 30,
          auto_handoff: !!b.auto_handoff,
        })
        .eq("id", id)
        .eq("company_id", companyId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await bumpScopeVersion(companyId, "livechat:campaigns");
      await rDelMatch(`livechat:campaigns:${companyId}:*`);

      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao atualizar campanha" });
    }
  });

  // -------------------------------
  // LISTAR TEMPLATES
  // -------------------------------
  app.get("/livechat/campaigns/templates", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { data, error } = await supabaseAdmin
        .from("message_templates")
        .select("id, name, kind")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao listar templates" });
    }
  });

  // -------------------------------
  // ADICIONAR STEP
  // -------------------------------
  app.post("/livechat/campaigns/:id/steps", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const b = req.body || {};

      const insert = {
        campaign_id: id,
        company_id: companyId,
        position: Number(b.position ?? 1),
        template_id: b.template_id,
        delay_sec: Number(b.delay_sec ?? 0),
        stop_on_reply: !!b.stop_on_reply,
      };

      const { data, error } = await supabaseAdmin
        .from("campaign_steps")
        .insert([insert])
        .select()
        .single();

      if (error) throw new Error(error.message);

      await rDelMatch(`livechat:campaigns:${companyId}:*`);
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao adicionar step" });
    }
  });

  // -------------------------------
  // PREVIEW (RPC)
  // -------------------------------
  app.get("/livechat/campaigns/:id/preview", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      const { data, error } = await supabaseAdmin.rpc("campaign_preview", {
        p_campaign_id: id,
        p_company_id: companyId,
      });

      if (error) throw new Error(error.message);
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao gerar preview" });
    }
  });

  // -------------------------------
  // COMMIT (RPC)
  // -------------------------------
  app.post("/livechat/campaigns/:id/commit", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      const { data, error } = await supabaseAdmin.rpc("campaign_fill_recipients", {
        p_campaign_id: id,
        p_company_id: companyId,
      });

      if (error) throw new Error(error.message);
      return res.json({ ok: true, ...(data || {}) });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao commitar audiência" });
    }
  });

  // -------------------------------
  // DISPARAR CAMPANHA
  // -------------------------------
  app.post("/livechat/campaigns/:id/dispatch", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      const { data: camp, error: e1 } = await supabaseAdmin
        .from("campaigns")
        .select("id, inbox_id, rate_limit_per_minute")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (e1) throw new Error(e1.message);
      if (!camp?.inbox_id) throw new Error("Inbox não definida");

      const { data: step } = await supabaseAdmin
        .from("campaign_steps")
        .select("id, template_id, delay_sec")
        .eq("campaign_id", id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!step?.id) throw new Error("Nenhum step configurado");

      const { data: tpl } = await supabaseAdmin
        .from("message_templates")
        .select("id, kind, payload")
        .eq("id", step.template_id)
        .maybeSingle();
      if (!tpl?.id) throw new Error("Template ausente");

      const { data: recipients } = await supabaseAdmin
        .from("campaign_recipients")
        .select("id, phone")
        .eq("campaign_id", id)
        .limit(10000);
      if (!recipients?.length) throw new Error("Sem recipients. Execute o Commit.");

      let enqueued = 0;
      for (const r of recipients) {
        const payload = tpl.payload as any;
        if ((tpl.kind || "").toUpperCase() === "TEXT") {
          const content = String(payload?.text || "");
          if (!content) continue;
          await publish(EX_APP, "outbound", {
            jobType: "message.send",
            inboxId: camp.inbox_id,
            content,
            chatId: null,
            customerId: null,
            customerPhone: r.phone,
          });
          enqueued++;
        } else {
          await publish(EX_APP, "outbound", {
            jobType: "meta.sendMedia",
            inboxId: camp.inbox_id,
            media: payload,
            customerPhone: r.phone,
          });
          enqueued++;
        }
      }

      return res.json({ ok: true, enqueued });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao disparar campanha" });
    }
  });

  // -------------------------------
  // CHECAGEM DE PRÉ-REQUISITOS (opcional)
  // -------------------------------
  app.get("/livechat/campaigns/:id/requirements", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const details: any = { inbox: false, step1: false, template: false, recipients: 0 };
      const missing: string[] = [];

      const { data: camp } = await supabaseAdmin
        .from("campaigns").select("inbox_id").eq("id", id).maybeSingle();
      if (camp?.inbox_id) details.inbox = true; else missing.push("inbox");

      const { data: step } = await supabaseAdmin
        .from("campaign_steps").select("template_id").eq("campaign_id", id).maybeSingle();
      if (step?.template_id) details.step1 = true; else missing.push("step");

      const { data: tpl } = await supabaseAdmin
        .from("message_templates").select("id").eq("id", step?.template_id).maybeSingle();
      if (tpl?.id) details.template = true; else missing.push("template");

      const { count } = await supabaseAdmin
        .from("campaign_recipients").select("*", { count: "exact", head: true }).eq("campaign_id", id);
      details.recipients = count ?? 0;
      if (!count) missing.push("recipients");

      const ok = missing.length === 0;
      return res.json({ ok, missing, details });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao checar requisitos" });
    }
  });
}
