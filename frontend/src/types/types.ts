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
app_secret?: string | null;
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
  openai_project_id?: string | null;
  openai_api_key_id?: string | null;
  auto_generated?: boolean;
  default_model?: string | null;
  models_allowed?: string[] | null;
  usage_limits?: OpenAIIntegrationUsageLimits | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type OpenAIIntegrationCreatePayload = {
  name: string;
  api_key?: string;
  auto_generate?: boolean;
  org_id?: string | null;
  project_id?: string | null;
  default_model?: string | null;
  models_allowed?: string[];
  usage_limits?: OpenAIIntegrationUsageLimits;
};

export type OpenAIUsageLog = {
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
};

export type CompanyMonthlyBill = {
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
};
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

// ===== Agent Templates (para wizard de criação de agente) =====
export type AgentTemplate = {
  id: string;
  company_id: string | null;
  key: string;
  name: string;
  category?: string | null;
  description?: string | null;
  prompt_template: string;
  default_model?: string | null;
  default_model_params?: Record<string, unknown>;
  default_tools?: unknown[];
  created_at: string;
  updated_at?: string | null;
};

export type AgentTemplateQuestion = {
  id: string;
  template_id: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "boolean" | "multiselect";
  required: boolean;
  help?: string | null;
  options?: unknown[];
  order_index: number;
};

export type AgentTemplateTool = {
  id: string;
  template_id: string;
  tool_id: string;
  required: boolean;
  overrides?: Record<string, unknown>;
};

export type AgentTemplatePreview = {
  prompt: string;
  model: string | null;
  model_params: Record<string, unknown>;
  tools: unknown[];
};

// ====== TOOLS TYPES ======
export type ToolHandlerType = "INTERNAL_DB" | "HTTP" | "WORKFLOW" | "SOCKET";

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

export type ToolHandlerConfig = {
  table?: string;
  action?: "select" | "insert" | "update" | "upsert" | "delete";
  allowed_columns?: {
    read?: string[];
    write?: string[];
  };
  restricted_columns?: string[];
  required_columns?: string[];
  default_values?: Record<string, unknown>;
  post_insert_action?: string;
  // HTTP handler
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  // Workflow handler
  emit_event?: string;
  target_queue?: string;
  // Search
  search_column?: string;
  max_results?: number;
};

export type Tool = {
  id: string;
  key: string;
  name: string;
  category: string | null;
  description: string | null;
  schema: ToolSchema;
  handler_type: ToolHandlerType;
  handler_config: ToolHandlerConfig;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AgentTool = {
  id: string;
  agent_id: string;
  tool_id: string;
  is_enabled: boolean;
  overrides: Record<string, unknown>;
  created_at: string;
  tool?: Tool; // populated via join
};

export type ToolLog = {
  id: string;
  agent_id: string;
  tool_id: string;
  chat_id: string | null;
  contact_id: string | null;
  action: string;
  table_name: string | null;
  columns_accessed: string[];
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  executed_at: string;
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
  end_at?: string | null;
  created_at?: string | null;
  send_windows?: {
    enabled: boolean;
    timezone?: string;
    weekdays?: Record<string, string[]>; // "1": ["09:00-12:00"] etc
  } | null;
  timezone?: string | null;
  segment_id?: string | null;
}
