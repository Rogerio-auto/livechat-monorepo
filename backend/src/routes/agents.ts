import type { Application } from "express";
import { ZodError, z } from "zod";

import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { createAgent, deleteAgent, listAgentsFiltered, updateAgent, getAgent } from "../repos/agents.repo.ts";
import { AgentSchema } from "../types/integrations.ts";
import { runAgentReply } from "../services/agents.runtime.ts";
import type { ChatTurn } from "../services/agents.runtime.ts";

const updateAgentSchema = AgentSchema.partial();

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

export function registerAgentsRoutes(app: Application) {
  app.get("/agents", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const activeParam = typeof req.query.active === "string" ? req.query.active : undefined;
      const active = activeParam === undefined ? undefined : /^(1|true|yes)$/i.test(activeParam);
      const agents = await listAgentsFiltered(companyId, { q, active });
      return res.json(agents);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  app.post("/agents", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const parsed = AgentSchema.parse(req.body ?? {});
      const created = await createAgent(companyId, parsed);
      return res.status(201).json(created);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  app.put("/agents/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) {
        return res.status(400).json({ error: "agent id obrigatorio" });
      }

      const parsed = updateAgentSchema.parse(req.body ?? {});
      if (Object.keys(parsed).length === 0) {
        return res.status(400).json({ error: "Nada para atualizar" });
      }

      const updated = await updateAgent(companyId, id, parsed);
      return res.json(updated);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  app.delete("/agents/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) {
        return res.status(400).json({ error: "agent id obrigatorio" });
      }

      const result = await deleteAgent(companyId, id);
      return res.json(result);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // GET /agents/:id (detalhe)
  app.get("/agents/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "agent id obrigatorio" });
      const row = await getAgent(companyId, id);
      if (!row) return res.status(404).json({ error: "Agent not found" });
      return res.json(row);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // POST /agents/:id/test — executa o agente contra um prompt
  app.post("/agents/:id/test", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) return res.status(400).json({ error: "agent id obrigatorio" });

      const bodySchema = z.object({
        message: z.string().min(1),
        inboxId: z.string().uuid().optional(),
        chatContext: z
          .object({
            messages: z
              .array(
                z.object({
                  from: z.enum(["CUSTOMER", "AGENT"]),
                  text: z.string(),
                  ts: z.string().optional(),
                }),
              )
              .default([]),
          })
          .optional(),
      });
      const parsed = bodySchema.parse(req.body ?? {});

      const history: ChatTurn[] = (parsed.chatContext?.messages || []).map((m: any) => ({
        role: (m.from === "CUSTOMER" ? "user" : "assistant") as ChatTurn["role"],
        content: m.text,
      }));

      const out = await runAgentReply({
        companyId,
        inboxId: parsed.inboxId ?? null,
        agentId: id,
        userMessage: parsed.message,
        chatHistory: history,
      });
      return res.json({ reply: out.reply, usage: out.usage, agentId: out.agentId, model: out.model });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });
}
