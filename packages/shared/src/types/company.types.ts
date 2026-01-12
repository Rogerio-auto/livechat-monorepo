export interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city?: string | null;
  state?: string | null;
  logo?: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateCompanyDTO {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  industry?: string | null;
}

export interface UpdateCompanyDTO extends Partial<CreateCompanyDTO> {}

export interface PlanLimits {
  users: number;              // -1 = ilimitado
  inboxes: number;
  ai_agents: number;
  messages_per_month: number;
  storage_mb: number;
  contacts: number;
  campaigns_per_month: number;
}

export interface PlanFeatures {
  basic_templates?: boolean;
  basic_reports?: boolean;
  email_support?: boolean;
  api_access?: boolean;
  webhooks?: boolean;
  white_label?: boolean;
  priority_support?: boolean;
  custom_templates?: boolean;
  advanced_reports?: boolean;
  dedicated_manager?: boolean;
  custom_integrations?: boolean;
  "24_7_support"?: boolean;
  tasks_module?: boolean;
  calendar_module?: boolean;
  media_library?: boolean;
  document_generation?: boolean;
  automation_module?: boolean;
  [key: string]: boolean | undefined;
}

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  price_monthly: number;
  price_yearly?: number | null;
  limits: PlanLimits;
  features: PlanFeatures;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_yearly?: string | null;
  stripe_product_id?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string | null;
}
