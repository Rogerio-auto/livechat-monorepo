// backend/src/routes/project-templates.ts

import type { Application } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  listTemplates,
  getTemplateWithDetails,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addStageToTemplate,
  updateStage,
  deleteStage,
  addCustomFieldToTemplate,
  updateCustomField,
  deleteCustomField,
} from "../repos/project-templates.repo.js";

// ==================== SCHEMAS ====================

const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  industry: z.string().min(1, "Indústria é obrigatória"),
  icon: z.string().optional(),
  color: z.string().optional(),
  is_default: z.boolean().optional(),
});

const UpdateTemplateSchema = CreateTemplateSchema.partial();

const CreateStageSchema = z.object({
  name: z.string().min(1, "Nome do estágio é obrigatório"),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  order_index: z.number().int().min(0),
  requires_approval: z.boolean().optional(),
  automation_rules: z.record(z.string(), z.any()).optional(),
});

const UpdateStageSchema = CreateStageSchema.partial().omit({ order_index: true });

const CreateCustomFieldSchema = z.object({
  field_key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Deve ser snake_case"),
  field_label: z.string().min(1, "Label é obrigatório"),
  field_type: z.enum([
    "text",
    "number",
    "date",
    "datetime",
    "select",
    "multiselect",
    "file",
    "currency",
    "boolean",
    "textarea",
    "url",
    "email",
    "phone",
  ]),
  field_placeholder: z.string().optional(),
  field_help_text: z.string().optional(),
  field_options: z.array(z.string()).optional(),
  is_required: z.boolean().optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  regex_validation: z.string().optional(),
  order_index: z.number().int().min(0),
  show_in_card: z.boolean().optional(),
});

const UpdateCustomFieldSchema = CreateCustomFieldSchema.partial().omit({ order_index: true });

// ==================== HELPERS ====================

function getCompanyId(req: any): string {
  const companyId = req.user?. company_id;
  if (! companyId) {
    throw Object.assign(new Error("Company ID not found"), { status: 403 });
  }
  return companyId;
}

function getUserId(req: any): string {
  const userId = req.user?.public_user_id || req.user?.id;
  if (!userId) {
    throw Object.assign(new Error("User ID not found"), { status: 401 });
  }
  return userId;
}

function handleError(error: unknown) {
  console.error("[Project Templates] Error:", error);
  
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      payload: {
        error: "Validation failed",
        details: ((error as any).errors || (error as any).issues).map((e: any) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
    };
  }

  const status = (error as any)?.status || 500;
  const message =
    error instanceof Error
      ? error.message
      :  typeof error === "string"
      ?  error
      : "Internal server error";

  return { status, payload: { error: message } };
}

// ==================== ROUTES ====================

export function registerProjectTemplateRoutes(app: Application) {
  
  // ===== TEMPLATES =====

  /**
   * GET /projects/templates
   * Lista todos os templates da empresa
   */
  app. get("/projects/templates", requireAuth, async (req:  any, res) => {
    try {
      const companyId = getCompanyId(req);
      const templates = await listTemplates(companyId);
      return res.json(templates);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * GET /projects/templates/:id
   * Busca template com estágios e campos
   */
  app.get("/projects/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      const template = await getTemplateWithDetails(companyId, id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      return res.json(template);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * POST /projects/templates
   * Cria novo template
   */
  app.post("/projects/templates", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      
      const validated = CreateTemplateSchema.parse(req.body);
      const template = await createTemplate(companyId, userId, validated);

      return res.status(201).json(template);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * PUT /projects/templates/:id
   * Atualiza template
   */
  app.put("/projects/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      const validated = UpdateTemplateSchema.parse(req.body);
      const template = await updateTemplate(companyId, id, validated);

      return res.json(template);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * DELETE /projects/templates/:id
   * Deleta template (soft delete)
   */
  app.delete("/projects/templates/:id", requireAuth, async (req:  any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      await deleteTemplate(companyId, id);

      return res.json({ success: true, message: "Template deleted" });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  // ===== STAGES =====

  /**
   * POST /projects/templates/:id/stages
   * Adiciona estágio ao template
   */
  app.post("/projects/templates/:id/stages", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      // Verificar se template pertence à empresa
      const template = await getTemplateWithDetails(companyId, id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const validated = CreateStageSchema.parse(req.body);
      const stage = await addStageToTemplate(id, validated);

      return res.status(201).json(stage);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * PUT /projects/templates/stages/:stageId
   * Atualiza estágio
   */
  app.put("/projects/templates/stages/:stageId", requireAuth, async (req: any, res) => {
    try {
      const { stageId } = req.params;

      const validated = UpdateStageSchema.parse(req.body);
      const stage = await updateStage(stageId, validated);

      return res.json(stage);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * DELETE /projects/templates/stages/:stageId
   * Deleta estágio
   */
  app.delete("/projects/templates/stages/:stageId", requireAuth, async (req: any, res) => {
    try {
      const { stageId } = req.params;

      await deleteStage(stageId);

      return res.json({ success: true, message: "Stage deleted" });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  // ===== CUSTOM FIELDS =====

  /**
   * POST /projects/templates/:id/fields
   * Adiciona campo customizado ao template
   */
  app. post("/projects/templates/:id/fields", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      // Verificar se template pertence à empresa
      const template = await getTemplateWithDetails(companyId, id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const validated = CreateCustomFieldSchema.parse(req.body);
      const field = await addCustomFieldToTemplate(id, validated);

      return res.status(201).json(field);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * PUT /projects/templates/fields/:fieldId
   * Atualiza campo customizado
   */
  app.put("/projects/templates/fields/:fieldId", requireAuth, async (req: any, res) => {
    try {
      const { fieldId } = req.params;

      const validated = UpdateCustomFieldSchema.parse(req.body);
      const field = await updateCustomField(fieldId, validated);

      return res.json(field);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * DELETE /projects/templates/fields/:fieldId
   * Deleta campo customizado
   */
  app. delete("/projects/templates/fields/:fieldId", requireAuth, async (req: any, res) => {
    try {
      const { fieldId } = req.params;

      await deleteCustomField(fieldId);

      return res.json({ success: true, message: "Field deleted" });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  // ===== SEED TEMPLATES (HELPER ENDPOINT) =====

  /**
   * POST /projects/templates/seed/:industry
   * Cria template pré-configurado por indústria
   * Indústrias disponíveis: education, accounting, clinic, retail, events, law, solar_energy, construction, real_estate, generic
   */
  app.post("/projects/templates/seed/:industry", requireAuth, async (req:  any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { industry } = req.params;

      // Importar seeds pré-configurados
      const { seedTemplateByIndustry } = await import("../seeds/project-templates.seed.js");
      
      const template = await seedTemplateByIndustry(companyId, userId, industry);

      return res.status(201).json(template);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });
}
