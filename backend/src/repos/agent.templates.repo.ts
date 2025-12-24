import { supabaseAdmin } from "../lib/supabase.ts";

export type AgentTemplateRow = {
  id: string;
  company_id: string | null;
  key: string;
  name: string;
  category: string | null;
  description: string | null;
  prompt_template: string;
  default_model: string | null;
  default_model_params: Record<string, unknown>;
  default_tools: unknown[];
  created_at: string;
  updated_at: string | null;
  tools?: any[]; // Adicionado para otimização
};

export type AgentTemplateQuestionRow = {
  id: string;
  template_id: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "boolean" | "multiselect";
  required: boolean;
  help: string | null;
  options: unknown[];
  order_index: number;
};

export type AgentTemplateToolRow = {
  id: string;
  template_id: string;
  tool_id: string;
  required: boolean;
  overrides: Record<string, unknown>;
};

function mapTemplate(row: any): AgentTemplateRow {
  return {
    id: row.id,
    company_id: row.company_id ?? null,
    key: row.key,
    name: row.name,
    category: row.category ?? null,
    description: row.description ?? null,
    prompt_template: row.prompt_template,
    default_model: row.default_model ?? null,
    default_model_params: (row.default_model_params ?? {}) as Record<string, unknown>,
    default_tools: Array.isArray(row.default_tools) ? row.default_tools : [],
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

function mapQuestion(row: any): AgentTemplateQuestionRow {
  return {
    id: row.id,
    template_id: row.template_id,
    key: row.key,
    label: row.label,
    type: row.type,
    required: Boolean(row.required),
    help: row.help ?? null,
    options: Array.isArray(row.options) ? row.options : [],
    order_index: Number(row.order_index ?? 0),
  } as AgentTemplateQuestionRow;
}

function mapTool(row: any): AgentTemplateToolRow {
  return {
    id: row.id,
    template_id: row.template_id,
    tool_id: row.tool_id,
    required: Boolean(row.required),
    overrides: (row.overrides ?? {}) as Record<string, unknown>,
  };
}

export async function listAgentTemplates(companyId: string): Promise<AgentTemplateRow[]> {
  const { data: templates, error: tError } = await supabaseAdmin
    .from("agent_templates")
    .select("*")
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .order("name", { ascending: true });

  if (tError) throw new Error(tError.message);
  if (!templates || templates.length === 0) return [];

  // Buscar ferramentas separadamente para evitar erro de relacionamento no PostgREST
  const templateIds = templates.map(t => t.id);
  const { data: attData, error: attError } = await supabaseAdmin
    .from("agent_template_tools")
    .select("*")
    .in("template_id", templateIds);

  if (attError) throw new Error(attError.message);

  // Buscar catálogo separadamente
  const toolIds = [...new Set((attData || []).map(att => att.tool_id))];
  let catalogMap = new Map();
  
  if (toolIds.length > 0) {
    const { data: catalogData, error: catError } = await supabaseAdmin
      .from("tools_catalog")
      .select("*")
      .in("id", toolIds);
    
    if (catError) throw new Error(catError.message);
    catalogMap = new Map((catalogData || []).map(c => [c.id, c]));
  }

  return templates.map(row => {
    const template = mapTemplate(row);
    const toolsForThisTemplate = (attData || []).filter(att => att.template_id === row.id);
    template.tools = toolsForThisTemplate.map(att => ({
      ...(catalogMap.get(att.tool_id) || {}),
      required: att.required,
      overrides: att.overrides
    }));
    return template;
  });
}

export async function getAgentTemplateById(companyId: string, id: string): Promise<AgentTemplateRow | null> {
  const { data, error } = await supabaseAdmin
    .from("agent_templates")
    .select("*")
    .eq("id", id)
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTemplate(data) : null;
}

export async function getAgentTemplateQuestions(templateId: string): Promise<AgentTemplateQuestionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("agent_template_questions")
    .select("*")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapQuestion);
}

export async function getAgentTemplateTools(templateId: string): Promise<any[]> {
  const { data: attData, error: attError } = await supabaseAdmin
    .from("agent_template_tools")
    .select("*")
    .eq("template_id", templateId);

  if (attError) throw new Error(attError.message);
  if (!attData || attData.length === 0) return [];

  const toolIds = attData.map(att => att.tool_id);
  const { data: catalogData, error: catError } = await supabaseAdmin
    .from("tools_catalog")
    .select("*")
    .in("id", toolIds);

  if (catError) throw new Error(catError.message);

  const catalogMap = new Map((catalogData || []).map(c => [c.id, c]));

  return attData.map(att => ({
    ...(catalogMap.get(att.tool_id) || {}),
    required: att.required,
    overrides: att.overrides
  }));
}
