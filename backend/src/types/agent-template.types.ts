// backend/src/types/agent-template.types.ts

export interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'CUSTOMER_SERVICE' | 'SALES' | 'SUPPORT' | 'CUSTOM';
  system_prompt: string;
  model_config: ModelConfig;
  behavior_config: BehaviorConfig;
  knowledge_base_config: KnowledgeBaseConfig;
  version: number;
  is_active: boolean;
  is_public: boolean;
  company_id?: string;
  usage_count: number;
  rating?: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  
  // Relações
  tools?: TemplateTool[];
  questions?: AgentTemplateQuestion[];
}

export interface AgentTemplateQuestion {
  id: string;
  template_id: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'multiselect';
  required: boolean;
  help?: string;
  options?: any[];
  order_index: number;
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
}

export interface BehaviorConfig {
  tone?: 'PROFESSIONAL' | 'FRIENDLY' | 'CASUAL' | 'TECHNICAL';
  max_conversation_length?: number;
  auto_escalation?: boolean;
  escalation_keywords?: string[];
  forbidden_words?: string[];
  rate_limit?: number;
}

export interface KnowledgeBaseConfig {
  default_documents?: string[];
  default_urls?: string[];
  context_limit?: number;
}

export interface TemplateTool {
  template_id: string;
  tool_id: string;
  required: boolean;
  overrides: Record<string, any>;
  tool?: Tool;
}

export interface Tool {
  id: string;
  key: string;
  name: string;
  category?: string;
  description?: string;
  schema: Record<string, any>;
  handler_type: 'INTERNAL_DB' | 'HTTP' | 'WORKFLOW' | 'SOCKET';
  handler_config: Record<string, any>;
  is_active: boolean;
  company_id?: string;
  icon?: string;
  color?: string;
  requires_auth: boolean;
  usage_count: number;
  avg_execution_time_ms?: number;
  success_rate?: number;
  created_at: Date;
  updated_at?: Date;
}

export interface TemplateTest {
  id: string;
  template_id: string;
  version?: number;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | string;
  results?: any;
  metrics?: any;
  duration_ms?: number;
  created_by?: string | null;
  tester_id?: string;
  test_name?: string;
  test_scenario?: string;
  test_messages?: TestMessage[];
  agent_responses?: TestMessage[];
  execution_time_ms?: number;
  validations?: ValidationRule[];
  validation_results?: ValidationResult[];
  total_tokens?: number;
  total_cost?: number;
  tools_called?: string[];
  manual_score?: number;
  manual_notes?: string;
  created_at: Date;
}

export interface TestMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface TestScenario {
  id: string;
  name: string;
  description?: string | null;
  template_id?: string | null;
  input_data?: any;
  expected_output?: any;
  category: 'GREETING' | 'FAQ' | 'COMPLAINT' | 'COMPLEX_QUERY' | string;
  messages?: TestMessage[];
  expected_behavior?: string;
  validation_rules?: ValidationRule[];
  difficulty_level?: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  is_public?: boolean;
  company_id?: string;
  created_by?: string;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface ValidationRule {
  type: 'CONTAINS' | 'LENGTH' | 'SENTIMENT' | 'TOOL_USAGE' | 'RESPONSE_TIME' | 'CUSTOM';
  params: Record<string, any>;
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface TemplateValidation {
  id: string;
  template_id: string;
  version?: number;
  validator_id?: string;
  validation_type?: 'PROMPT_QUALITY' | 'TOOL_COMPATIBILITY' | 'PERFORMANCE' | 'SAFETY';
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'WARNING' | string;
  score?: number;
  issues?: ValidationIssue[];
  suggestions?: string[];
  details?: Record<string, any>;
  feedback?: string | null;
  results?: any;
  validated_by?: string | null;
  validated_at?: Date;
  created_at?: Date;
}

export interface ValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  field?: string;
  suggestion?: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  config: Record<string, any>;
  changes_summary?: string;
  changed_fields?: string[];
  created_by?: string;
  created_at: Date;
}

export interface ToolTest {
  id: string;
  tool_id: string;
  tester_id: string;
  test_name: string;
  test_input: Record<string, any>;
  expected_output?: Record<string, any>;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';
  actual_output?: Record<string, any>;
  error_message?: string;
  execution_time_ms?: number;
  validation_passed?: boolean;
  validation_details?: Record<string, any>;
  created_at: Date;
}
