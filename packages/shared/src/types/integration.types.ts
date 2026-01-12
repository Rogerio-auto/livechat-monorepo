export type OpenAIIntegrationUsageLimits = {
  rpm?: number;
  daily_usd_cap?: number;
  [key: string]: unknown;
};

export interface OpenAIIntegration {
  id: string;
  company_id: string;
  name: string;
  org_id?: string | null;
  project_id?: string | null;
  openai_project_id?: string | null;
  openai_api_key_id?: string | null;
  auto_generated?: boolean;
  default_model?: string | null;
  models_allowed?: string[] | null;
  usage_limits?: OpenAIIntegrationUsageLimits | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface OpenAIIntegrationCreatePayload {
  name: string;
  api_key?: string;
  auto_generate?: boolean;
  org_id?: string | null;
  project_id?: string | null;
  default_model?: string | null;
  models_allowed?: string[];
  usage_limits?: OpenAIIntegrationUsageLimits;
  is_active?: boolean;
}

export type OpenAIIntegrationUpdatePayload = Partial<OpenAIIntegrationCreatePayload>;

export interface OpenAIUsageLog {
  id: string;
  company_id: string;
  integration_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  request_type: string;
  created_at: string;
}

export interface CompanyMonthlyBill {
  id: string;
  company_id: string;
  billing_month: string;
  total_cost_usd: number;
  total_tokens: number;
  total_requests: number;
  status: 'pending' | 'paid' | 'overdue';
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;
  paid_at?: string;
  created_at: string;
}
