// repos/tools.repo.ts
// Repositório para CRUD de tools_catalog e agent_tools

import { db } from "../pg";

export type Tool = {
  id: string;
  key: string;
  name: string;
  category: string | null;
  description: string | null;
  schema: Record<string, any>;
  handler_type: "INTERNAL_DB" | "HTTP" | "WORKFLOW" | "SOCKET";
  handler_config: Record<string, any>;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AgentTool = {
  id: string;
  agent_id: string;
  tool_id: string;
  is_enabled: boolean;
  overrides: Record<string, any>;
  created_at: string;
};

export type ToolLog = {
  id: string;
  agent_id: string;
  tool_id: string;
  chat_id: string | null;
  contact_id: string | null;
  action: string;
  table_name: string | null;
  columns_accessed: string[];
  params: Record<string, any>;
  result: Record<string, any> | null;
  error: string | null;
  executed_at: string;
};

// ====== tools_catalog CRUD ======

export async function listTools(filters?: { category?: string; is_active?: boolean }) {
  let sql = "SELECT * FROM public.tools_catalog WHERE 1=1";
  const params: any[] = [];
  let idx = 1;
  
  if (filters?.category) {
    sql += ` AND category = $${idx++}`;
    params.push(filters.category);
  }
  if (filters?.is_active !== undefined) {
    sql += ` AND is_active = $${idx++}`;
    params.push(filters.is_active);
  }
  sql += " ORDER BY name";
  
  return await db.any<Tool>(sql, params);
}

export async function getToolById(id: string) {
  return await db.oneOrNone<Tool>(
    "SELECT * FROM public.tools_catalog WHERE id = $1",
    [id]
  );
}

export async function getToolByKey(key: string) {
  return await db.oneOrNone<Tool>(
    "SELECT * FROM public.tools_catalog WHERE key = $1",
    [key]
  );
}

export async function createTool(payload: Omit<Tool, "id" | "created_at" | "updated_at">) {
  return await db.one<Tool>(
    `INSERT INTO public.tools_catalog(key, name, category, description, schema, handler_type, handler_config, is_active, company_id)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      payload.key,
      payload.name,
      payload.category,
      payload.description,
      payload.schema,
      payload.handler_type,
      payload.handler_config,
      payload.is_active,
      payload.company_id,
    ]
  );
}

export async function updateTool(id: string, payload: Partial<Omit<Tool, "id" | "created_at" | "updated_at">>) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  
  if (payload.key !== undefined) {
    fields.push(`key = $${idx++}`);
    values.push(payload.key);
  }
  if (payload.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(payload.name);
  }
  if (payload.category !== undefined) {
    fields.push(`category = $${idx++}`);
    values.push(payload.category);
  }
  if (payload.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(payload.description);
  }
  if (payload.schema !== undefined) {
    fields.push(`schema = $${idx++}`);
    values.push(payload.schema);
  }
  if (payload.handler_type !== undefined) {
    fields.push(`handler_type = $${idx++}`);
    values.push(payload.handler_type);
  }
  if (payload.handler_config !== undefined) {
    fields.push(`handler_config = $${idx++}`);
    values.push(payload.handler_config);
  }
  if (payload.is_active !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(payload.is_active);
  }
  
  fields.push(`updated_at = NOW()`);
  values.push(id);
  
  const sql = `UPDATE public.tools_catalog SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
  return await db.one<Tool>(sql, values);
}

export async function deleteTool(id: string) {
  await db.none("DELETE FROM public.tools_catalog WHERE id = $1", [id]);
}

// ====== agent_tools CRUD ======

export async function listAgentTools(filters: { agent_id?: string; is_enabled?: boolean }) {
  let sql = `
    SELECT at.*, 
           row_to_json(tc.*) as tool
    FROM public.agent_tools at
    INNER JOIN public.tools_catalog tc ON at.tool_id = tc.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let idx = 1;
  
  if (filters.agent_id) {
    sql += ` AND at.agent_id = $${idx++}`;
    params.push(filters.agent_id);
  }
  if (filters.is_enabled !== undefined) {
    sql += ` AND at.is_enabled = $${idx++}`;
    params.push(filters.is_enabled);
  }
  
  const rows = await db.any<any>(sql, params);
  return rows.map((r) => ({ ...r, tool: r.tool as Tool })) as Array<AgentTool & { tool: Tool }>;
}

export async function getAgentTool(agentId: string, toolId: string) {
  const sql = `
    SELECT at.*, 
           row_to_json(tc.*) as tool
    FROM public.agent_tools at
    INNER JOIN public.tools_catalog tc ON at.tool_id = tc.id
    WHERE at.agent_id = $1 AND at.tool_id = $2
  `;
  const row = await db.oneOrNone<any>(sql, [agentId, toolId]);
  if (!row) return null;
  return { ...row, tool: row.tool as Tool } as AgentTool & { tool: Tool };
}

export async function addToolToAgent(
  agentId: string,
  toolId: string,
  options?: { is_enabled?: boolean; overrides?: Record<string, any> }
) {
  return await db.one<AgentTool>(
    `INSERT INTO public.agent_tools(agent_id, tool_id, is_enabled, overrides)
     VALUES($1, $2, $3, $4)
     RETURNING *`,
    [agentId, toolId, options?.is_enabled !== false, options?.overrides || {}]
  );
}

export async function updateAgentTool(
  agentId: string,
  toolId: string,
  payload: { is_enabled?: boolean; overrides?: Record<string, any> }
) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  
  if (payload.is_enabled !== undefined) {
    fields.push(`is_enabled = $${idx++}`);
    values.push(payload.is_enabled);
  }
  if (payload.overrides !== undefined) {
    fields.push(`overrides = $${idx++}`);
    values.push(payload.overrides);
  }
  
  values.push(agentId, toolId);
  const sql = `UPDATE public.agent_tools SET ${fields.join(", ")} WHERE agent_id = $${idx++} AND tool_id = $${idx} RETURNING *`;
  return await db.oneOrNone<AgentTool>(sql, values);
}

export async function removeToolFromAgent(agentId: string, toolId: string) {
  await db.none("DELETE FROM public.agent_tools WHERE agent_id = $1 AND tool_id = $2", [agentId, toolId]);
}

// ====== tool logs ======

export async function logToolExecution(log: Omit<ToolLog, "id" | "executed_at">) {
  return await db.one<ToolLog>(
    `INSERT INTO public.agent_tool_logs(agent_id, tool_id, chat_id, contact_id, action, table_name, columns_accessed, params, result, error)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      log.agent_id,
      log.tool_id,
      log.chat_id,
      log.contact_id,
      log.action,
      log.table_name,
      log.columns_accessed,
      log.params,
      log.result,
      log.error,
    ]
  );
}

export async function getToolLogs(filters: {
  agent_id?: string;
  tool_id?: string;
  chat_id?: string;
  limit?: number;
}) {
  let sql = "SELECT * FROM public.agent_tool_logs WHERE 1=1";
  const params: any[] = [];
  let idx = 1;
  
  if (filters.agent_id) {
    sql += ` AND agent_id = $${idx++}`;
    params.push(filters.agent_id);
  }
  if (filters.tool_id) {
    sql += ` AND tool_id = $${idx++}`;
    params.push(filters.tool_id);
  }
  if (filters.chat_id) {
    sql += ` AND chat_id = $${idx++}`;
    params.push(filters.chat_id);
  }
  
  sql += " ORDER BY executed_at DESC";
  
  if (filters.limit) {
    sql += ` LIMIT $${idx++}`;
    params.push(filters.limit);
  }
  
  return await db.any<ToolLog>(sql, params);
}
