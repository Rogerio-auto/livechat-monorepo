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

export interface Tool {
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
}

export interface AgentTool {
  id: string;
  agent_id: string;
  tool_id: string;
  is_enabled: boolean;
  overrides: Record<string, unknown>;
  created_at: string;
}

export interface ToolLog {
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
}

export interface CreateToolDTO extends Omit<Tool, "id" | "created_at" | "updated_at"> {}

export interface UpdateToolDTO extends Partial<CreateToolDTO> {}

export interface ToolStats {
  tool_id: string;
  total_calls: number;
  error_count: number;
  avg_latency_ms: number;
  last_executed_at?: string | Date | null;
  updated_at: string | Date;
}

export interface ToolTest {
  id: string;
  tool_id: string;
  tester_id: string;
  test_name: string;
  test_input: any;
  expected_output?: any;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';
  actual_output?: any;
  error_message?: string;
  execution_time_ms?: number;
  validation_passed?: boolean;
  validation_details?: any;
  created_at: string | Date;
}
