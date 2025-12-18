// backend/src/repos/integrations.openai.repo.ts

import { supabaseAdmin } from "../lib/supabase.ts";
import { encryptSecret, decryptSecret } from "../lib/crypto.ts";

const TABLE = "integrations_openai";
const SELECT_COLUMNS = `
  id, company_id, name, org_id, project_id, default_model, 
  models_allowed, usage_limits, is_active, 
  openai_project_id, openai_api_key_id, auto_generated,
  created_at, updated_at
`;

type JsonRecord = Record<string, unknown>;

// ==================== TYPES ====================

type IntegrationRow = {
  id: string;
  company_id: string;
  name: string;
  org_id: string | null;
  project_id:  string | null;
  default_model:  string | null;
  models_allowed:  string[] | null;
  usage_limits: JsonRecord | null;
  is_active: boolean | null;
  openai_project_id: string | null; // 🆕
  openai_api_key_id: string | null; // 🆕
  auto_generated: boolean | null;   // 🆕
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
  models_allowed:  string[] | null;
  usage_limits: JsonRecord | null;
  is_active: boolean;
  openai_project_id: string | null; // 🆕
  openai_api_key_id:  string | null; // 🆕
  auto_generated: boolean;          // 🆕
  created_at: string;
  updated_at: string | null;
};

// Input para criação MANUAL (compatibilidade)
type CreateIntegrationManualInput = {
  name: string;
  api_key: string;
  org_id?: string;
  project_id?: string;
  default_model?: string;
  models_allowed?: string[];
  usage_limits?: JsonRecord;
  is_active?: boolean;
};

// Input para criação AUTOMÁTICA (nova feature)
type CreateIntegrationAutoInput = {
  name: string;
  openai_project_id:  string;
  openai_api_key_id: string;
  api_key: string; // Gerada pela OpenAI
  default_model?:  string;
  models_allowed?:  string[];
  usage_limits?:  JsonRecord;
  is_active?: boolean;
};

type CreateIntegrationInput = CreateIntegrationManualInput | CreateIntegrationAutoInput;

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

// ==================== HELPERS ====================

function sanitizeModels(models?:  string[] | null): string[] | null {
  if (!models || models.length === 0) return null;
  const cleaned = Array.from(new Set(
    models.map(model => model.trim()).filter(model => model.length > 0)
  ));
  return cleaned.length > 0 ? cleaned :  null;
}

function mapRow(row: IntegrationRow): OpenAIIntegrationSafeRow {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    org_id: row.org_id,
    project_id: row.project_id,
    default_model: row.default_model,
    models_allowed: Array.isArray(row.models_allowed) 
      ? row.models_allowed 
      : sanitizeModels(row.models_allowed ??  undefined),
    usage_limits: row.usage_limits ?? null,
    is_active: Boolean(row.is_active ??  true),
    openai_project_id: row.openai_project_id ??  null,
    openai_api_key_id: row.openai_api_key_id ??  null,
    auto_generated:  Boolean(row.auto_generated ?? false),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ==================== CRUD ====================

/**
 * Cria integração (suporta manual E automática)
 * BACKWARD COMPATIBLE:  Aceita formato antigo sem quebrar
 */
export async function createOpenAIIntegration(
  companyId: string,
  input: CreateIntegrationInput
): Promise<OpenAIIntegrationSafeRow> {
  const isAuto = 'openai_project_id' in input;

  const payload = {
    company_id:  companyId,
    name:  input.name,
    api_key_enc: encryptSecret(input.api_key),
    org_id: 'org_id' in input ? ((input as any).org_id ??  null) : null,
    project_id: 'project_id' in input ? ((input as any).project_id ?? null) : null,
    default_model: input.default_model ??  "gpt-4o-mini",
    models_allowed: sanitizeModels(input.models_allowed ??  null),
    usage_limits: input.usage_limits ?? null,
    is_active: input.is_active ?? true,
    openai_project_id: isAuto ? (input as any).openai_project_id :  null,
    openai_api_key_id: isAuto ? (input as any).openai_api_key_id : null,
    auto_generated: isAuto,
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

/**
 * Lista integrações de uma empresa
 * BACKWARD COMPATIBLE
 */
export async function listOpenAIIntegrations(
  companyId: string
): Promise<OpenAIIntegrationSafeRow[]> {
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

/**
 * Busca integração por ID
 * BACKWARD COMPATIBLE
 */
export async function getOpenAIIntegration(
  companyId: string,
  id: string
): Promise<OpenAIIntegrationSafeRow | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapRow(data as IntegrationRow);
}

/**
 * Busca API key descriptografada (uso interno)
 */
export async function getDecryptedAPIKey(
  companyId:  string,
  integrationId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("api_key_enc")
    .eq("company_id", companyId)
    .eq("id", integrationId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.api_key_enc) return null;

  return decryptSecret(data.api_key_enc);
}

/**
 * Atualiza integração
 * BACKWARD COMPATIBLE
 */
export async function updateOpenAIIntegration(
  companyId: string,
  id: string,
  patch: UpdateIntegrationInput
): Promise<OpenAIIntegrationSafeRow> {
  const update:  Record<string, unknown> = {};

  if (patch.name !== undefined) update.name = patch.name;
  if (patch.org_id !== undefined) update.org_id = patch.org_id ??  null;
  if (patch.project_id !== undefined) update.project_id = patch.project_id ?? null;
  if (patch.default_model !== undefined) update.default_model = patch.default_model ?? null;
  if (patch.models_allowed !== undefined) update.models_allowed = sanitizeModels(patch.models_allowed);
  if (patch.usage_limits !== undefined) update.usage_limits = patch.usage_limits ??  null;
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

/**
 * Deleta integração
 * 🆕 Com revogação automática se for auto-generated
 */
export async function deleteOpenAIIntegration(
  companyId: string,
  id: string
): Promise<{ ok: true; revoked?:  boolean }> {
  // Buscar dados antes de deletar
  const integration = await getOpenAIIntegration(companyId, id);

  // Deletar do banco
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("company_id", companyId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("OpenAI integration not found");

  // Se foi auto-gerada, tentar revogar na OpenAI
  let revoked = false;
  if (integration?.auto_generated && integration.openai_project_id && integration.openai_api_key_id) {
    try {
      const { revokeProjectAPIKey } = await import('../services/openai.admin.service.ts');
      await revokeProjectAPIKey(integration.openai_project_id, integration.openai_api_key_id);
      revoked = true;
      console.log(`[Integration] ✅ Revoked API key for integration ${id}`);
    } catch (error) {
      console.error(`[Integration] ⚠️  Failed to revoke API key: `, error);
      // Não falhar a operação se revogação falhar
    }
  }

  return { ok: true, revoked };
}
