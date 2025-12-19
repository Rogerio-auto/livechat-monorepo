// frontend/src/types/projects.ts

export type ProjectTemplate = {
  id: string;
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
  field_type: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'multiselect' | 'file' | 'currency' | 'boolean' | 'textarea' | 'url' | 'email' | 'phone';
  field_placeholder: string | null;
  field_help_text: string | null;
  field_options: string[] | null;
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
  status: 'active' | 'completed' | 'cancelled' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  is_archived: boolean;
  is_favorite: boolean;
  created_by: string | null;
  created_at:  string;
  updated_at:  string | null;
  
  // Joined fields (optional)
  template_name?: string;
  owner_name?: string;
  contact_name?: string;
  tasks_count?: number;
  completed_tasks_count?: number;
  comments_count?: number;
  progress?: number;
  end_date?: string;
  budget?: number;
};

export type ProjectWithDetails = Project & {
  template?: ProjectTemplate;
  stage?: ProjectStage;
  owner?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
  comments?: ProjectComment[];
  tasks?: ProjectTask[];
  attachments?: ProjectAttachment[];
  activities?: ProjectActivity[];
};

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

export type ProjectComment = {
  id: string;
  project_id: string;
  comment_text: string;
  mentions:  string[];
  attachments: any[] | null;
  parent_comment_id: string | null;
  is_edited: boolean;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  user?: {
    name: string;
    avatar_url?: string;
  };
};

export type ProjectAttachment = {
  id:  string;
  project_id:  string;
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

export type ProjectStats = {
  total_projects:  number;
  active:  number;
  completed: number;
  on_hold: number;
  cancelled: number;
  by_priority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  total_estimated_value: number;
  total_final_value: number;
  avg_progress: number;
};
