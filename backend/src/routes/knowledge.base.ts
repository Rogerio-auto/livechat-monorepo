import type { Application } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import {
  listKnowledgeBase,
  searchKnowledgeBase,
  getKnowledgeBase,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBaseCategories,
  getKnowledgeBaseStats,
  recordKnowledgeBaseFeedback,
} from "../repos/knowledge.repo.ts";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  language: z.string().optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  related_urls: z.array(z.string().url()).optional(),
  attachments: z.array(z.any()).optional(),
  internal_notes: z.string().optional().nullable(),
  visible_to_agents: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

async function resolveCompanyId(req: any): Promise<string> {
  const companyId = req.profile?.company_id || req.user?.company_id;
  if (!companyId) throw new Error("CompanyId não encontrado no token");
  return companyId;
}

async function resolveUserId(req: any): Promise<string> {
  const userId = req.user?.id || req.profile?.id;
  if (!userId) throw new Error("UserId não encontrado no token");
  return userId;
}

export function registerKnowledgeBaseRoutes(app: Application) {
  // GET /api/knowledge-base - Lista todas as entradas
  app.get("/api/knowledge-base", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { status, category, search, visible_to_agents } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (category) filters.category = category;
      if (search) filters.search = search;
      if (visible_to_agents !== undefined) {
        filters.visible_to_agents = visible_to_agents === "true";
      }

      const items = await listKnowledgeBase(companyId, filters);
      return res.json(items);
    } catch (error: any) {
      console.error("[knowledge-base] GET error:", error);
      return res.status(500).json({ error: error.message || "Erro ao listar knowledge base" });
    }
  });

  // GET /api/knowledge-base/search - Busca semântica
  app.get("/api/knowledge-base/search", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { q, category, max_results } = req.query;

      if (!q) {
        return res.status(400).json({ error: "Parâmetro 'q' é obrigatório" });
      }

      const results = await searchKnowledgeBase(companyId, String(q), {
        category: category ? String(category) : undefined,
        maxResults: max_results ? parseInt(String(max_results)) : 5,
      });

      return res.json(results);
    } catch (error: any) {
      console.error("[knowledge-base] SEARCH error:", error);
      return res.status(500).json({ error: error.message || "Erro ao buscar knowledge base" });
    }
  });

  // GET /api/knowledge-base/categories - Lista categorias únicas
  app.get("/api/knowledge-base/categories", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const categories = await getKnowledgeBaseCategories(companyId);
      return res.json(categories);
    } catch (error: any) {
      console.error("[knowledge-base] GET categories error:", error);
      return res.status(500).json({ error: error.message || "Erro ao listar categorias" });
    }
  });

  // GET /api/knowledge-base/stats - Estatísticas
  app.get("/api/knowledge-base/stats", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const stats = await getKnowledgeBaseStats(companyId);
      return res.json(stats);
    } catch (error: any) {
      console.error("[knowledge-base] GET stats error:", error);
      return res.status(500).json({ error: error.message || "Erro ao obter estatísticas" });
    }
  });

  // GET /api/knowledge-base/:id - Obtém uma entrada específica
  app.get("/api/knowledge-base/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      const item = await getKnowledgeBase(companyId, id);
      if (!item) {
        return res.status(404).json({ error: "Knowledge base não encontrado" });
      }

      return res.json(item);
    } catch (error: any) {
      console.error("[knowledge-base] GET by id error:", error);
      return res.status(500).json({ error: error.message || "Erro ao buscar knowledge base" });
    }
  });

  // POST /api/knowledge-base - Cria nova entrada
  app.post("/api/knowledge-base", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const userId = await resolveUserId(req);

      const parsed = createSchema.parse(req.body);
      const item = await createKnowledgeBase(companyId, userId, parsed);

      return res.status(201).json(item);
    } catch (error: any) {
      console.error("[knowledge-base] POST error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      return res.status(500).json({ error: error.message || "Erro ao criar knowledge base" });
    }
  });

  // PUT /api/knowledge-base/:id - Atualiza entrada
  app.put("/api/knowledge-base/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const userId = await resolveUserId(req);
      const { id } = req.params;

      const parsed = updateSchema.parse(req.body);
      const item = await updateKnowledgeBase(companyId, userId, id, parsed);

      return res.json(item);
    } catch (error: any) {
      console.error("[knowledge-base] PUT error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      return res.status(500).json({ error: error.message || "Erro ao atualizar knowledge base" });
    }
  });

  // DELETE /api/knowledge-base/:id - Deleta entrada
  app.delete("/api/knowledge-base/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      await deleteKnowledgeBase(companyId, id);
      return res.status(204).send();
    } catch (error: any) {
      console.error("[knowledge-base] DELETE error:", error);
      return res.status(500).json({ error: error.message || "Erro ao deletar knowledge base" });
    }
  });

  // POST /api/knowledge-base/:id/feedback - Registra feedback
  app.post("/api/knowledge-base/:id/feedback", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const { helpful } = req.body;

      if (typeof helpful !== "boolean") {
        return res.status(400).json({ error: "Campo 'helpful' deve ser boolean" });
      }

      await recordKnowledgeBaseFeedback(companyId, id, helpful);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[knowledge-base] POST feedback error:", error);
      return res.status(500).json({ error: error.message || "Erro ao registrar feedback" });
    }
  });
}
