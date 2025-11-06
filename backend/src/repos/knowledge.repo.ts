import { supabaseAdmin } from "../lib/supabase.ts";

export type KnowledgeBaseRow = {
  id: string;
  company_id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  keywords: string[];
  priority: number;
  language: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  version: number;
  parent_id: string | null;
  usage_count: number;
  helpful_count: number;
  unhelpful_count: number;
  last_used_at: string | null;
  related_urls: string[];
  attachments: unknown[];
  internal_notes: string | null;
  visible_to_agents: boolean;
  requires_approval: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type KnowledgeBaseInput = {
  title: string;
  content: string;
  category?: string | null;
  tags?: string[];
  keywords?: string[];
  priority?: number;
  language?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  related_urls?: string[];
  attachments?: unknown[];
  internal_notes?: string | null;
  visible_to_agents?: boolean;
  requires_approval?: boolean;
};

const TABLE = "knowledge_base";

/**
 * Lista entradas da knowledge base com filtros
 */
export async function listKnowledgeBase(
  companyId: string,
  filters?: {
    status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
    category?: string;
    search?: string;
    visible_to_agents?: boolean;
  }
): Promise<KnowledgeBaseRow[]> {
  let query = supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("company_id", companyId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  if (filters?.visible_to_agents !== undefined) {
    query = query.eq("visible_to_agents", filters.visible_to_agents);
  }

  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%,tags.cs.{${filters.search}}`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[knowledge.repo] listKnowledgeBase error:", error);
    throw new Error(`Erro ao listar knowledge base: ${error.message}`);
  }

  return (data || []).map(mapRow);
}

/**
 * Busca semântica usando full-text search
 */
export async function searchKnowledgeBase(
  companyId: string,
  queryText: string,
  options?: {
    category?: string;
    maxResults?: number;
  }
): Promise<KnowledgeBaseRow[]> {
  const { data, error } = await supabaseAdmin.rpc("search_knowledge_base", {
    p_company_id: companyId,
    p_query: queryText,
    p_category: options?.category || null,
    p_max_results: options?.maxResults || 5,
  });

  if (error) {
    console.error("[knowledge.repo] searchKnowledgeBase error:", error);
    // Fallback para busca simples se RPC falhar
    return listKnowledgeBase(companyId, { 
      search: queryText, 
      category: options?.category,
      visible_to_agents: true,
      status: "ACTIVE"
    }).then(results => results.slice(0, options?.maxResults || 5));
  }

  return (data || []).map(mapRow);
}

/**
 * Obtém uma entrada específica
 */
export async function getKnowledgeBase(
  companyId: string,
  id: string
): Promise<KnowledgeBaseRow | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[knowledge.repo] getKnowledgeBase error:", error);
    throw new Error(`Erro ao buscar knowledge base: ${error.message}`);
  }

  return data ? mapRow(data) : null;
}

/**
 * Cria nova entrada
 */
export async function createKnowledgeBase(
  companyId: string,
  userId: string,
  input: KnowledgeBaseInput
): Promise<KnowledgeBaseRow> {
  const payload = {
    company_id: companyId,
    title: input.title,
    content: input.content,
    category: input.category || null,
    tags: input.tags || [],
    keywords: input.keywords || [],
    priority: input.priority ?? 0,
    language: input.language || "pt-BR",
    status: input.status || "ACTIVE",
    related_urls: input.related_urls || [],
    attachments: input.attachments || [],
    internal_notes: input.internal_notes || null,
    visible_to_agents: input.visible_to_agents ?? true,
    requires_approval: input.requires_approval ?? false,
    created_by: userId,
    updated_by: userId,
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("[knowledge.repo] createKnowledgeBase error:", error);
    throw new Error(`Erro ao criar knowledge base: ${error.message}`);
  }

  return mapRow(data);
}

/**
 * Atualiza entrada existente
 */
export async function updateKnowledgeBase(
  companyId: string,
  userId: string,
  id: string,
  input: Partial<KnowledgeBaseInput>
): Promise<KnowledgeBaseRow> {
  const update: Record<string, unknown> = {
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) update.title = input.title;
  if (input.content !== undefined) update.content = input.content;
  if (input.category !== undefined) update.category = input.category || null;
  if (input.tags !== undefined) update.tags = input.tags;
  if (input.keywords !== undefined) update.keywords = input.keywords;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.language !== undefined) update.language = input.language;
  if (input.status !== undefined) update.status = input.status;
  if (input.related_urls !== undefined) update.related_urls = input.related_urls;
  if (input.attachments !== undefined) update.attachments = input.attachments;
  if (input.internal_notes !== undefined) update.internal_notes = input.internal_notes || null;
  if (input.visible_to_agents !== undefined) update.visible_to_agents = input.visible_to_agents;
  if (input.requires_approval !== undefined) update.requires_approval = input.requires_approval;

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(update)
    .eq("company_id", companyId)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[knowledge.repo] updateKnowledgeBase error:", error);
    throw new Error(`Erro ao atualizar knowledge base: ${error.message}`);
  }

  return mapRow(data);
}

/**
 * Deleta entrada
 */
export async function deleteKnowledgeBase(
  companyId: string,
  id: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("company_id", companyId)
    .eq("id", id);

  if (error) {
    console.error("[knowledge.repo] deleteKnowledgeBase error:", error);
    throw new Error(`Erro ao deletar knowledge base: ${error.message}`);
  }
}

/**
 * Incrementa contador de uso
 */
export async function incrementKnowledgeBaseUsage(
  companyId: string,
  id: string
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("increment_kb_usage", {
    p_company_id: companyId,
    p_kb_id: id,
  });

  if (error) {
    console.error("[knowledge.repo] incrementKnowledgeBaseUsage error:", error);
    // Não lançar erro, apenas log
  }
}

/**
 * Registra feedback (helpful/unhelpful)
 */
export async function recordKnowledgeBaseFeedback(
  companyId: string,
  id: string,
  helpful: boolean
): Promise<void> {
  const field = helpful ? "helpful_count" : "unhelpful_count";
  
  const { error } = await supabaseAdmin.rpc("increment_kb_feedback", {
    p_company_id: companyId,
    p_kb_id: id,
    p_field: field,
  });

  if (error) {
    console.error("[knowledge.repo] recordKnowledgeBaseFeedback error:", error);
  }
}

/**
 * Obtém categorias únicas
 */
export async function getKnowledgeBaseCategories(
  companyId: string
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("category")
    .eq("company_id", companyId)
    .not("category", "is", null)
    .order("category");

  if (error) {
    console.error("[knowledge.repo] getKnowledgeBaseCategories error:", error);
    return [];
  }

  const categories = [...new Set((data || []).map(row => row.category).filter(Boolean))];
  return categories as string[];
}

/**
 * Obtém estatísticas da knowledge base
 */
export async function getKnowledgeBaseStats(
  companyId: string
): Promise<{
  total: number;
  active: number;
  draft: number;
  archived: number;
  total_usage: number;
  avg_helpful_rate: number;
}> {
  const { data, error } = await supabaseAdmin.rpc("get_kb_stats", {
    p_company_id: companyId,
  });

  if (error) {
    console.error("[knowledge.repo] getKnowledgeBaseStats error:", error);
    return {
      total: 0,
      active: 0,
      draft: 0,
      archived: 0,
      total_usage: 0,
      avg_helpful_rate: 0,
    };
  }

  return data || {
    total: 0,
    active: 0,
    draft: 0,
    archived: 0,
    total_usage: 0,
    avg_helpful_rate: 0,
  };
}

function mapRow(row: any): KnowledgeBaseRow {
  return {
    id: row.id,
    company_id: row.company_id,
    title: row.title,
    content: row.content,
    category: row.category || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    priority: Number(row.priority ?? 0),
    language: row.language || "pt-BR",
    status: row.status || "ACTIVE",
    version: Number(row.version ?? 1),
    parent_id: row.parent_id || null,
    usage_count: Number(row.usage_count ?? 0),
    helpful_count: Number(row.helpful_count ?? 0),
    unhelpful_count: Number(row.unhelpful_count ?? 0),
    last_used_at: row.last_used_at || null,
    related_urls: Array.isArray(row.related_urls) ? row.related_urls : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    internal_notes: row.internal_notes || null,
    visible_to_agents: Boolean(row.visible_to_agents ?? true),
    requires_approval: Boolean(row.requires_approval ?? false),
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at || null,
  };
}
