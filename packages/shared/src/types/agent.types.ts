export type AgentStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED" | "ERROR";

export interface AgentModelParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface AgentMediaConfig {
  vision_model?: string;
  transcription_model?: string;
}

export interface Agent {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  integration_openai_id: string | null;
  model: string | null;
  model_params: AgentModelParams | null;
  aggregation_enabled: boolean;
  aggregation_window_sec: number | null;
  max_batch_messages: number | null;
  reply_if_idle_sec: number | null;
  media_config: AgentMediaConfig | null;
  tools_policy: Record<string, any> | null;
  allow_handoff: boolean;
  ignore_group_messages: boolean;
  enabled_inbox_ids: string[];
  transcription_model: string | null;
  vision_model: string | null;
  api_token: string | null;
  created_at: string;
  updated_at: string | null;
}

// Aliases para compatibilidade com o frontend legado
export type AutomationAgent = Agent;
export type AutomationAgentPayload = CreateAgentDTO;

export interface KnowledgeDocument {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  status: 'PROCESSING' | 'READY' | 'ERROR';
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens_used?: number;
  cost?: number;
  feedback?: 'positive' | 'negative' | null;
}

export interface Conversation {
  id: string;
  agent_id: string;
  customer_id?: string;
  started_at: string;
  ended_at?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'ESCALATED';
  messages: ConversationMessage[];
  total_tokens: number;
  total_cost: number;
  user_satisfaction?: number; // 1-5
  error_count: number;
}

export interface AgentMetrics {
  agent_id: string;
  period: 'hour' | 'day' | 'week' | 'month';
  
  // Métricas de uso
  total_conversations: number;
  active_conversations: number;
  avg_response_time_ms: number;
  
  // Métricas de qualidade
  success_rate: number;
  escalation_rate: number;
  avg_satisfaction: number;
  
  // Métricas de erro
  error_rate: number;
  timeout_count: number;
  api_errors: number;
  
  // Métricas de custo
  total_tokens: number;
  total_cost: number;
  avg_cost_per_conversation: number;
}

export interface CreateAgentDTO {
  name: string;
  company_id?: string;
  description?: string | null;
  status?: AgentStatus;
  integration_openai_id?: string | null;
  model?: string | null;
  model_params?: AgentModelParams | null;
  aggregation_enabled?: boolean;
  aggregation_window_sec?: number | null;
  max_batch_messages?: number | null;
  reply_if_idle_sec?: number | null;
  media_config?: AgentMediaConfig | null;
  tools_policy?: Record<string, any> | null;
  allow_handoff?: boolean;
  ignore_group_messages?: boolean;
  enabled_inbox_ids?: string[];
  transcription_model?: string | null;
  vision_model?: string | null;
}

export interface UpdateAgentDTO extends Partial<CreateAgentDTO> {}

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
  tools?: any[]; // Adicionado para otimização

  // Aliases para o frontend
  prompt?: string;
  model?: string;
  model_params?: Record<string, unknown>;
};

export type AgentTemplatePreview = AgentTemplate;

export type AgentTemplateQuestion = {
  id: string;
  template_id: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "boolean" | "multiselect" | "string";
  required: boolean;
  help?: string | null;
  description?: string | null;
  placeholder?: string | null;
  options?: unknown[];
  order_index: number;
};
