// backend/src/repos/project-templates.repo.ts

import { supabaseAdmin } from "../lib/supabase.js";

// ==================== TYPES ====================

export type ProjectTemplate = {
  id:  string;
  company_id: string;
  name: string;
  description: string | null;
  industry: string;
  icon: string;
  color: string;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at:  string;
  updated_at: string | null;
};

export type ProjectStage = {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  order_index: number;
  requires_approval: boolean;
  auto_complete_previous: boolean;
  automation_rules: Record<string, any> | null;
  created_at: string;
  updated_at: string | null;
};

export type ProjectCustomField = {
  id: string;
  template_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  field_placeholder: string | null;
  field_help_text: string | null;
  field_options: any[] | null;
  is_required: boolean;
  min_value: number | null;
  max_value: number | null;
  regex_validation: string | null;
  order_index: number;
  show_in_card: boolean;
  created_at: string;
};

export type TemplateWithDetails = ProjectTemplate & {
  stages: ProjectStage[];
  custom_fields: ProjectCustomField[];
};

// ==================== CRUD ====================

/**
 * Lista todos os templates de uma empresa, incluindo templates globais do mesmo nicho
 */
export async function listTemplates(companyId: string): Promise<ProjectTemplate[]> {
  // 1. Buscar indústria da empresa
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("industry")
    .eq("id", companyId)
    .single();

  const industry = company?.industry;

  // 2. Buscar templates da empresa OU globais do mesmo nicho
  let query = supabaseAdmin
    .from("project_templates")
    .select(`
      *,
      stages_count:project_stages(count),
      fields_count:project_custom_fields(count)
    `)
    .eq("is_active", true);

  if (industry) {
    // Filtra por templates da empresa OU templates globais do mesmo nicho
    query = query.or(`company_id.eq.${companyId},and(company_id.is.null,industry.eq.${industry})`);
  } else {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query.order("is_default", { ascending: false }).order("name");

  if (error) throw new Error(error.message);

  return (data || []).map(t => ({
    ...t,
    stages_count: t.stages_count?.[0]?.count || 0,
    fields_count: t.fields_count?.[0]?.count || 0
  }));
}

/**
 * Busca template com estágios e campos
 */
export async function getTemplateWithDetails(
  companyId: string,
  templateId: string
): Promise<TemplateWithDetails | null> {
  // Buscar template
  const { data: template, error:  templateError } = await supabaseAdmin
    .from("project_templates")
    .select("*")
    .eq("id", templateId)
    .eq("company_id", companyId)
    .single();

  if (templateError || !template) return null;

  // Buscar estágios
  const { data:  stages, error: stagesError } = await supabaseAdmin
    .from("project_stages")
    .select("*")
    .eq("template_id", templateId)
    .order("order_index", { ascending:  true });

  if (stagesError) throw new Error(stagesError.message);

  // Buscar campos customizados
  const { data: customFields, error: fieldsError } = await supabaseAdmin
    .from("project_custom_fields")
    .select("*")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });

  if (fieldsError) throw new Error(fieldsError.message);

  return {
    ...template,
    stages:  stages || [],
    custom_fields: customFields || [],
  };
}

/**
 * Cria um novo template
 */
export async function createTemplate(
  companyId: string,
  userId: string,
  input: {
    name: string;
    description?:  string;
    industry: string;
    icon?:  string;
    color?:  string;
    is_default?: boolean;
  }
): Promise<ProjectTemplate> {
  const { data, error } = await supabaseAdmin
    .from("project_templates")
    .insert({
      company_id: companyId,
      created_by:  userId,
      ... input,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Atualiza um template
 */
export async function updateTemplate(
  companyId: string,
  templateId: string,
  updates:  Partial<Omit<ProjectTemplate, "id" | "company_id" | "created_at" | "created_by">>
): Promise<ProjectTemplate> {
  const { data, error } = await supabaseAdmin
    .from("project_templates")
    .update(updates)
    .eq("id", templateId)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Deleta um template (soft delete)
 */
export async function deleteTemplate(
  companyId: string,
  templateId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_templates")
    .update({ is_active: false })
    .eq("id", templateId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
}

// ==================== STAGES ====================

/**
 * Adiciona um estágio ao template
 */
export async function addStageToTemplate(
  templateId: string,
  stage: {
    name: string;
    description?: string;
    color?:  string;
    icon?: string;
    order_index: number;
    requires_approval?:  boolean;
    automation_rules?: Record<string, any>;
  }
): Promise<ProjectStage> {
  const { data, error } = await supabaseAdmin
    .from("project_stages")
    .insert({
      template_id: templateId,
      ...stage,
    })
    .select()
    .single();

  if (error) throw new Error(error. message);
  return data;
}

/**
 * Atualiza um estágio
 */
export async function updateStage(
  stageId: string,
  updates: Partial<Omit<ProjectStage, "id" | "template_id" | "created_at">>
): Promise<ProjectStage> {
  const { data, error } = await supabaseAdmin
    .from("project_stages")
    .update(updates)
    .eq("id", stageId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Deleta um estágio
 */
export async function deleteStage(stageId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_stages")
    .delete()
    .eq("id", stageId);

  if (error) throw new Error(error.message);
}

// ==================== CUSTOM FIELDS ====================

/**
 * Adiciona campo customizado ao template
 */
export async function addCustomFieldToTemplate(
  templateId:  string,
  field: {
    field_key: string;
    field_label: string;
    field_type: string;
    field_placeholder?:  string;
    field_help_text?: string;
    field_options?: any[];
    is_required?: boolean;
    order_index: number;
    show_in_card?: boolean;
  }
): Promise<ProjectCustomField> {
  const { data, error } = await supabaseAdmin
    .from("project_custom_fields")
    .insert({
      template_id: templateId,
      ...field,
    })
    .select()
    .single();

  if (error) throw new Error(error. message);
  return data;
}

/**
 * Atualiza campo customizado
 */
export async function updateCustomField(
  fieldId: string,
  updates: Partial<Omit<ProjectCustomField, "id" | "template_id" | "created_at">>
): Promise<ProjectCustomField> {
  const { data, error } = await supabaseAdmin
    . from("project_custom_fields")
    .update(updates)
    .eq("id", fieldId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Deleta campo customizado
 */
export async function deleteCustomField(fieldId: string): Promise<void> {
  const { error } = await supabaseAdmin
    . from("project_custom_fields")
    .delete()
    .eq("id", fieldId);

  if (error) throw new Error(error.message);
}
