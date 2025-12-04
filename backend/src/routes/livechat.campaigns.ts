import express from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { warnOnLimit } from "../middlewares/checkSubscription.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { z } from "zod";
import { publish, EX_APP } from "../queue/rabbit.ts";
import { rGet, rSet, rDelMatch } from "../lib/redis.ts";
import { bumpScopeVersion } from "../lib/cache.ts";
import { validateCampaignSafety } from "../services/campaigns/validation.js";
import * as db from "../pg.ts";

// Multer for file uploads (max 5MB for recipient lists)
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(txt|csv|xlsx|xls)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Formato não suportado. Use TXT, CSV ou XLSX."));
    }
  }
});

export function registerCampaignRoutes(app: express.Application) {
  const router = express.Router();

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
          "id, name, status, type, inbox_id, start_at, end_at, rate_limit_per_minute, auto_handoff, created_at, send_windows, timezone, segment_id",
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
app.post("/livechat/campaigns", requireAuth, warnOnLimit("campaigns_per_month"), async (req: any, res) => {
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
  inbox_id: inboxId,
  name: String(b.name || "Campanha"),
  type: String(b.type || "BROADCAST"),
  status: "DRAFT",
  rate_limit_per_minute: Number(b.rate_limit_per_minute || 30),
  auto_handoff: !!b.auto_handoff,
  // scheduling (opcional). Se vier string de data, normaliza para ISO; caso contrário, mantém null
  start_at: b.start_at ? new Date(b.start_at).toISOString() : null,
  end_at: b.end_at ? new Date(b.end_at).toISOString() : null,
  // janela diária opcional
  send_windows: b.send_windows ?? { enabled: false },
  timezone: b.timezone || "America/Sao_Paulo",
  // use a PK real da tabela users. Se o seu FK apontar para users.user_id, troque para user_uid.
  created_by: req.user.db_user_id ?? req.user.user_uid,
};
    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .insert([insert])
      .select("id, name, status, type, inbox_id, rate_limit_per_minute, auto_handoff, start_at, end_at, send_windows, timezone")
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
  // VALIDAR CAMPANHA (antes de ativar)
  // -------------------------------
  app.get("/livechat/campaigns/:id/validate", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      console.log(`[campaigns] 🔍 Validando campanha ${id}`);
      
      const validation = await validateCampaignSafety(id);
      
      if (!validation.safe) {
        console.warn(`[campaigns] ⚠️  Validação falhou:`, validation.critical_issues);
      } else {
        console.log(`[campaigns] ✅ Validação passou:`, validation.stats);
      }

      return res.json(validation);
    } catch (err) {
      console.error("[campaigns] Erro ao validar:", err);
      return res.status(500).json({ 
        error: err instanceof Error ? err.message : String(err),
        safe: false,
        critical_issues: ["Erro interno ao validar campanha"],
        warnings: [],
        stats: {},
      });
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

      // Se está tentando ativar campanha (mudando status para RUNNING ou SCHEDULED), validar segurança
      if (b.status && (b.status === "RUNNING" || b.status === "SCHEDULED")) {
        console.log(`[campaigns] 🔍 Validando segurança antes de ativar campanha ${id}`);
        
        try {
          const validation = await validateCampaignSafety(id);
          
          if (!validation.safe) {
            console.error(`[campaigns] ❌ Validação falhou:`, validation.critical_issues);
            return res.status(400).json({
              error: "Campanha não passou na validação de segurança",
              critical_issues: validation.critical_issues,
              warnings: validation.warnings,
              stats: validation.stats,
            });
          }
          
          if (validation.warnings.length > 0) {
            console.warn(`[campaigns] ⚠️  Warnings encontrados:`, validation.warnings);
          }
          
          console.log(`[campaigns] ✅ Validação passou:`, validation.stats);
        } catch (validationError) {
          console.error(`[campaigns] ❌ Erro na validação:`, validationError);
          return res.status(500).json({
            error: "Erro ao validar campanha",
            details: validationError instanceof Error ? validationError.message : String(validationError),
          });
        }
      }

      // Permite atualizar status opcionalmente
      const patch: any = {};
      if (b.name !== undefined) patch.name = b.name;
      if (b.inbox_id !== undefined) patch.inbox_id = b.inbox_id ?? null;
      if (b.rate_limit_per_minute !== undefined) patch.rate_limit_per_minute = b.rate_limit_per_minute ?? 30;
      if (b.auto_handoff !== undefined) patch.auto_handoff = !!b.auto_handoff;
  if (b.status !== undefined) patch.status = b.status; // EXPECT: DRAFT|RUNNING|PAUSED|SCHEDULED|COMPLETED|CANCELLED
  if (b.start_at !== undefined) patch.start_at = b.start_at ? new Date(b.start_at).toISOString() : null;
  if (b.end_at !== undefined) patch.end_at = b.end_at ? new Date(b.end_at).toISOString() : null;
  if (b.send_windows !== undefined) patch.send_windows = b.send_windows;
  if (b.timezone !== undefined) patch.timezone = b.timezone;

      const { data, error } = await supabaseAdmin
        .from("campaigns")
        .update(patch)
        .eq("id", id)
        .eq("company_id", companyId)
  .select("id, name, status, type, inbox_id, rate_limit_per_minute, auto_handoff, start_at, end_at, send_windows, timezone")
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
      const syncMeta = req.query.syncMeta === "true";
      
      // Busca templates locais
      const { data, error } = await supabaseAdmin
        .from("message_templates")
        .select("id, name, kind, payload, inbox_id")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      
      // Se syncMeta=true, busca templates da Meta e sincroniza status
      if (syncMeta) {
        // Busca inboxes META_CLOUD da empresa
        const { data: inboxes } = await supabaseAdmin
          .from("inboxes")
          .select("id, provider, waba_id")
          .eq("company_id", companyId)
          .eq("provider", "META_CLOUD");
        
        if (inboxes && inboxes.length > 0) {
          const { listWhatsAppTemplates } = await import("../services/meta/templates.js");
          
          for (const inbox of inboxes) {
            if (!inbox.waba_id) continue;
            
            try {
              // Busca templates da Meta para esta inbox
              const metaTemplates = await listWhatsAppTemplates(inbox.id);
              
              // Atualiza status dos templates locais que têm meta_template_id
              for (const tpl of data || []) {
                if (tpl.inbox_id !== inbox.id) continue;
                if (!tpl.payload?.meta_template_id) continue;
                
                // Encontra template correspondente na Meta
                const metaTemplate = metaTemplates.find((mt: any) => 
                  mt.id === tpl.payload.meta_template_id || 
                  mt.name === tpl.payload.meta_template_name
                );
                
                if (metaTemplate && metaTemplate.status !== tpl.payload?.status) {
                  // Atualiza status no banco
                  await supabaseAdmin
                    .from("message_templates")
                    .update({
                      payload: {
                        ...tpl.payload,
                        status: metaTemplate.status,
                        meta_template_id: metaTemplate.id,
                        meta_template_name: metaTemplate.name,
                        language: metaTemplate.language,
                        category: metaTemplate.category,
                        synced_at: new Date().toISOString(),
                      }
                    })
                    .eq("id", tpl.id);
                  
                  // Atualiza no array também
                  tpl.payload.status = metaTemplate.status;
                  console.log(`[campaigns] ✅ synced template ${tpl.name} → status: ${metaTemplate.status}`);
                }
              }
            } catch (err) {
              console.warn(`[campaigns] ⚠️  falha ao sincronizar templates da inbox ${inbox.id}:`, err);
            }
          }
        }
      }
      
      // Adiciona meta_status extraído do payload para facilitar o frontend
      const templates = (data || []).map((tpl: any) => ({
        id: tpl.id,
        name: tpl.name,
        kind: tpl.kind,
        meta_status: tpl.payload?.status || null,
        meta_template_id: tpl.payload?.meta_template_id || null,
        meta_template_name: tpl.payload?.meta_template_name || null,
      }));
      
      return res.json(templates);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao listar templates" });
    }
  });

  // -------------------------------
  // IMPORTAR TEMPLATES DA META
  // -------------------------------
  app.post("/livechat/campaigns/templates/import-from-meta", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      const allowed = ["ADMIN","MANAGER"].includes(role);
      if (!allowed) return res.status(403).json({ error: "Sem permissão para importar templates" });
      
      const companyId = await resolveCompanyId(req);
      const bodySchema = z.object({
        inboxId: z.string().uuid(),
        status: z.enum(["APPROVED", "PENDING", "REJECTED"]).optional(),
      }).strict();
      const parsed = bodySchema.parse(req.body || {});

      // Valida inbox
      const { data: inbox, error: inboxErr } = await supabaseAdmin
        .from("inboxes")
        .select("id, provider, waba_id")
        .eq("id", parsed.inboxId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (inboxErr) throw new Error(inboxErr.message);
      if (!inbox) return res.status(404).json({ error: "Inbox não encontrada" });
      if (inbox.provider !== "META_CLOUD") {
        return res.status(400).json({ error: "Inbox deve ser do tipo META_CLOUD" });
      }
      if (!inbox.waba_id) {
        return res.status(400).json({ error: "Inbox não possui waba_id configurado" });
      }

      // Busca templates da Meta
      const { listWhatsAppTemplates } = await import("../services/meta/templates.js");
      const metaTemplates = await listWhatsAppTemplates(parsed.inboxId, { 
        status: parsed.status,
        limit: 100 
      });

      // Busca templates locais existentes para esta inbox
      const { data: existingTemplates } = await supabaseAdmin
        .from("message_templates")
        .select("id, name, payload")
        .eq("company_id", companyId)
        .eq("inbox_id", parsed.inboxId);

      const existingMetaIds = new Set(
        (existingTemplates || [])
          .map((t: any) => t.payload?.meta_template_id)
          .filter(Boolean)
      );

      // Importa apenas templates que não existem localmente
      const imported = [];
      for (const metaTemplate of metaTemplates) {
        if (existingMetaIds.has(metaTemplate.id)) {
          continue; // Já existe localmente
        }

        // Determina kind baseado nos componentes
        let kind = "TEXT";
        const components = (metaTemplate as any).components || [];
        const hasHeader = components.find((c: any) => c.type === "HEADER");
        const hasButtons = components.find((c: any) => c.type === "BUTTONS");
        
        if (hasButtons) {
          kind = "BUTTONS";
        } else if (hasHeader?.format === "IMAGE") {
          kind = "IMAGE";
        } else if (hasHeader?.format === "VIDEO") {
          kind = "VIDEO";
        } else if (hasHeader?.format === "DOCUMENT") {
          kind = "DOCUMENT";
        }

        // Extrai texto do BODY
        const bodyComponent = components.find((c: any) => c.type === "BODY");
        const text = bodyComponent?.text || "";

        const payload = {
          text,
          meta_template_id: metaTemplate.id,
          meta_template_name: metaTemplate.name,
          status: metaTemplate.status,
          language: metaTemplate.language,
          category: metaTemplate.category,
          components,
          imported_at: new Date().toISOString(),
        };

        const { data: created, error: createErr } = await supabaseAdmin
          .from("message_templates")
          .insert({
            company_id: companyId,
            inbox_id: parsed.inboxId,
            name: metaTemplate.name,
            kind,
            payload,
          })
          .select("id, name")
          .single();

        if (!createErr && created) {
          imported.push(created);
          console.log(`[campaigns] ✅ imported template: ${metaTemplate.name} (${metaTemplate.status})`);
        }
      }

      return res.json({
        success: true,
        imported: imported.length,
        total: metaTemplates.length,
        templates: imported,
      });
    } catch (e: any) {
      console.error("[campaigns] erro ao importar templates da Meta:", e);
      return res.status(500).json({ error: e?.message || "Erro ao importar templates" });
    }
  });

  // -------------------------------
  // CRIAR TEMPLATE (rascunho)
  // -------------------------------
  app.post("/livechat/campaigns/templates", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      const allowed = ["ADMIN","MANAGER","SUPERVISOR"].includes(role);
      if (!allowed) return res.status(403).json({ error: "Sem permissão para criar template" });
      const companyId = await resolveCompanyId(req);
      const bodySchema = z.object({
        name: z.string().trim().min(1),
        kind: z.enum(["TEXT","IMAGE","VIDEO","DOCUMENT","BUTTONS","PAYMENT","MEDIA_TEXT"]),
        payload: z.any().optional().default({}),
        inboxId: z.string().uuid().optional().nullable(),
      }).strict();
      const parsed = bodySchema.parse(req.body || {});
      // Mapeia corretamente tipos de mídia e texto
      const mapKind = (k: string, payload: any) => {
        switch (k) {
          case "MEDIA_TEXT":
            // Se tem mediaUrl, é texto + mídia
            return { kind: "MEDIA_TEXT", payload: { text: payload.text || "", mediaUrl: payload.mediaUrl || "", _meta: { original_kind: k } } };
          case "IMAGE":
          case "VIDEO":
          case "DOCUMENT":
            // Só mídia
            return { kind: k, payload: { mediaUrl: payload.mediaUrl || "", _meta: { original_kind: k } } };
          case "BUTTONS":
          case "PAYMENT":
            // usa TEMPLATE para armazenar estruturas mais complexas
            return { kind: "TEMPLATE", payload: { ...payload, _meta: { original_kind: k } } };
          default:
            // TEXT puro
            return { kind: k, payload: { text: payload.text || "", _meta: { original_kind: k } } };
        }
      };
      const mapped = mapKind(parsed.kind, parsed.payload ?? {});

      // Valida inbox para tipos que exigem API oficial
      if (["BUTTONS","PAYMENT"].includes(parsed.kind) || (parsed.kind === "MEDIA_TEXT" && mapped.payload.mediaUrl)) {
        if (parsed.inboxId) {
          const { data: inboxRow, error: inboxErr } = await supabaseAdmin
            .from("inboxes")
            .select("id, provider")
            .eq("id", parsed.inboxId)
            .maybeSingle();
          if (inboxErr) throw new Error(inboxErr.message);
          if (!inboxRow) return res.status(400).json({ error: "Inbox inválida para a empresa" });
          if (!["META_CLOUD","WAHA"].includes(inboxRow.provider)) {
            return res.status(400).json({ error: "Esta campanha contém botões ou mídia, mas a inbox selecionada não é API oficial." });
          }
        }
      }
      // valida inbox (se enviada)
      let inboxId: string | null = null;
      if (parsed.inboxId) {
        const { data: inboxRow, error: inboxErr } = await supabaseAdmin
          .from("inboxes")
          .select("id, company_id")
          .eq("id", parsed.inboxId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (inboxErr) throw new Error(inboxErr.message);
        if (!inboxRow) return res.status(400).json({ error: "Inbox inválida para a empresa" });
        inboxId = inboxRow.id as string;
      }
      // Buscar users.id local a partir do auth user_id
      let createdBy: string | null = null;
      if (req.user?.id) {
        const { data: userRow } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("user_id", req.user.id)
          .maybeSingle();
        createdBy = userRow?.id || null;
      }
      const insert = {
        company_id: companyId,
        name: parsed.name,
        kind: mapped.kind,
        payload: mapped.payload,
        created_by: createdBy,
        inbox_id: inboxId,
      } as any;
      const { data, error } = await supabaseAdmin
        .from("message_templates")
        .insert([insert])
        .select("id, name, kind, payload, company_id, created_at, updated_at, created_by, inbox_id")
        .single();
      if (error) throw new Error(error.message);
      await bumpScopeVersion(`templates:${companyId}`);
      return res.status(201).json(data);
    } catch (e: any) {
  const isZod = e instanceof z.ZodError;
  return res.status(isZod ? 400 : 500).json({ error: isZod ? (e as any).issues.map((i: any)=>i.message).join("; ") : (e?.message || "Erro ao criar template") });
    }
  });

  // -------------------------------
  // ATUALIZAR TEMPLATE
  // -------------------------------
  app.put("/livechat/campaigns/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const role = String(req?.profile?.role || "").toUpperCase();
      const allowed = ["ADMIN","MANAGER","SUPERVISOR"].includes(role);
      if (!allowed) return res.status(403).json({ error: "Sem permissão para atualizar template" });
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });
      const bodySchema = z.object({
        name: z.string().trim().min(1).optional(),
        kind: z.enum(["TEXT","IMAGE","VIDEO","DOCUMENT","BUTTONS","PAYMENT","MEDIA_TEXT"]).optional(),
        payload: z.any().optional(),
        inboxId: z.string().uuid().optional().nullable(),
      }).strict();
      const patch = bodySchema.parse(req.body || {});
      const mapKind = (k: string | undefined, payload: any) => {
        if (!k) return { kind: undefined, payload };
        switch (k) {
          case "MEDIA_TEXT":
            return { kind: "TEXT", payload: { ...payload, _meta: { original_kind: k } } };
          case "BUTTONS":
          case "PAYMENT":
            return { kind: "TEMPLATE", payload: { ...payload, _meta: { original_kind: k } } };
          default:
            return { kind: k, payload };
        }
      };
      const mapped = mapKind(patch.kind, patch.payload ?? undefined);
      // valida inbox (se enviada)
      let inboxId: string | undefined = undefined;
      if (patch.inboxId !== undefined) {
        if (patch.inboxId === null) {
          inboxId = null as any; // explicit clear
        } else {
          const { data: inboxRow, error: inboxErr } = await supabaseAdmin
            .from("inboxes")
            .select("id, company_id")
            .eq("id", patch.inboxId)
            .eq("company_id", companyId)
            .maybeSingle();
          if (inboxErr) throw new Error(inboxErr.message);
          if (!inboxRow) return res.status(400).json({ error: "Inbox inválida para a empresa" });
          inboxId = inboxRow.id as string;
        }
      }
      const update = {
        name: patch.name ?? undefined,
        kind: mapped.kind ?? undefined,
        payload: mapped.payload ?? undefined,
        updated_at: new Date().toISOString(),
        inbox_id: inboxId,
      } as any;
      const { data, error } = await supabaseAdmin
        .from("message_templates")
        .update(update)
        .eq("id", id)
        .eq("company_id", companyId)
        .select("id, name, kind, payload, company_id, created_at, updated_at, inbox_id")
        .single();
      if (error) throw new Error(error.message);
      await bumpScopeVersion(`templates:${companyId}`);
      return res.json(data);
    } catch (e: any) {
  const isZod = e instanceof z.ZodError;
  return res.status(isZod ? 400 : 500).json({ error: isZod ? (e as any).issues.map((i: any)=>i.message).join("; ") : (e?.message || "Erro ao atualizar template") });
    }
  });

  // -------------------------------
  // PREVIEW TEMPLATE
  // -------------------------------
  app.get("/livechat/campaigns/templates/:id/preview", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      
      const { data, error } = await supabaseAdmin
        .from("message_templates")
        .select("id, company_id, name, kind, payload, variables, created_at, updated_at, inbox_id")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: "Template não encontrado" });
      
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao visualizar template" });
    }
  });

    // -------------------------------
    // DETALHES TEMPLATE (enriquecido)
    // -------------------------------
    app.get("/livechat/campaigns/templates/:id/details", requireAuth, async (req: any, res) => {
      try {
        const companyId = await resolveCompanyId(req);
        const { id } = req.params;
        const userId = req.user?.id;
      
        // 1. Buscar template
        const { data: template, error: tplError } = await supabaseAdmin
          .from("message_templates")
          .select("id, company_id, name, kind, payload, variables, created_at, updated_at, created_by, inbox_id")
          .eq("id", id)
          .eq("company_id", companyId)
          .maybeSingle();
      
        if (tplError) throw new Error(tplError.message);
        if (!template) return res.status(404).json({ error: "Template não encontrado" });
      
        // 2. Buscar criador
        let creator = null;
        if (template.created_by) {
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("id, name, email")
            .eq("id", template.created_by)
            .maybeSingle();
          if (user) creator = user;
        }
      
  // Inbox derivada e campanhas
  let inbox: any = null;
  
  // Prioridade 1: Buscar inbox diretamente do template.inbox_id
  if (template.inbox_id) {
    const { data: inboxData } = await supabaseAdmin
      .from("inboxes")
      .select("id, name, provider, is_official_api")
      .eq("id", template.inbox_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (inboxData) inbox = inboxData;
  }
  
  // 3. Buscar campanhas que usam este template (via campaign_steps)
        const { data: steps } = await supabaseAdmin
          .from("campaign_steps")
          .select("campaign_id")
          .eq("template_id", id)
          .limit(100);
        let campaigns: any[] = [];
        if (steps && steps.length > 0) {
          const campaignIds = Array.from(new Set(steps.map((s: any) => s.campaign_id).filter(Boolean)));
          if (campaignIds.length > 0) {
            const { data: camps } = await supabaseAdmin
              .from("campaigns")
              .select("id, name, status, inbox_id")
              .in("id", campaignIds)
              .eq("company_id", companyId)
              .order("created_at", { ascending: false })
              .limit(10);
            campaigns = camps || [];
            // Prioridade 2: Se inbox ainda não definida, tenta derivar da 1a campanha
            if (!inbox && campaigns[0]?.inbox_id) {
              const { data: inboxData } = await supabaseAdmin
                .from("inboxes")
                .select("id, name, provider, is_official_api")
                .eq("id", campaigns[0].inbox_id)
                .eq("company_id", companyId)
                .maybeSingle();
              if (inboxData) inbox = inboxData;
            }
          }
        }
      
        // 4. Buscar estatísticas de mensagens enviadas (tabela chat_messages)
        // Observação: usamos view_status (Pending, Sent, Delivered, Read)
        // e contamos por template_id quando disponível.
        const { count: totalSent } = await supabaseAdmin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("template_id", id);

        const { count: delivered } = await supabaseAdmin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("template_id", id)
          .eq("view_status", "Delivered");

        const { count: read } = await supabaseAdmin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("template_id", id)
          .eq("view_status", "Read");

        const { count: sent } = await supabaseAdmin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("template_id", id)
          .eq("view_status", "Sent");
      
        // Falhas nem sempre são registradas. Mantemos 0 por padrão.
        const failed = 0;

        // 5. Inbox pela coluna direta (preferível) ou payload legacy
        if (!inbox) {
          const inboxId = (template as any).inbox_id || template.payload?.inbox_id || null;
          if (inboxId) {
            const { data: inboxData } = await supabaseAdmin
              .from("inboxes")
              .select("id, name, provider, is_official_api")
              .eq("id", inboxId)
              .eq("company_id", companyId)
              .maybeSingle();
            if (inboxData) {
              inbox = inboxData;
            }
          }
        }
      
        return res.json({
          ...template,
          creator,
          inbox: inbox ? {
            id: inbox.id,
            name: inbox.name,
            provider: inbox.provider,
            is_official_api: inbox.is_official_api,
          } : null,
          campaigns: campaigns || [],
          stats: {
            total_sent: totalSent || 0,
            delivered: delivered || 0,
            read: read || 0,
            sent: sent || 0,
            failed: failed || 0,
          },
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Erro ao buscar detalhes do template" });
      }
    });

  // -------------------------------
  // CLONAR TEMPLATE
  // -------------------------------
  app.post("/livechat/campaigns/templates/:id/clone", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      
      // Load original template
      const { data: original, error: loadError } = await supabaseAdmin
        .from("message_templates")
        .select("*")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      
      if (loadError) throw new Error(loadError.message);
      if (!original) return res.status(404).json({ error: "Template não encontrado" });
      
      // Buscar users.id local para created_by
      let createdBy: string | null = null;
      if (req.user?.id) {
        const { data: userRow } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("user_id", req.user.id)
          .maybeSingle();
        createdBy = userRow?.id || null;
      }
      
      // Create clone with new name
      const cloneName = `${original.name} (cópia)`;
      const { data: clone, error: cloneError } = await supabaseAdmin
        .from("message_templates")
        .insert([{
          company_id: companyId,
          name: cloneName,
          kind: original.kind,
          payload: original.payload,
          created_by: createdBy,
          inbox_id: (original as any).inbox_id || null,
        }])
        .select()
        .single();
      
      if (cloneError) throw new Error(cloneError.message);
      
      // Clear cache
      await rDelMatch(`livechat:campaigns:${companyId}:*`);
      await bumpScopeVersion(`templates:${companyId}`);
      
      return res.status(201).json(clone);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao clonar template" });
    }
  });

  // -------------------------------
  // DELETAR TEMPLATE
  // -------------------------------
  app.delete("/livechat/campaigns/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      
      // Check if template is being used in any campaign steps
      const { data: usages } = await supabaseAdmin
        .from("campaign_steps")
        .select("id, campaign_id")
        .eq("template_id", id)
        .limit(1);
      
      if (usages && usages.length > 0) {
        return res.status(400).json({ 
          error: "Template está sendo usado em campanhas. Remova-o das campanhas antes de excluir." 
        });
      }
      
      const { error } = await supabaseAdmin
        .from("message_templates")
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);
      
      if (error) throw new Error(error.message);
      
      // Clear cache
      await rDelMatch(`livechat:campaigns:${companyId}:*`);
      await bumpScopeVersion(`templates:${companyId}`);
      
      return res.json({ ok: true, deleted: id });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao deletar template" });
    }
  });

  // -------------------------------
  // LISTAR STEPS DA CAMPANHA
  // -------------------------------
  app.get("/livechat/campaigns/:id/steps", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      // Valida campanha pertence à empresa
      const { data: camp } = await supabaseAdmin
        .from("campaigns")
        .select("id")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!camp?.id) return res.status(404).json({ error: "Campanha não encontrada" });

      const { data, error } = await supabaseAdmin
        .from("campaign_steps")
        .select("id, position, template_id, delay_sec, stop_on_reply")
        .eq("campaign_id", id)
        .order("position", { ascending: true });
      if (error) throw new Error(error.message);
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao listar steps" });
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
  // PREVIEW (RPC) LEGACY + SEGMENT INFO
  // -------------------------------
  app.get("/livechat/campaigns/:id/preview", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      const { data, error } = await supabaseAdmin.rpc("campaign_preview", { p_campaign_id: id, p_company_id: companyId });
      if (error) throw new Error(error.message);

      // Inclui info de segment ligado (se houver)
      const { data: link } = await supabaseAdmin
        .from('campaign_segment_links')
        .select('segment_id')
        .eq('campaign_id', id)
        .limit(1)
        .maybeSingle();
      let segment: any = null;
      if (link?.segment_id) {
        const { data: segRow } = await supabaseAdmin
          .from('campaign_segments')
          .select('id, name, definition')
          .eq('id', link.segment_id)
          .maybeSingle();
        if (segRow) segment = segRow;
      }

      return res.json({ items: data || [], segment });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao gerar preview (legacy)" });
    }
  });

  // -------------------------------
  // SEGMENTATION PREVIEW (dinâmico com filtros) - POST para aceitar body
  // -------------------------------
  app.post("/livechat/campaigns/:id/segmentation/preview", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const b = req.body || {};

      // Filtros suportados (todos opcionais)
      // age_min, age_max -> calculado via birth_date ou birthDate
      // states[], cities[] -> leads.state / leads.city ou customers.state / customers.city
      // funnel_columns[] -> kanban_columns.id ou nome
      // tags[] -> tags associadas ao chat (requer join chat_tags -> tags)
      // lead_status[] -> leads.status_client / leads."statusClient"
      // created_after, created_before -> leads.created_at / customers.created_at
      const schema = z.object({
        age_min: z.number().int().min(0).optional(),
        age_max: z.number().int().min(0).optional(),
        states: z.array(z.string().min(1)).optional(),
        cities: z.array(z.string().min(1)).optional(),
        funnel_columns: z.array(z.string().min(1)).optional(),
        tags: z.array(z.string().min(1)).optional(),
        lead_status: z.array(z.string().min(1)).optional(),
        created_after: z.string().datetime().optional(),
        created_before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(500).optional().default(200),
      }).strict();

      let filters: any;
      try { filters = schema.parse(b); } catch (err: any) {
        return res.status(400).json({ error: "Filtros inválidos", issues: err?.issues || [] });
      }

      // Montagem dinâmica de SQL (somente parâmetros, evitando injeção)
      // Busca direta na tabela customers, valida phone e lead_id, depois verifica etapa no leads
      const conditions: string[] = []; // Não precisa de company filter aqui pois já está no WHERE principal
      const params: any[] = [companyId]; // companyId será $1

      // Idade calculada (usa birthDate ou birth_date) -> DATE_PART('year', age(now(), birth))
      if (filters.age_min !== undefined) {
        conditions.push("DATE_PART('year', age(now(), COALESCE(l.\"birthDate\", c.birth_date))) >= $" + (params.length + 1));
        params.push(filters.age_min);
      }
      if (filters.age_max !== undefined) {
        conditions.push("DATE_PART('year', age(now(), COALESCE(l.\"birthDate\", c.birth_date))) <= $" + (params.length + 1));
        params.push(filters.age_max);
      }
      if (filters.states?.length) {
        conditions.push("COALESCE(c.state, l.state) = ANY($" + (params.length + 1) + ")");
        params.push(filters.states);
      }
      if (filters.cities?.length) {
        conditions.push("COALESCE(c.city, l.city) = ANY($" + (params.length + 1) + ")");
        params.push(filters.cities);
      }
      if (filters.lead_status?.length) {
        conditions.push("COALESCE(l.status_client, l.\"statusClient\") = ANY($" + (params.length + 1) + ")");
        params.push(filters.lead_status);
      }
      if (filters.created_after) {
        conditions.push("c.created_at >= $" + (params.length + 1));
        params.push(filters.created_after);
      }
      if (filters.created_before) {
        conditions.push("c.created_at <= $" + (params.length + 1));
        params.push(filters.created_before);
      }

      // Funnel columns -> match column id (uuid) OR name (text)
      if (filters.funnel_columns?.length) {
        const fc = filters.funnel_columns as string[];
        const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
        const ids = fc.filter((v) => isUuid(v));
        const names = fc.filter((v) => !isUuid(v));
        if (ids.length && names.length) {
          const p1 = params.length + 1;
          const p2 = params.length + 2;
          conditions.push(`(l.kanban_column_id = ANY($${p1}::uuid[]) OR kc.name = ANY($${p2}))`);
          params.push(ids, names);
        } else if (ids.length) {
          const p1 = params.length + 1;
          conditions.push(`l.kanban_column_id = ANY($${p1}::uuid[])`);
          params.push(ids);
        } else if (names.length) {
          const p1 = params.length + 1;
          conditions.push(`kc.name = ANY($${p1})`);
          params.push(names);
        }
      }

      // Tags: need EXISTS against chat_tags + chats linking lead->customer->chat
      if (filters.tags?.length) {
        conditions.push(`EXISTS (
          SELECT 1 FROM chats ch
          JOIN chat_tags ct ON ct.chat_id = ch.id
          JOIN tags tg ON tg.id = ct.tag_id
          WHERE ch.customer_id = c.id AND tg.name = ANY($${params.length + 1})
        )`);
        params.push(filters.tags);
      }

      const where = conditions.length ? conditions.join(" AND ") : "TRUE";

      const sql = `
        SELECT DISTINCT
          c.phone AS phone,
          c.name AS name,
          c.lead_id AS lead_id,
          c.id AS customer_id,
          l.kanban_column_id,
          DATE_PART('year', age(now(), COALESCE(l."birthDate", c.birth_date))) AS idade,
          c.created_at AS created_at
        FROM customers c
        INNER JOIN leads l ON l.id = c.lead_id
        LEFT JOIN kanban_columns kc ON kc.id = l.kanban_column_id
        WHERE c.company_id = $1
        AND c.phone IS NOT NULL
        AND c.lead_id IS NOT NULL
        AND (${where})
        ORDER BY c.created_at DESC
        LIMIT $${params.length + 1};
      `;
      params.push(filters.limit);

      // Usa conexão direta PG para melhor flexibilidade
      const { db } = await import("../pg.ts");
      const rows = await db.any(sql, params);
      return res.json({ items: rows, count: rows.length });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro na segmentação preview" });
    }
  });

  // -------------------------------
  // SEGMENTATION COMMIT (gera recipients e PERSISTE definição) - POST
  // -------------------------------
  app.post("/livechat/campaigns/:id/segmentation/commit", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const b = req.body || {};

      const schema = z.object({
        filters: z.any(), // reuse same shape; already validated at preview typically
        dry_run: z.boolean().optional().default(false),
        limit: z.number().int().min(1).max(100000).optional().default(10000),
        segment_name: z.string().min(1).optional(),
      }).strict();
      const parsed = schema.parse(b);

      // Reutiliza preview endpoint internamente para obter lista (avoid duplication)
      const previewReq = { ...parsed.filters, limit: parsed.limit };
      req.body = previewReq; // hacky reuse; would be cleaner factoring into helper
      let previewResp: any;
      const fakeRes = { json: (out: any) => (previewResp = out) } as any;
      await new Promise((resolve) => {
        // direct function call reuse by constructing expected context
        (async () => {
          try {
            // Call preview logic by simulating request (copy filters)
            const companyId2 = companyId; // local alias
            const b2 = previewReq;
            const conditions: string[] = [];
            const params: any[] = [companyId2];
            if (b2.age_min !== undefined) { conditions.push("DATE_PART('year', age(now(), COALESCE(l.\"birthDate\", c.birth_date))) >= $" + (params.length + 1)); params.push(b2.age_min); }
            if (b2.age_max !== undefined) { conditions.push("DATE_PART('year', age(now(), COALESCE(l.\"birthDate\", c.birth_date))) <= $" + (params.length + 1)); params.push(b2.age_max); }
            if (b2.states?.length) { conditions.push("COALESCE(c.state, l.state) = ANY($" + (params.length + 1) + ")"); params.push(b2.states); }
            if (b2.cities?.length) { conditions.push("COALESCE(c.city, l.city) = ANY($" + (params.length + 1) + ")"); params.push(b2.cities); }
            if (b2.lead_status?.length) { conditions.push("COALESCE(l.status_client, l.\"statusClient\") = ANY($" + (params.length + 1) + ")"); params.push(b2.lead_status); }
            if (b2.created_after) { conditions.push("c.created_at >= $" + (params.length + 1)); params.push(b2.created_after); }
            if (b2.created_before) { conditions.push("c.created_at <= $" + (params.length + 1)); params.push(b2.created_before); }
            if (b2.funnel_columns?.length) {
              const fc = b2.funnel_columns as string[];
              const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
              const ids = fc.filter((v) => isUuid(v));
              const names = fc.filter((v) => !isUuid(v));
              if (ids.length && names.length) {
                const p1 = params.length + 1;
                const p2 = params.length + 2;
                conditions.push(`(l.kanban_column_id = ANY($${p1}::uuid[]) OR kc.name = ANY($${p2}))`);
                params.push(ids, names);
              } else if (ids.length) {
                const p1 = params.length + 1;
                conditions.push(`l.kanban_column_id = ANY($${p1}::uuid[])`);
                params.push(ids);
              } else if (names.length) {
                const p1 = params.length + 1;
                conditions.push(`kc.name = ANY($${p1})`);
                params.push(names);
              }
            }
            if (b2.tags?.length) { conditions.push(`EXISTS (SELECT 1 FROM chats ch JOIN chat_tags ct ON ct.chat_id = ch.id JOIN tags tg ON tg.id = ct.tag_id WHERE ch.customer_id = c.id AND tg.name = ANY($${params.length + 1}))`); params.push(b2.tags); }
            const where = conditions.length ? conditions.join(" AND ") : "TRUE";
            const sql = `SELECT DISTINCT c.phone AS phone, c.name AS name, c.lead_id AS lead_id, c.id AS customer_id, c.created_at AS created_at FROM customers c INNER JOIN leads l ON l.id = c.lead_id LEFT JOIN kanban_columns kc ON kc.id = l.kanban_column_id WHERE c.company_id = $1 AND c.phone IS NOT NULL AND c.lead_id IS NOT NULL AND (${where}) ORDER BY c.created_at DESC LIMIT $${params.length + 1}`;
            params.push(previewReq.limit);
            const { db } = await import("../pg.ts");
            const rows = await db.any(sql, params);
            previewResp = { items: rows, count: rows.length };
          } catch (err) {
            previewResp = { error: (err as any)?.message || 'Erro interno preview commit' };
          } finally { resolve(null); }
        })();
      });

      if (!previewResp || previewResp.error) {
        return res.status(500).json({ error: previewResp?.error || "Falha ao gerar preview interno" });
      }

      if (parsed.dry_run) {
        return res.json({ ok: true, dry_run: true, count: previewResp.count });
      }

      // Persistir definição de segmentação usando campaign_segments + campaign_segment_links
      let segmentId: string | null = null;
      const segmentName = parsed.segment_name || `Segmento da campanha ${id}`;
      // 1) cria ou atualiza campaign_segments
      const { data: existingLink } = await supabaseAdmin
        .from('campaign_segment_links')
        .select('segment_id')
        .eq('campaign_id', id)
        .limit(1)
        .maybeSingle();

      if (existingLink?.segment_id) {
        segmentId = existingLink.segment_id as any;
        await supabaseAdmin
          .from('campaign_segments')
          .update({ definition: parsed.filters, name: segmentName })
          .eq('id', segmentId);
      } else {
        const { data: segRow, error: segErr } = await supabaseAdmin
          .from('campaign_segments')
          .insert([{ company_id: companyId, name: segmentName, definition: parsed.filters }])
          .select('id')
          .single();
        if (segErr) console.error('[segmentation] create segment error', segErr.message);
        segmentId = (segRow as any)?.id || null;
        if (segmentId) {
          await supabaseAdmin.from('campaign_segment_links').insert([{ campaign_id: id, segment_id: segmentId }]);
        }
      }
      if (segmentId) {
        await supabaseAdmin.from('campaigns').update({ segment_id: segmentId }).eq('id', id).eq('company_id', companyId);
      }

      // Inserir recipients evitando duplicados de phone
      const rows: any[] = previewResp.items || [];
      if (!rows.length) return res.json({ ok: true, inserted: 0, segment_id: segmentId });
      // Normaliza telefone (apenas dígitos)
      const normPhone = (s: string) => (s || '').replace(/\D/g, '').replace(/^00/, '');
      const toInsert = rows.map(r => ({
        campaign_id: id,
        phone: normPhone(r.phone),
        name: r.name || null,
        lead_id: r.lead_id || null,
        customer_id: r.customer_id || null,
        segment_source: 'dynamic',
      }));

      // Batch insert em chunks (Supabase limite ~1000)
      const CHUNK = 1000;
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const slice = toInsert.slice(i, i + CHUNK);
        const { error: insErr } = await supabaseAdmin.from('campaign_recipients').insert(slice);
        if (insErr) console.error('[segmentation/commit] insert error', insErr.message);
        else inserted += slice.length;
      }

      // Limpa cache de campanhas para refletir novos recipients
      await rDelMatch(`livechat:campaigns:${companyId}:*`);
      return res.json({ ok: true, inserted, total_candidates: rows.length, segment_id: segmentId });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao commitar segmentação" });
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
  // DELETAR CAMPANHA
  // -------------------------------
  app.delete('/livechat/campaigns/:id', requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      // remove e cascades apagam steps/recipients/deliveries pelo FK CASCADE
      const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id).eq('company_id', companyId);
      if (error) throw new Error(error.message);
      await rDelMatch(`livechat:campaigns:${companyId}:*`);
      return res.json({ ok: true, deleted: id });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Erro ao deletar campanha' });
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
            templateId: tpl.id,
            campaignId: id,
          });
          enqueued++;
        } else {
          await publish(EX_APP, "outbound", {
            jobType: "meta.sendMedia",
            inboxId: camp.inbox_id,
            media: payload,
            customerPhone: r.phone,
            templateId: tpl.id,
            campaignId: id,
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
  // ESTATÍSTICAS DA CAMPANHA
  // -------------------------------
  app.get("/livechat/campaigns/:id/stats", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      // Contagem de recipients
      const { count: totalRecipients } = await supabaseAdmin
        .from("campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id);

      // Contagem de deliveries por status
      const { data: deliveries } = await supabaseAdmin
        .from("campaign_deliveries")
        .select("status")
        .eq("campaign_id", id);

      const stats = {
        total_recipients: totalRecipients || 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        pending: 0,
      };

      if (deliveries) {
        deliveries.forEach((d: any) => {
          if (d.status === "SENT") stats.sent++;
          else if (d.status === "DELIVERED") stats.delivered++;
          else if (d.status === "READ") stats.read++;
          else if (d.status === "FAILED") stats.failed++;
          else if (d.status === "PENDING") stats.pending++;
        });
      }

      return res.json(stats);
    } catch (err) {
      console.error("[campaigns] Erro ao obter stats:", err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // -------------------------------
  // MÉTRICAS DA CAMPANHA (campaign_metrics)
  // -------------------------------
  app.get("/livechat/campaigns/:id/metrics", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      // Buscar métricas da tabela campaign_metrics
      const { data: metrics, error } = await supabaseAdmin
        .from("campaign_metrics")
        .select("*")
        .eq("campaign_id", id)
        .maybeSingle();

      if (error) {
        console.error("[campaigns] Erro ao buscar métricas:", error);
        return res.status(500).json({ error: error.message });
      }

      // Se não existir métricas ainda, retornar valores zerados
      if (!metrics) {
        return res.json({
          campaign_id: id,
          messages_sent: 0,
          messages_delivered: 0,
          messages_read: 0,
          messages_failed: 0,
          messages_blocked: 0,
          delivery_rate: 0,
          read_rate: 0,
          response_rate: 0,
          block_rate: 0,
          failure_rate: 0,
          health_status: "UNKNOWN",
          last_calculated_at: null,
        });
      }

      return res.json(metrics);
    } catch (err) {
      console.error("[campaigns] Erro ao obter métricas:", err);
      return res.status(500).json({ error: String(err) });
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

  // -------------------------------
  // UPLOAD DE LISTA DE RECIPIENTS (TXT/CSV/XLSX)
  // -------------------------------
  app.post(
    "/livechat/campaigns/:id/upload-recipients", 
    requireAuth, 
    warnOnLimit("campaigns"),
    upload.single("file"),
    async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id: campaignId } = req.params;
      
      // Validate campaign exists and belongs to company
      const { data: campaign, error: campError } = await supabaseAdmin
        .from("campaigns")
        .select("id, company_id, inbox_id")
        .eq("id", campaignId)
        .eq("company_id", companyId)
        .maybeSingle();
      
      if (campError || !campaign) {
        return res.status(404).json({ error: "Campanha não encontrada" });
      }
      
      if (!campaign.inbox_id) {
        return res.status(400).json({ error: "Campanha sem inbox configurada" });
      }
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }
      
      const { buffer, originalname } = req.file;
      
      // Parse file based on extension
      const { parseRecipientFile } = await import("../services/campaigns/uploadParser.js");
      const parseResult = await parseRecipientFile(buffer, originalname);
      
      if (parseResult.valid.length === 0) {
        return res.status(400).json({
          error: "Nenhum número válido encontrado",
          stats: {
            total: parseResult.total,
            valid: 0,
            invalid: parseResult.invalid.length,
          },
          invalid: parseResult.invalid.slice(0, 10), // Return first 10 invalid for debugging
        });
      }
      
      // Import sync utility
      const { ensureLeadCustomerChat } = await import("../services/meta/store.js");
      
      // Process valid recipients
      const CHUNK = 1000;
      let created_customers = 0;
      let created_leads = 0;
      let inserted = 0;
      let skipped_existing = 0;
      const failed_phones: string[] = [];
      
      console.log(`[campaigns] Processing ${parseResult.valid.length} valid recipients for campaign ${campaignId}`);
      
      // Prepare recipients to insert
      const recipientsToInsert: any[] = [];
      
      for (const recipient of parseResult.valid) {
        try {
          console.log(`[campaigns] Ensuring contact for phone: ${recipient.phone}`);
          
          // Try to ensure customer/lead/chat exists
          const ensured = await ensureLeadCustomerChat({
            companyId,
            inboxId: campaign.inbox_id, // Use campaign's inbox
            phone: recipient.phone,
            name: recipient.name || null,
            rawPhone: recipient.phone,
          });
          
          console.log(`[campaigns] Contact ensured: chatId=${ensured.chatId}, customerId=${ensured.customerId}`);
          
          // Track if new entities were created
          if (ensured.customerId && !ensured.existingCustomer) {
            created_customers++;
          }
          
          // Add to recipients list with resolved customer_id
          recipientsToInsert.push({
            campaign_id: campaignId,
            phone: recipient.phone,
            name: recipient.name || null,
            customer_id: ensured.customerId || null,
            lead_id: null, // Will be resolved by trigger or future sync
            segment_source: "manual_upload",
            last_step_sent: 0,
          });
        } catch (err: any) {
          console.error(`[campaigns] Failed to ensure contact for ${recipient.phone}:`, err.message);
          failed_phones.push(recipient.phone);
        }
      }
      
      console.log(`[campaigns] Prepared ${recipientsToInsert.length} recipients to insert`);
      
      // Batch insert recipients (with duplicate handling)
      if (recipientsToInsert.length > 0) {
        for (let i = 0; i < recipientsToInsert.length; i += CHUNK) {
          const chunk = recipientsToInsert.slice(i, i + CHUNK);
          
          console.log(`[campaigns] Inserting chunk ${i / CHUNK + 1}: ${chunk.length} recipients`);
          
          const { data: insertedData, error: insertError } = await supabaseAdmin
            .from("campaign_recipients")
            .upsert(chunk, {
              onConflict: "campaign_id,phone",
              ignoreDuplicates: false, // Update if exists
            })
            .select("id");
          
          if (insertError) {
            console.error("[campaigns] Error inserting recipients chunk:", insertError);
            // Count as failed
            failed_phones.push(...chunk.map(r => r.phone));
          } else {
            const numInserted = insertedData?.length || 0;
            inserted += numInserted;
            console.log(`[campaigns] Chunk inserted: ${numInserted} recipients`);
          }
        }
      }
      
      console.log(`[campaigns] Upload complete: inserted=${inserted}, failed=${failed_phones.length}, created_customers=${created_customers}`);
      
      // Invalidate cache
      await bumpScopeVersion(`campaigns:${companyId}`);
      await rDelMatch(`livechat:campaigns:*`);
      
      // Check warnings for uploaded recipients
      const warnings: string[] = [];
      
      // 1. Check opt-in status if template is MARKETING
      try {
        const { data: campaignWithTemplate } = await supabaseAdmin
          .from("campaigns")
          .select(`
            campaign_steps (
              message_templates (
                kind,
                payload
              )
            )
          `)
          .eq("id", campaignId)
          .maybeSingle();
        
        const template = campaignWithTemplate?.campaign_steps?.[0]?.message_templates;
        const payload = template?.payload as any;
        const templateCategory = payload?.category || template?.kind;
        
        if (templateCategory === "MARKETING") {
          const { countRecipientsWithoutOptIn } = await import("../services/campaigns/optIn.js");
          const withoutOptIn = await countRecipientsWithoutOptIn(campaignId);
          
          if (withoutOptIn > 0) {
            warnings.push(`${withoutOptIn} recipients sem opt-in para MARKETING (violação LGPD)`);
          }
        }
      } catch (error) {
        console.warn("[campaigns] Falha ao verificar opt-in:", error);
      }
      
      // 2. Check tier limit
      try {
        const { isInboxHealthy } = await import("../services/meta/health.js");
        const health = await isInboxHealthy(campaign.inbox_id);
        
        if (inserted > health.tier_limit) {
          warnings.push(`Recipients (${inserted}) excedem tier limit (${health.tier_limit})`);
        } else if (inserted > health.tier_limit * 0.8) {
          warnings.push(`Recipients próximos do tier limit (${Math.round((inserted / health.tier_limit) * 100)}%)`);
        }
        
        if (health.quality_rating === "YELLOW") {
          warnings.push("Quality rating YELLOW - envios restritos");
        } else if (health.quality_rating === "RED") {
          warnings.push("Quality rating RED - campanhas bloqueadas");
        }
      } catch (error) {
        console.warn("[campaigns] Falha ao verificar health:", error);
      }
      
      return res.json({
        success: true,
        stats: {
          total: parseResult.total,
          valid: parseResult.valid.length,
          invalid: parseResult.invalid.length,
          inserted,
          skipped_existing,
          created_customers,
          created_leads,
          failed: failed_phones.length,
        },
        warnings, // Adicionar warnings ao response
        invalid_sample: parseResult.invalid.slice(0, 5),
        failed_phones: failed_phones.slice(0, 10),
      });
      
    } catch (e: any) {
      console.error("[campaigns] upload-recipients error:", e);
      return res.status(500).json({ error: e?.message || "Erro ao processar upload" });
    }
  });

  /**
   * POST /api/campaigns/:campaignId/recipients/bulk-optin
   * Registrar opt-in em lote para todos os recipients de uma campanha
   */
  router.post("/:campaignId/recipients/bulk-optin", requireAuth, async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { opt_in_method, opt_in_source } = req.body;

      console.log("[Campaign Bulk Opt-in] 📥 Request received:", {
        campaignId,
        method: opt_in_method,
        source: opt_in_source,
        body: req.body,
      });

      if (!opt_in_source?.trim()) {
        return res.status(400).json({ error: "opt_in_source é obrigatório" });
      }

      const validMethods = ["FORMULARIO_WEB", "CONVERSA_WHATSAPP", "CHECKOUT", "OUTRO"];
      if (!validMethods.includes(opt_in_method)) {
        return res.status(400).json({ error: "opt_in_method inválido" });
      }

      console.log("[Campaign Bulk Opt-in] ✅ Validação passou, usando SQL direto...");

      // Usar pool PostgreSQL direto (não passa pelo PostgREST com cache)
      const result = await db.query<{ id: string }>(
        `UPDATE campaign_recipients
         SET marketing_opt_in = true,
             opt_in_date = NOW(),
             opt_in_method = $1,
             opt_in_source = $2
         WHERE campaign_id = $3
           AND (marketing_opt_in IS NULL OR marketing_opt_in = false)
         RETURNING id`,
        [opt_in_method, opt_in_source, campaignId]
      );

      const count = result.rowCount || 0;

      console.log("[Campaign Bulk Opt-in] ✅ Opt-in registrado para", count, "recipients");

      return res.json({
        success: true,
        updated_count: count,
        method: opt_in_method,
        source: opt_in_source,
      });
    } catch (e: any) {
      console.error("[Campaign Bulk Opt-in] ❌ FATAL Error:", e);
      return res.status(500).json({ error: e?.message || "Erro ao registrar opt-in" });
    }
  });

  // Registrar router no app
  app.use("/api/campaigns", router);
}
