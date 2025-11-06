import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { supabaseAdmin } from "../lib/supabase";
import type { Tool, AgentTool } from "../repos/tools.repo";
import {
  listTools,
  getToolById,
  getToolByKey,
  createTool,
  updateTool,
  deleteTool,
  listAgentTools,
  addToolToAgent,
  updateAgentTool,
  removeToolFromAgent,
  getToolLogs,
} from "../repos/tools.repo";

const router = Router();

console.log("[tools.admin] Router initialized");

// Extend Express Request type
interface AuthRequest extends Request {
  profile: {
    id: string;
    company_id: string;
    role: string;
  };
}

// Middleware: verificar role ADMIN
async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const profile = req.profile;
  if (!profile || profile.role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
  }
  next();
}

router.use(requireAuth);
// Restrict admin guard to this router's own subpaths to avoid intercepting unrelated /api routes
router.use("/tools", requireAdmin as any);
router.use("/agents", requireAdmin as any);

// ===================== TOOLS CATALOG =====================

// GET /tools - listar todas as ferramentas (filtrar por company)
router.get("/tools", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    const filters: any = {};
    if (req.query.category) filters.category = req.query.category as string;
    if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === "true";

    const tools = await listTools(filters);
    
    // Filtrar: apenas global (company_id null) ou da própria company
    const filtered = tools.filter((t) => !t.company_id || t.company_id === companyId);
    
    res.json(filtered);
  } catch (err: any) {
    console.error("[tools.admin] GET /tools error", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /tools/:id - obter ferramenta por ID
router.get("/tools/:id", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    const tool = await getToolById(req.params.id);
    if (!tool) return res.status(404).json({ error: "Tool not found" });
    
    // Verificar se pertence à company ou é global
    if (tool.company_id && tool.company_id !== companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    res.json(tool);
  } catch (err: any) {
    console.error("[tools.admin] GET /tools/:id error", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /tools - criar nova ferramenta
router.post("/tools", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    const { key, name, category, description, schema, handler_type, handler_config, is_active } = req.body;
    
    // Verificar se key já existe
    const existing = await getToolByKey(key);
    if (existing) {
      return res.status(400).json({ error: "Tool key already exists" });
    }
    
    const newTool = await createTool({
      key,
      name,
      category: category || "CUSTOM",
      description,
      schema,
      handler_type,
      handler_config,
      is_active: is_active !== false,
      company_id: companyId,
    });
    
    res.status(201).json(newTool);
  } catch (err: any) {
    console.error("[tools.admin] POST /tools error", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /tools/:id - atualizar ferramenta
router.put("/tools/:id", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    const tool = await getToolById(req.params.id);
    if (!tool) return res.status(404).json({ error: "Tool not found" });
    
    // Não pode editar ferramentas globais (company_id null)
    if (!tool.company_id) {
      return res.status(403).json({ error: "Cannot edit global tools" });
    }
    
    // Verificar ownership
    if (tool.company_id !== companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { key, name, category, description, schema, handler_type, handler_config, is_active } = req.body;
    const updated = await updateTool(req.params.id, {
      key,
      name,
      category,
      description,
      schema,
      handler_type,
      handler_config,
      is_active,
    });
    
    res.json(updated);
  } catch (err: any) {
    console.error("[tools.admin] PUT /tools/:id error", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /tools/:id/duplicate - duplicar ferramenta
router.post("/tools/:id/duplicate", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    const tool = await getToolById(req.params.id);
    if (!tool) return res.status(404).json({ error: "Tool not found" });
    
    // Verificar se pertence à company ou é global
    if (tool.company_id && tool.company_id !== companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // Gerar novo nome único
    let newName = req.body.name || `${tool.name} (cópia)`;
    let counter = 1;
    let nameExists = await getToolByKey(newName);
    while (nameExists) {
      counter++;
      newName = req.body.name ? `${req.body.name} ${counter}` : `${tool.name} (cópia ${counter})`;
      nameExists = await getToolByKey(newName);
    }
    
    // Criar cópia da ferramenta
    const duplicatedTool = await createTool({
      key: newName, // key também precisa ser único
      name: newName,
      category: tool.category,
      description: tool.description || "",
      schema: tool.schema || {},
      handler_type: tool.handler_type,
      handler_config: tool.handler_config || {},
      is_active: false, // Criar desabilitada por segurança
      company_id: companyId, // Sempre associar à company do usuário
    });
    
    console.log(`[tools.admin] Tool ${tool.id} duplicated as ${duplicatedTool.id} by user ${req.profile.id}`);
    
    res.status(201).json(duplicatedTool);
  } catch (err: any) {
    console.error("[tools.admin] POST /tools/:id/duplicate error", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /tools/:id - deletar ferramenta
router.delete("/tools/:id", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    const tool = await getToolById(req.params.id);
    if (!tool) return res.status(404).json({ error: "Tool not found" });
    
    // Não pode deletar ferramentas globais
    if (!tool.company_id) {
      return res.status(403).json({ error: "Cannot delete global tools" });
    }
    
    // Verificar ownership
    if (tool.company_id !== companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    await deleteTool(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[tools.admin] DELETE /tools/:id error", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /tools/:id/logs - obter logs de execução
router.get("/tools/:id/logs", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    const tool = await getToolById(req.params.id);
    if (!tool) return res.status(404).json({ error: "Tool not found" });
    
    // Verificar se pertence à company ou é global
    if (tool.company_id && tool.company_id !== companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const filters: any = { tool_id: req.params.id };
    if (req.query.agent_id) filters.agent_id = req.query.agent_id as string;
    if (req.query.chat_id) filters.chat_id = req.query.chat_id as string;
    if (req.query.action) filters.action = req.query.action as string;
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string, 10);
    
    const logs = await getToolLogs(filters);
    
    res.json(logs);
  } catch (err: any) {
    console.error("[tools.admin] GET /tools/:id/logs error", err);
    res.status(500).json({ error: err.message });
  }
});

// ===================== AGENT TOOLS =====================

// GET /agents/:agentId/tools - listar ferramentas de um agente
router.get("/agents/:agentId/tools", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    
    // Verificar se agente pertence à company
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, company_id")
      .eq("id", req.params.agentId)
      .single();
    
    if (!agent || agent.company_id !== companyId) {
      return res.status(403).json({ error: "Agent not found or forbidden" });
    }
    
    const filters: any = { agent_id: req.params.agentId };
    if (req.query.is_enabled !== undefined) filters.is_enabled = req.query.is_enabled === "true";
    
    const agentTools = await listAgentTools(filters);
    res.json(agentTools);
  } catch (err: any) {
    console.error("[tools.admin] GET /agents/:agentId/tools error", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /agents/:agentId/tools - adicionar ferramenta ao agente
router.post("/agents/:agentId/tools", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    
    // Verificar se agente pertence à company
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, company_id")
      .eq("id", req.params.agentId)
      .single();
    
    if (!agent || agent.company_id !== companyId) {
      return res.status(403).json({ error: "Agent not found or forbidden" });
    }
    
    const { tool_id, is_enabled, overrides } = req.body;
    if (!tool_id) return res.status(400).json({ error: "tool_id required" });
    
    // Verificar se tool existe e está acessível
    const tool = await getToolById(tool_id);
    if (!tool) return res.status(404).json({ error: "Tool not found" });
    if (tool.company_id && tool.company_id !== companyId) {
      return res.status(403).json({ error: "Tool forbidden" });
    }
    
    const newAgentTool = await addToolToAgent(req.params.agentId, tool_id, {
      is_enabled: is_enabled !== false,
      overrides: overrides || null,
    });
    
    res.status(201).json(newAgentTool);
  } catch (err: any) {
    console.error("[tools.admin] POST /agents/:agentId/tools error", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /agents/:agentId/tools/:toolId - atualizar ferramenta do agente
router.put("/agents/:agentId/tools/:toolId", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    
    // Verificar se agente pertence à company
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, company_id")
      .eq("id", req.params.agentId)
      .single();
    
    if (!agent || agent.company_id !== companyId) {
      return res.status(403).json({ error: "Agent not found or forbidden" });
    }
    
    const { is_enabled, overrides } = req.body;
    const updated = await updateAgentTool(req.params.agentId, req.params.toolId, {
      is_enabled,
      overrides,
    });
    
    if (!updated) return res.status(404).json({ error: "Agent tool not found" });
    
    res.json(updated);
  } catch (err: any) {
    console.error("[tools.admin] PUT /agents/:agentId/tools/:toolId error", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /agents/:agentId/tools/:toolId - remover ferramenta do agente
router.delete("/agents/:agentId/tools/:toolId", async (req: any, res: any) => {
  try {
    const companyId = req.profile.company_id;
    
    // Verificar se agente pertence à company
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, company_id")
      .eq("id", req.params.agentId)
      .single();
    
    if (!agent || agent.company_id !== companyId) {
      return res.status(403).json({ error: "Agent not found or forbidden" });
    }
    
    await removeToolFromAgent(req.params.agentId, req.params.toolId);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[tools.admin] DELETE /agents/:agentId/tools/:toolId error", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
