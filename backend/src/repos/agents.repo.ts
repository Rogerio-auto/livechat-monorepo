import { supabaseAdmin } from "../lib/supabase.ts";
import type { AgentInput } from "../types/integrations.ts";

const TABLE = "agents";
const SELECT_COLUMNS = "id, company_id, name, description, status, integration_openai_id, model, model_params, aggregation_enabled, aggregation_window_sec, max_batch_messages, reply_if_idle_sec, media_config, tools_policy, allow_handoff, ignore_group_messages, enabled_inbox_ids, transcription_model, vision_model, created_at, updated_at";

type JsonRecord = Record<string, unknown>;

type AgentRowInternal = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED" | null;
  integration_openai_id: string | null;
  model: string | null;
  model_params: JsonRecord | null;
  aggregation_enabled: boolean | null;
  aggregation_window_sec: number | null;
  max_batch_messages: number | null;
  reply_if_idle_sec: number | null;
  media_config: JsonRecord | null;
  tools_policy: JsonRecord | null;
  allow_handoff: boolean | null;
  ignore_group_messages: boolean | null;
  enabled_inbox_ids: string[] | null;
  transcription_model?: string | null;
  vision_model?: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AgentRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  integration_openai_id: string | null;
  model: string | null;
  model_params: JsonRecord | null;
  aggregation_enabled: boolean;
  aggregation_window_sec: number | null;
  max_batch_messages: number | null;
  reply_if_idle_sec: number | null;
  media_config: JsonRecord | null;
  tools_policy: JsonRecord | null;
  allow_handoff: boolean;
  ignore_group_messages: boolean;
  enabled_inbox_ids: string[];
  transcription_model?: string | null;
  vision_model?: string | null;
  created_at: string;
  updated_at: string | null;
};

function mapAgent(row: AgentRowInternal): AgentRow {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    description: row.description ?? null,
    status: row.status ?? "INACTIVE",
    integration_openai_id: row.integration_openai_id ?? null,
    model: row.model ?? null,
    model_params: row.model_params ?? null,
    aggregation_enabled: Boolean(row.aggregation_enabled),
    aggregation_window_sec: row.aggregation_window_sec ?? null,
    max_batch_messages: row.max_batch_messages ?? null,
    reply_if_idle_sec: row.reply_if_idle_sec ?? null,
    media_config: row.media_config ?? null,
    tools_policy: row.tools_policy ?? null,
    allow_handoff: Boolean(row.allow_handoff),
    ignore_group_messages: Boolean(row.ignore_group_messages ?? true),
    enabled_inbox_ids: Array.isArray(row.enabled_inbox_ids) ? row.enabled_inbox_ids : [],
    transcription_model: row.transcription_model ?? null,
    vision_model: row.vision_model ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

function nullable<T>(value: T | undefined | null): T | null {
  return value === undefined ? null : value ?? null;
}

export async function createAgent(companyId: string, input: AgentInput): Promise<AgentRow> {
  const payload = {
    company_id: companyId,
    name: input.name,
    description: input.description ?? null,
    status: input.status ?? "ACTIVE",
    integration_openai_id: nullable(input.integration_openai_id ?? null),
    model: input.model ?? null,
    model_params: input.model_params ?? null,
    aggregation_enabled: input.aggregation_enabled ?? true,
    aggregation_window_sec: input.aggregation_window_sec ?? 20,
    max_batch_messages: input.max_batch_messages ?? 20,
    reply_if_idle_sec: input.reply_if_idle_sec ?? null,
    media_config: input.media_config ?? null,
    tools_policy: input.tools_policy ?? null,
    allow_handoff: input.allow_handoff ?? false,
    ignore_group_messages: input.ignore_group_messages ?? true,
    enabled_inbox_ids: input.enabled_inbox_ids ?? [],
    transcription_model: input.transcription_model ?? null,
    vision_model: input.vision_model ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert([payload])
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create agent");
  }

  return mapAgent(data as AgentRowInternal);
}

export async function listAgents(companyId: string): Promise<AgentRow[]> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    throw new Error(error?.message || "Failed to list agents");
  }

  return (data as AgentRowInternal[]).map(mapAgent);
}

export async function listAgentsFiltered(
  companyId: string,
  opts?: { q?: string; active?: boolean | undefined },
): Promise<AgentRow[]> {
  let query = supabaseAdmin
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (opts?.q && opts.q.trim()) {
    query = query.ilike("name", `%${opts.q.trim()}%`);
  }
  if (typeof opts?.active === "boolean") {
    if (opts.active) query = query.eq("status", "ACTIVE");
    else query = query.neq("status", "ACTIVE");
  }

  const { data, error } = await query;
  if (error || !data) {
    throw new Error(error?.message || "Failed to list agents");
  }
  return (data as AgentRowInternal[]).map(mapAgent);
}

export async function getAgent(companyId: string, id: string): Promise<AgentRow | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAgent(data as AgentRowInternal) : null;
}

export async function getActiveAgentForInbox(
  companyId: string,
  _inboxId?: string,
): Promise<AgentRow | null> {
  // Schema atual não possui coluna inbox_id. Estratégia: pegar o mais recente ACTIVE com allow_handoff=true
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .eq("allow_handoff", true)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAgent(data as AgentRowInternal) : null;
}

export async function updateAgent(
  companyId: string,
  id: string,
  patch: Partial<AgentInput>,
): Promise<AgentRow> {
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description ?? null;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.integration_openai_id !== undefined) update.integration_openai_id = nullable(patch.integration_openai_id);
  if (patch.model !== undefined) update.model = patch.model ?? null;
  if (patch.model_params !== undefined) update.model_params = patch.model_params ?? null;
  if (patch.aggregation_enabled !== undefined) update.aggregation_enabled = patch.aggregation_enabled;
  if (patch.aggregation_window_sec !== undefined) update.aggregation_window_sec = patch.aggregation_window_sec ?? null;
  if (patch.max_batch_messages !== undefined) update.max_batch_messages = patch.max_batch_messages ?? null;
  if (patch.reply_if_idle_sec !== undefined) update.reply_if_idle_sec = patch.reply_if_idle_sec ?? null;
  if (patch.media_config !== undefined) update.media_config = patch.media_config ?? null;
  if (patch.tools_policy !== undefined) update.tools_policy = patch.tools_policy ?? null;
  if (patch.allow_handoff !== undefined) update.allow_handoff = patch.allow_handoff;
  if (patch.ignore_group_messages !== undefined) update.ignore_group_messages = patch.ignore_group_messages;
  if (patch.enabled_inbox_ids !== undefined) update.enabled_inbox_ids = patch.enabled_inbox_ids ?? [];
  if (patch.transcription_model !== undefined) update.transcription_model = patch.transcription_model ?? null;
  if (patch.vision_model !== undefined) update.vision_model = patch.vision_model ?? null;

  if (Object.keys(update).length === 0) {
    throw new Error("No fields provided to update agent");
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(update)
    .eq("company_id", companyId)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update agent");
  }

  return mapAgent(data as AgentRowInternal);
}

export async function deleteAgent(companyId: string, id: string): Promise<{ ok: true }> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("company_id", companyId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Agent not found");
  }

  return { ok: true };
}