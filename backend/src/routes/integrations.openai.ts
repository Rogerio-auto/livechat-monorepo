// backend/src/routes/integrations.openai.ts

import type { Application } from "express";
import { ZodError, z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import {
  createOpenAIIntegration,
  deleteOpenAIIntegration,
  listOpenAIIntegrations,
  updateOpenAIIntegration,
  getOpenAIIntegration,
} from "../repos/integrations.openai.repo.ts";
import { OpenAIIntegrationSchema } from "../types/integrations.ts";
import { 
  createOpenAIProject, 
  validateAPIKey,
  checkProjectsAPIAvailability 
} from "../services/openai.admin.service.ts";

// ==================== SCHEMAS ====================

// Schema para criação MANUAL (existente - BACKWARD COMPATIBLE)
const ManualIntegrationSchema = OpenAIIntegrationSchema;

// Schema para criação AUTOMÁTICA (nova feature)
const AutoIntegrationSchema = z.object({
  name: z.string().trim().min(1),
  default_model: z.string().optional(),
  models_allowed: z.array(z.string()).optional(),
  usage_limits: z.record(z.string(), z.any()).optional(),
  auto_generate: z.literal(true), // Flag para indicar criação automática
}).strict();

const updateIntegrationSchema = OpenAIIntegrationSchema.partial();

// ==================== HELPERS ====================

async function resolveCompanyId(req: any) {
  const authId = String(req?. user?.id || "");
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

  const companyId = (data as any)?.company_id || req?. user?.company_id || null;
  if (!companyId) {
    throw Object.assign(new Error("Usuario sem company_id"), { status: 404 });
  }

  if (req?.user && ! req. user.company_id) {
    req.user.company_id = companyId;
  }

  return companyId as string;
}

async function getCompanyName(companyId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  return data?.name || `Company ${companyId. slice(0, 8)}`;
}

function formatRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      payload: { 
        error: error.issues.map(i => i.message).join("; ") || "Validation failed",
        details: error.issues 
      },
    };
  }

  const status = typeof (error as any)?.status === "number" 
    ? Number((error as any).status) 
    : 500;
  const message =
    error instanceof Error 
      ? error.message 
      : typeof error === "string" 
        ?  error 
        : "Unexpected error";

  return { status, payload: { error: message } };
}

// ==================== ROUTES ====================

export function registerOpenAIIntegrationRoutes(app: Application) {
  
  // 🆕 Endpoint para checar disponibilidade da Projects API
  app.get("/integrations/openai/capabilities", requireAuth, async (req:  any, res) => {
    try {
      const projectsAPIAvailable = await checkProjectsAPIAvailability();
      
      return res.json({
        auto_generation_available: projectsAPIAvailable,
        manual_creation_available: true,
      });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // GET - Listar integrações (UNCHANGED - BACKWARD COMPATIBLE)
  app.get("/integrations/openai", requireAuth, async (req:  any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const rows = await listOpenAIIntegrations(companyId);
      return res.json(rows);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // GET - Buscar integração específica
  app.get("/integrations/openai/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      
      const integration = await getOpenAIIntegration(companyId, id);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      return res.json(integration);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // POST - Criar integração (ATUALIZADO - SUPORTA MANUAL E AUTO)
  app.post("/integrations/openai", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const body = req.body ??  {};

      // Detectar tipo de criação
      const isAutoGeneration = body.auto_generate === true;

      if (isAutoGeneration) {
        // ===== FLUXO AUTOMÁTICO (NOVO) =====
        console.log('[Integration] Auto-generation requested');

        // Validar schema
        const parsed = AutoIntegrationSchema.parse(body);

        // Buscar nome da empresa
        const companyName = await getCompanyName(companyId);

        // Criar projeto na OpenAI
        let projectData;
        try {
          projectData = await createOpenAIProject(companyName, {
            monthlyBudgetUSD: parsed.usage_limits?. monthly_budget_usd,
          });
        } catch (error:  any) {
          // Se Projects API não disponível, retornar erro amigável
          if (error. message.includes('not available')) {
            return res.status(503).json({
              error: 'Auto-generation not available',
              message: 'OpenAI Projects API is not enabled for your account.  Please create API key manually.',
              fallback: 'Use manual creation mode',
            });
          }
          throw error;
        }

        // Criar integração no banco
        const created = await createOpenAIIntegration(companyId, {
          name: parsed.name,
          api_key:  projectData.apiKey,
          openai_project_id: projectData.projectId,
          openai_api_key_id: projectData. apiKeyId,
          default_model: parsed.default_model || "gpt-4o-mini",
          models_allowed: parsed. models_allowed,
          usage_limits: parsed. usage_limits,
          is_active: true,
        });

        console.log(`[Integration] ✅ Auto-created integration ${created.id} for company ${companyId}`);

        return res.status(201).json({
          ... created,
          // Não retornar API key completa
          api_key_preview: `${projectData.apiKey. slice(0, 8)}...${projectData.apiKey.slice(-4)}`,
          message: 'Integration created successfully with auto-generated API key',
        });

      } else {
        // ===== FLUXO MANUAL (EXISTENTE - BACKWARD COMPATIBLE) =====
        console.log('[Integration] Manual creation requested');

        const parsed = ManualIntegrationSchema.parse(body);

        // Validar API key fornecida
        const isValid = await validateAPIKey(parsed. api_key);
        if (!isValid) {
          return res. status(400).json({
            error: 'Invalid API key',
            message: 'The provided OpenAI API key is invalid or inactive',
          });
        }

        const created = await createOpenAIIntegration(companyId, parsed);

        console.log(`[Integration] ✅ Manually created integration ${created.id} for company ${companyId}`);

        return res.status(201).json(created);
      }
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // PUT - Atualizar integração (UNCHANGED - BACKWARD COMPATIBLE)
  app.put("/integrations/openai/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params as { id?:  string };
      if (!id) {
        return res.status(400).json({ error: "integration id obrigatorio" });
      }

      const parsed = updateIntegrationSchema.parse(req.body ??  {});
      if (Object.keys(parsed).length === 0) {
        return res. status(400).json({ error: "Nada para atualizar" });
      }

      // Se está atualizando API key, validar
      if (parsed. api_key) {
        const isValid = await validateAPIKey(parsed.api_key);
        if (!isValid) {
          return res.status(400).json({
            error: 'Invalid API key',
            message: 'The provided OpenAI API key is invalid or inactive',
          });
        }
      }

      const updated = await updateOpenAIIntegration(companyId, id, parsed);
      return res.json(updated);
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });

  // DELETE - Deletar integração (ATUALIZADO - REVOGA SE AUTO)
  app.delete("/integrations/openai/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req. params as { id?: string };
      if (!id) {
        return res.status(400).json({ error: "integration id obrigatorio" });
      }

      const result = await deleteOpenAIIntegration(companyId, id);
      
      return res.json({
        ... result,
        message: result.revoked 
          ? 'Integration deleted and API key revoked successfully'
          :  'Integration deleted successfully',
      });
    } catch (error) {
      const { status, payload } = formatRouteError(error);
      return res.status(status).json(payload);
    }
  });
}

