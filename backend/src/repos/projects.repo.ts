// backend/src/repos/projects.repo.ts

import { supabaseAdmin } from "../lib/supabase.ts";

// ==================== TYPES ====================

export type Project = {
  id: string;
  company_id: string;
  template_id: string;
  current_stage_id: string | null;
  project_number: string;
  title: string;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_id: string | null;
  estimated_value: number | null;
  final_value: number | null;
  currency: string;
  start_date: string | null;
  estimated_end_date: string | null;
  actual_end_date: string | null;
  progress_percentage: number;
  owner_user_id: string | null;
  assigned_users: string[];
  custom_fields: Record<string, any>;
  status: string;
  priority: string;
  tags: string[];
  is_archived: boolean;
  is_favorite: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ProjectComment = {
  id: string;
  project_id: string;
  user_id: string;
  comment_text: string;
  is_internal: boolean;
  parent_id: string | null;
  created_at: string;
  user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
};

export type CreateProjectInput = {
  template_id: string;
  title: string;
  description?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  estimated_value?: number;
  start_date?: string;
  estimated_end_date?: string;
  owner_user_id?: string;
  assigned_users?: string[];
  custom_fields?: Record<string, any>;
  priority?: string;
  tags?: string[];
};

export type UpdateProjectInput = Partial<Omit<Project, "id" | "company_id" | "created_at" | "created_by" | "project_number">>;

export type ProjectFilters = {
  status?: string;
  stage_id?: string;
  template_id?: string;
  owner_user_id?: string;
  assigned_to?: string;
  priority?: string;
  search?: string;
  is_archived?: boolean;
  start_date_from?: string;
  start_date_to?: string;
};

// ==================== CRUD ====================

/**
 * Lista projetos com filtros
 */
export async function listProjects(
  companyId: string,
  filters?: ProjectFilters,
  limit:  number = 100,
  offset: number = 0
): Promise<{ projects: Project[]; total: number }> {
  let query = supabaseAdmin
    .from("projects")
    .select(`
      *,
      template:project_templates(name),
      owner:users!owner_user_id(name),
      tasks_count:project_tasks(count),
      comments_count:project_comments(count)
    `, { count: "exact" })
    .eq("company_id", companyId);

  // Aplicar filtros
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.stage_id) {
    query = query.eq("current_stage_id", filters.stage_id);
  }
  if (filters?.owner_user_id) {
    query = query.eq("owner_user_id", filters. owner_user_id);
  }
  if (filters?.assigned_to) {
    query = query.contains("assigned_users", [filters.assigned_to]);
  }
  if (filters?.priority) {
    query = query. eq("priority", filters.priority);
  }
  if (filters?.is_archived !== undefined) {
    query = query.eq("is_archived", filters.is_archived);
  }
  if (filters?.search) {
    query = query. or(`title.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,project_number.ilike.%${filters.search}%`);
  }
  if (filters?.start_date_from) {
    query = query.gte("start_date", filters.start_date_from);
  }
  if (filters?.start_date_to) {
    query = query.lte("start_date", filters. start_date_to);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const projects = (data || []).map((p: any) => ({
    ...p,
    template_name: p.template?.name,
    owner_name: p.owner?.name,
    tasks_count: p.tasks_count?.[0]?.count || 0,
    comments_count: p.comments_count?.[0]?.count || 0,
  }));

  return {
    projects,
    total: count || 0,
  };
}

/**
 * Busca projeto por ID
 */
export async function getProject(
  companyId: string,
  projectId: string
): Promise<Project | null> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data;
}

/**
 * Cria novo projeto
 */
export async function createProject(
  companyId: string,
  userId: string,
  input: CreateProjectInput
): Promise<Project> {
  // Buscar estágio inicial do template
  const { data: template, error: tError } = await supabaseAdmin
    .from("project_templates")
    .select("id, stages:project_stages(id, order_index)")
    .eq("id", input.template_id)
    .single();

  if (tError) throw new Error("Template not found");
  
  const initialStage = template.stages?.sort((a: any, b: any) => a.order_index - b.order_index)[0];

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      company_id: companyId,
      created_by: userId,
      current_stage_id: initialStage?.id,
      ...input,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await createProjectActivity(data.id, userId, "created", {
    title: "Projeto criado",
    description: `Projeto ${data.project_number} iniciado.`,
  });

  return data;
}

/**
 * Atualiza projeto
 */
export async function updateProject(
  companyId: string,
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<Project> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await createProjectActivity(projectId, userId, "field_update", {
    title: "Projeto atualizado",
    metadata: input,
  });

  return data;
}

/**
 * Busca projeto com todos os detalhes (estágio, comentários, tarefas, anexos)
 */
export async function getProjectWithDetails(
  companyId: string,
  projectId: string
): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select(`
      *,
      template:project_templates(*),
      stage:project_stages(*),
      owner:users!owner_user_id(id, name, email, avatar_url:avatar),
      comments:project_comments(*, user:users!created_by(id, name, avatar_url:avatar)),
      tasks:project_tasks(*),
      attachments:project_attachments(*),
      activities:project_activities(*, user:users!created_by(id, name))
    `)
    .eq("id", projectId)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data;
}

/**
 * Move projeto para outro estágio
 */
export async function moveProjectStage(
  companyId: string,
  projectId: string,
  userId: string,
  newStageId: string
): Promise<Project> {
  // Buscar estágio anterior
  const project = await getProject(companyId, projectId);
  if (!project) throw new Error("Project not found");

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({ current_stage_id: newStageId })
    .eq("id", projectId)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Registrar mudança de estágio
  try {
    await createProjectActivity(projectId, userId, "stage_change", {
      title: "Estágio alterado",
      from_stage_id: project.current_stage_id || undefined,
      to_stage_id: newStageId,
    });
  } catch (err) {
    console.error("[DEBUG] Failed to create project activity (ignoring):", err);
  }

  return data;
}

/**
 * Arquiva projeto
 */
export async function archiveProject(
  companyId: string,
  projectId: string,
  userId:  string
): Promise<void> {
  await updateProject(companyId, projectId, userId, { is_archived: true });
}

/**
 * Deleta projeto (hard delete)
 */
export async function deleteProject(
  companyId: string,
  projectId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("company_id", companyId);

  if (error) throw new Error(error. message);
}

// ==================== ACTIVITIES ====================

export type ProjectActivity = {
  id: string;
  project_id: string;
  activity_type: string;
  title: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  from_stage_id: string | null;
  to_stage_id: string | null;
  created_by: string | null;
  created_at: string;
};

/**
 * Registra atividade no projeto
 */
export async function createProjectActivity(
  projectId: string,
  userId: string,
  activityType: string,
  details?:  {
    title?: string;
    description?: string;
    metadata?:  Record<string, any>;
    from_stage_id?: string;
    to_stage_id?:  string;
  }
): Promise<ProjectActivity> {
  const { data, error } = await supabaseAdmin
    .from("project_activities")
    .insert({
      project_id: projectId,
      activity_type: activityType,
      created_by: userId,
      ... details,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Lista atividades de um projeto
 */
export async function getProjectActivities(
  projectId: string,
  limit: number = 50
): Promise<ProjectActivity[]> {
  const { data, error } = await supabaseAdmin
    .from("project_activities")
    .select("*")
    .eq("project_id", projectId)
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

// ==================== COMMENTS ====================

/**
 * Adiciona comentário ao projeto
 */
export async function addComment(
  companyId: string,
  projectId: string,
  userId: string,
  input: {
    content: string;
    is_internal?: boolean;
    parent_id?: string;
  }
): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from("project_comments")
    .insert({
      project_id: projectId,
      created_by: userId,
      comment_text: input.content,
      parent_comment_id: input.parent_id || null,
    })
    .select(`
      *,
      user:users(id, name, avatar_url:avatar)
    `)
    .single();

  if (error) throw new Error(error.message);

  // Registrar atividade
  await createProjectActivity(projectId, userId, "comment", {
    title: "Novo comentário",
    description: input.content.substring(0, 100),
  });

  return data;
}

/**
 * Lista comentários de um projeto
 */
export async function listProjectComments(
  projectId: string
): Promise<ProjectComment[]> {
  const { data, error } = await supabaseAdmin
    .from("project_comments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}
export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw new Error(error.message);
}
// ==================== ATTACHMENTS ====================

export type ProjectAttachment = {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size:  number | null;
  file_category: string | null;
  folder:  string | null;
  description: string | null;
  tags: string[];
  is_public: boolean;
  uploaded_by: string;
  created_at: string;
};

/**
 * Adiciona anexo ao projeto
 */
export async function addAttachment(
  companyId: string,
  projectId: string,
  userId: string,
  attachment: {
    file_name:  string;
    file_url:  string;
    file_type?:  string;
    file_size?:  number;
  }
): Promise<ProjectAttachment> {
  const { data, error } = await supabaseAdmin
    .from("project_attachments")
    .insert({
      project_id: projectId,
      uploaded_by: userId,
      ... attachment,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Registrar atividade
  await createProjectActivity(projectId, userId, "file_upload", {
    title: "Arquivo anexado",
    description: attachment. file_name,
  });

  return data;
}

/**
 * Lista anexos de um projeto
 */
export async function listProjectAttachments(
  projectId: string
): Promise<ProjectAttachment[]> {
  const { data, error } = await supabaseAdmin
    .from("project_attachments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending:  false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Deleta anexo
 */
export async function deleteAttachment(
  attachmentId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) throw new Error(error.message);
}
// ==================== STATS ====================

export async function getProjectStats(companyId: string, templateId?: string): Promise<any> {
  let query = supabaseAdmin
    .from("projects")
    .select("status, estimated_value, final_value, progress_percentage, priority")
    .eq("company_id", companyId);

  if (templateId) {
    query = query.eq("template_id", templateId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const stats = {
    total_projects: data.length,
    active: data.filter(p => p.status === 'active').length,
    completed: data.filter(p => p.status === 'completed').length,
    on_hold: data.filter(p => p.status === 'on_hold').length,
    cancelled: data.filter(p => p.status === 'cancelled').length,
    total_estimated_value: data.reduce((acc, p) => acc + (p.estimated_value || 0), 0),
    total_final_value: data.reduce((acc, p) => acc + (p.final_value || 0), 0),
    avg_progress: data.length > 0 
      ? Math.round(data.reduce((acc, p) => acc + (p.progress_percentage || 0), 0) / data.length) 
      : 0,
    by_priority: {
      urgent: data.filter(p => p.priority === 'urgent').length,
      high: data.filter(p => p.priority === 'high').length,
      medium: data.filter(p => p.priority === 'medium').length,
      low: data.filter(p => p.priority === 'low').length,
    }
  };

  return stats;
}
// ==================== TASKS ====================

export type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  assigned_to: string | null;
  order_index: number;
  created_by: string | null;
  created_at:  string;
  updated_at:  string | null;
};

/**
 * Adiciona tarefa ao projeto
 */
export async function addTask(
  companyId: string,
  projectId: string,
  userId: string,
  task: {
    title: string;
    description?: string;
    due_date?: string;
    assigned_to?: string;
    priority?: string;
  }
): Promise<ProjectTask> {
  // Buscar o maior order_index atual para este projeto
  const { data: lastTask, error: fetchError } = await supabaseAdmin
    .from("project_tasks")
    .select("order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const nextOrderIndex = lastTask ? lastTask.order_index + 1 : 0;

  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .insert({
      project_id: projectId,
      created_by: userId,
      order_index: nextOrderIndex,
      ...task,
    })
    .select(`
      *,
      assigned_user:users!assigned_to(id, name, avatar)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Atualiza tarefa
 */
export async function updateTask(
  taskId: string,
  updates: any
): Promise<ProjectTask> {
  const payload: any = { ...updates };

  // Se estiver marcando como concluído via status ou is_completed
  if (updates.status === "completed" || updates.is_completed === true) {
    payload.is_completed = true;
    payload.completed_at = new Date().toISOString();
  } else if (updates.status === "pending" || updates.is_completed === false) {
    payload.is_completed = false;
    payload.completed_at = null;
  }

  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .update(payload)
    .eq("id", taskId)
    .select(`
      *,
      assigned_user:users!assigned_to(id, name, avatar)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Deleta tarefa
 */
export async function deleteTask(
  taskId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_tasks")
    .delete()
    .eq("id", taskId);

  if (error) throw new Error(error.message);
}

/**
 * Lista tarefas de um projeto
 */
export async function listProjectTasks(
  projectId: string
): Promise<ProjectTask[]> {
  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .select(`
      *,
      assigned_user:users!assigned_to(id, name, avatar)
    `)
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}
