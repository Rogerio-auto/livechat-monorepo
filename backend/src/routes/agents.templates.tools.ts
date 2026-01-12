// routes/agents.templates.tools.ts
// Rotas para gerenciar ferramentas dos templates (admin only)

import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db } from "../pg.js";

const router = Router();

console.log("[templates.tools] Router initialized");

// Middleware: verificar role ADMIN
async function requireAdmin(req: any, res: any, next: any) {
  const profile = req.profile;
  if (!profile || profile.role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
  }
  next();
}

router.use(requireAuth);
// Restrict admin guard only to this router's own paths to avoid intercepting unrelated /api routes
router.use("/agent-templates", requireAdmin as any);

// GET /agent-templates/:templateId/tools - listar ferramentas do template
router.get("/agent-templates/:templateId/tools", async (req: any, res: any) => {
  try {
    const { templateId } = req.params;
    
    const tools = await db.any(
      `SELECT att.*, tc.key, tc.name, tc.description, tc.category, tc.handler_type
       FROM public.agent_template_tools att
       INNER JOIN public.tools_catalog tc ON att.tool_id = tc.id
       WHERE att.template_id = $1
       ORDER BY tc.name`,
      [templateId]
    );
    
    res.json(tools);
  } catch (err: any) {
    console.error("[templates.tools] GET error", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /agent-templates/:templateId/tools - adicionar ferramenta ao template
router.post("/agent-templates/:templateId/tools", async (req: any, res: any) => {
  try {
    const { templateId } = req.params;
    const { tool_id, required, overrides } = req.body;
    
    if (!tool_id) {
      return res.status(400).json({ error: "tool_id é obrigatório" });
    }
    
    const result = await db.one(
      `INSERT INTO public.agent_template_tools(template_id, tool_id, required, overrides)
       VALUES($1, $2, $3, $4)
       ON CONFLICT (template_id, tool_id) 
       DO UPDATE SET required = EXCLUDED.required, overrides = EXCLUDED.overrides
       RETURNING *`,
      [templateId, tool_id, required !== false, overrides || {}]
    );
    
    res.json(result);
  } catch (err: any) {
    console.error("[templates.tools] POST error", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /agent-templates/:templateId/tools/:toolId - atualizar configuração da ferramenta
router.put("/agent-templates/:templateId/tools/:toolId", async (req: any, res: any) => {
  try {
    const { templateId, toolId } = req.params;
    const { required, overrides } = req.body;
    
    const result = await db.oneOrNone(
      `UPDATE public.agent_template_tools
       SET required = $3, overrides = $4
       WHERE template_id = $1 AND tool_id = $2
       RETURNING *`,
      [templateId, toolId, required, overrides || {}]
    );
    
    if (!result) {
      return res.status(404).json({ error: "Ferramenta não encontrada no template" });
    }
    
    res.json(result);
  } catch (err: any) {
    console.error("[templates.tools] PUT error", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /agent-templates/:templateId/tools/:toolId - remover ferramenta do template
router.delete("/agent-templates/:templateId/tools/:toolId", async (req: any, res: any) => {
  try {
    const { templateId, toolId } = req.params;
    
    await db.none(
      "DELETE FROM public.agent_template_tools WHERE template_id = $1 AND tool_id = $2",
      [templateId, toolId]
    );
    
    res.json({ success: true });
  } catch (err: any) {
    console.error("[templates.tools] DELETE error", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
