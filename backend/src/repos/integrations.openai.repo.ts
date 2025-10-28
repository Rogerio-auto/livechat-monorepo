import { supabaseAdmin } from "../lib/supabase.ts";
import { encryptSecret } from "../lib/crypto.ts";

const TABLE = "integrations_openai";
const SELECT_COLUMNS = "id, company_id, name, org_id, project_id, default_model, models_allowed, usage_limits, is_active, created_at, updated_at";

type JsonRecord = Record<string, unknown>;

type IntegrationRow = {
  id: string;
  company_id: string;
  name: string;
  org_id: string | null;
  project_id: string | null;
  default_model: string | null;
  models_allowed: string[] | null;
  usage_limits: JsonRecord | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string | null;
};

export type OpenAIIntegrationSafeRow = {
  id: string;
  company_id: string;
  name: string;
  org_id: string | null;
  project_id: string | null;
  default_model: string | null;
  models_allowed: string[] | null;
  usage_limits: JsonRecord | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

type CreateIntegrationInput = {
  name: string;
  api_key: string;
  org_id?: string;
  project_id?: string;
  default_model?: string;
  models_allowed?: string[];
  usage_limits?: JsonRecord;
  is_active?: boolean;
};

type UpdateIntegrationInput = {
  name?: string;
  api_key?: string;
  org_id?: string;
  project_id?: string;
  default_model?: string;
  models_allowed?: string[];
  usage_limits?: JsonRecord;
  is_active?: boolean;
};

function sanitizeModels(models?: string[] | null): string[] | null {
  if (!models || models.length === 0) {
    return null;
  }
  const cleaned = Array.from(new Set(models.map((model) => model.trim()).filter((model) => model.length > 0)));
  return cleaned.length > 0 ? cleaned : null;
}

function mapRow(row: IntegrationRow): OpenAIIntegrationSafeRow {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    org_id: row.org_id,
    project_id: row.project_id,
    default_model: row.default_model,
    models_allowed: Array.isArray(row.models_allowed) ? row.models_allowed : sanitizeModels(row.models_allowed ?? undefined),
    usage_limits: row.usage_limits ?? null,
    is_active: Boolean(row.is_active ?? true),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createOpenAIIntegration(companyId: string, input: CreateIntegrationInput): Promise<OpenAIIntegrationSafeRow> {
  const payload = {
    company_id: companyId,
    name: input.name,
    api_key_enc: encryptSecret(input.api_key),
    org_id: input.org_id ?? null,
    project_id: input.project_id ?? null,
    default_model: input.default_model ?? null,
    models_allowed: sanitizeModels(input.models_allowed ?? null),
    usage_limits: input.usage_limits ?? null,
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert([payload])
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create OpenAI integration");
  }

  return mapRow(data as IntegrationRow);
}

export async function listOpenAIIntegrations(companyId: string): Promise<OpenAIIntegrationSafeRow[]> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    throw new Error(error?.message || "Failed to list OpenAI integrations");
  }

  return (data as IntegrationRow[]).map(mapRow);
}

export async function updateOpenAIIntegration(
  companyId: string,
  id: string,
  patch: UpdateIntegrationInput,
): Promise<OpenAIIntegrationSafeRow> {
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) update.name = patch.name;
  if (patch.org_id !== undefined) update.org_id = patch.org_id ?? null;
  if (patch.project_id !== undefined) update.project_id = patch.project_id ?? null;
  if (patch.default_model !== undefined) update.default_model = patch.default_model ?? null;
  if (patch.models_allowed !== undefined) update.models_allowed = sanitizeModels(patch.models_allowed);
  if (patch.usage_limits !== undefined) update.usage_limits = patch.usage_limits ?? null;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  if (patch.api_key !== undefined) update.api_key_enc = encryptSecret(patch.api_key);

  if (Object.keys(update).length === 0) {
    throw new Error("No fields provided to update integration");
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(update)
    .eq("company_id", companyId)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update OpenAI integration");
  }

  return mapRow(data as IntegrationRow);
}

export async function deleteOpenAIIntegration(companyId: string, id: string): Promise<{ ok: true }> {
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
    throw new Error("OpenAI integration not found");
  }

  return { ok: true };
}