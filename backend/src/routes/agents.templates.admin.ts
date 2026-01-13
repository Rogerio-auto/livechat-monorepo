import type { Application } from "express";
import { ZodError, z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";

async function getUserRole(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as any)?.role ?? null;
}

async function resolveCompanyId(req: any) {
  const companyId = req.profile?.company_id || req?.user?.company_id || null;
  if (!companyId) throw Object.assign(new Error("Missing company context"), { status: 400 });
  return companyId as string;
}

function ensureAdmin(role: string | null) {
  const r = String(role || "").toUpperCase();
  if (r !== "ADMIN" && r !== "SUPER_ADMIN" && r !== "SUPERADMIN" && r !== "OWNER") {
    throw Object.assign(new Error("Not allowed"), { status: 403 });
  }
}

const TemplateBase = z.object({
  key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  prompt_template: z.string().trim().min(1),
  default_model: z.string().trim().optional().nullable(),
  default_model_params: z.record(z.string(), z.any()).optional(),
  default_tools: z.array(z.any()).optional(),
});

const TemplateCreate = TemplateBase.strict();
const TemplateUpdate = TemplateBase.partial().strict();

const QuestionBase = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["text","textarea","select","number","boolean","multiselect"]),
  required: z.boolean().optional(),
  help: z.string().optional().nullable(),
  options: z.array(z.any()).optional(),
  order_index: z.number().int().min(0).optional(),
});
const QuestionCreate = QuestionBase.strict();
const QuestionUpdate = QuestionBase.partial().strict();

function formatRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return { status: 400, payload: { error: error.issues.map(i=>i.message).join("; ") } };
  }
  const status = typeof (error as any)?.status === "number" ? Number((error as any).status) : 500;
  const message = error instanceof Error ? error.message : String(error);
  return { status, payload: { error: message } };
}

export function registerAgentTemplatesAdminRoutes(app: Application) {
  // Create template (company-scoped)
  app.post("/api/agent-templates", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req?.user?.id || "");
      const role = await getUserRole(userId);
      ensureAdmin(role);
      const companyId = await resolveCompanyId(req);
      const body = TemplateCreate.parse(req.body ?? {});
      const payload = {
        company_id: companyId,
        key: body.key,
        name: body.name,
        category: body.category ?? null,
        description: body.description ?? null,
        prompt_template: body.prompt_template,
        default_model: body.default_model ?? null,
        default_model_params: body.default_model_params ?? {},
        default_tools: body.default_tools ?? [],
      };
      const { data, error } = await supabaseAdmin
        .from("agent_templates")
        .insert([payload])
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return res.status(201).json(data);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Update template
  app.put("/api/agent-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req?.user?.id || "");
      const role = await getUserRole(userId);
      ensureAdmin(role);
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "template id obrigatorio" });
      const patch = TemplateUpdate.parse(req.body ?? {});
      const { data, error } = await supabaseAdmin
        .from("agent_templates")
        .update({
          ...patch,
          category: patch.category ?? null,
          description: patch.description ?? null,
          default_model: patch.default_model ?? null,
          default_model_params: patch.default_model_params ?? undefined,
          default_tools: patch.default_tools ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("company_id", companyId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return res.json(data);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Delete template
  app.delete("/api/agent-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req?.user?.id || "");
      const role = await getUserRole(userId);
      ensureAdmin(role);
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "template id obrigatorio" });
      const { error } = await supabaseAdmin
        .from("agent_templates")
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return res.json({ ok: true });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Create question
  app.post("/api/agent-templates/:id/questions", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req?.user?.id || "");
      const role = await getUserRole(userId);
      ensureAdmin(role);
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "template id obrigatorio" });
      // Ensure template belongs to company
      const { data: tpl } = await supabaseAdmin
        .from("agent_templates")
        .select("id")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!tpl) return res.status(404).json({ error: "Template not found" });

      const body = QuestionCreate.parse(req.body ?? {});
      const payload = {
        template_id: id,
        key: body.key,
        label: body.label,
        type: body.type,
        required: Boolean(body.required),
        help: body.help ?? null,
        options: Array.isArray(body.options) ? body.options : [],
        order_index: Number.isFinite(body.order_index as any) ? Number(body.order_index) : 0,
      };
      const { data, error } = await supabaseAdmin
        .from("agent_template_questions")
        .insert([payload])
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return res.status(201).json(data);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Update question
  app.put("/api/agent-templates/:id/questions/:qid", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req?.user?.id || "");
      const role = await getUserRole(userId);
      ensureAdmin(role);
      const companyId = await resolveCompanyId(req);
      const { id, qid } = req.params as { id?: string; qid?: string };
      if (!id || !qid) return res.status(400).json({ error: "ids obrigatorios" });
      // Ensure template belongs to company
      const { data: tpl } = await supabaseAdmin
        .from("agent_templates")
        .select("id")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!tpl) return res.status(404).json({ error: "Template not found" });

      const patch = QuestionUpdate.parse(req.body ?? {});
      const { data, error } = await supabaseAdmin
        .from("agent_template_questions")
        .update({
          ...patch,
          help: patch.help ?? null,
          options: patch.options ?? undefined,
        })
        .eq("id", qid)
        .eq("template_id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return res.json(data);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Delete question
  app.delete("/api/agent-templates/:id/questions/:qid", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req?.user?.id || "");
      const role = await getUserRole(userId);
      ensureAdmin(role);
      const companyId = await resolveCompanyId(req);
      const { id, qid } = req.params as { id?: string; qid?: string };
      if (!id || !qid) return res.status(400).json({ error: "ids obrigatorios" });
      // Ensure template belongs to company
      const { data: tpl } = await supabaseAdmin
        .from("agent_templates")
        .select("id")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!tpl) return res.status(404).json({ error: "Template not found" });

      const { error } = await supabaseAdmin
        .from("agent_template_questions")
        .delete()
        .eq("id", qid)
        .eq("template_id", id);
      if (error) throw new Error(error.message);
      return res.json({ ok: true });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });
}
