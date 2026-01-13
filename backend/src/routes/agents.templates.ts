import type { Application } from "express";
import { ZodError, z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  listAgentTemplates,
  getAgentTemplateById,
  getAgentTemplateQuestions,
  getAgentTemplateTools,
} from "../repos/agent-templates.repo.js";
import { previewTemplate } from "../services/agent-templates.service.js";

async function resolveCompanyId(req: any) {
  const companyId = req.profile?.company_id || req.user?.company_id;
  if (companyId) return companyId;

  const authId = String(req?.user?.id || "");
  if (!authId) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("company_id")
    .eq("user_id", authId)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  const resolvedCompanyId = (data as any)?.company_id || req?.user?.company_id || null;
  if (!resolvedCompanyId) {
    throw Object.assign(new Error("Usuario sem company_id"), { status: 404 });
  }

  if (req?.user && !req.user.company_id) {
    req.user.company_id = resolvedCompanyId;
  }

  return resolvedCompanyId as string;
}

function formatRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      payload: { error: error.issues.map((i) => i.message).join("; ") || "Validation failed" },
    };
  }

  const status = typeof (error as any)?.status === "number" ? Number((error as any).status) : 500;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unexpected error";

  return { status, payload: { error: message } };
}

export function registerAgentTemplatesRoutes(app: Application) {
  function ensureCanConfigure(req: any) {
    const role = String(req?.profile?.role || "").toUpperCase();
    const allowed = role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR" || role === "SUPER_ADMIN";
    if (!allowed) {
      throw Object.assign(new Error("Acesso negado. Apenas manager/supervisor ou admin."), { status: 403 });
    }
  }
  // Listagem (sem perguntas para ser leve)
  app.get("/api/agent-templates", requireAuth, async (req: any, res) => {
    try {
      ensureCanConfigure(req);
      const companyId = await resolveCompanyId(req);
      const list = await listAgentTemplates(companyId);
      return res.json(list);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Detalhe completo com perguntas e ferramentas
  app.get("/api/agent-templates/:id", requireAuth, async (req: any, res) => {
    try {
      ensureCanConfigure(req);
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "template id obrigatorio" });

      const tpl = await getAgentTemplateById(companyId, id);
      if (!tpl) return res.status(404).json({ error: "Template not found" });
      const questions = await getAgentTemplateQuestions(id);
      const tools = await getAgentTemplateTools(id);
      return res.json({ ...tpl, questions, tools });
    } catch (error) {
      console.error("[GET /api/agent-templates/:id] Error:", error);
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Somente perguntas do template (para o wizard simplificado)
  app.get("/api/agent-templates/:id/questions", requireAuth, async (req: any, res) => {
    try {
      ensureCanConfigure(req);
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "template id obrigatorio" });
      const tpl = await getAgentTemplateById(companyId, id);
      if (!tpl) return res.status(404).json({ error: "Template not found" });
      const questions = await getAgentTemplateQuestions(id);
      return res.json(questions);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Somente ferramentas do template (para mostrar capacidades)
  app.get("/api/agent-templates/:id/tools", requireAuth, async (req: any, res) => {
    try {
      ensureCanConfigure(req);
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "template id obrigatorio" });
      const tpl = await getAgentTemplateById(companyId, id);
      if (!tpl) return res.status(404).json({ error: "Template not found" });
      const tools = await getAgentTemplateTools(id);
      return res.json(tools);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Preview do prompt com respostas
  app.post("/api/agent-templates/:id/preview", requireAuth, async (req: any, res) => {
    try {
      ensureCanConfigure(req);
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "template id obrigatorio" });

      const tpl = await getAgentTemplateById(companyId, id);
      if (!tpl) return res.status(404).json({ error: "Template not found" });

      const bodySchema = z
        .object({ answers: z.record(z.string(), z.any()).optional().default({}) })
        .strict();
      const { answers } = bodySchema.parse(req.body ?? {});
      const result = previewTemplate(tpl, answers || {});
      return res.json(result);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });
}
