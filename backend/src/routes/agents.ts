import type { Application } from "express";
import { ZodError, z } from "zod";

import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { createAgent, deleteAgent, listAgentsFiltered, updateAgent, getAgent } from "../repos/agents.repo.ts";
import { AgentSchema } from "../types/integrations.ts";
import { runAgentReply } from "../services/agents.runtime.ts";
import type { ChatTurn } from "../services/agents.runtime.ts";
import { getAgentTemplateTools } from "../repos/agent.templates.repo.ts";
import { addToolToAgent } from "../repos/tools.repo.ts";

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
  // Nova rota: agentes com métricas de desempenho
  app.get("/api/agents/metrics", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);

      const { data: agents, error: agentsError } = await supabaseAdmin
        .from("agents")
        .select(`id, name, status, created_at`)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (agentsError) {
        throw Object.assign(new Error(agentsError.message), { status: 500 });
      }

      // Buscar métricas de chat para cada agente
  const agentIds = agents?.map((a: any) => a.id) || [];
      
      const { data: chatMetrics, error: metricsError } = await supabaseAdmin
        .from("chats")
        .select("ai_agent_id, status")
        .in("ai_agent_id", agentIds)
        .eq("company_id", companyId);

      if (metricsError) {
        throw Object.assign(new Error(metricsError.message), { status: 500 });
      }

      // Calcular métricas por agente
      const metricsMap = new Map<string, { active: number; total: number }>();
      
      for (const chat of chatMetrics || []) {
        const agentId = (chat as any).ai_agent_id;
        if (!agentId) continue;

        const current = metricsMap.get(agentId) || { active: 0, total: 0 };
        current.total += 1;
        if (chat.status === "OPEN" || chat.status === "PENDING") {
          current.active += 1;
        }
        metricsMap.set(agentId, current);
      }

      // Montar resposta com métricas
      const result = (agents as any[])?.map((agent: any) => {
        const metrics = metricsMap.get(agent.id) || { active: 0, total: 0 };
        
        return {
          id: agent.id,
          name: agent.name,
          template_name: null as string | null,
          template_category: null as string | null,
          is_active: String(agent.status).toUpperCase() === "ACTIVE",
          active_chats: metrics.active,
          total_chats: metrics.total,
          created_at: agent.created_at,
        };
      }) || [];

      return res.json(result);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // Backward-compat: legacy endpoint without /api used by older frontend
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

  app.get("/api/agents", requireAuth, async (req: any, res) => {
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

  // POST /api/agents/from-template - criar agente a partir de template + respostas
  app.post("/api/agents/from-template", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const bodySchema = z.object({
        template_id: z.string().uuid(),
        answers: z.record(z.string(), z.any()).optional().default({}),
      });
      const { template_id, answers } = bodySchema.parse(req.body ?? {});

      // Buscar template
      const { data: tpl, error: tplError } = await supabaseAdmin
        .from("agent_templates")
        .select("*")
        .eq("id", template_id)
        .or(`company_id.is.null,company_id.eq.${companyId}`)
        .maybeSingle();
      if (tplError || !tpl) {
        return res.status(404).json({ error: "Template não encontrado" });
      }

      // Gerar description a partir do prompt_template substituindo variáveis
      let description = tpl.prompt_template || "";
      for (const [key, value] of Object.entries(answers)) {
        const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
        description = description.replace(placeholder, String(value ?? ""));
      }

      // Garantir limite de 5000 caracteres para atender ao AgentSchema
      if (description.length > 5000) {
        console.warn(
          `[agents/from-template] description too long (${description.length}). Truncating to 5000 chars. Template=${tpl.id}`,
        );
        description = description.slice(0, 5000);
      }

      // Extrair name das respostas ou usar o do template
      const agentName = String(answers.nome_agente || answers.agent_name || answers.name || tpl.name);

      // Montar payload válido para AgentSchema
      const agentPayload = {
        name: agentName,
        description,
        status: "ACTIVE",
        model: tpl.default_model ?? undefined,
        model_params: tpl.default_model_params ?? undefined,
        aggregation_enabled: true,
        aggregation_window_sec: 20,
        max_batch_messages: 20,
        allow_handoff: true,
          ignore_group_messages: true,
          enabled_inbox_ids: [],
      };

  const parsed = AgentSchema.parse(agentPayload);
      const created = await createAgent(companyId, parsed);

      // Vincular ferramentas do template ao agente criado
      try {
        const templateTools = await getAgentTemplateTools(template_id);
        if (templateTools && templateTools.length > 0) {
          for (const tt of templateTools) {
            await addToolToAgent(created.id, tt.tool_id, {
              is_enabled: true,
              overrides: tt.overrides || {},
            });
          }
        }
      } catch (toolError) {
        console.error("[agents/from-template] Failed to link tools:", toolError);
        // Não falha a criação do agente se as ferramentas não puderem ser vinculadas
      }

      return res.status(201).json(created);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  app.post("/api/agents", requireAuth, async (req: any, res) => {
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

  app.put("/api/agents/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?: string };
      if (!id) {
        return res.status(400).json({ error: "agent id obrigatorio" });
      }

      // Compat: aceitar { is_active: boolean } do front simplificado e mapear para status
      const body = { ...(req.body ?? {}) } as any;
      if (typeof body.is_active === "boolean") {
        body.status = body.is_active ? "ACTIVE" : "INACTIVE";
        delete body.is_active;
      }

      const parsed = updateAgentSchema.parse(body);
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

  app.delete("/api/agents/:id", requireAuth, async (req: any, res) => {
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

  // GET /api/agents/:id (detalhe)
  app.get("/api/agents/:id", requireAuth, async (req: any, res) => {
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

  // POST /api/agents/:id/test — executa o agente contra um prompt
  app.post("/api/agents/:id/test", requireAuth, async (req: any, res) => {
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
        chatId: "test-chat",
        contactId: "test-contact",
      });
      return res.json({ reply: out.reply, usage: out.usage, agentId: out.agentId, model: out.model });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });
}
