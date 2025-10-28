export type Me = {
id: string;
name: string | null;
companyName: string | null;
companyId: string | null;
avatarUrl?: string | null;
};


export type Company = {
id: string;
name: string;
address: string;
city: string;
state: string;
logo: string;
};


export type MetaProviderConfig = {
access_token?: string | null;
refresh_token?: string | null;
provider_api_key?: string | null;
phone_number_id?: string | null;
waba_id?: string | null;
webhook_verify_token?: string | null;
};


export type WahaProviderConfig = {
api_key?: string | null;
};


export type ProviderConfig = {
meta?: MetaProviderConfig | null;
waha?: WahaProviderConfig | null;
};


export type Inbox = {
id: string;
name: string;
phone_number: string;
is_active?: boolean | null;
webhook_url?: string | null;
channel?: string | null;
provider?: string | null;
base_url?: string | null;
api_version?: string | null;
phone_number_id?: string | null;
waba_id?: string | null;
instance_id?: string | null;
webhook_verify_token?: string | null;
provider_config?: ProviderConfig | null;
};


export type InboxForm = {
name: string;
phone_number: string;
webhook_url: string;
is_active: boolean;
provider: string;
channel: string;
provider_config?: ProviderConfig | null;
};


export type Agent = { id: string; name: string; role?: string | null; email?: string };

export type OpenAIIntegrationUsageLimits = {
  rpm?: number;
  daily_usd_cap?: number;
  [key: string]: unknown;
};

export type OpenAIIntegration = {
  id: string;
  company_id: string;
  name: string;
  org_id?: string | null;
  project_id?: string | null;
  default_model?: string | null;
  models_allowed?: string[] | null;
  usage_limits?: OpenAIIntegrationUsageLimits | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type OpenAIIntegrationCreatePayload = {
  name: string;
  api_key: string;
  org_id?: string | null;
  project_id?: string | null;
  default_model?: string | null;
  models_allowed?: string[];
  usage_limits?: OpenAIIntegrationUsageLimits;
  is_active?: boolean;
};

export type OpenAIIntegrationUpdatePayload = Partial<OpenAIIntegrationCreatePayload>;

export type AgentStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type AutomationAgent = {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  status?: AgentStatus;
  integration_openai_id?: string | null;
  model?: string | null;
  model_params?: Record<string, unknown> | null;
  aggregation_enabled?: boolean;
  aggregation_window_sec?: number | null;
  max_batch_messages?: number | null;
  reply_if_idle_sec?: number | null;
  media_config?: Record<string, unknown> | null;
  tools_policy?: Record<string, unknown> | null;
  allow_handoff?: boolean;
  created_at: string;
  updated_at: string | null;
};

export type AutomationAgentPayload = {
  name: string;
  description?: string;
  status?: AgentStatus;
  integration_openai_id?: string | null;
  model?: string;
  model_params?: Record<string, unknown>;
  aggregation_enabled?: boolean;
  aggregation_window_sec?: number;
  max_batch_messages?: number;
  reply_if_idle_sec?: number | null;
  media_config?: Record<string, unknown>;
  tools_policy?: Record<string, unknown>;
  allow_handoff?: boolean;
};


export type CampaignStatus = "DRAFT"|"SCHEDULED"|"RUNNING"|"PAUSED"|"COMPLETED"|"CANCELLED";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  type: "BROADCAST"|"DRIP"|"TRIGGERED";
  inbox_id: string | null;
  rate_limit_per_minute: number;
  auto_handoff: boolean;
  start_at?: string | null;
  created_at?: string | null;
}
