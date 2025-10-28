import type { Application } from "express";
import { ZodError } from "zod";

import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import {
  createOpenAIIntegration,
  deleteOpenAIIntegration,
  listOpenAIIntegrations,
  updateOpenAIIntegration,
} from "../repos/integrations.openai.repo.ts";
import { OpenAIIntegrationSchema } from "../types/integrations.ts";

const updateIntegrationSchema = OpenAIIntegrationSchema.partial();

async function resolveCompanyId(req: any) {
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

  const companyId = (data as any)?.company_id || req?.user?.company_id || null;
  if (!companyId) {
    throw Object.assign(new Error("Usuario sem company_id"), { status: 404 });
  }

  if (req?.user && !req.user.company_id) {
    req.user.company_id = companyId;
  }

  return companyId as string;
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

export function registerOpenAIIntegrationRoutes(app: Application) {
  app.get("/integrations/openai", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const rows = await listOpenAIIntegrations(companyId);
      return res.json(rows);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  app.post("/integrations/openai", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const parsed = OpenAIIntegrationSchema.parse(req.body ?? {});
      const created = await createOpenAIIntegration(companyId, parsed);
      return res.status(201).json(created);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  app.put("/integrations/openai/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) {
        return res.status(400).json({ error: "integration id obrigatorio" });
      }

      const parsed = updateIntegrationSchema.parse(req.body ?? {});
      if (Object.keys(parsed).length === 0) {
        return res.status(400).json({ error: "Nada para atualizar" });
      }

      const updated = await updateOpenAIIntegration(companyId, id, parsed);
      return res.json(updated);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  app.delete("/integrations/openai/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) {
        return res.status(400).json({ error: "integration id obrigatorio" });
      }

      const deleted = await deleteOpenAIIntegration(companyId, id);
      return res.json(deleted);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });
}
